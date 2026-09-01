import { readLocal, writeLocal } from '$lib/local-storage';
import type { TerminalSession } from './types';
import {
	HISTORY_STORAGE_KEY,
	clearHistoryForWorkspace,
	markHistoryClosed,
	normalizeHistory,
	removeHistoryEntries,
	trimHistory,
	upsertHistoryEntry,
	type TerminalHistoryEntry
} from './history';

class TerminalHistoryState {
	entries = $state<TerminalHistoryEntry[]>([]);
	hydrated = $state(false);

	init(): void {
		if (this.hydrated || typeof window === 'undefined') return;
		this.entries = trimHistory(
			normalizeHistory(readLocal<unknown>(HISTORY_STORAGE_KEY, []))
		);
		this.hydrated = true;
	}

	upsert(session: TerminalSession, workspaceId?: string): void {
		this.#publish(upsertHistoryEntry(this.entries, session, workspaceId));
	}

	markClosed(ids: readonly string[], now = Date.now()): void {
		this.#publish(markHistoryClosed(this.entries, ids, now));
	}

	remove(id: string): void {
		this.#publish(removeHistoryEntries(this.entries, [id]));
	}

	removeMany(ids: readonly string[]): void {
		this.#publish(removeHistoryEntries(this.entries, ids));
	}

	clear(workspaceId?: string): void {
		this.#publish(clearHistoryForWorkspace(this.entries, workspaceId));
	}

	#publish(next: TerminalHistoryEntry[]): void {
		if (next === this.entries) return;
		this.entries = next;
		writeLocal(HISTORY_STORAGE_KEY, next);
	}
}

export const terminalHistory = new TerminalHistoryState();
