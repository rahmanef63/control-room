export interface ConvexCommand {
  _id: string;
  request_id: string;
  action: string;
  target_type: string;
  target_id: string;
  payload?: Record<string, unknown>;
  status: string;
  requested_by: string;
  requested_at: number;
}

export type AuditActor =
  | 'manual-dashboard'
  | 'manual-cli'
  | 'manual-tui'
  | 'system-agent'
  | 'scheduled-check';

export type CommandFinalStatus = 'success' | 'failed' | 'timeout';
