export const SESSION_COLORS_STORAGE_KEY = 'control-room:session-colors';

/** Dark-theme palette preserved from the React implementation. */
export const SESSION_COLOR_PALETTE = [
	'#38bdf8',
	'#a78bfa',
	'#34d399',
	'#fbbf24',
	'#f472b6',
	'#fb923c',
	'#22d3ee',
	'#facc15',
	'#4ade80',
	'#f87171'
] as const;

export type SessionColors = Record<string, string>;

function hashCode(value: string): number {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(index);
		hash |= 0;
	}
	return Math.abs(hash);
}

/** Stable fallback color when a session has no user override. */
export function defaultColorFor(sessionId: string): string {
	return SESSION_COLOR_PALETTE[hashCode(sessionId) % SESSION_COLOR_PALETTE.length];
}

/** Return the original object when no stale override needs pruning. */
export function pruneSessionColors(colors: SessionColors, liveSessionIds: readonly string[]): SessionColors {
	const live = new Set(liveSessionIds);
	let changed = false;
	const next: SessionColors = {};
	for (const [id, color] of Object.entries(colors)) {
		if (live.has(id)) next[id] = color;
		else changed = true;
	}
	return changed ? next : colors;
}
