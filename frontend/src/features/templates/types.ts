import type { TerminalProfile } from '@/shared/types/contracts';

export interface TerminalTemplate {
  id: string;
  name: string;
  description?: string;
  color?: string;
  profile?: TerminalProfile;
  agentProfileId?: string;
  environmentId?: string;
  cwd?: string;
  initialCommand?: string;
  customTitle?: string;
  workspaceId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateCreateInput {
  name: string;
  description?: string;
  color?: string;
  profile?: TerminalProfile;
  agentProfileId?: string;
  environmentId?: string;
  cwd?: string;
  initialCommand?: string;
  customTitle?: string;
  workspaceId?: string;
}

export type TemplateUpdateInput = Partial<TemplateCreateInput>;
