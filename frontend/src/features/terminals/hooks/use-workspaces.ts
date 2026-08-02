'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { readLocal, writeLocal } from '@/features/terminals/lib/local-storage';
import {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  WORKSPACE_ACTIVE_KEY,
  WORKSPACE_SESSION_MAP_KEY,
  WORKSPACES_STORAGE_KEY,
} from '@/features/terminals/lib/utils';

const REMOTE_STATE_KEY = 'workspaces';
const REMOTE_DEBOUNCE_MS = 600;

interface RemoteWorkspaceState {
  workspaces: Workspace[];
  sessionMap: SessionWorkspaceMap;
  activeId: string;
}

async function fetchRemoteState(): Promise<RemoteWorkspaceState | null> {
  try {
    const res = await fetch(`/api/state/${REMOTE_STATE_KEY}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const payload = (await res.json()) as { value: RemoteWorkspaceState | null };
    return payload?.value ?? null;
  } catch {
    return null;
  }
}

async function pushRemoteState(state: RemoteWorkspaceState): Promise<void> {
  try {
    await fetch(`/api/state/${REMOTE_STATE_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch {
    // ignore; localStorage is still authoritative as fallback
  }
}

export interface Workspace {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

export type SessionWorkspaceMap = Record<string, string>;

const WORKSPACE_COLORS = ['#38bdf8', '#a855f7', '#f59e0b', '#34d399', '#fb7185', '#818cf8'];

const readJson = readLocal;
const writeJson = writeLocal;

function makeWorkspaceId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickColor(existing: Workspace[]): string {
  const used = new Set(existing.map((w) => w.color).filter(Boolean));
  return WORKSPACE_COLORS.find((c) => !used.has(c)) ?? WORKSPACE_COLORS[existing.length % WORKSPACE_COLORS.length];
}

export interface UseWorkspacesResult {
  workspaces: Workspace[];
  activeId: string;
  sessionMap: SessionWorkspaceMap;
  setActive: (id: string) => void;
  createWorkspace: (name?: string) => Workspace;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
  assignSession: (sessionId: string, workspaceId?: string) => void;
  unassignSession: (sessionId: string) => void;
  resolveSessionWorkspace: (sessionId: string) => string;
}

export function useWorkspaces(): UseWorkspacesResult {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string>(DEFAULT_WORKSPACE_ID);
  const [sessionMap, setSessionMap] = useState<SessionWorkspaceMap>({});
  const [hydrated, setHydrated] = useState(false);
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Step 1: warm from localStorage so the UI renders without a network round-trip.
    const stored = readJson<Workspace[]>(WORKSPACES_STORAGE_KEY, []);
    const map = readJson<SessionWorkspaceMap>(WORKSPACE_SESSION_MAP_KEY, {});
    const storedActive =
      typeof window !== 'undefined' ? window.localStorage.getItem(WORKSPACE_ACTIVE_KEY) : null;

    let next = stored;
    if (next.length === 0) {
      next = [
        {
          id: DEFAULT_WORKSPACE_ID,
          name: DEFAULT_WORKSPACE_NAME,
          color: WORKSPACE_COLORS[0],
          createdAt: Date.now(),
        },
      ];
      writeJson(WORKSPACES_STORAGE_KEY, next);
    }

    setWorkspaces(next);
    setSessionMap(map);
    if (storedActive && next.some((w) => w.id === storedActive)) {
      setActiveId(storedActive);
    } else {
      setActiveId(next[0].id);
    }

    // Step 2: pull authoritative state from the agent so a fresh browser/tab
    // gets the same workspaces, session map, and active tab as everywhere else.
    let cancelled = false;
    fetchRemoteState().then((remote) => {
      if (cancelled || !remote) {
        setHydrated(true);
        return;
      }
      if (remote.workspaces?.length > 0) setWorkspaces(remote.workspaces);
      if (remote.sessionMap) setSessionMap(remote.sessionMap);
      if (
        remote.activeId &&
        remote.workspaces?.some((w) => w.id === remote.activeId)
      ) {
        setActiveId(remote.activeId);
      }
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(WORKSPACES_STORAGE_KEY, workspaces);
  }, [workspaces, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(WORKSPACE_SESSION_MAP_KEY, sessionMap);
  }, [sessionMap, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(WORKSPACE_ACTIVE_KEY, activeId);
  }, [activeId, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    remoteSaveTimer.current = setTimeout(() => {
      void pushRemoteState({ workspaces, sessionMap, activeId });
    }, REMOTE_DEBOUNCE_MS);
    return () => {
      if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    };
  }, [workspaces, sessionMap, activeId, hydrated]);

  const setActive = useCallback((id: string) => setActiveId(id), []);

  const createWorkspace = useCallback((name?: string): Workspace => {
    const trimmed = (name ?? '').trim();
    let workspace: Workspace = {
      id: makeWorkspaceId(),
      name: '',
      color: '',
      createdAt: Date.now(),
    };
    setWorkspaces((current) => {
      const fallbackName = trimmed || `workspace ${current.length + 1}`;
      workspace = {
        ...workspace,
        name: fallbackName,
        color: pickColor(current),
      };
      return [...current, workspace];
    });
    setActiveId(workspace.id);
    return workspace;
  }, []);

  const renameWorkspace = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setWorkspaces((current) =>
      current.map((w) => (w.id === id ? { ...w, name: trimmed } : w))
    );
  }, []);

  const deleteWorkspace = useCallback((id: string) => {
    setWorkspaces((current) => {
      if (current.length <= 1) return current;
      const next = current.filter((w) => w.id !== id);
      setActiveId((currentActive) => (currentActive === id ? next[0].id : currentActive));
      return next;
    });
    setSessionMap((current) => {
      const next: SessionWorkspaceMap = {};
      for (const [sid, wid] of Object.entries(current)) {
        if (wid !== id) next[sid] = wid;
      }
      return next;
    });
  }, []);

  const assignSession = useCallback(
    (sessionId: string, workspaceId?: string) => {
      const target = workspaceId ?? activeId;
      setSessionMap((current) => {
        if (current[sessionId] === target) return current;
        return { ...current, [sessionId]: target };
      });
    },
    [activeId]
  );

  const unassignSession = useCallback((sessionId: string) => {
    setSessionMap((current) => {
      if (!(sessionId in current)) return current;
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
  }, []);

  const resolveSessionWorkspace = useCallback(
    (sessionId: string) => {
      return sessionMap[sessionId] ?? DEFAULT_WORKSPACE_ID;
    },
    [sessionMap]
  );

  return {
    workspaces,
    activeId,
    sessionMap,
    setActive,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    assignSession,
    unassignSession,
    resolveSessionWorkspace,
  };
}
