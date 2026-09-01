<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Cannot open terminal · VPS Control Room</title>
</svelte:head>

<div class="view-error">
	<h1>Cannot open read-only terminal</h1>
	<p>{page.error?.message || 'This terminal view failed to load.'}</p>
	<button type="button" onclick={() => window.location.reload()}>Try again</button>
</div>

<style>
	.view-error {
		display: grid;
		min-height: 100dvh;
		place-content: center;
		gap: 12px;
		padding: 24px;
		background: var(--bg);
		text-align: center;
	}
	.view-error h1 { margin: 0; color: rgb(253 164 175); font-size: 18px; }
	.view-error p { max-width: 440px; margin: 0; color: var(--ink-muted); font-size: 12px; line-height: 1.55; }
	.view-error button {
		justify-self: center;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface-2);
		padding: 8px 13px;
		color: var(--ink);
		font-size: 11px;
		cursor: pointer;
	}
</style>
