type CronActionSpawn = {
  type: "spawn";
  profile?: string;
  agentProfileId?: string;
  environmentId?: string;
  cwd?: string;
  initialCommand?: string;
};

type CronActionSendInput = {
  type: "send_input";
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
  lastResult?: {
    ok: boolean;
    message?: string;
    sessionId?: string;
  };
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
