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


export type BroadcastInputPost = (sessionId: string, data: string) => Promise<void>;

/** Preserve keystroke order independently for every target terminal. */
export class BroadcastInputQueue {
	private tails = new Map<string, Promise<void>>();

	constructor(private readonly post: BroadcastInputPost) {}

	enqueue(sessionId: string, data: string): void {
		const previous = this.tails.get(sessionId) ?? Promise.resolve();
		const current = previous
			.catch(() => undefined)
			.then(() => this.post(sessionId, data))
			.catch(() => undefined);
		this.tails.set(sessionId, current);
		void current.then(() => {
			if (this.tails.get(sessionId) === current) this.tails.delete(sessionId);
		});
	}

	async flush(sessionId?: string): Promise<void> {
		if (sessionId) {
			const tail = this.tails.get(sessionId);
			if (tail) await tail;
			return;
		}
		await Promise.all([...this.tails.values()]);
	}
}
