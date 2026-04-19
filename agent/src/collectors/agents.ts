import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../logger.js";
import type { AgentMetadata } from "../../../packages/contracts/index.js";

const execAsync = promisify(exec);

export interface AgentStatus {
  name: string;
  pid?: number;
  status: "running" | "stopped" | "unknown";
  cpu: number;
  memory: number;
  uptime_seconds: number;
  last_seen: number;
  detection_source: "process" | "container" | "systemd" | "pidfile";
  available_actions: string[];
  metadata?: AgentMetadata;
}

interface KnownAgent {
  name: string;
  processMatch: string | RegExp;
  serviceCandidates?: string[];
}

const KNOWN_AGENTS: KnownAgent[] = [
  {
    name: "openclaw-gateway",
    processMatch: "openclaw-gateway",
    serviceCandidates: ["openclaw-gateway.service", "openclaw-gateway"],
  },
  {
    name: "openclaw-nodes",
    processMatch: "openclaw-nodes",
    serviceCandidates: ["openclaw-nodes.service", "openclaw-nodes"],
  },
  {
    name: "codex",
    processMatch: /\bcodex\b/,
  },
  {
    name: "convex_realtime_daemon",
    processMatch: "convex_realtime_daemon.py",
    serviceCandidates: [
      "convex-realtime-daemon.service",
      "convex_realtime_daemon.service",
      "convex_realtime_daemon",
    ],
  },
  {
    name: "ollama",
    processMatch: /ollama\s+(serve|server)/,
    serviceCandidates: ["ollama.service", "ollama"],
  },
];

interface PsProcess {
  pid: number;
  elapsed: number;
  cpu: number;
  rss: number;
  command: string;
}

function parsePsOutput(output: string): PsProcess[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+([0-9.]+)\s+([0-9]+)\s+(.*)$/);
      if (!match) {
        return [];
      }

      return [
        {
          pid: parseInt(match[1] ?? "0", 10),
          elapsed: parseInt(match[2] ?? "0", 10),
          cpu: parseFloat(match[3] ?? "0"),
          rss: parseInt(match[4] ?? "0", 10),
          command: match[5] ?? "",
        },
      ];
    });
}

function parseSystemdUnits(output: string): Set<string> {
  const services = new Set<string>();

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const unit = line.split(/\s+/)[0];
    if (unit) {
      services.add(unit);
    }
  }

  return services;
}

function matchesAgent(process: PsProcess, agent: KnownAgent): boolean {
  const fullCmd = process.command;
  const match = agent.processMatch;

  if (typeof match === "string") {
    return fullCmd.includes(match);
  }

  return match.test(fullCmd);
}

function resolveServiceName(agent: KnownAgent, systemdUnits: Set<string>): string | undefined {
  const candidates = agent.serviceCandidates ?? [];

  for (const candidate of candidates) {
    if (systemdUnits.has(candidate)) {
      return candidate;
    }

    if (candidate.endsWith(".service")) {
      const shortName = candidate.slice(0, -".service".length);
      if (systemdUnits.has(shortName)) {
        return shortName;
      }
    }
  }

  return undefined;
}

function buildAgentMetadata(
  serviceName: string | undefined,
  processCount: number
): AgentMetadata | undefined {
  if (!serviceName && processCount <= 1) {
    return undefined;
  }

  return {
    ...(serviceName
      ? {
          service_name: serviceName,
          command_targets: {
            service: serviceName,
          },
        }
      : {}),
    ...(processCount > 1 ? { process_count: processCount } : {}),
  };
}

export async function collectAgents(): Promise<AgentStatus[]> {
  let processes: PsProcess[] = [];
  let systemdUnits = new Set<string>();

  try {
    const { stdout } = await execAsync(
      "ps -eo pid=,etimes=,pcpu=,rss=,args="
    );
    processes = parsePsOutput(stdout);
  } catch (err) {
    logger.warn("Failed to run ps for agent detection", {
      error: String(err),
    });
  }

  try {
    const { stdout } = await execAsync(
      "systemctl list-unit-files --type=service --no-legend --plain --no-pager"
    );
    systemdUnits = parseSystemdUnits(stdout);
  } catch (err) {
    logger.warn("Failed to list systemd services for agent actions", {
      error: String(err),
    });
  }

  const results: AgentStatus[] = [];
  const now = Date.now();

  for (const knownAgent of KNOWN_AGENTS) {
    const matchingProcesses = processes.filter((p) =>
      matchesAgent(p, knownAgent)
    );
    const serviceName = resolveServiceName(knownAgent, systemdUnits);
    const availableActions = serviceName ? ["service.restart"] : [];
    const metadata = buildAgentMetadata(serviceName, matchingProcesses.length);

    if (matchingProcesses.length === 0) {
      results.push({
        name: knownAgent.name,
        status: processes.length === 0 ? "unknown" : "stopped",
        cpu: 0,
        memory: 0,
        uptime_seconds: 0,
        last_seen: now,
        detection_source: "process",
        available_actions: availableActions,
        metadata,
      });
    } else {
      const proc = matchingProcesses[0]!;
      const memoryBytes = proc.rss * 1024;

      results.push({
        name: knownAgent.name,
        pid: proc.pid,
        status: "running",
        cpu: proc.cpu,
        memory: memoryBytes,
        uptime_seconds: proc.elapsed,
        last_seen: now,
        detection_source: "process",
        available_actions: availableActions,
        metadata,
      });
    }
  }

  return results;
}
