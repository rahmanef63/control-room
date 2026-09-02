import type { TerminalSession } from '$lib/features/terminals/types';

export const ALFA_WATCHERS_STORAGE_KEY = 'control-room:alfa-watchers';
export const ALFA_DEFAULT_PROMPT = 'please continue as ur recommended, ultrathink';
export const ALFA_PATROL_SENIOR_FULLSTACK_PROMPT = [
	'[PATROL-MODE: SENIOR-FULLSTACK]',
	"Read the target pane's recent buffer. Infer project context (SvelteKit,",
	'Node agent boundaries, design system, deploy pipeline,',
	'etc.). Pick the next concrete step a senior fullstack engineer would',
	'take. Invoke any relevant skill (/audit-bp, /rr-prep, /rr-send,',
	'/sc-git, /sc-dokploy, /verify, ...) when it actually helps.',
	'Continue autonomously, ultrathink.'
].join(' ');
export const ALFA_PATROL_MODES = ['static', 'patrol-senior-fullstack'] as const;
export type AlfaPatrolMode = (typeof ALFA_PATROL_MODES)[number];

export interface AlfaWatcher {
	id: string;
	label?: string;
	watchedSessionIds: string[];
	instructions: Record<string, string>;
	defaultInstruction: string;
	mode?: AlfaPatrolMode;
	scopeWorkspaceId?: string;
	createdAt: number;
	silenceThresholdMs?: number;
}

type PatrolPingEvent = 'waiting' | 'done';
export interface PatrolPing {
	id: string;
	alfaId: string;
	sessionId: string;
	title: string;
	prompt: string;
	activityState: PatrolPingEvent;
	firedAt: number;
	enqueuedAt: number;
	acknowledged: boolean;
	acknowledgedAt?: number;
}

export type WatcherMap = Record<string, AlfaWatcher>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeWatcher(value: unknown): AlfaWatcher | null {
	if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null;
	const watchedSessionIds = Array.isArray(value.watchedSessionIds)
		? [...new Set(value.watchedSessionIds.filter((item): item is string => typeof item === 'string' && Boolean(item)))]
		: [];
	const instructions = isRecord(value.instructions)
		? Object.fromEntries(
				Object.entries(value.instructions).filter(
					(entry): entry is [string, string] => typeof entry[1] === 'string'
				)
			)
		: {};
	const mode = typeof value.mode === 'string' && (ALFA_PATROL_MODES as readonly string[]).includes(value.mode)
		? (value.mode as AlfaPatrolMode)
		: undefined;
	return {
		id: value.id,
		...(typeof value.label === 'string' && value.label ? { label: value.label } : {}),
		watchedSessionIds,
		instructions,
		defaultInstruction:
			typeof value.defaultInstruction === 'string' && value.defaultInstruction.trim()
				? value.defaultInstruction
				: ALFA_DEFAULT_PROMPT,
		...(mode ? { mode } : {}),
		...(typeof value.scopeWorkspaceId === 'string' && value.scopeWorkspaceId
			? { scopeWorkspaceId: value.scopeWorkspaceId }
			: {}),
		createdAt:
			typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
				? value.createdAt
				: Date.now(),
		...(typeof value.silenceThresholdMs === 'number' && Number.isFinite(value.silenceThresholdMs)
			? { silenceThresholdMs: Math.max(0, value.silenceThresholdMs) }
			: {})
	};
}

export function normalizeWatcherMap(value: unknown): WatcherMap {
	if (!isRecord(value)) return {};
	const map: WatcherMap = {};
	for (const entry of Object.values(value)) {
		const watcher = normalizeWatcher(entry);
		if (watcher) map[watcher.id] = watcher;
	}
	return map;
}

export function watcherMap(watchers: readonly AlfaWatcher[]): WatcherMap {
	return Object.fromEntries(watchers.map((watcher) => [watcher.id, watcher]));
}

export function sortedWatchers(map: WatcherMap): AlfaWatcher[] {
	return Object.values(map).sort((a, b) => a.createdAt - b.createdAt);
}

