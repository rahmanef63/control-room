// Tiny safe-localStorage helpers. Consolidates the readJson/writeJson +
// try/catch + window guard pattern repeated across use-alfa-watchers,
// use-pane-agent-overrides, use-app-settings, use-workspaces.
//
// No reactivity here — hooks layer their own useState/useEffect on top.

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

export function removeLocal(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
