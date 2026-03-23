import os from "os";

import { parseEnvironmentText, readRuntimeConfig } from "../runtime-config.js";
import type {
  RuntimeAgentProfile,
  RuntimeEnvironment,
  TerminalCreateRequest,
  TerminalProfile,
  TerminalProfileDescriptor,
} from "./types.js";

export interface TerminalLaunchSpec {
  profile: TerminalProfile;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  environment?: RuntimeEnvironment;
  agentProfile?: RuntimeAgentProfile;
}

const DEFAULT_SHELL = process.env["SHELL"] || "/bin/bash";
const DEFAULT_CWD =
  process.env["TERMINAL_DEFAULT_CWD"] || `/home/${os.userInfo().username}`;

function shellEscapeSingle(input: string): string {
  return input.replace(/'/g, `'\\''`);
}

function missingBinaryFallback(binary: string): string {
  const safeBinary = shellEscapeSingle(binary);
  const safeShell = shellEscapeSingle(DEFAULT_SHELL);
  return `printf '\\r\\n[%s] is not installed on this VPS. Dropping into a shell.\\r\\n' '${safeBinary}'; exec '${safeShell}' -li`;
}

function interactiveBinaryCommand(binary: string, args: string[] = []): string {
  const safeBinary = shellEscapeSingle(binary);
  const command = [safeBinary, ...args.map(shellEscapeSingle)].join(" ");
  return [
    `if command -v '${safeBinary}' >/dev/null 2>&1; then`,
    `  exec ${command};`,
    "else",
    `  ${missingBinaryFallback(binary)};`,
    "fi",
  ].join(" ");
}

function resolveLaunchCommand(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) {
    return interactiveBinaryCommand("bash", ["-li"]);
  }

  return [
    `if command -v /bin/bash >/dev/null 2>&1; then`,
    `  exec /bin/bash -lc '${shellEscapeSingle(trimmed)}';`,
    "else",
    `  exec ${trimmed};`,
    "fi",
  ].join(" ");
}

export const TERMINAL_PROFILES: TerminalProfileDescriptor[] = [
  {
    profile: "shell",
    title: "Empty Terminal",
    description: "Interactive login shell on the VPS host.",
  },
  {
    profile: "codex",
    title: "Codex",
    description: "Start a Codex CLI session directly in the terminal.",
  },
  {
    profile: "claude",
    title: "Claude",
    description: "Start a Claude CLI session if the binary is installed.",
  },
  {
    profile: "gemini",
    title: "Gemini",
    description: "Start a Gemini CLI session if the binary is installed.",
  },
  {
    profile: "openclaw",
    title: "OpenClaw TUI",
    description: "Start OpenClaw in interactive mode on the VPS host.",
  },
];

export function resolveTerminalLaunch(request: TerminalCreateRequest): TerminalLaunchSpec {
  const runtimeConfig = readRuntimeConfig();
  const agentProfile = request.agentProfileId
    ? runtimeConfig.agentProfiles.find((entry) => entry.id === request.agentProfileId)
    : undefined;
  if (request.agentProfileId && !agentProfile) {
    throw new Error(`Unknown agent profile: ${request.agentProfileId}`);
  }
  const environmentId = request.environmentId ?? agentProfile?.environmentId;
  const environment = environmentId
    ? runtimeConfig.environments.find((entry) => entry.id === environmentId)
    : undefined;
  if (environmentId && !environment) {
    throw new Error(`Unknown environment: ${environmentId}`);
  }

  const profile = agentProfile?.terminalProfile ?? request.profile ?? "shell";
  const cwd = environment?.cwd || DEFAULT_CWD;
  const envBlock = environment ? parseEnvironmentText(environment.envText) : {};
  const resolvedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...envBlock,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  };

  if (environment) {
    resolvedEnv.CONTROL_ROOM_ENVIRONMENT_ID = environment.id;
    resolvedEnv.CONTROL_ROOM_ENVIRONMENT_LABEL = environment.label;
  }

  if (agentProfile) {
    resolvedEnv.CONTROL_ROOM_AGENT_PROFILE_ID = agentProfile.id;
    resolvedEnv.CONTROL_ROOM_AGENT_LABEL = agentProfile.label;
    resolvedEnv.CONTROL_ROOM_AGENT_MODEL = agentProfile.model;
    resolvedEnv.CONTROL_ROOM_AGENT_SKILLS = agentProfile.skills.join(",");
  }

  const titlePrefix = agentProfile?.label;

  if (agentProfile?.launchCommand) {
    return {
      profile,
      title: titlePrefix || agentProfile.model,
      command: "/bin/bash",
      args: ["-lc", resolveLaunchCommand(agentProfile.launchCommand)],
      cwd,
      env: resolvedEnv,
      environment,
      agentProfile,
    };
  }

  switch (profile) {
    case "shell":
      return {
        profile,
        title: titlePrefix || (environment ? `${environment.label} Shell` : "Empty Terminal"),
        command: DEFAULT_SHELL,
        args: ["-li"],
        cwd,
        env: resolvedEnv,
        environment,
        agentProfile,
      };
    case "codex":
      return {
        profile,
        title: titlePrefix || "Codex",
        command: "/bin/bash",
        args: ["-lc", interactiveBinaryCommand("codex")],
        cwd,
        env: resolvedEnv,
        environment,
        agentProfile,
      };
    case "claude":
      return {
        profile,
        title: titlePrefix || "Claude",
        command: "/bin/bash",
        args: ["-lc", interactiveBinaryCommand("claude")],
        cwd,
        env: resolvedEnv,
        environment,
        agentProfile,
      };
    case "gemini":
      return {
        profile,
        title: titlePrefix || "Gemini",
        command: "/bin/bash",
        args: ["-lc", interactiveBinaryCommand("gemini")],
        cwd,
        env: resolvedEnv,
        environment,
        agentProfile,
      };
    case "openclaw":
      return {
        profile,
        title: titlePrefix || "OpenClaw TUI",
        command: "/bin/bash",
        args: [
          "-lc",
          [
            "if command -v 'openclaw' >/dev/null 2>&1; then",
            "  if openclaw tui --help >/dev/null 2>&1; then",
            "    exec openclaw tui;",
            "  else",
            "    exec openclaw;",
            "  fi;",
            "else",
            `  ${missingBinaryFallback("openclaw")};`,
            "fi",
          ].join(" "),
        ],
        cwd,
        env: resolvedEnv,
        environment,
        agentProfile,
      };
    default: {
      const exhaustiveCheck: never = profile;
      throw new Error(`Unsupported terminal profile: ${exhaustiveCheck}`);
    }
  }
}
