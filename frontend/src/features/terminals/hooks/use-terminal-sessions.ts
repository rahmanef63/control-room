'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { TerminalProfileOption } from '@/features/terminals/components/launcher-card';
import { ACTIVE_SESSION_KEY, SESSION_STORAGE_KEY } from '@/features/terminals/lib/utils';
import type { TerminalTemplate } from '@/features/templates/types';

import { readHistory, sessionToHistoryEntry, writeHistory } from './sessions/storage';
import type {
  CreateSessionBody,
  TerminalHistoryEntry,
  TerminalListResponse,
  UseTerminalSessionsOptions,
} from './sessions/types';
import type {
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
  TerminalSession,
} from '@/shared/types/contracts';

export type { TerminalHistoryEntry, UseTerminalSessionsOptions } from './sessions/types';

export interface UseTerminalSessionsResult {
  profiles: TerminalProfileOption[];
  environments: RuntimeEnvironmentSummary[];
  agentProfiles: RuntimeResolvedAgentProfile[];
  sessions: TerminalSession[];
  activeId: string | null;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  creatingKey: string | null;
  createSession: (body: CreateSessionBody, key: string) => Promise<TerminalSession | null>;
  closeSession: (id: string) => Promise<void>;
  duplicateSession: (session: TerminalSession) => Promise<void>;
  launchTemplate: (template: TerminalTemplate) => Promise<void>;
  updateSession: (nextSession: TerminalSession) => void;
  reorderSessions: (orderedIds: string[]) => void;
  broadcastInput: (data: string) => void;
  history: TerminalHistoryEntry[];
  restoreHistory: (workspaceId?: string) => Promise<void>;
  restoreHistoryEntry: (entry: TerminalHistoryEntry) => Promise<void>;
  removeHistoryEntry: (id: string) => void;
  clearHistory: (workspaceId?: string) => void;
  restoring: boolean;
}

