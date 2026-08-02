import {
  HISTORY_MAX_ENTRIES,
  HISTORY_STORAGE_KEY,
} from '@/features/terminals/lib/utils';
import type { TerminalSession } from '@/shared/types/contracts';

import type { TerminalHistoryEntry } from './types';

export function readHistory(): TerminalHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TerminalHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry.id === 'string');
  } catch {
    return [];
  }
}

// Returns the trimmed list actually persisted (newest HISTORY_MAX_ENTRIES by
// recency) so callers can keep their in-memory state bounded too — otherwise
// React state grows unbounded while only localStorage stays capped.
export function writeHistory(entries: TerminalHistoryEntry[]): TerminalHistoryEntry[] {
  const trimmed = entries
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, HISTORY_MAX_ENTRIES);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // ignore
    }
  }
  return trimmed;
}

export function sessionToHistoryEntry(
  session: TerminalSession,
  workspaceId?: string
): TerminalHistoryEntry {
  return {
    id: session.id,
    profile: session.profile,
    title: session.title,
    cwd: session.cwd,
    agentProfileId: session.agent_profile_id,
    environmentId: session.environment_id,
    workspaceId,
    updatedAt: session.updated_at ?? Date.now(),
  };
}
