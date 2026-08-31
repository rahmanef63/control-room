import type { TerminalSession } from '$lib/features/terminals/types';

type BroadcastSession = Pick<TerminalSession, 'id' | 'status'>;

/** Resolve a keyboard event into the exact running PTYs that should receive it. */
export function resolveBroadcastFanout(
	sourceId: string,
	selectedTargets: ReadonlySet<string>,
	sessions: BroadcastSession[]
): string[] {
	const runningIds = new Set(
		sessions.filter((session) => session.status === 'running').map((session) => session.id)
	);
	const ids = new Set<string>();
	for (const id of selectedTargets) {
		if (runningIds.has(id)) ids.add(id);
	}
	if (ids.size === 0) return [];
	if (runningIds.has(sourceId)) ids.add(sourceId);
	return [...ids];
}
