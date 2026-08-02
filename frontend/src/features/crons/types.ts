import type { TerminalProfile } from '@/shared/types/contracts';

export type CronActionSpawn = {
  type: 'spawn';
  profile?: TerminalProfile;
  agentProfileId?: string;
  environmentId?: string;
  cwd?: string;
  initialCommand?: string;
};

export type CronActionSendInput = {
  type: 'send_input';
  sessionId: string;
  data: string;
};

export type CronAction = CronActionSpawn | CronActionSendInput;

export interface CronEntry {
  id: string;
  name: string;
  cronExpr: string;
  enabled: boolean;
  workspaceId?: string;
  action: CronAction;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastResult?: { ok: boolean; message?: string; sessionId?: string };
}

export interface CronCreateInput {
  name: string;
  cronExpr: string;
  enabled?: boolean;
  workspaceId?: string;
  action: CronAction;
}

export interface CronUpdateInput {
  name?: string;
  cronExpr?: string;
  enabled?: boolean;
  workspaceId?: string;
  action?: CronAction;
}
