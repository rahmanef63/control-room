#!/usr/bin/env node
import { ConvexHttpClient } from "convex/browser";

interface CommandArgs {
  _: string[];
  flags: Record<string, string | boolean>;
}

type CmdStatus = "queued" | "running" | "success" | "failed" | "cancelled" | "timeout";

type TargetType = "container" | "service" | "agent" | "dokploy-app" | "fail2ban";

interface CommandRecord {
  _id: string;
  request_id: string;
  action: string;
  target_type: TargetType;
  target_id: string;
  status: CmdStatus;
  requested_by: string;
  requested_at: number;
  result?: string;
  error?: string;
}

function parseArgv(argv: string[]): CommandArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith("--")) {
      positional.push(part);
      continue;
    }

    const key = part.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }

  return { _: positional, flags };
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usage(): void {
  console.log(`vpsctl - VPS Control Room terminal client\n
Required env:
  CONVEX_URL
  CONVEX_ADMIN_KEY

Commands:
  vpsctl status
  vpsctl apps list
  vpsctl agents list
  vpsctl events list [--limit 20]
  vpsctl action run <action> --target-type <type> --target-id <id> [--lines 100] [--wait]
  vpsctl commands list [--limit 20]
  vpsctl tui [--interval 3]

Examples:
  vpsctl status
  vpsctl action run container.restart --target-type container --target-id n8n --wait
  vpsctl action run container.logs --target-type container --target-id n8n --lines 200 --wait
  vpsctl tui --interval 2
`);
}

async function createClient(): Promise<ConvexHttpClient> {
  const client = new ConvexHttpClient(getEnv("CONVEX_URL"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).setAdminAuth(getEnv("CONVEX_ADMIN_KEY"));
  return client;
}

async function query<T>(client: ConvexHttpClient, name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (client as any).query(name, args)) as T;
}

async function mutation<T>(client: ConvexHttpClient, name: string, args: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (client as any).mutation(name, args)) as T;
}

async function cmdStatus(client: ConvexHttpClient): Promise<void> {
  const overview = await query<{ snapshot: null | { cpu_total: number; ram_used: number; ram_total: number; uptime_seconds: number }; active_alert_count: number; app_count: number; agent_count: number }>(
    client,
    "snapshots:getOverview",
    {}
  );

  if (!overview.snapshot) {
    console.log("No system snapshot available yet.");
    return;
  }

  const ramPct = overview.snapshot.ram_total > 0
    ? ((overview.snapshot.ram_used / overview.snapshot.ram_total) * 100).toFixed(1)
    : "0.0";

  console.log("=== VPS STATUS ===");
  console.log(`CPU: ${overview.snapshot.cpu_total.toFixed(1)}%`);
  console.log(`RAM: ${ramPct}%`);
  console.log(`Uptime(s): ${Math.round(overview.snapshot.uptime_seconds)}`);
  console.log(`Apps: ${overview.app_count}`);
  console.log(`Agents: ${overview.agent_count}`);
  console.log(`Active alerts: ${overview.active_alert_count}`);
}

async function cmdAppsList(client: ConvexHttpClient): Promise<void> {
  const apps = await query<Array<{ name: string; runtime_status: string; health_status: string; source: string; last_seen: number }>>(
    client,
    "appStatus:listApps",
    {}
  );

  const rows = apps
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({
      name: a.name,
      runtime: a.runtime_status,
      health: a.health_status,
      source: a.source,
      last_seen: new Date(a.last_seen).toISOString(),
    }));

  console.table(rows);
}

async function cmdAgentsList(client: ConvexHttpClient): Promise<void> {
  const agents = await query<Array<{ name: string; status: string; pid?: number; cpu: number; uptime_seconds: number }>>(
    client,
    "agentStatus:listAgents",
    {}
  );

  const rows = agents
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({
      name: a.name,
      status: a.status,
      pid: a.pid ?? "-",
      cpu: `${a.cpu.toFixed(1)}%`,
      uptime_s: Math.round(a.uptime_seconds),
    }));

  console.table(rows);
}

async function cmdEventsList(client: ConvexHttpClient, limit: number): Promise<void> {
  const events = await query<{ page: Array<{ timestamp: number; severity: string; type: string; source: string; message: string }> }>(
    client,
    "events:listEvents",
    {
      paginationOpts: { cursor: null, numItems: limit },
    }
  );

  for (const event of events.page) {
    const ts = new Date(event.timestamp).toISOString();
    console.log(`[${ts}] ${event.severity.toUpperCase()} ${event.type} (${event.source}) ${event.message}`);
  }
}

async function cmdCommandsList(client: ConvexHttpClient, limit: number): Promise<void> {
  const commands = await query<{ page: CommandRecord[] }>(client, "commands:listCommands", {
    paginationOpts: { cursor: null, numItems: limit },
  });

  console.table(
    commands.page.map((c) => ({
      request_id: c.request_id,
      action: c.action,
      target: c.target_id,
      status: c.status,
      by: c.requested_by,
      requested_at: new Date(c.requested_at).toISOString(),
    }))
  );
}

async function waitForCommand(client: ConvexHttpClient, requestId: string, timeoutMs = 30000): Promise<CommandRecord | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const commands = await query<{ page: CommandRecord[] }>(client, "commands:listCommands", {
      paginationOpts: { cursor: null, numItems: 50 },
    });

    const match = commands.page.find((c) => c.request_id === requestId);
    if (match && ["success", "failed", "cancelled", "timeout"].includes(match.status)) {
      return match;
    }

    await sleep(1000);
  }

  return null;
}

