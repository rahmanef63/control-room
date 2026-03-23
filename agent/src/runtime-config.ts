import fs from "fs";
import path from "path";

import type {
  RuntimeAgentProfile,
  RuntimeConfig,
  RuntimeEnvironment,
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
  TerminalProfile,
} from "./terminal/types.js";

const DEFAULT_CONFIG_PATH =
  process.env["CONTROL_ROOM_CONFIG_PATH"] ||
  path.resolve(process.cwd(), "../config/control-room.runtime.json");

const DEFAULT_CONFIG: RuntimeConfig = {
  environments: [
    {
      id: "host-default",
      label: "Host Default",
      description: "Main host workspace for the control room and general VPS operations.",
      cwd: "/home/rahman/projects/vps-rahmanef",
      envText:
        "CONTROL_ROOM_DOMAIN=vps.rahmanef.com\nCONTROL_ROOM_ACCESS_MODE=tailscale-only\nWORKSPACE_ROOT=/home/rahman/projects",
      tags: ["host", "default", "ops"],
    },
  ],
  agentProfiles: [
    {
      id: "codex-ops",
      label: "Codex Ops",
      description: "Codex terminal tuned for VPS operations and end-to-end fixes.",
      terminalProfile: "codex",
      model: "codex",
      environmentId: "host-default",
      skills: ["skill-coder", "system-check", "dokploy-deploy"],
    },
  ],
};

const TERMINAL_PROFILES = new Set<TerminalProfile>([
  "shell",
  "codex",
  "claude",
  "gemini",
  "openclaw",
]);

function ensureString(input: unknown, fallback = ""): string {
  return typeof input === "string" ? input : fallback;
}

function ensureStringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeEnvironment(input: unknown, index: number): RuntimeEnvironment {
  const record = typeof input === "object" && input ? (input as Record<string, unknown>) : {};

  return {
    id: ensureString(record.id, `env-${index + 1}`),
    label: ensureString(record.label, `Environment ${index + 1}`),
    description: ensureString(record.description),
    cwd: ensureString(record.cwd, "/home/rahman"),
    envText: ensureString(record.envText),
    tags: ensureStringArray(record.tags),
  };
}

function normalizeAgentProfile(input: unknown, index: number): RuntimeAgentProfile {
  const record = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  const terminalProfile = ensureString(record.terminalProfile, "shell") as TerminalProfile;

  return {
    id: ensureString(record.id, `agent-${index + 1}`),
    label: ensureString(record.label, `Agent ${index + 1}`),
    description: ensureString(record.description),
    terminalProfile: TERMINAL_PROFILES.has(terminalProfile) ? terminalProfile : "shell",
    model: ensureString(record.model, "custom"),
    environmentId: ensureString(record.environmentId) || undefined,
    skills: ensureStringArray(record.skills),
    launchCommand: ensureString(record.launchCommand) || undefined,
  };
}

function decodeDoubleQuoted(input: string): string {
  return input.replace(/\\(.)/g, (_, token: string) => {
    switch (token) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "\\":
        return "\\";
      case '"':
        return '"';
      default:
        return token;
    }
  });
}

export function parseEnvironmentText(envText: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Invalid environment entry: ${rawLine}`);
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const rawValue = normalized.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment key: ${key}`);
    }

    let value = rawValue;
    if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
      value = decodeDoubleQuoted(rawValue.slice(1, -1));
    } else if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
      value = rawValue.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function normalizeRuntimeConfig(input: unknown): RuntimeConfig {
  const record = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  const environments = Array.isArray(record.environments)
    ? record.environments.map((entry, index) => normalizeEnvironment(entry, index))
    : DEFAULT_CONFIG.environments;
  const agentProfiles = Array.isArray(record.agentProfiles)
    ? record.agentProfiles.map((entry, index) => normalizeAgentProfile(entry, index))
    : DEFAULT_CONFIG.agentProfiles;

  return { environments, agentProfiles };
}

function ensureConfigFileExists(): void {
  if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
    return;
  }

  fs.mkdirSync(path.dirname(DEFAULT_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(DEFAULT_CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
}

export function readRuntimeConfig(): RuntimeConfig {
  ensureConfigFileExists();
  const raw = fs.readFileSync(DEFAULT_CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return normalizeRuntimeConfig(parsed);
}

export function listEnvironmentSummaries(
  config = readRuntimeConfig()
): RuntimeEnvironmentSummary[] {
  return config.environments.map((environment) => {
    const env = parseEnvironmentText(environment.envText);
    return {
      ...environment,
      envVarCount: Object.keys(env).length,
      envKeys: Object.keys(env),
    };
  });
}

export function listResolvedAgentProfiles(
  config = readRuntimeConfig()
): RuntimeResolvedAgentProfile[] {
  const environmentMap = new Map(config.environments.map((environment) => [environment.id, environment]));
  return config.agentProfiles.map((profile) => ({
    ...profile,
    environmentLabel: profile.environmentId
      ? environmentMap.get(profile.environmentId)?.label
      : undefined,
  }));
}
