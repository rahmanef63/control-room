<script lang="ts">
	// Svelte 5 runes port of frontend/src/shared/pwa/version-guard.tsx.
	// Polls /api/version and prompts a hard-refresh (unregister SW + drop
	// caches + reload) when the running build differs from what the server
	// has. Dismissal is persisted in localStorage per build id, so a reload —
	// and any other open tab — stops re-nagging for the same version.
	//
	// `PUBLIC_BUILD_ID` mirrors NEXT_PUBLIC_BUILD_ID from next.config.ts's
	// stamping logic (COMMIT_SHA/GITHUB_SHA at deploy time). Read via
	// `$env/dynamic/public` (not `$env/static/public`) so `bun run dev`
	// doesn't fail to start just because the var isn't set — the original
	// component already treats an absent value as 'unknown' and skips
	// polling entirely, which this preserves.
	import { onMount } from 'svelte';
	import { RefreshCcw, X } from 'lucide-svelte';
	import { env } from '$env/dynamic/public';

	import { forceFreshReload } from './force-fresh-reload';

	const POLL_INTERVAL_MS = 5 * 60 * 1000;
	const FOCUS_DEBOUNCE_MS = 30 * 1000;
	const BAKED_BUILD_ID = env.PUBLIC_BUILD_ID ?? 'unknown';
	const DISMISS_STORAGE_KEY = 'vps-cr-vguard-dismissed';

	let latest = $state<string | null>(null);
	let dismissedBuild = $state<string | null>(null);
	let working = $state(false);

	async function fetchServerBuildId(): Promise<string | null> {
		try {
			const res = await fetch('/api/version', { cache: 'no-store' });
			if (!res.ok) return null;
			const json = (await res.json()) as { buildId?: string };
			return json.buildId ?? null;
		} catch {
			return null;
		}
	}

	async function check(): Promise<void> {
		const v = await fetchServerBuildId();
		if (!v || v === 'unknown') return;
		latest = v;
	}

	onMount(() => {
		try {
			const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
			if (stored) dismissedBuild = stored;
		} catch {
			// storage blocked
		}
		const onStorage = (e: StorageEvent) => {
			if (e.key === DISMISS_STORAGE_KEY) dismissedBuild = e.newValue;
		};
		window.addEventListener('storage', onStorage);

		if (BAKED_BUILD_ID === 'unknown') {
			// dev — skip polling, still honor cross-tab dismissal for consistency.
			return () => window.removeEventListener('storage', onStorage);
		}

		let lastPolledAt = Date.now();
		void check();

		const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS);
		const onVisible = () => {
			if (document.visibilityState !== 'visible') return;
			if (Date.now() - lastPolledAt < FOCUS_DEBOUNCE_MS) return;
			lastPolledAt = Date.now();
			void check();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', onVisible);

		return () => {
			window.clearInterval(interval);
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', onVisible);
			window.removeEventListener('storage', onStorage);
		};
	});

	let stale = $derived(
		!!latest &&
			latest !== BAKED_BUILD_ID &&
			BAKED_BUILD_ID !== 'unknown' &&
			latest !== dismissedBuild
	);

	async function handleRefresh(): Promise<void> {
		working = true;
		await forceFreshReload();
	}

	function handleDismiss(): void {
		dismissedBuild = latest;
		try {
			if (latest) localStorage.setItem(DISMISS_STORAGE_KEY, latest);
		} catch {
			// storage blocked
		}
	}
</script>

{#if stale}
	<div role="status" aria-live="polite" class="version-guard">
		<div class="version-guard__icon"><RefreshCcw size={14} /></div>
		<div class="version-guard__body">
			<p class="version-guard__title">New version available</p>
			<p class="version-guard__sub">Hard-refresh to clear cache &amp; storage.</p>
		</div>
		<button
			type="button"
			onclick={() => void handleRefresh()}
			disabled={working}
			class="version-guard__refresh"
		>
			{working ? 'Cleaning…' : 'Refresh'}
		</button>
		<button type="button" onclick={handleDismiss} aria-label="Dismiss" class="version-guard__dismiss">
			<X size={14} />
		</button>
	</div>
{/if}

<style>
	.version-guard {
		position: fixed;
		bottom: max(1rem, env(safe-area-inset-bottom));
		left: 50%;
		transform: translateX(-50%);
		z-index: 110;
		display: flex;
		align-items: center;
		gap: 12px;
		width: calc(100% - 2rem);
		max-width: 24rem;
		border-radius: 1rem;
		border: 1px solid rgba(251, 191, 36, 0.3);
		background: rgba(17, 26, 44, 0.95);
		padding: 12px 16px;
		box-shadow: 0 16px 48px -20px rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}
	.version-guard__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		border-radius: 0.75rem;
		background: rgba(251, 191, 36, 0.15);
		color: #fcd34d;
	}
	.version-guard__body {
		min-width: 0;
		flex: 1;
	}
	.version-guard__title {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--ink);
	}
	.version-guard__sub {
		margin: 0;
		font-size: 0.72rem;
		color: var(--ink-muted);
	}
	.version-guard__refresh {
		flex-shrink: 0;
		border-radius: 0.75rem;
		border: 1px solid rgba(251, 191, 36, 0.3);
		background: rgba(251, 191, 36, 0.15);
		color: #fde68a;
		padding: 6px 12px;
		font-size: 0.72rem;
		font-weight: 600;
	}
	.version-guard__refresh:disabled {
		opacity: 0.6;
	}
	.version-guard__dismiss {
		flex-shrink: 0;
		border-radius: 0.5rem;
		padding: 4px;
		color: var(--ink-muted);
	}
	.version-guard__dismiss:hover {
		color: var(--ink);
	}
</style>
