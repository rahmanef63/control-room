import type { MutationCtx, QueryCtx } from "../_generated/server";
import { agentStatusFields } from "../lib/validators";

export interface UpsertAgentStatusArgs {
  name: string;
  pid?: number;
  status: "running" | "stopped" | "unknown";
  cpu: number;
  memory: number;
  uptime_seconds: number;
  last_seen: number;
  detection_source: "process" | "container" | "systemd" | "pidfile";
  available_actions: string[];
  metadata?: unknown;
}

export async function upsertAgentStatusHandler(
  ctx: MutationCtx,
  args: UpsertAgentStatusArgs
) {
  const existing = await ctx.db
    .query("agent_status")
    .withIndex("by_name", (q) => q.eq("name", args.name))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      pid: args.pid,
      status: args.status,
      cpu: args.cpu,
      memory: args.memory,
      uptime_seconds: args.uptime_seconds,
      last_seen: args.last_seen,
      detection_source: args.detection_source,
      available_actions: args.available_actions,
      metadata: args.metadata,
    });
    return existing._id;
  }

  return await ctx.db.insert("agent_status", {
    name: args.name,
    pid: args.pid,
    status: args.status,
    cpu: args.cpu,
    memory: args.memory,
    uptime_seconds: args.uptime_seconds,
    last_seen: args.last_seen,
    detection_source: args.detection_source,
    available_actions: args.available_actions,
    metadata: args.metadata,
  });
}

export async function listAgentsHandler(ctx: QueryCtx) {
  return await ctx.db.query("agent_status").collect();
}
