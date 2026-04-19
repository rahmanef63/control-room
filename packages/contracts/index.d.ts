export type AppSource = "dokploy" | "docker" | "systemd";
export type AppRuntimeStatus =
  | "running"
  | "stopped"
  | "restarting"
  | "error"
  | "unknown";
export type AppHealthStatus = "healthy" | "unhealthy" | "none" | "unknown";

export type AgentRuntimeStatus = "running" | "stopped" | "unknown";
export type AgentDetectionSource = "process" | "container" | "systemd" | "pidfile";

export type AlertSeverity = "warning" | "error" | "critical";
export type AlertStatus = "active" | "resolved" | "acknowledged";

export type EventSeverity = "info" | "warning" | "error" | "critical";

export type AuditResult = "success" | "failed" | "cancelled";
export type AuditSeverity = "info" | "warning" | "critical";
export type AuditTriggeredBy =
  | "manual-dashboard"
  | "manual-cli"
  | "manual-tui"
  | "system-agent"
  | "scheduled-check";

export type CommandTargetType =
  | "container"
  | "service"
  | "agent"
  | "dokploy-app"
  | "fail2ban";
export type CommandStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "cancelled"
  | "timeout";

export type TerminalProfile = "shell" | "codex" | "claude" | "gemini" | "openclaw";

export interface AppCommandTargets {
  container?: string;
  dokploy_project?: string;
}

export interface AppMetadata {
  container_id?: string;
  container_name?: string;
  dokploy_name?: string;
  dokploy_project_id?: string;
  dokploy_application_id?: string;
  created_at?: string;
  labels?: Record<string, string>;
  command_targets?: AppCommandTargets;
}

export interface AgentCommandTargets {
  service?: string;
}

export interface AgentMetadata {
  service_name?: string;
  process_count?: number;
  command_targets?: AgentCommandTargets;
}

export interface SystemSnapshot {
  _id: string;
  _creationTime: number;
  timestamp: number;
  cpu_total: number;
  cpu_cores: number[];
  ram_total: number;
  ram_used: number;
  ram_available: number;
  disk: Array<{
    mount: string;
    total: number;
    used: number;
    available: number;
  }>;
  network: {
    rx_bytes: number;
    tx_bytes: number;
    rx_rate: number;
    tx_rate: number;
  };
  uptime_seconds: number;
  load_average: number[];
}

export interface AppStatus {
  _id: string;
  _creationTime: number;
  name: string;
  source: AppSource;
  runtime_status: AppRuntimeStatus;
  health_status: AppHealthStatus;
  ports: Array<{
    internal: number;
    published: number;
    protocol: string;
  }>;
  domain?: string;
  last_seen: number;
  restart_count?: number;
  last_deploy_time?: number;
  last_known_error?: string;
  metadata?: AppMetadata;
}

export interface AgentStatus {
  _id: string;
  _creationTime: number;
  name: string;
  pid?: number;
  status: AgentRuntimeStatus;
  cpu: number;
  memory: number;
  uptime_seconds: number;
  last_seen: number;
  detection_source: AgentDetectionSource;
  available_actions: string[];
  metadata?: AgentMetadata;
}

export interface AlertRecord {
  _id: string;
  _creationTime: number;
  type: string;
  message: string;
  target?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  created_at: number;
  resolved_at?: number;
  metadata?: Record<string, unknown>;
}

export interface EventRecord {
  _id: string;
  _creationTime: number;
  timestamp: number;
  type: string;
  message: string;
  severity: EventSeverity;
  source: string;
  target?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRecord {
  _id: string;
  _creationTime: number;
  timestamp: number;
  action: string;
  target: string;
  result: AuditResult;
  severity: AuditSeverity;
  triggered_by: AuditTriggeredBy;
  request_id: string;
  metadata?: Record<string, unknown>;
}

export interface CommandRecord {
  _id: string;
  _creationTime: number;
  request_id: string;
  action: string;
  target_type: CommandTargetType;
  target_id: string;
  payload?: Record<string, unknown>;
  status: CommandStatus;
  requested_by: string;
  requested_at: number;
  started_at?: number;
  finished_at?: number;
  result?: string;
  error?: string;
}

export interface OverviewData {
  snapshot: SystemSnapshot | null;
  active_alert_count: number;
  app_count: number;
  agent_count: number;
}

export interface RuntimeEnvironment {
  id: string;
  label: string;
  description: string;
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

export interface RuntimeConfigResponse {
  config: RuntimeConfig;
  environments: RuntimeEnvironmentSummary[];
  agentProfiles: RuntimeResolvedAgentProfile[];
  configPath: string;
}

export interface TerminalCreateRequest {
  profile?: TerminalProfile;
  environmentId?: string;
  agentProfileId?: string;
  /** Skip all permission prompts / dangerously allow all tools (YOLO mode). */
  dangerouslyAllow?: boolean;
  /** When true, use the agent default cwd instead of the environment's configured directory. */
  useActiveDir?: boolean;
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

export const APP_SOURCE_VALUES: readonly AppSource[];
export const APP_RUNTIME_STATUS_VALUES: readonly AppRuntimeStatus[];
export const APP_HEALTH_STATUS_VALUES: readonly AppHealthStatus[];
export const AGENT_STATUS_VALUES: readonly AgentRuntimeStatus[];
export const AGENT_DETECTION_SOURCE_VALUES: readonly AgentDetectionSource[];
export const ALERT_SEVERITY_VALUES: readonly AlertSeverity[];
export const ALERT_STATUS_VALUES: readonly AlertStatus[];
export const EVENT_SEVERITY_VALUES: readonly EventSeverity[];
export const AUDIT_RESULT_VALUES: readonly AuditResult[];
export const AUDIT_SEVERITY_VALUES: readonly AuditSeverity[];
export const AUDIT_TRIGGER_VALUES: readonly AuditTriggeredBy[];
export const COMMAND_TARGET_TYPE_VALUES: readonly CommandTargetType[];
export const COMMAND_STATUS_VALUES: readonly CommandStatus[];
export const TERMINAL_PROFILE_VALUES: readonly TerminalProfile[];
