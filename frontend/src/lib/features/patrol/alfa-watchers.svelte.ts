import { readLocal, writeLocal } from '$lib/local-storage';
import {
	ALFA_DEFAULT_PROMPT,
	ALFA_WATCHERS_STORAGE_KEY,
	normalizeWatcher,
	normalizeWatcherMap,
	ownerOfTarget,
	pruneWatchers,
	sortedWatchers,
	watcherMap,
	type AlfaWatcher,
	type WatcherMap
} from './alfa';

const POLL_MS = 6000;

class AlfaWatchersState {
	watchers = $state<AlfaWatcher[]>([]);
	hydrated = $state(false);
	remoteReady = $state(false);
	loading = $state(false);
	error = $state<string | null>(null);
	#timer: ReturnType<typeof setInterval> | null = null;

	init(): void {
		if (this.hydrated || typeof window === 'undefined') return;
		const cached = normalizeWatcherMap(readLocal<WatcherMap>(ALFA_WATCHERS_STORAGE_KEY, {}));
		this.watchers = sortedWatchers(cached);
		this.hydrated = true;
		void this.refresh();
		this.#timer = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			void this.refresh();
		}, POLL_MS);
	}

	destroy(): void {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
	}

	watcherOf(sessionId: string): AlfaWatcher | undefined {
		return this.watchers.find((watcher) => watcher.id === sessionId);
	}

	watchersOfTarget(sessionId: string): AlfaWatcher[] {
		return this.watchers.filter((watcher) => watcher.watchedSessionIds.includes(sessionId));
	}

	ownerOfTarget(sessionId: string): AlfaWatcher | undefined {
		return ownerOfTarget(this.watchers, sessionId);
	}

	isAlfa(sessionId: string): boolean {
		return Boolean(this.watcherOf(sessionId));
	}

	isWatchedByAny(sessionId: string): boolean {
		return Boolean(this.ownerOfTarget(sessionId));
	}

	async refresh(): Promise<void> {
		if (this.loading) return;
		this.loading = true;
		try {
			const response = await fetch('/api/alfa/watchers', { cache: 'no-store' });
			if (!response.ok) throw new Error(`Watcher refresh failed (${response.status})`);
			const payload = (await response.json()) as { watchers?: unknown[] };
			const next: AlfaWatcher[] = [];
			for (const entry of payload.watchers ?? []) {
				const watcher = normalizeWatcher(entry);
				if (watcher) next.push(watcher);
			}
			this.#set(next);
			this.remoteReady = true;
			this.error = null;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Watcher refresh failed';
		} finally {
			this.loading = false;
		}
	}

	async registerOrUpdate(
		input: Omit<AlfaWatcher, 'createdAt'> & { createdAt?: number }
	): Promise<AlfaWatcher | null> {
		const previous = this.watcherOf(input.id);
		const optimistic = normalizeWatcher({
			...input,
			createdAt: input.createdAt ?? previous?.createdAt ?? Date.now(),
			defaultInstruction: input.defaultInstruction || ALFA_DEFAULT_PROMPT
		});
		if (!optimistic) return null;
		this.#set([...this.watchers.filter((watcher) => watcher.id !== optimistic.id), optimistic]);
		try {
			const response = await fetch('/api/alfa/watchers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(optimistic)
			});
			if (!response.ok) throw new Error(`Watcher save failed (${response.status})`);
			const payload = (await response.json()) as { watcher?: unknown };
			const watcher = normalizeWatcher(payload.watcher) ?? optimistic;
			this.#set([...this.watchers.filter((entry) => entry.id !== watcher.id), watcher]);
			this.remoteReady = true;
			this.error = null;
			return watcher;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Watcher save failed';
			await this.refresh();
			return null;
		}
	}

	async deregister(alfaId: string): Promise<boolean> {
		if (!this.isAlfa(alfaId)) return false;
		this.#set(this.watchers.filter((watcher) => watcher.id !== alfaId));
		try {
			const response = await fetch(`/api/alfa/watchers/${encodeURIComponent(alfaId)}`, { method: 'DELETE' });
			if (!response.ok && response.status !== 404) throw new Error(`Watcher delete failed (${response.status})`);
			this.error = null;
			return response.ok;
		} catch (error) {
			this.error = error instanceof Error ? error.message : 'Watcher delete failed';
			await this.refresh();
			return false;
		}
	}

	pruneTo(liveSessionIds: string[]): void {
		if (!this.remoteReady) return;
		const result = pruneWatchers(this.watchers, liveSessionIds);
		if (result.removedIds.length === 0 && result.changedIds.length === 0) return;
		this.#set(result.watchers);
		void this.#syncPrune(result.removedIds, result.changedIds, result.watchers);
	}

	async #syncPrune(removedIds: string[], changedIds: string[], watchers: AlfaWatcher[]): Promise<void> {
		// Watcher endpoints are read-modify-write against one remote map. Serialize
		// these mutations so a delete and target-prune cannot overwrite each other.
		try {
			for (const id of removedIds) {
				await fetch(`/api/alfa/watchers/${encodeURIComponent(id)}`, { method: 'DELETE' });
			}
			for (const id of changedIds) {
				const watcher = watchers.find((entry) => entry.id === id);
				if (!watcher) continue;
				await fetch('/api/alfa/watchers', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(watcher)
				});
			}
		} catch {
			await this.refresh();
		}
	}

	#set(next: AlfaWatcher[]): void {
		this.watchers = next.slice().sort((a, b) => a.createdAt - b.createdAt);
		writeLocal(ALFA_WATCHERS_STORAGE_KEY, watcherMap(this.watchers));
	}
}

export const alfaWatchers = new AlfaWatchersState();
