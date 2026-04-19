import type {
  CommandRecord,
  CommandStatus,
  CommandTargetType,
} from '../../../packages/contracts/index.js';

export type CmdStatus = CommandStatus;
export type TargetType = CommandTargetType;
export type { CommandRecord };

export interface OverviewQueryResult {
  snapshot: null | {
    cpu_total: number;
    ram_used: number;
    ram_total: number;
    uptime_seconds: number;
  };
  active_alert_count: number;
  app_count: number;
  agent_count: number;
}

export interface AppListItem {
  name: string;
  runtime_status: string;
  health_status: string;
  source: string;
  last_seen: number;
}

export interface AgentListItem {
  name: string;
  status: string;
  pid?: number;
  cpu: number;
  uptime_seconds: number;
}

export interface TuiAgentListItem {
  name: string;
  status: string;
  cpu: number;
}

export interface EventListItem {
  timestamp: number;
  severity: string;
  type: string;
  source: string;
  message: string;
}

export interface TuiEventListItem {
  timestamp: number;
  severity: string;
  message: string;
}

export interface PaginatedResult<T> {
  page: T[];
}
