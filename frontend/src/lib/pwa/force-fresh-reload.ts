/**
 * Ported near-verbatim from frontend/src/shared/runtime/force-fresh-reload.ts
 * — plain browser APIs (ServiceWorker, CacheStorage, sessionStorage), nothing
 * React/Next-specific, so no changes were needed beyond the import path.
 *
 * Hard-recovery: unregister all service workers, drop every named cache,
 * then reload with a `_v=<ts>` cache-buster on the URL so any HTTP caching
 * layer (CDN, proxy, browser HTTP cache) also revalidates.
 *
 * Each step is wrapped in withTimeout(…, 1500) — even if SW unregister or
 * Cache Storage hangs (rare on iOS PWA), we still reach the reload within
 * ~3s instead of leaving the user staring at a broken page.
 */

const STEP_TIMEOUT_MS = 1500;

function withTimeout(p: Promise<unknown>, ms: number): Promise<void> {
	return Promise.race([
		p.then(() => undefined).catch(() => undefined),
		new Promise<void>((resolve) => setTimeout(resolve, ms))
	]);
}

export async function forceFreshReload(): Promise<void> {
	const swWork = (async () => {
		if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
			const regs = await navigator.serviceWorker.getRegistrations();
			await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
		}
	})();
	await withTimeout(swWork, STEP_TIMEOUT_MS);

	const cacheWork = (async () => {
		if (typeof caches !== 'undefined') {
			const keys = await caches.keys();
			await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
		}
	})();
	await withTimeout(cacheWork, STEP_TIMEOUT_MS);

	if (typeof window !== 'undefined') {
		const url = new URL(window.location.href);
		url.searchParams.set('_v', Date.now().toString(36));
		window.location.replace(url.toString());
	}
}

const RELOAD_GUARD_KEY = 'vps-control-room:auto-reload-at';
const GUARD_WINDOW_MS = 90_000;

/** Returns true on first call within the 90s window; false thereafter.
 *  When sessionStorage is unavailable (iOS private mode, sandboxed iframes)
 *  we accept one possible extra reload over leaving the user stuck. */
export function claimAutoReloadOnce(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const last = parseInt(window.sessionStorage.getItem(RELOAD_GUARD_KEY) ?? '0', 10);
		if (Number.isFinite(last) && Date.now() - last < GUARD_WINDOW_MS) return false;
		window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
		return true;
	} catch {
		return true;
	}
}
