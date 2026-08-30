// Svelte 5 runes port of
// frontend/src/features/terminals/hooks/use-fullscreen.ts. Call from a
// component's <script> top level (same rule as $effect/$state — must run
// during component initialization); the returned `isFullscreen` is a live
// getter, not a snapshot.

export interface UseFullscreenResult {
	readonly isFullscreen: boolean;
	enter: () => Promise<void>;
	exit: () => Promise<void>;
	toggle: () => Promise<void>;
}

export function useFullscreen(): UseFullscreenResult {
	let isFullscreen = $state(false);

	$effect(() => {
		if (typeof document === 'undefined') return;
		const handler = () => {
			isFullscreen = !!document.fullscreenElement;
		};
		document.addEventListener('fullscreenchange', handler);
		return () => document.removeEventListener('fullscreenchange', handler);
	});

	async function enter(): Promise<void> {
		if (typeof document === 'undefined') return;
		try {
			const el = document.documentElement as HTMLElement & {
				webkitRequestFullscreen?: () => Promise<void>;
			};
			if (el.requestFullscreen) {
				await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
			} else if (el.webkitRequestFullscreen) {
				await el.webkitRequestFullscreen();
			}
		} catch {
			// Fall through — CSS layer handles fallback
		}
		isFullscreen = true;
	}

	async function exit(): Promise<void> {
		if (typeof document === 'undefined') return;
		try {
			const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
			if (document.fullscreenElement && document.exitFullscreen) {
				await document.exitFullscreen();
			} else if (doc.webkitExitFullscreen) {
				await doc.webkitExitFullscreen();
			}
		} catch {
			// ignore
		}
		isFullscreen = false;
	}

	async function toggle(): Promise<void> {
		if (isFullscreen) {
			await exit();
		} else {
			await enter();
		}
	}

	return {
		get isFullscreen() {
			return isFullscreen;
		},
		enter,
		exit,
		toggle
	};
}