export function createWatcher(
	session: Pick<TerminalSession, 'id' | 'title'>,
	options: { workspaceId?: string; now?: number } = {}
): AlfaWatcher {
	return {
		id: session.id,
		label: session.title,
		watchedSessionIds: [],
		instructions: {},
		defaultInstruction: ALFA_DEFAULT_PROMPT,
		mode: 'static',
		...(options.workspaceId ? { scopeWorkspaceId: options.workspaceId } : {}),
		createdAt: options.now ?? Date.now()
	};
}

export function assignTarget(
	watchers: readonly AlfaWatcher[],
	destinationAlfaId: string | null,
	targetSessionId: string
): AlfaWatcher[] {
	return watchers.map((watcher) => {
		const without = watcher.watchedSessionIds.filter((id) => id !== targetSessionId);
		if (watcher.id === destinationAlfaId) {
			return {
				...watcher,
				watchedSessionIds: without.includes(targetSessionId) ? without : [...without, targetSessionId]
			};
		}
		if (without.length !== watcher.watchedSessionIds.length) {
			const instructions = { ...watcher.instructions };
			delete instructions[targetSessionId];
			return { ...watcher, watchedSessionIds: without, instructions };
		}
		return watcher;
	});
}

export function pruneWatchers(
	watchers: readonly AlfaWatcher[],
	liveSessionIds: readonly string[]
): { watchers: AlfaWatcher[]; removedIds: string[]; changedIds: string[] } {
	const live = new Set(liveSessionIds);
	const removedIds: string[] = [];
	const changedIds: string[] = [];
	const next: AlfaWatcher[] = [];
	for (const watcher of watchers) {
		if (!live.has(watcher.id)) {
			removedIds.push(watcher.id);
			continue;
		}
		const watchedSessionIds = watcher.watchedSessionIds.filter((id) => live.has(id));
		if (watchedSessionIds.length !== watcher.watchedSessionIds.length) {
			const keep = new Set(watchedSessionIds);
			const instructions = Object.fromEntries(
				Object.entries(watcher.instructions).filter(([id]) => keep.has(id))
			);
			next.push({ ...watcher, watchedSessionIds, instructions });
			changedIds.push(watcher.id);
		} else {
			next.push(watcher);
		}
	}
	return { watchers: next, removedIds, changedIds };
}

export function ownerOfTarget(watchers: readonly AlfaWatcher[], sessionId: string): AlfaWatcher | undefined {
	return watchers.find((watcher) => watcher.watchedSessionIds.includes(sessionId));
}

export function activeWatchedCount(watchers: readonly AlfaWatcher[], sessions: readonly Pick<TerminalSession, 'id' | 'status'>[]): number {
	const live = new Set(sessions.filter((session) => session.status === 'running').map((session) => session.id));
	const watched = new Set<string>();
	for (const watcher of watchers) {
		for (const id of watcher.watchedSessionIds) if (live.has(id)) watched.add(id);
	}
	return watched.size;
}

export interface PatrolPingGroup {
	sessionId: string;
	title: string;
	items: PatrolPing[];
	latestAt: number;
}

export function pendingPingGroups(
	pings: readonly PatrolPing[],
	sessions: readonly Pick<TerminalSession, 'id' | 'title'>[]
): PatrolPingGroup[] {
	const byTarget = new Map<string, PatrolPing[]>();
	for (const ping of pings) {
		if (ping.acknowledged) continue;
		const list = byTarget.get(ping.sessionId) ?? [];
		list.push(ping);
		byTarget.set(ping.sessionId, list);
	}
	return [...byTarget.entries()]
		.map(([sessionId, items]) => {
			const sorted = items.slice().sort((a, b) => b.enqueuedAt - a.enqueuedAt);
			const session = sessions.find((candidate) => candidate.id === sessionId);
			return {
				sessionId,
				title: session?.title ?? sorted[0]?.title ?? sessionId.slice(0, 8),
				items: sorted,
				latestAt: sorted[0]?.enqueuedAt ?? 0
			};
		})
		.sort((a, b) => b.latestAt - a.latestAt);
}
