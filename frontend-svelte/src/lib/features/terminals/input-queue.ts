export type TerminalInputPost = (sessionId: string, data: string) => Promise<void>;

/** Preserve keystroke order independently for every terminal target. */
export class OrderedTerminalInputQueue {
	private tails = new Map<string, Promise<void>>();

	constructor(private readonly post: TerminalInputPost) {}

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
