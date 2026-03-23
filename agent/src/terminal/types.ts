export type TerminalProfile = "shell" | "codex" | "claude" | "gemini" | "openclaw";

export interface RuntimeEnvironment {
  id: string;
  label: string;
  description: string;
  cwd: string;
  envText: string;
  tags: string[];
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

export interface RuntimeEnvironmentSummary extends RuntimeEnvironment {
  envVarCount: number;
  envKeys: string[];
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
}

export interface TerminalSessionRecord {
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
  exit_code?: number;
  exit_signal?: number;
}

export type TerminalGatewayEvent =
  | { type: "bootstrap"; buffer: string; session: TerminalSessionRecord }
  | { type: "output"; sessionId: string; data: string }
  | { type: "status"; session: TerminalSessionRecord }
  | { type: "error"; message: string }
  | { type: "pong"; ts: number };

export interface TerminalProfileDescriptor {
  profile: TerminalProfile;
  title: string;
  description: string;
}
