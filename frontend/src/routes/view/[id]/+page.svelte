<script lang="ts">
	import { page } from '$app/state';
	import ReadOnlyTerminalView from '$lib/features/terminals/ReadOnlyTerminalView.svelte';

	let sessionId = $derived(page.params.id ?? '');
</script>

<svelte:head>
	<title>Read-only terminal · VPS Control Room</title>
</svelte:head>

<div class="shared-view-shell">
	<header class="shared-view-header">
		<span>Read-only view</span>
		<code>{sessionId}</code>
	</header>
	<main class="shared-view-main">
		<ReadOnlyTerminalView id={sessionId} />
	</main>
</div>

<style>
	.shared-view-shell {
		display: flex;
		height: 100dvh;
		min-height: 0;
		flex-direction: column;
		background: var(--bg);
	}
	.shared-view-header {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 9px;
		min-height: 42px;
		padding: 6px 11px;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--surface) 94%, transparent);
	}
	.shared-view-header span {
		flex: 0 0 auto;
		color: var(--ink-muted);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.shared-view-header code {
		min-width: 0;
		overflow: hidden;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.shared-view-main {
		min-height: 0;
		flex: 1;
		padding: 7px;
	}
	@media (max-width: 640px) {
		.shared-view-header { min-height: 38px; padding-inline: 9px; }
		.shared-view-main { padding: 0; }
	}
</style>
