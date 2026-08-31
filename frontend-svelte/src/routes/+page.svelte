<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { Grid2X2, Rows3, ShieldCheck } from 'lucide-svelte';

	import DevicesDrawer from '$lib/components/devices-drawer.svelte';
	import { Button } from '$lib/components/ui/button';
	import BroadcastMenu from '$lib/features/terminals/BroadcastMenu.svelte';
	import PaneChrome from '$lib/features/terminals/PaneChrome.svelte';
	import Terminal from '$lib/features/terminals/Terminal.svelte';
	import WorkspaceTabs from '$lib/features/terminals/WorkspaceTabs.svelte';
	import {
		BroadcastInputQueue,
		resolveBroadcastFanout
	} from '$lib/features/terminals/broadcast';
	import {
		useTerminalPreferences,
		type GridCols
	} from '$lib/features/terminals/use-terminal-preferences.svelte';
	import { DEFAULT_FONT_SIZE } from '$lib/features/terminals/types';
	import { useWorkspaces } from '$lib/features/terminals/use-workspaces.svelte';
	import { terminalSessions } from '$lib/state/terminal-sessions.svelte';

	const workspaces = useWorkspaces();
	const preferences = useTerminalPreferences();
	const broadcastInputQueue = new BroadcastInputQueue(async (id, data) => {
		const response = await fetch(`/api/terminals/${encodeURIComponent(id)}/input`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data })
		});
		if (!response.ok) throw new Error(`Broadcast input failed: ${response.status}`);
	});
	let devicesOpen = $state(false);

	let activeWorkspaceSessions = $derived.by(() =>
		terminalSessions.sessions.filter(
			(session) => workspaces.resolveSessionWorkspace(session.id) === workspaces.activeId
		)
	);

	let sessionCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const session of terminalSessions.sessions) {
			const workspaceId = workspaces.resolveSessionWorkspace(session.id);
			counts[workspaceId] = (counts[workspaceId] ?? 0) + 1;
		}
		return counts;
	});

	onMount(() => {
		void terminalSessions.refresh();
	});

	// Keep single-pane focus inside the selected workspace. The terminals stay
	// mounted after first activation so switching workspace preserves xterm scrollback.
	$effect(() => {
		const sessions = activeWorkspaceSessions;
		const activeId = terminalSessions.activeId;
		if (sessions.length > 0 && !sessions.some((session) => session.id === activeId)) {
			terminalSessions.setActive(sessions[0].id);
		}
	});

	async function newShell(): Promise<void> {
		const session = await terminalSessions.create({ profile: 'shell' });
		if (session) workspaces.assignSession(session.id, workspaces.activeId);
	}

	async function closeSession(id: string): Promise<void> {
		await terminalSessions.close(id);
		preferences.removeBroadcastTarget(id);
		workspaces.unassignSession(id);
	}

	async function duplicateSession(session: (typeof terminalSessions.sessions)[number]): Promise<void> {
		const workspaceId = workspaces.resolveSessionWorkspace(session.id);
		const duplicated = await terminalSessions.duplicate(session);
		if (duplicated) workspaces.assignSession(duplicated.id, workspaceId);
	}

	function moveSession(sessionId: string, workspaceId: string): void {
		if (workspaceId !== workspaces.resolveSessionWorkspace(sessionId)) {
			preferences.removeBroadcastTarget(sessionId);
		}
		workspaces.assignSession(sessionId, workspaceId);
	}

	function focusSession(sessionId: string): void {
		terminalSessions.setActive(sessionId);
		preferences.setViewMode('single');
	}

	function selectWorkspace(id: string): void {
		if (id !== workspaces.activeId) preferences.clearBroadcastTargets();
		workspaces.setActive(id);
		const first = terminalSessions.sessions.find(
			(session) => workspaces.resolveSessionWorkspace(session.id) === id
		);
		if (first) terminalSessions.setActive(first.id);
	}

	function createWorkspace(): void {
		preferences.clearBroadcastTargets();
		workspaces.createWorkspace();
	}

	function deleteWorkspace(id: string): void {
		workspaces.deleteWorkspace(id);
		selectWorkspace(workspaces.activeId);
	}

	async function logout(): Promise<void> {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.assign(resolve('/login'));
	}

	function paneIsWorkspaceVisible(sessionId: string): boolean {
		return workspaces.resolveSessionWorkspace(sessionId) === workspaces.activeId;
	}

	function paneIsActive(sessionId: string): boolean {
		return preferences.viewMode === 'grid' || sessionId === terminalSessions.activeId;
	}

	function paneIsBroadcastTarget(sessionId: string): boolean {
		const session = activeWorkspaceSessions.find((item) => item.id === sessionId);
		return session?.status === 'running' && preferences.broadcastTargets.has(sessionId);
	}

	function broadcastInput(sourceId: string, data: string): boolean {
		const ids = resolveBroadcastFanout(
			sourceId,
			preferences.broadcastTargets,
			activeWorkspaceSessions
		);
		if (ids.length === 0) return false;

		for (const id of ids) broadcastInputQueue.enqueue(id, data);
		return true;
	}
