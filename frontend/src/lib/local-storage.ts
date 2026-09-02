// Tiny safe-localStorage helpers. Verbatim port of
// frontend/src/features/terminals/lib/local-storage.ts — consolidates the
// readJson/writeJson + try/catch + window guard pattern repeated across
// use-alfa-watchers, use-pane-agent-overrides, use-app-settings,
// use-workspaces (none of those consumers are ported yet; use-app-settings
// is the first).
//
// No reactivity here — callers layer their own $state/$effect on top.

export function readLocal<T>(key: string, fallback: T): T {
	if (typeof window === 'undefined') return fallback;
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw);
		return parsed === null ? fallback : (parsed as T);
	} catch {
		return fallback;
	}
}

export function writeLocal(key: string, value: unknown): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// quota exceeded / disabled storage — ignore
	}
}
