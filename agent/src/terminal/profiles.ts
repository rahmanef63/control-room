import os from "os";

import { parseEnvironmentText, readRuntimeConfig } from "../../../packages/runtime-config/index.js";
import type {
  RuntimeAgentProfile,
  RuntimeEnvironment,
  TerminalCreateRequest,
  TerminalProfile,
  TerminalProfileDescriptor,
} from "../../../packages/contracts/index.js";

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
  // useActiveDir=true skips the environment's configured directory and uses DEFAULT_CWD
  const cwd = request.useActiveDir ? DEFAULT_CWD : (environment?.cwd ?? DEFAULT_CWD);
  const envBlock = environment ? parseEnvironmentText(environment.envText) : {};
  const yolo = request.dangerouslyAllow === true;
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
    const launchCmd = yolo
      ? `${agentProfile.launchCommand} --dangerously-skip-permissions`
      : agentProfile.launchCommand;
    return {
      profile,
      title: titlePrefix ? (yolo ? `${titlePrefix} (YOLO)` : titlePrefix) : agentProfile.model,
      command: "/bin/bash",
      args: ["-lc", resolveLaunchCommand(launchCmd)],
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
      // --yolo: alias for --dangerously-bypass-approvals-and-sandbox (no sandbox, no prompts)
      return {
        profile,
        title: titlePrefix || (yolo ? "Codex (YOLO)" : "Codex"),
        command: "/bin/bash",
        args: ["-lc", interactiveBinaryCommand("codex", yolo ? ["--yolo"] : [])],
        cwd,
        env: resolvedEnv,
        environment,
        agentProfile,
      };
    case "claude":
      // --dangerously-skip-permissions: bypass all permission prompts (YOLO mode)
      return {
        profile,
        title: titlePrefix || (yolo ? "Claude (YOLO)" : "Claude"),
        command: "/bin/bash",
        args: ["-lc", interactiveBinaryCommand("claude", yolo ? ["--dangerously-skip-permissions"] : [])],
        cwd,
        env: resolvedEnv,
        environment,
        agentProfile,
      };
    case "gemini":
      // --yolo: auto-approve all actions without confirmation
      return {
        profile,
        title: titlePrefix || (yolo ? "Gemini (YOLO)" : "Gemini"),
        command: "/bin/bash",
        args: ["-lc", interactiveBinaryCommand("gemini", yolo ? ["--yolo"] : [])],
        cwd,
        env: resolvedEnv,
        environment,
        agentProfile,
      };
    case "openclaw":
      // OpenClaw is a TUI orchestrator — it has no built-in bypass flag of its own.
      // YOLO behaviour is delegated to whichever coding-agent skill it runs internally.
      // We still label the pane so the user knows it was launched in permissive intent.
      return {
        profile,
        title: titlePrefix || (yolo ? "OpenClaw (YOLO)" : "OpenClaw TUI"),
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
