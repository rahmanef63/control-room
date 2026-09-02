export type TerminalProfile = "shell" | "codex" | "claude" | "gemini" | "openclaw";

/** Known CLI detected inside a terminal process tree. */
export type TerminalInnerAgent = "claude" | "codex" | "gemini" | "openclaw";

export interface RuntimeEnvironment {
  id: string;
  label: string;
  description: string;
  /** Empty means use the host terminal default cwd. */
  cwd: string;
  envText: string;
  tags: string[];
}

export interface RuntimeEnvironmentSummary extends RuntimeEnvironment {
  envVarCount: number;
  envKeys: string[];
}

export interface RuntimeAgentProfile {
  id: string;
  label: string;
  description: string;
  terminalProfile: TerminalProfile;
  model: string;
  environmentId?: string;
  skills: string[];
  launchCommand?: string;
}

export interface RuntimeResolvedAgentProfile extends RuntimeAgentProfile {
  environmentLabel?: string;
}

export interface RuntimeConfig {
  environments: RuntimeEnvironment[];
  agentProfiles: RuntimeAgentProfile[];
}

export interface TerminalCreateRequest {
  profile?: TerminalProfile;
  environmentId?: string;
  agentProfileId?: string;
  /** Launch the CLI with its supported permission-bypass flag when available. */
  dangerouslyAllow?: boolean;
  /** Use the host default cwd instead of a configured environment cwd. */
  useActiveDir?: boolean;
  /** Absolute cwd override used by duplicate/restore flows. */
  cwd?: string;
}

export interface TerminalSession {
  id: string;
  profile: TerminalProfile;
  title: string;
  command: string;
  pid: number;
  cwd: string;
  rows: number;
  cols: number;
  status: "running" | "exited";
  created_at: number;
  updated_at: number;
  environment_id?: string;
  environment_label?: string;
  agent_profile_id?: string;
  model?: string;
  skills?: string[];
  inner_agent?: TerminalInnerAgent | null;
  exit_code?: number;
  exit_signal?: number;
}

export interface TerminalProfileDescriptor {
  profile: TerminalProfile;
  title: string;
  description: string;
}

export type TerminalGatewayEvent =
  | { type: "bootstrap"; buffer: string; session: TerminalSession }
  | { type: "output"; sessionId: string; data: string }
  | { type: "status"; session: TerminalSession }
  | { type: "error"; message: string }
  | { type: "pong"; ts: number };

export const TERMINAL_PROFILE_VALUES: readonly TerminalProfile[];
