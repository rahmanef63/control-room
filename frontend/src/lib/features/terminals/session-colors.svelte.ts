import { readLocal, writeLocal } from '$lib/local-storage';
import {
	SESSION_COLORS_STORAGE_KEY,
	defaultColorFor,
	pruneSessionColors,
	type SessionColors
} from './session-colors';

/**
 * App-wide session-color SSOT. A module singleton matches the React
 * cross-tab behavior while making Svelte consumers reactive without
 * spawning independent per-component copies.
 */
class SessionColorsState {
	colors = $state<SessionColors>({});
	hydrated = $state(false);
	#listening = false;

	init(): void {
		if (typeof window === 'undefined') return;
		if (!this.hydrated) {
			this.colors = readLocal<SessionColors>(SESSION_COLORS_STORAGE_KEY, {});
			this.hydrated = true;
		}
		if (!this.#listening) {
			window.addEventListener('storage', this.#onStorage);
			this.#listening = true;
		}
	}

	colorOf(sessionId: string): string {
		return this.colors[sessionId] ?? defaultColorFor(sessionId);
	}

	hasOverride(sessionId: string): boolean {
		return sessionId in this.colors;
	}

	setColor(sessionId: string, color: string): void {
		if (this.colors[sessionId] === color) return;
		this.#publish({ ...this.colors, [sessionId]: color });
	}

	clearColor(sessionId: string): void {
		if (!(sessionId in this.colors)) return;
		const next = { ...this.colors };
		delete next[sessionId];
		this.#publish(next);
	}

	pruneTo(liveSessionIds: readonly string[]): void {
		const next = pruneSessionColors(this.colors, liveSessionIds);
		if (next !== this.colors) this.#publish(next);
	}

	#publish(next: SessionColors): void {
		this.colors = next;
		writeLocal(SESSION_COLORS_STORAGE_KEY, next);
	}

	#onStorage = (event: StorageEvent): void => {
		if (event.key !== SESSION_COLORS_STORAGE_KEY) return;
		this.colors = readLocal<SessionColors>(SESSION_COLORS_STORAGE_KEY, {});
	};
}

export const sessionColors = new SessionColorsState();
