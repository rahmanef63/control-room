<script lang="ts">
	// App-wide SvelteKit error boundary. Version-guard handles stale-build
	// recovery separately so this component can remain focused on render/load errors.
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<div class="error-page">
	<h1>Something went wrong</h1>
	<p class="error-page__message">
		{page.error?.message || 'An unexpected error occurred.'}
	</p>
	{#if page.status}
		<p class="error-page__status">Status: {page.status}</p>
	{/if}
	<a href={resolve('/')} class="error-page__link">Back to terminals</a>
</div>

<style>
	.error-page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 24px;
		text-align: center;
		background: var(--bg);
		color: var(--ink);
	}
	.error-page h1 {
		font-size: 1.35rem;
		margin: 0;
	}
	.error-page__message {
		color: var(--ink-muted);
		max-width: 28rem;
		margin: 0;
	}
	.error-page__status {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--ink-muted);
		margin: 0;
	}
	.error-page__link {
		margin-top: 8px;
		border-radius: 0.75rem;
		border: 1px solid var(--border);
		padding: 8px 16px;
		font-size: 0.85rem;
		color: var(--ink);
		text-decoration: none;
	}
</style>
