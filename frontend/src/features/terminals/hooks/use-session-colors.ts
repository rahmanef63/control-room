'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { readLocal, writeLocal } from '@/features/terminals/lib/local-storage';

const SESSION_COLORS_STORAGE_KEY = 'control-room:session-colors';

/**
 * Deterministic palette used when the user has not picked a color.
 * Tuned for dark-theme contrast — saturated mids, no pure primaries.
 */
export const SESSION_COLOR_PALETTE = [
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f472b6', // pink
  '#fb923c', // orange
  '#22d3ee', // cyan
  '#facc15', // yellow
  '#4ade80', // green
  '#f87171', // rose
] as const;

export type SessionColors = Record<string, string>;

const readStored = (): SessionColors =>
  readLocal<SessionColors>(SESSION_COLORS_STORAGE_KEY, {});
const writeStored = (value: SessionColors): void =>
  writeLocal(SESSION_COLORS_STORAGE_KEY, value);

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Stable color for a session id when nothing is stored. */
export function defaultColorFor(sessionId: string): string {
  return SESSION_COLOR_PALETTE[hashCode(sessionId) % SESSION_COLOR_PALETTE.length];
}

/**
 * Module-level store so every `useSessionColors()` caller sees the same
 * snapshot in real time. Before this, each hook instance had its own
 * useState → picking a color in the alfa dialog would NOT update the
 * matching terminal pane's border until the page refreshed.
 */
let snapshot: SessionColors = {};
const listeners = new Set<() => void>();
let hydrated = false;

function ensureHydrated(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  snapshot = readStored();
  // Cross-tab sync — picker in another tab also fans out.
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_COLORS_STORAGE_KEY) return;
    snapshot = readStored();
    listeners.forEach((notify) => notify());
  });
}

function subscribe(notify: () => void): () => void {
  ensureHydrated();
  listeners.add(notify);
  return () => listeners.delete(notify);
}

const EMPTY_SNAPSHOT: SessionColors = {};
function getSnapshot(): SessionColors {
  return hydrated ? snapshot : EMPTY_SNAPSHOT;
}
function getServerSnapshot(): SessionColors {
  return EMPTY_SNAPSHOT;
}

function publish(next: SessionColors): void {
  snapshot = next;
  writeStored(next);
  listeners.forEach((notify) => notify());
}

export interface UseSessionColorsResult {
  colors: SessionColors;
  /** Resolved color — user-picked override or deterministic default. */
  colorOf: (sessionId: string) => string;
  setColor: (sessionId: string, color: string) => void;
  clearColor: (sessionId: string) => void;
  pruneTo: (liveSessionIds: string[]) => void;
}

export function useSessionColors(): UseSessionColorsResult {
  const colors = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const colorOf = useCallback(
    (sessionId: string): string => colors[sessionId] ?? defaultColorFor(sessionId),
    [colors]
  );

  const setColor = useCallback((sessionId: string, color: string) => {
    if (snapshot[sessionId] === color) return;
    publish({ ...snapshot, [sessionId]: color });
  }, []);

  const clearColor = useCallback((sessionId: string) => {
    if (!(sessionId in snapshot)) return;
    const next = { ...snapshot };
    delete next[sessionId];
    publish(next);
  }, []);

  const pruneTo = useCallback((liveSessionIds: string[]) => {
    const liveSet = new Set(liveSessionIds);
    let changed = false;
    const next: SessionColors = {};
    for (const [id, value] of Object.entries(snapshot)) {
      if (liveSet.has(id)) next[id] = value;
      else changed = true;
    }
    if (!changed) return;
    publish(next);
  }, []);

  return { colors, colorOf, setColor, clearColor, pruneTo };
}
