<script lang="ts">
	// Minimal working replacement for frontend/src/features/terminals/screen.tsx
	// (598 lines) + terminals-main.tsx + session-tabs.tsx — enough to prove the
	// full vertical slice end to end (auth → list/create/close sessions → live
	// pane with SSE streaming + input + resize). The multi-workspace grid,
	// drawers (crons/templates/devices/history), patrol/alfa features, and
	// broadcast are NOT here yet — see README-MIGRATION.md for the tracked
	// backlog of every file this still needs.
	import { onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button';
	import Terminal from '$lib/features/terminals/Terminal.svelte';
	import { terminalSessions } from '$lib/state/terminal-sessions.svelte';

	onMount(() => {
		void terminalSessions.refresh();
	});

	async function newShell(): Promise<void> {
		await terminalSessions.create({ profile: 'shell' });
	}

	async function logout(): Promise<void> {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

<svelte:head>
	<title>Terminals · VPS Terminals</title>
</svelte:head>

<div class="workspace">
	<header class="topbar">
		<span class="topbar__brand">VPS Terminals</span>
		<div class="topbar__tabs">
			{#each terminalSessions.sessions as session (session.id)}
				<button
					class="tab"
					class:tab--active={session.id === terminalSessions.activeId}
					onclick={() => terminalSessions.setActive(session.id)}
				>
					<span class="tab__dot" data-status={session.status}></span>
					{session.title || session.profile}
					<span
						class="tab__close"
						role="button"
						tabindex="0"
						onclick={(e) => {
							e.stopPropagation();
							void terminalSessions.close(session.id);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.stopPropagation();
								void terminalSessions.close(session.id);
							}
						}}
					>
						×
					</span>
				</button>
			{/each}
			<Button variant="ghost" size="sm" onclick={newShell}>+ New shell</Button>
		</div>
		<Button variant="outline" size="sm" onclick={logout}>Sign out</Button>
	</header>

	<main class="stage">
		{#if terminalSessions.loading && terminalSessions.sessions.length === 0}
			<p class="hint">Loading terminals…</p>
		{:else if terminalSessions.error}
			<p class="hint hint--error">{terminalSessions.error}</p>
		{:else if terminalSessions.active}
			{#key terminalSessions.active.id}
				<Terminal
					session={terminalSessions.active}
					onUpdate={(s) => terminalSessions.patchFromStream(s)}
				/>
			{/key}
		{:else}
			<div class="empty">
				<p>No terminal sessions yet.</p>
				<Button onclick={newShell}>Launch a shell</Button>
			</div>
		{/if}
	</main>
</div>

<style>
	.workspace {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.topbar__brand {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--accent);
	}
	.topbar__tabs {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		overflow-x: auto;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--ink-muted);
		border-radius: 999px;
		padding: 5px 10px;
		font-size: 0.8rem;
		white-space: nowrap;
		cursor: pointer;
	}
	.tab--active {
		color: var(--ink);
		border-color: var(--accent);
	}
	.tab__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #4ade80;
	}
	.tab__dot[data-status='exited'] {
		background: var(--ink-muted);
	}
	.tab__close {
		margin-left: 4px;
		opacity: 0.6;
	}
	.tab__close:hover {
		opacity: 1;
	}
	.stage {
		flex: 1;
		min-height: 0;
		padding: 12px;
	}
	.hint {
		color: var(--ink-muted);
		padding: 24px;
	}
	.hint--error {
		color: #fca5a5;
	}
	.empty {
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: var(--ink-muted);
	}
</style>
