'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { readLocal, writeLocal } from '@/features/terminals/lib/local-storage';
import { ALFA_WATCHERS_STORAGE_KEY } from '@/features/terminals/lib/utils';
import { ALFA_DEFAULT_PROMPT, type AlfaWatcher } from '@/shared/types/contracts';

export { ALFA_DEFAULT_PROMPT, type AlfaWatcher };

type WatcherMap = Record<string, AlfaWatcher>;

const readLocalCache = (): WatcherMap => readLocal<WatcherMap>(ALFA_WATCHERS_STORAGE_KEY, {});
const writeLocalCache = (map: WatcherMap): void => writeLocal(ALFA_WATCHERS_STORAGE_KEY, map);

// ---------------------------------------------------------------------------
// Module-level singleton store.
//
// Every pane plus the registry dialog reads watcher state, so a per-hook
// fetch+interval would mean N polls of /api/alfa/watchers per tick. Instead we
// keep ONE map, ONE poller, and fan out via useSyncExternalStore. This is how
// alfa-spawned panes and their watch relationships now appear WITHOUT a manual
// refresh: the poller pulls server truth on an interval and notifies everyone.
// ---------------------------------------------------------------------------

const POLL_MS = 6000;

let cache: WatcherMap = {};
let snapshot: AlfaWatcher[] = [];
const listeners = new Set<() => void>();
let poller: ReturnType<typeof setInterval> | null = null;
let hydrated = false;

function recomputeSnapshot(): void {
  snapshot = Object.values(cache).sort((a, b) => a.createdAt - b.createdAt);
}

function setCache(next: WatcherMap): void {
  cache = next;
  writeLocalCache(next);
  recomputeSnapshot();
  for (const listener of listeners) listener();
}

async function fetchAll(): Promise<AlfaWatcher[] | null> {
  try {
    const res = await fetch('/api/alfa/watchers', { cache: 'no-store' });
    if (!res.ok) return null;
    const payload = (await res.json()) as { watchers?: AlfaWatcher[] };
    return Array.isArray(payload.watchers) ? payload.watchers : null;
  } catch {
    return null;
  }
}

function postWatcher(watcher: AlfaWatcher): Promise<void> {
  return fetch('/api/alfa/watchers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(watcher),
  })
    .then(() => undefined)
    .catch(() => undefined);
}

function deleteWatcherRemote(id: string): Promise<void> {
  return fetch(`/api/alfa/watchers/${encodeURIComponent(id)}`, { method: 'DELETE' })
    .then(() => undefined)
    .catch(() => undefined);
}

async function pollOnce(): Promise<void> {
  if (typeof document !== 'undefined' && document.hidden) return;
  const remote = await fetchAll();
  if (!remote) return;
  const map: WatcherMap = {};
  for (const watcher of remote) map[watcher.id] = watcher;
  // Server is source of truth for existence + watch relationships. Local
  // optimistic writes (registerOrUpdate) already POSTed, so the next poll
  // reflects them — no merge needed.
  if (JSON.stringify(map) !== JSON.stringify(cache)) setCache(map);
}

function ensurePoller(): void {
  if (!hydrated) {
    cache = readLocalCache();
    recomputeSnapshot();
    hydrated = true;
  }
  if (poller) return;
  void pollOnce();
  poller = setInterval(() => void pollOnce(), POLL_MS);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  ensurePoller();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && poller) {
      clearInterval(poller);
      poller = null;
    }
  };
}

function getSnapshot(): AlfaWatcher[] {
  return snapshot;
}

const EMPTY: AlfaWatcher[] = [];
function getServerSnapshot(): AlfaWatcher[] {
  return EMPTY;
}

export interface UseAlfaWatchersResult {
  watchers: AlfaWatcher[];
  watcherOf: (sessionId: string) => AlfaWatcher | undefined;
  isAlfa: (sessionId: string) => boolean;
  isWatchedByAny: (sessionId: string) => boolean;
  watchersOfTarget: (sessionId: string) => AlfaWatcher[];
  registerOrUpdate: (input: Omit<AlfaWatcher, 'createdAt'> & { createdAt?: number }) => void;
  deregister: (alfaId: string) => void;
  pruneTo: (liveSessionIds: string[]) => void;
}

export function useAlfaWatchers(): UseAlfaWatchersResult {
  const watchers = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const registerOrUpdate = useCallback(
    (input: Omit<AlfaWatcher, 'createdAt'> & { createdAt?: number }) => {
      const previous = cache[input.id];
      const next: AlfaWatcher = {
        ...input,
        createdAt: input.createdAt ?? previous?.createdAt ?? Date.now(),
        defaultInstruction: input.defaultInstruction || ALFA_DEFAULT_PROMPT,
      };
      setCache({ ...cache, [input.id]: next });
      void postWatcher(next);
    },
    []
  );

  const deregister = useCallback((alfaId: string) => {
    if (!(alfaId in cache)) return;
    const next = { ...cache };
    delete next[alfaId];
    setCache(next);
    void deleteWatcherRemote(alfaId);
  }, []);

  const pruneTo = useCallback((liveSessionIds: string[]) => {
    const liveSet = new Set(liveSessionIds);
    const next: WatcherMap = {};
    const removed: string[] = [];
    const updated: AlfaWatcher[] = [];
    let changed = false;
    for (const [id, value] of Object.entries(cache)) {
      if (!liveSet.has(id)) {
        changed = true;
        removed.push(id);
        continue;
      }
      const filteredWatched = value.watchedSessionIds.filter((sid) => liveSet.has(sid));
      if (filteredWatched.length !== value.watchedSessionIds.length) {
        changed = true;
        const reshaped: AlfaWatcher = { ...value, watchedSessionIds: filteredWatched };
        updated.push(reshaped);
        next[id] = reshaped;
      } else {
        next[id] = value;
      }
    }
    if (!changed) return;
    setCache(next);
    for (const id of removed) void deleteWatcherRemote(id);
    for (const watcher of updated) void postWatcher(watcher);
  }, []);

  const watcherOf = useCallback(
    (sessionId: string) => watchers.find((w) => w.id === sessionId),
    [watchers]
  );
  const isAlfa = useCallback(
    (sessionId: string) => watchers.some((w) => w.id === sessionId),
    [watchers]
  );
  const isWatchedByAny = useCallback(
    (sessionId: string) => watchers.some((w) => w.watchedSessionIds.includes(sessionId)),
    [watchers]
  );
  const watchersOfTarget = useCallback(
    (sessionId: string) => watchers.filter((w) => w.watchedSessionIds.includes(sessionId)),
    [watchers]
  );

  return {
    watchers,
    watcherOf,
    isAlfa,
    isWatchedByAny,
    watchersOfTarget,
    registerOrUpdate,
    deregister,
    pruneTo,
  };
}
