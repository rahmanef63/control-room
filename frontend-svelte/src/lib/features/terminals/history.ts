import type { TerminalProfile, TerminalSession } from './types';

export const HISTORY_STORAGE_KEY = 'vps-control-room.terminal-history';
export const HISTORY_MAX_ENTRIES = 40;

export interface TerminalHistoryEntry {
	id: string;
	profile: TerminalProfile;
	title: string;
	cwd: string;
	agentProfileId?: string;
	environmentId?: string;
	workspaceId?: string;
	updatedAt: number;
	closedAt?: number;
}

export function normalizeHistory(input: unknown): TerminalHistoryEntry[] {
	if (!Array.isArray(input)) return [];
	return input.filter(
		(entry): entry is TerminalHistoryEntry =>
			Boolean(entry) && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
	);
}

export function trimHistory(entries: readonly TerminalHistoryEntry[]): TerminalHistoryEntry[] {
	return [...entries]
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(0, HISTORY_MAX_ENTRIES);
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
		updatedAt: session.updated_at ?? Date.now()
	};
}

export function upsertHistoryEntry(
	entries: readonly TerminalHistoryEntry[],
	session: TerminalSession,
	workspaceId?: string
): TerminalHistoryEntry[] {
	const previous = entries.find((entry) => entry.id === session.id);
	const resolvedWorkspace = workspaceId ?? previous?.workspaceId;
	const entry = sessionToHistoryEntry(session, resolvedWorkspace);
	if (
		previous &&
		previous.profile === entry.profile &&
		previous.title === entry.title &&
		previous.cwd === entry.cwd &&
		previous.agentProfileId === entry.agentProfileId &&
		previous.environmentId === entry.environmentId &&
		previous.workspaceId === entry.workspaceId &&
		previous.updatedAt === entry.updatedAt &&
		previous.closedAt === undefined
	) {
		return entries as TerminalHistoryEntry[];
	}
	return trimHistory([entry, ...entries.filter((item) => item.id !== entry.id)]);
}

export function markHistoryClosed(
	entries: readonly TerminalHistoryEntry[],
	ids: readonly string[],
	now = Date.now()
): TerminalHistoryEntry[] {
	if (ids.length === 0) return entries as TerminalHistoryEntry[];
	const idSet = new Set(ids);
	let changed = false;
	const next = entries.map((entry) => {
		if (!idSet.has(entry.id) || entry.closedAt) return entry;
		changed = true;
		return { ...entry, closedAt: now };
	});
	return changed ? trimHistory(next) : (entries as TerminalHistoryEntry[]);
}

export function removeHistoryEntries(
	entries: readonly TerminalHistoryEntry[],
	ids: readonly string[]
): TerminalHistoryEntry[] {
	if (ids.length === 0) return entries as TerminalHistoryEntry[];
	const idSet = new Set(ids);
	const next = entries.filter((entry) => !idSet.has(entry.id));
	return next.length === entries.length ? (entries as TerminalHistoryEntry[]) : next;
}

export function clearHistoryForWorkspace(
	entries: readonly TerminalHistoryEntry[],
	workspaceId?: string
): TerminalHistoryEntry[] {
	if (!workspaceId) return entries.length === 0 ? (entries as TerminalHistoryEntry[]) : [];
	const next = entries.filter((entry) => entry.workspaceId !== workspaceId);
	return next.length === entries.length ? (entries as TerminalHistoryEntry[]) : next;
}

export function shortenCwd(cwd: string, maxLength = 42): string {
	if (!cwd) return '~';
	const home = cwd.replace(/^\/home\/[^/]+/, '~');
	if (home.length <= maxLength) return home;
	const parts = home.split('/');
	if (parts.length <= 3) return home;
	return `${parts[0]}/…/${parts.slice(-2).join('/')}`;
}

export function relativeHistoryTime(ts: number, now = Date.now()): string {
	const min = Math.round((now - ts) / 60_000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	return `${Math.round(hr / 24)}d ago`;
}
