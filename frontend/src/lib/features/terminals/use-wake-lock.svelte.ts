// Svelte 5 runes port of
// frontend/src/features/terminals/hooks/use-wake-lock.ts. The original took
// a plain `active: boolean` prop and relied on React's dependency array to
// re-run when it changed; runes have no dependency array, so `active` is a
// getter (`() => boolean`) that the caller passes in — reading it inside
// $effect makes the effect re-run whenever the underlying $state it closes
// over changes, e.g. `useWakeLock(() => someState.value)`.

interface WakeLockSentinel {
	release: () => Promise<void>;
	released: boolean;
	addEventListener: (type: 'release', listener: () => void) => void;
}

interface NavigatorWakeLock {
	wakeLock?: {
		request: (type: 'screen') => Promise<WakeLockSentinel>;
	};
}

export function useWakeLock(active: () => boolean): void {
	let sentinel: WakeLockSentinel | null = null;

	$effect(() => {
		if (typeof navigator === 'undefined') return;
		const nav = navigator as Navigator & NavigatorWakeLock;
		if (!nav.wakeLock) return;

		let cancelled = false;
		const isActive = active();

		async function acquire() {
			try {
				const s = await nav.wakeLock!.request('screen');
				if (cancelled) {
					await s.release().catch(() => undefined);
					return;
				}
				sentinel = s;
				s.addEventListener('release', () => {
					sentinel = null;
				});
			} catch {
				// ignore — WakeLock may be denied
			}
		}

		async function release() {
			if (!sentinel) return;
			try {
				await sentinel.release();
			} catch {
				// ignore
			}
			sentinel = null;
		}

		if (isActive) {
			void acquire();
		} else {
			void release();
		}

		function onVisibilityChange() {
			if (document.visibilityState === 'visible' && isActive && !sentinel) {
				void acquire();
			}
		}

		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', onVisibilityChange);
			void release();
		};
	});
}
