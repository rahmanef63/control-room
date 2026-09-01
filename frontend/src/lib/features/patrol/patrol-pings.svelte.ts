import type { PatrolPing } from './alfa';

const POLL_MS = 8000;

class PatrolPingsState {
	pings = $state<PatrolPing[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	enabled = $state(false);
	#timer: ReturnType<typeof setInterval> | null = null;

	get pendingCount(): number {
		return this.pings.filter((ping) => !ping.acknowledged).length;
	}

	setEnabled(value: boolean): void {
		if (this.enabled === value) return;
		this.enabled = value;
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
		if (!value) return;
		void this.refresh();
		this.#timer = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			void this.refresh();
		}, POLL_MS);
	}

	destroy(): void {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
		this.enabled = false;
	}

	async refresh(): Promise<void> {
		if (this.loading) return;
		this.loading = true;
		try {
			const response = await fetch('/api/patrol/pending?all=1', { cache: 'no-store' });
			if (!response.ok) throw new Error(`Patrol refresh failed (${response.status})`);
			const payload = (await response.json()) as { pings?: PatrolPing[] };
			this.pings = Array.isArray(payload.pings) ? payload.pings : [];
			this.error = null;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Patrol refresh failed';
		} finally {
			this.loading = false;
		}
	}

	async acknowledge(id: string): Promise<boolean> {
		try {
			const response = await fetch(`/api/patrol/pending/${encodeURIComponent(id)}/ack`, { method: 'POST' });
			if (!response.ok) throw new Error(`Patrol ack failed (${response.status})`);
			const payload = (await response.json()) as { ping?: PatrolPing };
			if (payload.ping) {
				this.pings = this.pings.map((ping) => (ping.id === id ? payload.ping! : ping));
			} else {
				await this.refresh();
			}
			this.error = null;
			return true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Patrol ack failed';
			return false;
		}
	}
}

export const patrolPings = new PatrolPingsState();
