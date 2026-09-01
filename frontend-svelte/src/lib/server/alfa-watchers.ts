import { terminalGatewayFetch } from '$lib/server/gateway';
import {
	ALFA_DEFAULT_PROMPT,
	normalizeWatcher,
	normalizeWatcherMap,
	sortedWatchers,
	type AlfaWatcher,
	type WatcherMap
} from '$lib/features/patrol/alfa';

const REMOTE_KEY = 'alfa-watchers';

async function readMap(): Promise<WatcherMap> {
	try {
		const response = await terminalGatewayFetch(`/state/${encodeURIComponent(REMOTE_KEY)}`);
		if (!response.ok) return {};
		const payload = (await response.json()) as { value?: unknown };
		return normalizeWatcherMap(payload.value);
	} catch {
		return {};
	}
}

async function writeMap(map: WatcherMap): Promise<void> {
	const response = await terminalGatewayFetch(`/state/${encodeURIComponent(REMOTE_KEY)}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(map)
	});
	if (!response.ok) throw new Error(`Watcher state write failed (${response.status})`);
}

export async function listWatchers(): Promise<AlfaWatcher[]> {
	return sortedWatchers(await readMap());
}

export async function upsertWatcher(
	input: Omit<AlfaWatcher, 'createdAt'> & { createdAt?: number }
): Promise<AlfaWatcher> {
	const map = await readMap();
	const previous = map[input.id];
	const watcher = normalizeWatcher({
		...input,
		createdAt: input.createdAt ?? previous?.createdAt ?? Date.now(),
		defaultInstruction: input.defaultInstruction || ALFA_DEFAULT_PROMPT
	});
	if (!watcher) throw new Error('Invalid watcher');
	map[watcher.id] = watcher;
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
