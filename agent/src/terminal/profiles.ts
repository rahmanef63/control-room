import fs from "fs";
import os from "os";
import path from "path";

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

// The agent runs on the VPS (Linux) in production, but devs also run it on
// Windows / macOS for local testing. `/bin/bash`, `-li`, and `/home/<user>`
// only exist on Linux/macOS, so detect the host and branch. The Linux path is
// kept byte-identical to the original so the VPS is unaffected.
const isWindows = process.platform === "win32";

// Control-room master secrets that must NOT be inherited by interactive shells.
// A pty is a shell the user (or an AI agent) drives, so anything in its env is
// readable via `env`. Tools still get the full inherited PATH/HOME/etc.; only
// these named secrets are scrubbed from each spawned session's environment.
const SENSITIVE_ENV_KEYS = [
  "CONTROL_ROOM_SECRET",
  "CONTROL_ROOM_SESSION_SECRET",
  "AGENT_GATEWAY_SECRET",
] as const;

const DEFAULT_SHELL =
  process.env["SHELL"] ||
  (isWindows ? process.env["ComSpec"] || "powershell.exe" : "/bin/bash");

const isPowerShell = /powershell|pwsh/i.test(DEFAULT_SHELL);

const DEFAULT_CWD =
  process.env["TERMINAL_DEFAULT_CWD"] ||
  (isWindows ? os.homedir() : `/home/${os.userInfo().username}`);

// Args that open an interactive shell. POSIX login shell uses -li; PowerShell
// has no login concept and -NoLogo skips its banner; cmd.exe takes none.
function interactiveShellArgs(): string[] {
  if (!isWindows) return ["-li"];
  if (isPowerShell) return ["-NoLogo"];
  return [];
}

// Run an arbitrary command line through the default shell. PowerShell uses
// -Command; cmd.exe uses /c. Windows-only — the Linux path keeps its original
// bash -lc wrappers untouched.
function shellExecArgs(line: string): string[] {
  if (isPowerShell) return ["-NoLogo", "-Command", line];
  if (path.basename(DEFAULT_SHELL).toLowerCase().startsWith("cmd")) return ["/c", line];
  return ["-lc", line]; // bash/sh on Windows (e.g. git-bash)
}

// Windows equivalent of the Linux `command -v <bin> ... else drop into a shell`
// guard: probe the binary on PATH, run it if present, otherwise print a note
// and KEEP the shell open (-NoExit / cmd /k) so the pane doesn't vanish.
function windowsAgentArgs(binary: string, flags: string[]): string[] {
  if (isPowerShell) {
    const q = (s: string): string => `'${s.replace(/'/g, "''")}'`;
    const argStr = flags.map(q).join(" ");
    const call = argStr ? `& ${q(binary)} ${argStr}` : `& ${q(binary)}`;
    const script =
      `if (Get-Command ${q(binary)} -ErrorAction SilentlyContinue) { ${call} } ` +
      `else { Write-Host "[${binary}] is not installed on this machine. Dropping into a shell." }`;
    return ["-NoLogo", "-NoExit", "-Command", script];
  }
  // cmd.exe: /k runs the line then keeps the prompt (so a missing binary shows
  // its error and leaves an interactive shell instead of closing the pane).
  if (path.basename(DEFAULT_SHELL).toLowerCase().startsWith("cmd")) {
    return ["/k", [binary, ...flags].join(" ")];
  }
  // bash/sh on Windows (e.g. git-bash): reuse the POSIX command-v guard.
  return ["-lc", interactiveBinaryCommand(binary, flags)];
}

// Launch a coding-agent CLI (claude/codex/gemini). On Linux: the original
// bash -lc wrapper with a `command -v` guard + graceful fallback. On Windows:
// probe via Get-Command/where, run the binary, else drop into a shell.
function agentLaunch(binary: string, flags: string[] = []): { command: string; args: string[] } {
  if (isWindows) {
    return { command: DEFAULT_SHELL, args: windowsAgentArgs(binary, flags) };
  }
  return { command: "/bin/bash", args: ["-lc", interactiveBinaryCommand(binary, flags)] };
}

function shellEscapeSingle(input: string): string {
  return input.replace(/'/g, `'\\''`);
}

function resolveRequestedCwd(input: string | undefined): string | undefined {
  if (!input) return undefined;
  if (!path.isAbsolute(input)) return undefined;
  const normalized = path.normalize(input);
  try {
    const stat = fs.statSync(normalized);
    if (!stat.isDirectory()) return undefined;
  } catch {
    return undefined;
  }
  return normalized;
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
  // Resolution order: explicit request.cwd (duplicate/restore) > useActiveDir > environment.cwd > DEFAULT_CWD
  const requestedCwd = resolveRequestedCwd(request.cwd);
  const cwd =
    requestedCwd ?? (request.useActiveDir ? DEFAULT_CWD : (environment?.cwd ?? DEFAULT_CWD));
  const envBlock = environment ? parseEnvironmentText(environment.envText) : {};
  const yolo = request.dangerouslyAllow === true;
  const resolvedEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...envBlock,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  };
  // Scrub master secrets so a command/agent in the pane can't read them via `env`.
  for (const key of SENSITIVE_ENV_KEYS) {
    delete resolvedEnv[key];
  }

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
    const launchSpec = isWindows
      ? { command: DEFAULT_SHELL, args: shellExecArgs(launchCmd) }
      : { command: "/bin/bash", args: ["-lc", resolveLaunchCommand(launchCmd)] };
    return {
      profile,
      title: titlePrefix ? (yolo ? `${titlePrefix} (YOLO)` : titlePrefix) : agentProfile.model,
      command: launchSpec.command,
      args: launchSpec.args,
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
        args: interactiveShellArgs(),
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
        ...agentLaunch("codex", yolo ? ["--yolo"] : []),
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
        ...agentLaunch("claude", yolo ? ["--dangerously-skip-permissions"] : []),
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
        ...agentLaunch("gemini", yolo ? ["--yolo"] : []),
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
        // Windows has no POSIX `command -v` probe — run `openclaw tui` directly
        // through the shell (node-pty resolves it on PATH; errors surface in the
        // pane). Linux keeps the original probe + graceful bash fallback.
        ...(isWindows
          ? { command: DEFAULT_SHELL, args: shellExecArgs("openclaw tui") }
          : {
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
            }),
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