async function cmdActionRun(client: ConvexHttpClient, args: CommandArgs): Promise<void> {
  const action = args._[2];
  if (!action) {
    throw new Error("Missing action. Usage: vpsctl action run <action> --target-type <type> --target-id <id>");
  }

  const targetType = String(args.flags["target-type"] ?? "").trim() as TargetType;
  const targetId = String(args.flags["target-id"] ?? "").trim();
  const lines = args.flags.lines !== undefined ? Number(args.flags.lines) : undefined;
  const wait = Boolean(args.flags.wait);

  if (!targetType) throw new Error("--target-type is required");
  if (!targetId) throw new Error("--target-id is required");

  const payload: Record<string, unknown> = {};
  if (action === "container.logs") {
    payload.lines = Number.isFinite(lines) ? lines : 100;
  }

  await mutation<string>(client, "commands:enqueueCommand", {
    action,
    target_type: targetType,
    target_id: targetId,
    requested_by: "manual-cli",
    ...(Object.keys(payload).length > 0 ? { payload } : {}),
  });

  console.log(`Queued ${action} on ${targetType}:${targetId} (requested_by=manual-cli)`);

  if (wait) {
    console.log("Waiting for completion...");

    const recent = await query<{ page: CommandRecord[] }>(client, "commands:listCommands", {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    const queued = recent.page.find((c) => c.action === action && c.target_id === targetId && c.requested_by === "manual-cli");

    if (!queued) {
      console.log("Queued command not found in recent list yet.");
      return;
    }

    const done = await waitForCommand(client, queued.request_id, 60000);
    if (!done) {
      console.log("Timed out while waiting for command result.");
      return;
    }

    console.log(`Final status: ${done.status}`);
    if (done.result) console.log(done.result);
    if (done.error) console.error(done.error);
  }
}

function clearScreen(): void {
  process.stdout.write("\x1Bc");
}

async function cmdTui(client: ConvexHttpClient, intervalSec: number): Promise<void> {
  // Simple terminal dashboard loop (lightweight TUI)
  while (true) {
    const [overview, apps, agents, events] = await Promise.all([
      query<{ snapshot: null | { cpu_total: number; ram_used: number; ram_total: number; uptime_seconds: number }; active_alert_count: number; app_count: number; agent_count: number }>(client, "snapshots:getOverview", {}),
      query<Array<{ name: string; runtime_status: string; health_status: string }>>(client, "appStatus:listApps", {}),
      query<Array<{ name: string; status: string; cpu: number }>>(client, "agentStatus:listAgents", {}),
      query<{ page: Array<{ timestamp: number; severity: string; message: string }> }>(client, "events:listEvents", {
        paginationOpts: { cursor: null, numItems: 5 },
      }),
    ]);

    clearScreen();
    console.log(`VPS Control Room TUI  |  ${new Date().toISOString()}\n`);

    if (overview.snapshot) {
      const ramPct = overview.snapshot.ram_total > 0
        ? ((overview.snapshot.ram_used / overview.snapshot.ram_total) * 100).toFixed(1)
        : "0.0";
      console.log(`CPU: ${overview.snapshot.cpu_total.toFixed(1)}% | RAM: ${ramPct}% | Uptime(s): ${Math.round(overview.snapshot.uptime_seconds)} | Alerts: ${overview.active_alert_count}`);
      console.log(`Apps: ${overview.app_count} | Agents: ${overview.agent_count}\n`);
    } else {
      console.log("No snapshot yet.\n");
    }

    console.log("Apps:");
    for (const app of apps.slice(0, 8)) {
      console.log(`- ${app.name.padEnd(28)} ${app.runtime_status.padEnd(10)} health=${app.health_status}`);
    }

    console.log("\nAgents:");
    for (const agent of agents.slice(0, 8)) {
      console.log(`- ${agent.name.padEnd(28)} ${agent.status.padEnd(10)} cpu=${agent.cpu.toFixed(1)}%`);
    }

    console.log("\nRecent Events:");
    for (const event of events.page) {
      console.log(`- [${new Date(event.timestamp).toISOString()}] ${event.severity.toUpperCase()} ${event.message}`);
    }

    console.log("\nPress Ctrl+C to exit.");

    await sleep(intervalSec * 1000);
  }
}

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2));

  if (args._.length === 0 || args.flags.help) {
    usage();
    return;
  }

  const client = await createClient();

  const [a, b] = args._;

  if (a === "status") {
    await cmdStatus(client);
    return;
  }

  if (a === "apps" && b === "list") {
    await cmdAppsList(client);
    return;
  }

  if (a === "agents" && b === "list") {
    await cmdAgentsList(client);
    return;
  }

  if (a === "events" && b === "list") {
    const limit = Number(args.flags.limit ?? 20);
    await cmdEventsList(client, Number.isFinite(limit) ? limit : 20);
    return;
  }

  if (a === "commands" && b === "list") {
    const limit = Number(args.flags.limit ?? 20);
    await cmdCommandsList(client, Number.isFinite(limit) ? limit : 20);
    return;
  }

  if (a === "action" && b === "run") {
    await cmdActionRun(client, args);
    return;
  }

  if (a === "tui") {
    const interval = Number(args.flags.interval ?? 3);
    await cmdTui(client, Number.isFinite(interval) && interval > 0 ? interval : 3);
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(`[vpsctl] ${String(err)}`);
  process.exit(1);
});
