import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../logger.js";

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
  metadata?: Record<string, unknown>;
}

interface KnownAgent {
  name: string;
  // Match against the COMMAND column or full COMMAND+ARGS
  processMatch: string | RegExp;
  available_actions: string[];
}

const KNOWN_AGENTS: KnownAgent[] = [
  {
    name: "openclaw-gateway",
    processMatch: "openclaw-gateway",
    available_actions: ["service.restart"],
  },
  {
    name: "openclaw-nodes",
    processMatch: "openclaw-nodes",
    available_actions: ["service.restart"],
  },
  {
    name: "codex",
    processMatch: /\bcodex\b/,
    available_actions: ["service.restart"],
  },
  {
    name: "convex_realtime_daemon",
    processMatch: "convex_realtime_daemon.py",
    available_actions: ["service.restart"],
  },
  {
    name: "ollama",
    processMatch: /ollama\s+(serve|server)/,
    available_actions: ["service.restart"],
  },
];

interface PsProcess {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  tty: string;
  stat: string;
  start: string;
  time: string;
  command: string;
}

function parsePsAux(output: string): PsProcess[] {
  const lines = output.split("\n");
  // Skip header line
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);

  return dataLines.map((line) => {
    // ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
    const parts = line.trim().split(/\s+/);
    return {
      user: parts[0] ?? "",
      pid: parseInt(parts[1] ?? "0", 10),
      cpu: parseFloat(parts[2] ?? "0"),
      mem: parseFloat(parts[3] ?? "0"),
      vsz: parseInt(parts[4] ?? "0", 10),
      rss: parseInt(parts[5] ?? "0", 10),
      tty: parts[6] ?? "",
      stat: parts[7] ?? "",
      start: parts[8] ?? "",
      time: parts[9] ?? "",
      // Everything from index 10 onwards is the command
      command: parts.slice(10).join(" "),
    };
  });
}

/**
 * Parse elapsed time from `ps` TIME field (format: [[DD-]HH:]MM:SS) to seconds.
 */
function parseElapsedTime(timeStr: string): number {
  try {
    // Handle DD-HH:MM:SS format
    let days = 0;
    let remaining = timeStr;

    if (remaining.includes("-")) {
      const [dayPart, rest] = remaining.split("-");
      days = parseInt(dayPart ?? "0", 10);
      remaining = rest ?? "";
    }

    const parts = remaining.split(":").map((p) => parseInt(p, 10));

    if (parts.length === 3) {
      const [h, m, s] = parts;
      return (
        days * 86400 +
        (h ?? 0) * 3600 +
        (m ?? 0) * 60 +
        (s ?? 0)
      );
    } else if (parts.length === 2) {
      const [m, s] = parts;
      return days * 86400 + (m ?? 0) * 60 + (s ?? 0);
    }

    return 0;
  } catch {
    return 0;
  }
}

function matchesAgent(process: PsProcess, agent: KnownAgent): boolean {
  const fullCmd = `${process.command}`;
  const match = agent.processMatch;

  if (typeof match === "string") {
    return fullCmd.includes(match) || process.command.includes(match);
  } else {
    return match.test(fullCmd);
  }
}

export async function collectAgents(): Promise<AgentStatus[]> {
  let processes: PsProcess[] = [];

  try {
    const { stdout } = await execAsync("ps aux");
    processes = parsePsAux(stdout);
  } catch (err) {
    logger.warn("Failed to run ps aux for agent detection", {
      error: String(err),
    });
    // Return all agents as unknown
    return KNOWN_AGENTS.map((agent) => ({
      name: agent.name,
      status: "unknown" as const,
      cpu: 0,
      memory: 0,
      uptime_seconds: 0,
      last_seen: Date.now(),
      detection_source: "process" as const,
      available_actions: agent.available_actions,
    }));
  }

  const results: AgentStatus[] = [];

  for (const knownAgent of KNOWN_AGENTS) {
    const matchingProcesses = processes.filter((p) =>
      matchesAgent(p, knownAgent)
    );

    if (matchingProcesses.length === 0) {
      results.push({
        name: knownAgent.name,
        status: "stopped",
        cpu: 0,
        memory: 0,
        uptime_seconds: 0,
        last_seen: Date.now(),
        detection_source: "process",
        available_actions: knownAgent.available_actions,
      });
    } else {
      // Use the first matching process (main process)
      const proc = matchingProcesses[0]!;

      // RSS is in KB in ps aux output
      const memoryBytes = proc.rss * 1024;

      const uptime_seconds = parseElapsedTime(proc.time);

      results.push({
        name: knownAgent.name,
        pid: proc.pid,
        status: "running",
        cpu: proc.cpu,
        memory: memoryBytes,
        uptime_seconds,
        last_seen: Date.now(),
        detection_source: "process",
        available_actions: knownAgent.available_actions,
        metadata:
          matchingProcesses.length > 1
            ? { process_count: matchingProcesses.length }
            : undefined,
      });
    }
  }

  return results;
}
