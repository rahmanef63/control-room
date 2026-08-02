import type { TerminalProfileOption } from '@/features/terminals/components/launcher-card';
import type {
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
  TerminalProfile,
  TerminalSession,
} from '@/shared/types/contracts';

export interface TerminalListResponse {
  profiles?: TerminalProfileOption[];
  sessions?: TerminalSession[];
  environments?: RuntimeEnvironmentSummary[];
  agentProfiles?: RuntimeResolvedAgentProfile[];
}

export interface TerminalHistoryEntry {
  id: string;
  profile: TerminalProfile;
  title: string;
  cwd: string;
  agentProfileId?: string;
  environmentId?: string;
  workspaceId?: string;
  updatedAt: number;
  /** Set when the pane closed; entry is retained for the History drawer. */
  closedAt?: number;
}

export interface CreateSessionBody extends Record<string, unknown> {
  dangerouslyAllow?: boolean;
  useActiveDir?: boolean;
}

export interface UseTerminalSessionsOptions {
  /** Workspace id to assign newly created sessions (from launcher). */
  resolveActiveWorkspaceId?: () => string;
  /** Workspace id to assign duplicated sessions, given source session id. */
  resolveSourceWorkspaceId?: (sourceId: string) => string;
  /** Called when a session is bound to a workspace (create/duplicate/restore/initial load). */
  onAssignWorkspace?: (sessionId: string, workspaceId: string) => void;
}