export function useTerminalSessions(
  options: UseTerminalSessionsOptions = {}
): UseTerminalSessionsResult {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const [profiles, setProfiles] = useState<TerminalProfileOption[]>([]);
  const [environments, setEnvironments] = useState<RuntimeEnvironmentSummary[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<RuntimeResolvedAgentProfile[]>([]);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TerminalHistoryEntry[]>([]);
  const [restoring, setRestoring] = useState(false);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const upsertHistory = useCallback((session: TerminalSession, workspaceId?: string) => {
    setHistory((current) => {
      const previous = current.find((item) => item.id === session.id);
      const resolvedWorkspace =
        workspaceId ??
        previous?.workspaceId ??
        optionsRef.current.resolveSourceWorkspaceId?.(session.id);
      const entry = sessionToHistoryEntry(session, resolvedWorkspace);
      const next = [entry, ...current.filter((item) => item.id !== entry.id)];
      return writeHistory(next);
    });
  }, []);

  const removeHistoryEntries = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setHistory((current) => {
      const idSet = new Set(ids);
      const next = current.filter((item) => !idSet.has(item.id));
      return writeHistory(next);
    });
  }, []);

  // Mark history entries closed (instead of deleting) so the History drawer can
  // still show "what this terminal was for" after the pane is gone.
  const markHistoryClosed = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setHistory((current) => {
      const idSet = new Set(ids);
      let changed = false;
      const next = current.map((item) => {
        if (!idSet.has(item.id) || item.closedAt) return item;
        changed = true;
        return { ...item, closedAt: Date.now() };
      });
      return changed ? writeHistory(next) : current;
    });
  }, []);

  const clearHistory = useCallback((workspaceId?: string) => {
    setHistory((current) => {
      if (!workspaceId) {
        writeHistory([]);
        return [];
      }
      const next = current.filter((entry) => entry.workspaceId !== workspaceId);
      return writeHistory(next);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/terminals');
        const payload = (await response.json()) as TerminalListResponse;
        if (cancelled) return;

        const profileList = payload.profiles ?? [];
        const environmentList = payload.environments ?? [];
        const agentProfileList = (payload.agentProfiles ?? []).map((profile) => ({
          ...profile,
          skills: profile.skills ?? [],
        }));
        const sessionList = (payload.sessions ?? []).map((session) => ({
          ...session,
          skills: session.skills ?? [],
        }));

        const persistedIds =
          typeof window !== 'undefined'
            ? JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? '[]')
            : [];
        const orderedSessions =
          Array.isArray(persistedIds) && persistedIds.length > 0
            ? [
                ...sessionList.filter((session) => persistedIds.includes(session.id)),
                ...sessionList.filter((session) => !persistedIds.includes(session.id)),
              ]
            : sessionList;

        setProfiles(profileList);
        setEnvironments(environmentList);
        setAgentProfiles(agentProfileList);
        setSessions(orderedSessions);

        if (orderedSessions.length > 0) {
          orderedSessions.forEach((session) => {
            const inferredWs = optionsRef.current.resolveSourceWorkspaceId?.(session.id);
            upsertHistory(session, inferredWs);
          });
          const storedActive =
            typeof window !== 'undefined' ? window.localStorage.getItem(ACTIVE_SESSION_KEY) : null;
          const candidate =
            storedActive && orderedSessions.some((item) => item.id === storedActive)
              ? storedActive
              : orderedSessions[0].id;
          setActiveId(candidate);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load terminal sessions');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [upsertHistory]);

  // Live sync: poll the server session list so panes created out-of-band (e.g.
  // an alfa spawning a child via the agent API) appear without a manual
  // refresh, and panes closed elsewhere drop out. Server is source of truth for
  // existence + status; local order is preserved and a just-created optimistic
  // pane is kept for a short grace window until the server poll catches up.
  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 5000;
    const GRACE_MS = 8000;

    async function sync() {
      if (typeof document !== 'undefined' && document.hidden) return;
      let server: TerminalSession[];
      try {
        const response = await fetch('/api/terminals', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as TerminalListResponse;
        server = (payload.sessions ?? []).map((s) => ({ ...s, skills: s.skills ?? [] }));
      } catch {
        return;
      }
      if (cancelled) return;

      const serverById = new Map(server.map((s) => [s.id, s]));
      const now = Date.now();
      const added: TerminalSession[] = [];
      const dropped: string[] = [];

      setSessions((current) => {
        const merged: TerminalSession[] = [];
        const seen = new Set<string>();
        for (const s of current) {
          const srv = serverById.get(s.id);
          if (srv) {
            // Reuse the existing object ref unless a rendered field changed —
            // keeps panes from re-rendering every 5s. updated_at churns on every
            // keystroke so it is deliberately excluded from the comparison.
            const changed =
              srv.status !== s.status ||
              srv.title !== s.title ||
              srv.cwd !== s.cwd ||
              srv.inner_agent !== s.inner_agent;
            merged.push(changed ? { ...srv, skills: srv.skills ?? s.skills ?? [] } : s);
            seen.add(s.id);
          } else if (now - (s.created_at ?? 0) < GRACE_MS) {
            merged.push(s); // optimistic create not yet visible to the poll
            seen.add(s.id);
          } else {
            dropped.push(s.id);
          }
        }
        for (const s of server) {
          if (!seen.has(s.id)) {
            merged.push(s);
            added.push(s);
          }
        }
        // No structural change → keep the old array ref (skip the re-render).
        if (added.length === 0 && dropped.length === 0) {
          let identical = merged.length === current.length;
          if (identical) {
            for (let i = 0; i < merged.length; i += 1) {
              if (merged[i] !== current[i]) {
                identical = false;
                break;
              }
            }
          }
          if (identical) return current;
        }
        return merged;
      });

      for (const s of added) upsertHistory(s);
      if (dropped.length > 0) markHistoryClosed(dropped);

      // Keep the persisted cwd ("where I left off") fresh as the user cd's
      // around. Without this the history entry holds only the launch-time cwd,
      // so restoring after a crash reopens the wrong directory. Gated on an
      // actual cwd change to avoid a localStorage write every poll tick.
      const prevById = new Map(sessionsRef.current.map((s) => [s.id, s]));
      for (const s of server) {
        if (s.status !== 'running' || !s.cwd) continue;
        const prev = prevById.get(s.id);
        if (prev && prev.cwd !== s.cwd) upsertHistory(s);
      }
    }

    const id = setInterval(() => void sync(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [upsertHistory, markHistoryClosed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(sessions.map((session) => session.id))
    );
  }, [sessions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeId) {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, activeId);
    }
  }, [activeId]);

  const createSession = useCallback(
    async (body: CreateSessionBody, key: string): Promise<TerminalSession | null> => {
      setCreatingKey(key);
      setError(null);

      try {
        const response = await fetch('/api/terminals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const payload = (await response.json()) as { session?: TerminalSession; error?: string };
        if (!response.ok || !payload.session) {
          throw new Error(payload.error || 'Failed to create terminal');
        }

        const nextSession = {
          ...payload.session,
          skills: payload.session.skills ?? [],
        };

        const targetWorkspace = optionsRef.current.resolveActiveWorkspaceId?.();
        if (targetWorkspace) {
          optionsRef.current.onAssignWorkspace?.(nextSession.id, targetWorkspace);
        }

        setSessions((current) => [
          nextSession,
          ...current.filter((item) => item.id !== nextSession.id),
        ]);
        setActiveId(nextSession.id);
        upsertHistory(nextSession, targetWorkspace);
        return nextSession;
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to create terminal');
        return null;
      } finally {
        setCreatingKey(null);
      }
    },
    [upsertHistory]
  );

  const closeSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/terminals/${id}`, { method: 'DELETE' });
        setSessions((current) => {
          const next = current.filter((session) => session.id !== id);
          if (activeId === id) {
            setActiveId(next[0]?.id ?? null);
          }
          return next;
        });
        markHistoryClosed([id]);
      } catch {
        setError('Failed to close terminal');
      }
    },
    [activeId, markHistoryClosed]
  );

  const duplicateSession = useCallback(
    async (session: TerminalSession) => {
      setCreatingKey(`duplicate:${session.id}`);
      setError(null);
      try {
        let liveCwd = session.cwd;
        let liveTitle = session.title;
        try {
          const fresh = await fetch(`/api/terminals/${encodeURIComponent(session.id)}`);
          if (fresh.ok) {
            const payload = (await fresh.json()) as { session?: TerminalSession };
            if (payload.session) {
              liveCwd = payload.session.cwd ?? liveCwd;
              liveTitle = payload.session.title ?? liveTitle;
            }
          }
        } catch {
          // fall back to stale session fields
        }

        const body: CreateSessionBody = {
          profile: session.profile,
          cwd: liveCwd,
        };
        if (session.agent_profile_id) body.agentProfileId = session.agent_profile_id;
        if (session.environment_id) body.environmentId = session.environment_id;

        const createResp = await fetch('/api/terminals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const created = (await createResp.json()) as { session?: TerminalSession; error?: string };
        if (!createResp.ok || !created.session) {
          throw new Error(created.error || 'Failed to duplicate terminal');
        }

        let nextSession: TerminalSession = {
          ...created.session,
          skills: created.session.skills ?? [],
        };

        const sourceWorkspace =
          optionsRef.current.resolveSourceWorkspaceId?.(session.id) ??
          optionsRef.current.resolveActiveWorkspaceId?.();
        if (sourceWorkspace) {
          optionsRef.current.onAssignWorkspace?.(nextSession.id, sourceWorkspace);
        }

        if (liveTitle && liveTitle !== nextSession.title) {
          try {
            const rename = await fetch(`/api/terminals/${encodeURIComponent(nextSession.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: liveTitle }),
            });
            if (rename.ok) {
              const renamed = (await rename.json()) as { session?: TerminalSession };
              if (renamed.session) {
                nextSession = { ...renamed.session, skills: renamed.session.skills ?? [] };
              }
            }
          } catch {
            // keep default title on rename failure
          }
        }

        setSessions((current) => [
          nextSession,
          ...current.filter((item) => item.id !== nextSession.id),
        ]);
        setActiveId(nextSession.id);
        upsertHistory(nextSession, sourceWorkspace);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error ? caughtError.message : 'Failed to duplicate terminal'
        );
      } finally {
        setCreatingKey(null);
      }
    },
    [upsertHistory]
  );

  const launchTemplate = useCallback(
    async (template: TerminalTemplate) => {
      setCreatingKey(`template:${template.id}`);
      setError(null);
      try {
        const body: CreateSessionBody = {};
        if (template.profile) body.profile = template.profile;
        if (template.agentProfileId) body.agentProfileId = template.agentProfileId;
        if (template.environmentId) body.environmentId = template.environmentId;
        if (template.cwd) body.cwd = template.cwd;

        const resp = await fetch('/api/terminals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = (await resp.json()) as { session?: TerminalSession; error?: string };
        if (!resp.ok || !payload.session) {
          throw new Error(payload.error || 'Failed to launch template');
        }

        let nextSession: TerminalSession = {
          ...payload.session,
          skills: payload.session.skills ?? [],
        };

        const targetWs =
          template.workspaceId ?? optionsRef.current.resolveActiveWorkspaceId?.();
        if (targetWs) optionsRef.current.onAssignWorkspace?.(nextSession.id, targetWs);

        if (template.customTitle && template.customTitle !== nextSession.title) {
          try {
            const rename = await fetch(`/api/terminals/${encodeURIComponent(nextSession.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: template.customTitle }),
            });
            if (rename.ok) {
              const renamed = (await rename.json()) as { session?: TerminalSession };
              if (renamed.session) {
                nextSession = { ...renamed.session, skills: renamed.session.skills ?? [] };
              }
            }
          } catch {
            // ignore rename failure
          }
        }

        setSessions((current) => [
          nextSession,
          ...current.filter((item) => item.id !== nextSession.id),
        ]);
        setActiveId(nextSession.id);
        upsertHistory(nextSession, targetWs);

        if (template.initialCommand) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          try {
            await fetch(`/api/terminals/${encodeURIComponent(nextSession.id)}/input`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: `${template.initialCommand}\r` }),
            });
          } catch {
            // ignore
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to launch template');
      } finally {
        setCreatingKey(null);
      }
    },
    [upsertHistory]
  );

  const updateSession = useCallback(
    (nextSession: TerminalSession) => {
      const normalized = { ...nextSession, skills: nextSession.skills ?? [] };
      setSessions((current) => {
        const exists = current.some((session) => session.id === normalized.id);
        if (!exists) {
          return [normalized, ...current];
        }
        return current.map((session) => (session.id === normalized.id ? normalized : session));
      });
      upsertHistory(normalized);
    },
    [upsertHistory]
  );

  const reorderSessions = useCallback((orderedIds: string[]) => {
    if (orderedIds.length === 0) return;
    setSessions((current) => {
      const byId = new Map(current.map((session) => [session.id, session]));
      const orderedSet = new Set(orderedIds);
      let pickIndex = 0;
      const next: TerminalSession[] = [];
      for (const session of current) {
        if (orderedSet.has(session.id)) {
          const nextId = orderedIds[pickIndex++];
          const replacement = byId.get(nextId);
          if (replacement) next.push(replacement);
        } else {
          next.push(session);
        }
      }
      return next;
    });
  }, []);

  const broadcastInput = useCallback(
    (data: string) => {
      for (const session of sessions) {
        if (session.status !== 'running') continue;
        void fetch(`/api/terminals/${encodeURIComponent(session.id)}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
      }
    },
    [sessions]
  );

  const restoreHistory = useCallback(async (workspaceId?: string) => {
    if (restoring) return;
    const liveIds = new Set(sessionsRef.current.map((session) => session.id));
    const candidates = history.filter((entry) => {
      if (liveIds.has(entry.id)) return false;
      if (workspaceId && entry.workspaceId !== workspaceId) return false;
      return true;
    });
    if (candidates.length === 0) return;

    setRestoring(true);
    setError(null);
    const recreated: string[] = [];
    try {
      for (const entry of candidates) {
        const body: CreateSessionBody = {
          profile: entry.profile,
          cwd: entry.cwd,
        };
        if (entry.agentProfileId) body.agentProfileId = entry.agentProfileId;
        if (entry.environmentId) body.environmentId = entry.environmentId;

        const response = await fetch('/api/terminals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as { session?: TerminalSession; error?: string };
        if (!response.ok || !payload.session) {
          throw new Error(payload.error || 'Failed to restore terminal');
        }
        let nextSession: TerminalSession = {
          ...payload.session,
          skills: payload.session.skills ?? [],
        };

        if (entry.workspaceId) {
          optionsRef.current.onAssignWorkspace?.(nextSession.id, entry.workspaceId);
        }

        if (entry.title && entry.title !== nextSession.title) {
          try {
            const rename = await fetch(`/api/terminals/${encodeURIComponent(nextSession.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: entry.title }),
            });
            if (rename.ok) {
              const renamed = (await rename.json()) as { session?: TerminalSession };
              if (renamed.session) {
                nextSession = { ...renamed.session, skills: renamed.session.skills ?? [] };
              }
            }
          } catch {
            // ignore — stale title is acceptable
          }
        }

        setSessions((current) => [
          ...current.filter((item) => item.id !== nextSession.id),
          nextSession,
        ]);
        upsertHistory(nextSession, entry.workspaceId);
        recreated.push(entry.id);
      }
      removeHistoryEntries(recreated);
      const firstNew = sessionsRef.current[0];
      if (firstNew) setActiveId(firstNew.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to restore terminals');
      if (recreated.length > 0) removeHistoryEntries(recreated);
    } finally {
      setRestoring(false);
    }
  }, [history, removeHistoryEntries, restoring, upsertHistory]);

  // Restore ONE history entry (used by the History drawer). If the pane is
  // still live, just focus it; otherwise recreate it from the stored spec.
  const restoreHistoryEntry = useCallback(
    async (entry: TerminalHistoryEntry) => {
      if (sessionsRef.current.some((s) => s.id === entry.id)) {
        setActiveId(entry.id);
        return;
      }
      setError(null);
      try {
        const body: CreateSessionBody = { profile: entry.profile, cwd: entry.cwd };
        if (entry.agentProfileId) body.agentProfileId = entry.agentProfileId;
        if (entry.environmentId) body.environmentId = entry.environmentId;

        const response = await fetch('/api/terminals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = (await response.json()) as { session?: TerminalSession; error?: string };
        if (!response.ok || !payload.session) {
          throw new Error(payload.error || 'Failed to restore terminal');
        }
        let nextSession: TerminalSession = { ...payload.session, skills: payload.session.skills ?? [] };

        if (entry.workspaceId) optionsRef.current.onAssignWorkspace?.(nextSession.id, entry.workspaceId);

        if (entry.title && entry.title !== nextSession.title) {
          try {
            const rename = await fetch(`/api/terminals/${encodeURIComponent(nextSession.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: entry.title }),
            });
            if (rename.ok) {
              const renamed = (await rename.json()) as { session?: TerminalSession };
              if (renamed.session) nextSession = { ...renamed.session, skills: renamed.session.skills ?? [] };
            }
          } catch {
            // stale title acceptable
          }
        }

        setSessions((current) => [nextSession, ...current.filter((item) => item.id !== nextSession.id)]);
        setActiveId(nextSession.id);
        upsertHistory(nextSession, entry.workspaceId);
        removeHistoryEntries([entry.id]);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to restore terminal');
      }
    },
    [removeHistoryEntries, upsertHistory]
  );

  const removeHistoryEntry = useCallback(
    (id: string) => removeHistoryEntries([id]),
    [removeHistoryEntries]
  );

  return {
    profiles,
    environments,
    agentProfiles,
    sessions,
    activeId,
    setActiveId,
    loading,
    error,
    setError,
    creatingKey,
    createSession,
    closeSession,
    duplicateSession,
    launchTemplate,
    updateSession,
    reorderSessions,
    broadcastInput,
    history,
    restoreHistory,
    restoreHistoryEntry,
    removeHistoryEntry,
    clearHistory,
    restoring,
  };
}
