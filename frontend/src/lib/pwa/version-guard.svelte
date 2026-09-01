<script lang="ts">
	// SvelteKit-native deploy detection. `version` is the deterministic build id
	// baked into this loaded client; `updated` polls SvelteKit's version manifest.
	// `/api/version` is only used to label/dismiss the newer server build.
	import { version as BAKED_BUILD_ID } from '$app/environment';
	import { updated } from '$app/state';
	import { onMount } from 'svelte';
	import { RefreshCcw, X } from 'lucide-svelte';

	import { forceFreshReload } from './force-fresh-reload';

	const FOCUS_DEBOUNCE_MS = 30 * 1000;
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

	async function refreshLatest(): Promise<void> {
		const next = await fetchServerBuildId();
		if (next && next !== BAKED_BUILD_ID) latest = next;
	}

	async function check(): Promise<void> {
		if (await updated.check()) await refreshLatest();
	}

	onMount(() => {
		try {
			const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
			if (stored) dismissedBuild = stored;
		} catch {
			// storage blocked
		}

		const onStorage = (event: StorageEvent) => {
			if (event.key === DISMISS_STORAGE_KEY) dismissedBuild = event.newValue;
		};
		window.addEventListener('storage', onStorage);

		let lastCheckedAt = 0;
		void check();
		const onVisible = () => {
			if (document.visibilityState !== 'visible') return;
			if (Date.now() - lastCheckedAt < FOCUS_DEBOUNCE_MS) return;
			lastCheckedAt = Date.now();
			void check();
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('focus', onVisible);

		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('focus', onVisible);
			window.removeEventListener('storage', onStorage);
		};
	});

	// Background version polling is owned by SvelteKit (`kit.version.pollInterval`).
	// When it flips the reactive updated flag, resolve the newer human-readable id.
	$effect(() => {
		if (updated.current && !latest) void refreshLatest();
	});

	let stale = $derived(
		updated.current && !!latest && latest !== BAKED_BUILD_ID && latest !== dismissedBuild
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
