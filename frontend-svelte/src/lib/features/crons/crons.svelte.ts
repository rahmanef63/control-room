import type { CronCreateInput, CronEntry, CronUpdateInput } from './crons';

class CronsState {
	crons = $state<CronEntry[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	async refresh(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			const response = await fetch('/api/crons', { cache: 'no-store' });
			const payload = (await response.json()) as { crons?: CronEntry[]; error?: string };
			if (!response.ok) throw new Error(payload.error || 'Failed to load crons');
			this.crons = payload.crons ?? [];
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Failed to load crons';
		} finally {
			this.loading = false;
		}
	}

	async create(input: CronCreateInput): Promise<CronEntry | null> {
		this.error = null;
		try {
			const response = await fetch('/api/crons', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			const payload = (await response.json()) as { cron?: CronEntry; error?: string };
			if (!response.ok || !payload.cron) throw new Error(payload.error || 'Failed to create cron');
			this.crons = [...this.crons, payload.cron];
			return payload.cron;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Failed to create cron';
			return null;
		}
	}

	async update(id: string, input: CronUpdateInput): Promise<CronEntry | null> {
		this.error = null;
		try {
			const response = await fetch(`/api/crons/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(input)
			});
			const payload = (await response.json()) as { cron?: CronEntry; error?: string };
			if (!response.ok || !payload.cron) throw new Error(payload.error || 'Failed to update cron');
			this.crons = this.crons.map((entry) => (entry.id === id ? payload.cron! : entry));
			return payload.cron;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Failed to update cron';
			return null;
		}
	}

	async delete(id: string): Promise<boolean> {
		this.error = null;
		try {
			const response = await fetch(`/api/crons/${encodeURIComponent(id)}`, { method: 'DELETE' });
			if (response.status !== 204 && !response.ok) {
				const payload = (await response.json().catch(() => ({}))) as { error?: string };
				throw new Error(payload.error || 'Failed to delete cron');
			}
			this.crons = this.crons.filter((entry) => entry.id !== id);
			return true;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Failed to delete cron';
			return false;
		}
	}

	async run(id: string): Promise<CronEntry | null> {
		this.error = null;
		try {
			const response = await fetch(`/api/crons/${encodeURIComponent(id)}/run`, { method: 'POST' });
			const payload = (await response.json()) as { cron?: CronEntry; error?: string };
			if (!response.ok || !payload.cron) throw new Error(payload.error || 'Failed to run cron');
			this.crons = this.crons.map((entry) => (entry.id === id ? payload.cron! : entry));
			return payload.cron;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Failed to run cron';
			return null;
		}
	}
}

export const cronsState = new CronsState();
