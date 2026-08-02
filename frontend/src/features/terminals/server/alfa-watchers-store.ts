// Server-side helper that fronts the agent /state/alfa-watchers store with
// atomic per-watcher upsert + delete semantics. Both the dialog and the
// /alfa skill go through these helpers so concurrent updates don't trample
// each other.

import { terminalGatewayFetch } from '@/features/terminals/server/terminal-gateway';
import { ALFA_DEFAULT_PROMPT, type AlfaWatcher } from '@/shared/types/contracts';

export type { AlfaWatcher };

const REMOTE_KEY = 'alfa-watchers';

type WatcherMap = Record<string, AlfaWatcher>;

async function readMap(): Promise<WatcherMap> {
  try {
    const res = await terminalGatewayFetch(`/state/${encodeURIComponent(REMOTE_KEY)}`);
    if (!res.ok) return {};
    const payload = (await res.json()) as { value?: WatcherMap | null };
    const value = payload?.value;
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

async function writeMap(map: WatcherMap): Promise<void> {
  await terminalGatewayFetch(`/state/${encodeURIComponent(REMOTE_KEY)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(map),
  });
}

export async function listWatchers(): Promise<AlfaWatcher[]> {
  const map = await readMap();
  return Object.values(map).sort((a, b) => a.createdAt - b.createdAt);
}

export async function upsertWatcher(input: Omit<AlfaWatcher, 'createdAt'> & { createdAt?: number }): Promise<AlfaWatcher> {
  const map = await readMap();
  const previous = map[input.id];
  const watcher: AlfaWatcher = {
    ...input,
    createdAt: input.createdAt ?? previous?.createdAt ?? Date.now(),
    defaultInstruction: input.defaultInstruction || ALFA_DEFAULT_PROMPT,
  };
  map[input.id] = watcher;
  await writeMap(map);
  return watcher;
}

export async function deleteWatcher(id: string): Promise<boolean> {
  const map = await readMap();
  if (!(id in map)) return false;
  delete map[id];
  await writeMap(map);
  return true;
}