</script>

<svelte:head>
	<title>Terminals · VPS Control Room</title>
</svelte:head>

<div class="terminal-shell">
	<WorkspaceTabs
		workspaces={workspaces.workspaces}
		activeId={workspaces.activeId}
		{sessionCounts}
		onSelect={selectWorkspace}
		onCreate={createWorkspace}
		onRename={workspaces.renameWorkspace}
		onDelete={deleteWorkspace}
	/>

	<header class="topbar">
		<span class="topbar__brand">VPS Control Room</span>

		<div class="session-tabs" aria-label="Terminal sessions">
			{#each activeWorkspaceSessions as session (session.id)}
				<div class="session-tab" data-active={session.id === terminalSessions.activeId || undefined}>
					<button
						type="button"
						class="session-tab__main"
						onclick={() => terminalSessions.setActive(session.id)}
					>
						<span class="session-tab__dot" data-status={session.status}></span>
						<span class="session-tab__title">{session.title || session.profile}</span>
					</button>
					<button
						type="button"
						class="session-tab__close"
						onclick={() => void closeSession(session.id)}
						aria-label={`Close ${session.title || session.profile}`}
					>
						×
					</button>
				</div>
			{/each}
			<Button variant="ghost" size="sm" onclick={newShell}>+ New shell</Button>
		</div>

		<div class="topbar__controls">
			<Button
				variant={preferences.viewMode === 'grid' ? 'default' : 'outline'}
				size="sm"
				onclick={() => preferences.setViewMode(preferences.viewMode === 'grid' ? 'single' : 'grid')}
			>
				{#if preferences.viewMode === 'grid'}
					<Rows3 size={14} /> Single
				{:else}
					<Grid2X2 size={14} /> Grid
				{/if}
			</Button>

			{#if preferences.viewMode === 'grid'}
				<label class="grid-cols-control">
					<span>Cols</span>
					<select
						value={preferences.gridCols}
						onchange={(event) => preferences.setGridCols(event.currentTarget.value as GridCols)}
					>
						<option value="auto">Auto</option>
						<option value="1">1</option>
						<option value="2">2</option>
						<option value="3">3</option>
						<option value="4">4</option>
					</select>
				</label>
			{/if}

			<BroadcastMenu
				sessions={activeWorkspaceSessions}
				targets={preferences.broadcastTargets}
				onChange={preferences.setBroadcastTargets}
			/>

			<Button variant="outline" size="sm" onclick={() => (devicesOpen = true)}>
				<ShieldCheck size={14} /> Devices
			</Button>
			<Button variant="outline" size="sm" onclick={logout}>Sign out</Button>
		</div>
	</header>

	<DevicesDrawer open={devicesOpen} onOpenChange={(value) => (devicesOpen = value)} />

	<main class="terminal-stage">
		{#if terminalSessions.loading && terminalSessions.sessions.length === 0}
			<p class="hint">Loading terminal sessions…</p>
		{:else if terminalSessions.error}
			<p class="hint hint--error">{terminalSessions.error}</p>
		{/if}

		{#if terminalSessions.sessions.length > 0}
			<div
				class="terminal-grid"
				data-view={preferences.viewMode}
				data-grid-cols={preferences.gridCols}
			>
				{#each terminalSessions.sessions as session (session.id)}
					{@const workspaceVisible = paneIsWorkspaceVisible(session.id)}
					{@const active = paneIsActive(session.id)}
					<div
						class="terminal-slot"
						data-session-id={session.id}
						data-workspace-visible={workspaceVisible}
						data-active={active}
						aria-hidden={!workspaceVisible || !active}
					>
						<div class="pane-frame">
							<PaneChrome
								{session}
								workspaces={workspaces.workspaces}
								currentWorkspaceId={workspaces.resolveSessionWorkspace(session.id)}
								fontSize={preferences.fontSizes[session.id] ?? DEFAULT_FONT_SIZE}
								viewMode={preferences.viewMode}
								onRename={(id, title) => terminalSessions.rename(id, title)}
								onDuplicate={duplicateSession}
								onMoveToWorkspace={moveSession}
								onFontSizeChange={preferences.setFontSize}
								onFocus={focusSession}
								onClose={closeSession}
							/>
							{#if paneIsBroadcastTarget(session.id)}
								<div class="pane-broadcast-banner">
									Broadcast target — typing in any sibling pane is mirrored here.
								</div>
							{/if}
							<div class="pane-terminal-host">
								<Terminal
									{session}
									active={workspaceVisible && active}
									fontSize={preferences.fontSizes[session.id] ?? DEFAULT_FONT_SIZE}
									onUpdate={(updated) => terminalSessions.patchFromStream(updated)}
									onData={broadcastInput}
								/>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if !terminalSessions.loading && activeWorkspaceSessions.length === 0}
			<div class="empty">
				<p>No terminal sessions in this workspace.</p>
				<Button onclick={newShell}>Launch a shell</Button>
			</div>
		{/if}
	</main>
</div>

<style>
	.terminal-shell {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		background: var(--bg);
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		padding: 7px 10px;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.topbar__brand {
		flex: 0 0 auto;
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.78rem;
		color: var(--accent);
	}
	.session-tabs {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 5px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.session-tabs::-webkit-scrollbar {
		display: none;
	}
	.session-tab {
		display: inline-flex;
		align-items: center;
		flex: 0 0 auto;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.session-tab[data-active='true'] {
		border-color: var(--accent);
	}
	.session-tab__main,
	.session-tab__close {
		border: 0;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.session-tab__main {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 30px;
		padding: 4px 8px;
	}
	.session-tab__close {
		width: 26px;
		height: 30px;
		font-size: 16px;
	}
	.session-tab__close:hover {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
	}
	.session-tab[data-active='true'] .session-tab__main {
		color: var(--ink);
	}
	.session-tab__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #4ade80;
	}
	.session-tab__dot[data-status='exited'] {
		background: var(--ink-muted);
	}
	.session-tab__title {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.76rem;
	}
	.topbar__controls {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 0 0 auto;
	}
	.grid-cols-control {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.7rem;
		color: var(--ink-muted);
	}
	.grid-cols-control select {
		height: 30px;
		border: 1px solid var(--border);
		border-radius: 7px;
		background: var(--surface-2);
		color: var(--ink);
		padding: 0 6px;
		font-size: 0.72rem;
	}
	.terminal-stage {
		position: relative;
		flex: 1;
		min-height: 0;
		padding: 8px;
		overflow: auto;
	}
	.terminal-grid {
		display: grid;
		gap: 8px;
		width: 100%;
		height: 100%;
		min-height: 0;
	}
	.terminal-grid[data-view='single'] {
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
	}
	.terminal-grid[data-view='grid'][data-grid-cols='auto'] {
		grid-template-columns: repeat(auto-fit, minmax(min(480px, 100%), 1fr));
		grid-auto-rows: minmax(280px, 1fr);
	}
	.terminal-grid[data-view='grid'][data-grid-cols='1'] {
		grid-template-columns: minmax(0, 1fr);
		grid-auto-rows: minmax(280px, 1fr);
	}
	.terminal-grid[data-view='grid'][data-grid-cols='2'] {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		grid-auto-rows: minmax(280px, 1fr);
	}
	.terminal-grid[data-view='grid'][data-grid-cols='3'] {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-auto-rows: minmax(260px, 1fr);
	}
	.terminal-grid[data-view='grid'][data-grid-cols='4'] {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-auto-rows: minmax(240px, 1fr);
	}
	.terminal-slot {
		min-width: 0;
		min-height: 0;
	}
	.pane-frame {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: #0b1220;
	}
	.pane-broadcast-banner {
		border-bottom: 1px solid rgb(251 113 133 / 0.22);
		background: rgb(127 29 29 / 0.22);
		padding: 5px 10px;
		color: rgb(254 205 211);
		font-size: 11px;
		line-height: 1.35;
	}
	.pane-terminal-host {
		flex: 1 1 auto;
		min-height: 0;
	}
	.terminal-slot[data-workspace-visible='false'],
	.terminal-grid[data-view='single'] .terminal-slot[data-active='false'] {
		display: none;
	}
	.hint {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		color: var(--ink-muted);
		pointer-events: none;
	}
	.hint--error {
		color: #fca5a5;
	}
	.empty {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: var(--ink-muted);
	}
	@media (max-width: 900px) {
		.topbar {
			flex-wrap: wrap;
		}
		.topbar__brand {
			display: none;
		}
		.session-tabs {
			order: 2;
			flex-basis: 100%;
		}
		.topbar__controls {
			margin-left: auto;
		}
		.terminal-grid[data-view='grid'] {
			grid-template-columns: minmax(0, 1fr);
			grid-auto-rows: minmax(300px, 1fr);
		}
	}
</style>
