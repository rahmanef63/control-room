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
  source: 'dokploy' | 'docker' | 'systemd';
  runtime_status: 'running' | 'stopped' | 'restarting' | 'error' | 'unknown';
  health_status: 'healthy' | 'unhealthy' | 'none' | 'unknown';
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
  metadata?: Record<string, unknown>;
}

export interface AgentStatus {
  _id: string;
  _creationTime: number;
  name: string;
  pid?: number;
  status: 'running' | 'stopped' | 'unknown';
  cpu: number;
  memory: number;
  uptime_seconds: number;
  last_seen: number;
  detection_source: 'process' | 'container' | 'systemd' | 'pidfile';
  available_actions: string[];
  metadata?: Record<string, unknown>;
}

export interface AlertRecord {
  _id: string;
  _creationTime: number;
  type: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
  status: 'active' | 'resolved' | 'acknowledged';
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
  severity: 'info' | 'warning' | 'error' | 'critical';
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
  result: 'success' | 'failed' | 'cancelled';
  severity: 'info' | 'warning' | 'critical';
  triggered_by: 'manual-dashboard' | 'system-agent' | 'scheduled-check';
  request_id: string;
  metadata?: Record<string, unknown>;
}

export interface CommandRecord {
  _id: string;
  _creationTime: number;
  request_id: string;
  action: string;
  target_type: 'container' | 'service' | 'agent' | 'dokploy-app' | 'fail2ban';
  target_id: string;
  payload?: Record<string, unknown>;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';
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

export type TerminalProfile = 'shell' | 'codex' | 'claude' | 'gemini' | 'openclaw';

export interface TerminalSession {
  id: string;
  profile: TerminalProfile;
  title: string;
  command: string;
  pid: number;
  cwd: string;
  rows: number;
  cols: number;
  status: 'running' | 'exited';
  created_at: number;
  updated_at: number;
  exit_code?: number;
  exit_signal?: number;
}
