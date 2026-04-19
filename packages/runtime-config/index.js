import fs from "fs";
import path from "path";

import { TERMINAL_PROFILE_VALUES } from "../contracts/index.js";

export const DEFAULT_RUNTIME_CONFIG = {
  environments: [
    {
      id: "host-default",
      label: "Host Default",
      description: "Main host workspace for the control room and general VPS operations.",
      cwd: "/opt/vps-control-room",
      envText:
        "CONTROL_ROOM_ACCESS_MODE=tailscale-only\nWORKSPACE_ROOT=/opt",
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

const VALID_TERMINAL_PROFILES = new Set(TERMINAL_PROFILE_VALUES);

function ensureString(input, fallback = "") {
  return typeof input === "string" ? input : fallback;
}

function ensureStringArray(input) {
  return Array.isArray(input)
    ? input.filter((item) => typeof item === "string")
    : [];
}

function normalizeEnvironment(input, index) {
  const record = typeof input === "object" && input ? input : {};

  return {
    id: ensureString(record.id, `env-${index + 1}`),
    label: ensureString(record.label, `Environment ${index + 1}`),
    description: ensureString(record.description),
    cwd: ensureString(record.cwd, process.env.HOME ?? "/opt"),
    envText: ensureString(record.envText),
    tags: ensureStringArray(record.tags),
  };
}

function normalizeAgentProfile(input, index) {
  const record = typeof input === "object" && input ? input : {};
  const terminalProfile = ensureString(record.terminalProfile, "shell");

  return {
    id: ensureString(record.id, `agent-${index + 1}`),
    label: ensureString(record.label, `Agent ${index + 1}`),
    description: ensureString(record.description),
    terminalProfile: VALID_TERMINAL_PROFILES.has(terminalProfile)
      ? terminalProfile
      : "shell",
    model: ensureString(record.model, "custom"),
    environmentId: ensureString(record.environmentId) || undefined,
    skills: ensureStringArray(record.skills),
    launchCommand: ensureString(record.launchCommand) || undefined,
  };
}

function decodeDoubleQuoted(input) {
  return input.replace(/\\(.)/g, (_, token) => {
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

function resolveProjectRoot() {
  const cwd = process.cwd();
  const directConfigDir = path.join(cwd, "config");
  if (fs.existsSync(directConfigDir)) {
    return cwd;
  }

  const parent = path.resolve(cwd, "..");
  const parentConfigDir = path.join(parent, "config");
  if (fs.existsSync(parentConfigDir)) {
    return parent;
  }

  return parent;
}

function ensureConfigFileExists(configPath) {
  if (fs.existsSync(configPath)) {
    return;
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_RUNTIME_CONFIG, null, 2));
}

export function getDefaultRuntimeConfigPath() {
  if (process.env.CONTROL_ROOM_CONFIG_PATH) {
    return process.env.CONTROL_ROOM_CONFIG_PATH;
  }

  return path.join(resolveProjectRoot(), "config", "control-room.runtime.json");
}

export function getRuntimeConfigPath(options = {}) {
  return options.configPath || getDefaultRuntimeConfigPath();
}

export function parseEnvironmentText(envText) {
  const parsed = {};

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

export function normalizeRuntimeConfig(input) {
  const record = typeof input === "object" && input ? input : {};
  const environments = Array.isArray(record.environments)
    ? record.environments.map((entry, index) => normalizeEnvironment(entry, index))
    : DEFAULT_RUNTIME_CONFIG.environments;
  const agentProfiles = Array.isArray(record.agentProfiles)
    ? record.agentProfiles.map((entry, index) => normalizeAgentProfile(entry, index))
    : DEFAULT_RUNTIME_CONFIG.agentProfiles;

  return { environments, agentProfiles };
}

export function readRuntimeConfig(options = {}) {
  const configPath = getRuntimeConfigPath(options);
  ensureConfigFileExists(configPath);

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeRuntimeConfig(parsed);
}

export function writeRuntimeConfig(input, options = {}) {
  const normalized = normalizeRuntimeConfig(input);
  const configPath = getRuntimeConfigPath(options);

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(normalized, null, 2)}\n`);

  return normalized;
}

export function listEnvironmentSummaries(config = readRuntimeConfig()) {
  return config.environments.map((environment) => {
    const parsedEnv = parseEnvironmentText(environment.envText);
    return {
      ...environment,
      envVarCount: Object.keys(parsedEnv).length,
      envKeys: Object.keys(parsedEnv),
    };
  });
}

export function listResolvedAgentProfiles(config = readRuntimeConfig()) {
  const environmentMap = new Map(
    config.environments.map((environment) => [environment.id, environment]),
  );

  return config.agentProfiles.map((profile) => ({
    ...profile,
    environmentLabel: profile.environmentId
      ? environmentMap.get(profile.environmentId)?.label
      : undefined,
  }));
}

export function buildRuntimeConfigResponse(
  config = readRuntimeConfig(),
  options = {},
) {
  return {
    config,
    environments: listEnvironmentSummaries(config),
    agentProfiles: listResolvedAgentProfiles(config),
    configPath: getRuntimeConfigPath(options),
  };
}
