<script lang="ts">
	import { RefreshCcw, TriangleAlert } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<svelte:boundary>
	{@render children()}

	{#snippet failed(_error, reset)}
		<div class="pane-error" role="alert">
			<div class="pane-error__icon" aria-hidden="true">
				<TriangleAlert size={20} />
			</div>
			<div class="pane-error__copy">
				<p class="pane-error__title">This pane crashed</p>
				<p class="pane-error__message">
					The terminal view hit an error. Its session can still be alive on the agent, so reload this pane to reconnect.
				</p>
			</div>
			<button type="button" class="pane-error__retry" onclick={reset}>
				<RefreshCcw size={14} /> Reload pane
			</button>
		</div>
	{/snippet}
</svelte:boundary>

<style>
	.pane-error {
		display: flex;
		height: 100%;
		min-height: 180px;
		width: 100%;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		border: 1px solid rgb(248 113 113 / 0.3);
		border-radius: var(--radius);
		background: rgb(127 29 29 / 0.08);
		padding: 24px;
		text-align: center;
		color: var(--ink);
	}
	.pane-error__icon {
		display: grid;
		width: 38px;
		height: 38px;
		place-items: center;
		border-radius: 12px;
		background: rgb(248 113 113 / 0.12);
		color: #fca5a5;
	}
	.pane-error__copy {
		display: flex;
		max-width: 22rem;
		flex-direction: column;
		gap: 4px;
	}
	.pane-error__title,
	.pane-error__message {
		margin: 0;
	}
	.pane-error__title {
		font-size: 0.82rem;
		font-weight: 700;
	}
	.pane-error__message {
		color: var(--ink-muted);
		font-size: 0.7rem;
		line-height: 1.5;
	}
	.pane-error__retry {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 34px;
		border: 1px solid var(--border);
		border-radius: 9px;
		background: var(--surface-2);
		padding: 6px 11px;
		color: var(--ink);
		font: inherit;
		font-size: 0.7rem;
		font-weight: 650;
		cursor: pointer;
	}
	.pane-error__retry:hover {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
		color: var(--accent);
	}
</style>
