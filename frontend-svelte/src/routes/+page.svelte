<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';
	import { Grid2X2, History as HistoryIcon, Rows3, Settings2, ShieldCheck } from 'lucide-svelte';

	import DevicesDrawer from '$lib/components/devices-drawer.svelte';
	import HistoryDrawer from '$lib/features/terminals/HistoryDrawer.svelte';
	import SettingsDrawer from '$lib/components/settings-drawer.svelte';
	import InstallAppControl from '$lib/pwa/InstallAppControl.svelte';
	import { Button } from '$lib/components/ui/button';
	import BroadcastMenu from '$lib/features/terminals/BroadcastMenu.svelte';
	import PaneChrome from '$lib/features/terminals/PaneChrome.svelte';
	import PaneErrorBoundary from '$lib/features/terminals/PaneErrorBoundary.svelte';
	import Terminal from '$lib/features/terminals/Terminal.svelte';
	import TerminalProfileIcon from '$lib/features/terminals/TerminalProfileIcon.svelte';
	import WorkspaceTabs from '$lib/features/terminals/WorkspaceTabs.svelte';
	import { resolveBroadcastFanout } from '$lib/features/terminals/broadcast';
	import { OrderedTerminalInputQueue } from '$lib/features/terminals/input-queue';
	import type { TerminalHistoryEntry } from '$lib/features/terminals/history';
	import {
		useTerminalPreferences,
		type GridCols
	} from '$lib/features/terminals/use-terminal-preferences.svelte';
	import { DEFAULT_FONT_SIZE } from '$lib/features/terminals/types';
	import { useAppSettings } from '$lib/features/terminals/use-app-settings.svelte';
	import { useFullscreen } from '$lib/features/terminals/use-fullscreen.svelte';
	import {
		resolveSessionVisualState,
		type TerminalTelemetry
	} from '$lib/features/terminals/telemetry';
	import { sessionColors } from '$lib/features/terminals/session-colors.svelte';
	import { terminalHistory } from '$lib/features/terminals/terminal-history.svelte';
	import { useWakeLock } from '$lib/features/terminals/use-wake-lock.svelte';
	import { DEFAULT_WORKSPACE_ID, useWorkspaces } from '$lib/features/terminals/use-workspaces.svelte';
	import { terminalSessions } from '$lib/state/terminal-sessions.svelte';

	const workspaces = useWorkspaces();
	const preferences = useTerminalPreferences();
	const fullscreen = useFullscreen();
	const appSettings = useAppSettings();
	useWakeLock(() => terminalSessions.runningCount > 0);
	const broadcastInputQueue = new OrderedTerminalInputQueue(async (id, data) => {
		const response = await fetch(`/api/terminals/${encodeURIComponent(id)}/input`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data })
		});
		if (!response.ok) throw new Error(`Broadcast input failed: ${response.status}`);
	});
	let devicesOpen = $state(false);
	let settingsOpen = $state(false);
	let historyOpen = $state(false);
	let historyRestoring = $state(false);
	let sessionsLoaded = $state(false);
	let paneTelemetry = $state<Record<string, TerminalTelemetry>>({});

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

	let liveSessionIds = $derived(new Set(terminalSessions.sessions.map((session) => session.id)));
	let activeWorkspaceHistory = $derived.by(() =>
		terminalHistory.entries.filter(
			(entry) => (entry.workspaceId ?? DEFAULT_WORKSPACE_ID) === workspaces.activeId
		)
	);
	let activeRestorableHistory = $derived(
		activeWorkspaceHistory.filter((entry) => !liveSessionIds.has(entry.id))
	);
	let restorableHistoryCount = $derived(
		terminalHistory.entries.filter((entry) => !liveSessionIds.has(entry.id)).length
	);

	onMount(() => {
		sessionColors.init();
		terminalHistory.init();
		void terminalSessions.refresh().finally(() => {
			sessionsLoaded = true;
		});
	});

	// Keep history snapshots current without making history itself an effect
	// dependency. Svelte tracks the live session/workspace snapshots; untrack
	// prevents each history write from recursively scheduling this effect.
	$effect(() => {
		const ready = sessionsLoaded && workspaces.hydrated && terminalHistory.hydrated;
		const sessions = terminalSessions.sessions;
		const sessionMap = workspaces.sessionMap;
		if (!ready) return;
		untrack(() => {
			for (const session of sessions) {
				terminalHistory.upsert(session, sessionMap[session.id] ?? DEFAULT_WORKSPACE_ID);
			}
		});
	});

	// React prunes session colors against both live and history-restorable ids.
	// Now that history is a real SSOT, the same cleanup is safe again.
	$effect(() => {
		const ready = sessionsLoaded && terminalHistory.hydrated && sessionColors.hydrated;
		const keepIds = [
			...terminalSessions.sessions.map((session) => session.id),
			...terminalHistory.entries.map((entry) => entry.id)
		];
		if (!ready) return;
		untrack(() => sessionColors.pruneTo(keepIds));
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
		const workspaceId = workspaces.activeId;
		const session = await terminalSessions.create({ profile: 'shell' });
		if (!session) return;
		workspaces.assignSession(session.id, workspaceId);
		terminalHistory.upsert(session, workspaceId);
	}

	function updatePaneTelemetry(id: string, next: TerminalTelemetry): void {
		const current = paneTelemetry[id];
		if (
			current?.connectionState === next.connectionState &&
			current.rttMs === next.rttMs &&
			current.activityState === next.activityState &&
			current.activityLabel === next.activityLabel &&
			current.showActivity === next.showActivity
		) return;
		paneTelemetry = { ...paneTelemetry, [id]: next };
	}

	function removePaneTelemetry(id: string): void {
		if (!(id in paneTelemetry)) return;
		const next = { ...paneTelemetry };
		delete next[id];
		paneTelemetry = next;
	}

	async function closeSession(id: string): Promise<void> {
		const snapshot = terminalSessions.sessions.find((session) => session.id === id);
		const workspaceId = workspaces.resolveSessionWorkspace(id);
		if (snapshot) terminalHistory.upsert(snapshot, workspaceId);
		await terminalSessions.close(id);
		terminalHistory.markClosed([id]);
		preferences.removeBroadcastTarget(id);
		removePaneTelemetry(id);
		workspaces.unassignSession(id);
	}

	async function duplicateSession(session: (typeof terminalSessions.sessions)[number]): Promise<void> {
		const workspaceId = workspaces.resolveSessionWorkspace(session.id);
		const duplicated = await terminalSessions.duplicate(session);
		if (duplicated) {
			workspaces.assignSession(duplicated.id, workspaceId);
			terminalHistory.upsert(duplicated, workspaceId);
		}
	}

	function moveSession(sessionId: string, workspaceId: string): void {
		if (workspaceId !== workspaces.resolveSessionWorkspace(sessionId)) {
			preferences.removeBroadcastTarget(sessionId);
		}
		workspaces.assignSession(sessionId, workspaceId);
		const session = terminalSessions.sessions.find((item) => item.id === sessionId);
		if (session) terminalHistory.upsert(session, workspaceId);
	}

	function focusSession(sessionId: string): void {
		terminalSessions.setActive(sessionId);
		preferences.setViewMode('single');
		void fullscreen.enter();
	}

	function toggleFullscreen(): void {
		void fullscreen.toggle();
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

	function resolveHistoryWorkspace(entry: TerminalHistoryEntry): string {
		const requested = entry.workspaceId ?? DEFAULT_WORKSPACE_ID;
		return workspaces.workspaces.some((workspace) => workspace.id === requested)
			? requested
			: DEFAULT_WORKSPACE_ID;
	}

	async function recreateHistoryEntry(entry: TerminalHistoryEntry) {
		const targetWorkspace = resolveHistoryWorkspace(entry);
		const session = await terminalSessions.create({
			profile: entry.profile,
			cwd: entry.cwd,
			...(entry.agentProfileId ? { agentProfileId: entry.agentProfileId } : {}),
			...(entry.environmentId ? { environmentId: entry.environmentId } : {})
		});
		if (!session) return null;

		workspaces.assignSession(session.id, targetWorkspace);
		if (entry.title && entry.title !== session.title) {
			await terminalSessions.rename(session.id, entry.title);
		}
		const restored = terminalSessions.sessions.find((item) => item.id === session.id) ?? session;
		terminalHistory.upsert(restored, targetWorkspace);
		terminalHistory.remove(entry.id);
		if (targetWorkspace !== workspaces.activeId) selectWorkspace(targetWorkspace);
		terminalSessions.setActive(restored.id);
		return restored;
	}

	async function openHistoryEntry(entry: TerminalHistoryEntry): Promise<void> {
		const live = terminalSessions.sessions.find((session) => session.id === entry.id);
		if (live) {
			const workspaceId = workspaces.resolveSessionWorkspace(live.id);
			if (workspaceId !== workspaces.activeId) selectWorkspace(workspaceId);
			terminalSessions.setActive(live.id);
			return;
		}

		if (historyRestoring) return;
		historyRestoring = true;
		try {
			await recreateHistoryEntry(entry);
		} finally {
			historyRestoring = false;
		}
	}

	async function restoreActiveWorkspaceHistory(): Promise<void> {
		if (historyRestoring || activeRestorableHistory.length === 0) return;
		historyRestoring = true;
		try {
			for (const entry of [...activeRestorableHistory]) {
				const restored = await recreateHistoryEntry(entry);
				if (!restored) break;
			}
		} finally {
			historyRestoring = false;
		}
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

<div class="terminal-shell" data-fullscreen={fullscreen.isFullscreen || undefined}>
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
				{@const visualState = resolveSessionVisualState(session, paneTelemetry[session.id]?.activityState)}
				<div
					class="session-tab"
					style:--session-color={sessionColors.colorOf(session.id)}
					data-active={session.id === terminalSessions.activeId || undefined}
					data-state={visualState}
				>
					<button
						type="button"
						class="session-tab__main"
						onclick={() => terminalSessions.setActive(session.id)}
					>
						<span class="session-tab__profile"><TerminalProfileIcon profile={session.profile} size={13} /></span>
						<span class="session-tab__dot" data-status={visualState} aria-label={visualState}></span>
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

			<Button variant="outline" size="sm" onclick={() => (historyOpen = true)} aria-label="Open terminal history">
				<HistoryIcon size={14} /> History
				{#if restorableHistoryCount > 0}<span class="topbar-count">{restorableHistoryCount}</span>{/if}
			</Button>

			<InstallAppControl />

			<Button variant="outline" size="sm" onclick={() => (settingsOpen = true)} aria-label="Open settings">
				<Settings2 size={14} /> Settings
			</Button>
			<Button variant="outline" size="sm" onclick={() => (devicesOpen = true)}>
				<ShieldCheck size={14} /> Devices
			</Button>
			<Button variant="outline" size="sm" onclick={logout}>Sign out</Button>
		</div>
	</header>

	<HistoryDrawer
		open={historyOpen}
		history={terminalHistory.entries}
		liveIds={liveSessionIds}
		restoring={historyRestoring}
		onOpenChange={(value) => (historyOpen = value)}
		onOpenEntry={(entry) => void openHistoryEntry(entry)}
		onRemoveEntry={terminalHistory.remove.bind(terminalHistory)}
		onClearHistory={() => terminalHistory.clear()}
	/>

	<SettingsDrawer
		open={settingsOpen}
		notifications={appSettings.settings.notifications}
		softKeyboard={appSettings.settings.softKeyboard}
		onOpenChange={(value) => (settingsOpen = value)}
		onUpdateNotifications={appSettings.updateNotifications}
		onUpdateSoftKeyboard={appSettings.updateSoftKeyboard}
		onSetSoftKeyVisible={appSettings.setSoftKeyVisible}
		onOpenDevices={() => (devicesOpen = true)}
		onResetDefaults={appSettings.resetDefaults}
	/>
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
					{@const telemetry = paneTelemetry[session.id]}
					<div
						class="terminal-slot"
						data-session-id={session.id}
						data-workspace-visible={workspaceVisible}
						data-active={active}
						aria-hidden={!workspaceVisible || !active}
					>
						<PaneErrorBoundary>
						<div
							class="pane-frame"
							style:--session-color={sessionColors.colorOf(session.id)}
							data-heartbeat={appSettings.settings.notifications.heartbeatGlow && telemetry?.activityState === 'working' || undefined}
						>
							<PaneChrome
								{session}
								workspaces={workspaces.workspaces}
								currentWorkspaceId={workspaces.resolveSessionWorkspace(session.id)}
								fontSize={preferences.fontSizes[session.id] ?? DEFAULT_FONT_SIZE}
								viewMode={preferences.viewMode}
								connectionState={telemetry?.connectionState ?? 'connecting'}
								rttMs={telemetry?.rttMs ?? null}
								activityState={telemetry?.activityState ?? 'idle'}
								activityLabel={telemetry?.activityLabel ?? 'Idle'}
								showActivity={telemetry?.showActivity ?? false}
								fullscreen={fullscreen.isFullscreen}
								color={sessionColors.colorOf(session.id)}
								hasColorOverride={sessionColors.hasOverride(session.id)}
								onColorPick={(color) => sessionColors.setColor(session.id, color)}
								onColorClear={() => sessionColors.clearColor(session.id)}
								onRename={(id, title) => terminalSessions.rename(id, title)}
								onDuplicate={duplicateSession}
								onMoveToWorkspace={moveSession}
								onFontSizeChange={preferences.setFontSize}
								onFocus={focusSession}
								onToggleFullscreen={toggleFullscreen}
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
									fullscreen={fullscreen.isFullscreen}
									keyboardVisible={!appSettings.settings.softKeyboard.hideKeyboard}
									softKeyVisible={appSettings.settings.softKeyboard.visibility}
									onUpdate={(updated) => terminalSessions.patchFromStream(updated)}
									onTelemetry={updatePaneTelemetry}
									onFontSizeChange={preferences.setFontSize}
									onData={broadcastInput}
								/>
							</div>
						</div>
						</PaneErrorBoundary>
					</div>
				{/each}
			</div>
		{/if}

		{#if !terminalSessions.loading && activeWorkspaceSessions.length === 0}
			<div class="empty">
				{#if activeRestorableHistory.length > 0}
					<div class="empty__history">
						<p class="empty__eyebrow">Last session · {activeRestorableHistory.length} terminal{activeRestorableHistory.length === 1 ? '' : 's'}</p>
						<ul>
							{#each activeRestorableHistory.slice(0, 5) as entry (entry.id)}
								<li><span>{entry.title}</span><small>{entry.cwd}</small></li>
							{/each}
						</ul>
						<Button onclick={() => void restoreActiveWorkspaceHistory()} disabled={historyRestoring}>
							<HistoryIcon size={14} /> {historyRestoring ? 'Restoring…' : 'Restore where I left off'}
						</Button>
						<button type="button" class="empty__forget" onclick={() => terminalHistory.clear(workspaces.activeId)}>Forget this history</button>
					</div>
				{:else}
					<p>No terminal sessions in this workspace.</p>
					<Button onclick={newShell}>Launch a shell</Button>
				{/if}
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
	.terminal-shell[data-fullscreen='true'] :global(.workspace-tabs),
	.terminal-shell[data-fullscreen='true'] .topbar {
		display: none;
	}
	.terminal-shell[data-fullscreen='true'] .terminal-stage {
		padding: 0;
		overflow: hidden;
	}
	.terminal-shell[data-fullscreen='true'] .pane-frame {
		border: 0;
		border-radius: 0;
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
		border-color: var(--session-color, var(--accent));
	}
	.session-tab__profile {
		display: inline-flex;
		color: var(--session-color, var(--accent));
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
	.session-tab__dot[data-status='working'],
	.session-tab__dot[data-status='planning'] {
		background: #fbbf24;
		animation: session-dot-pulse 1.05s ease-in-out infinite;
	}
	.session-tab__dot[data-status='asking'],
	.session-tab__dot[data-status='waiting'] {
		background: #38bdf8;
		animation: session-dot-pulse 1.6s ease-in-out infinite;
	}
	.session-tab__dot[data-status='done'] {
		background: #a7f3d0;
	}
	.session-tab__dot[data-status='exited'] {
		background: #f87171;
	}
	@keyframes session-dot-pulse {
		50% { opacity: 0.55; transform: scale(0.7); }
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
	.topbar-count {
		display: inline-grid;
		min-width: 17px;
		height: 17px;
		place-items: center;
		border-radius: 999px;
		background: rgb(56 189 248 / 0.16);
		color: rgb(186 230 253);
		font-size: 9px;
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
		border: 1px solid var(--session-color, var(--border));
		border-radius: var(--radius);
		background: #0b1220;
	}
	.pane-frame[data-heartbeat='true'],
	:global(html[data-heartbeat-test='on']) .pane-frame {
		animation: pane-heartbeat 1.35s ease-in-out infinite;
	}
	@keyframes pane-heartbeat {
		0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--session-color, #38bdf8) 0%, transparent); }
		50% {
			box-shadow:
				0 0 0 2px color-mix(in srgb, var(--session-color, #38bdf8) 48%, transparent),
				0 0 24px color-mix(in srgb, var(--session-color, #38bdf8) 20%, transparent);
		}
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
	.empty__history {
		display: grid;
		gap: 10px;
		width: min(92vw, 420px);
		border: 1px solid var(--border);
		border-radius: 13px;
		background: var(--surface);
		padding: 14px;
	}
	.empty__eyebrow { margin: 0; color: var(--ink-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
	.empty__history ul { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; }
	.empty__history li { display: flex; justify-content: space-between; gap: 10px; min-width: 0; font-size: 11px; }
	.empty__history li span { overflow: hidden; color: var(--ink); text-overflow: ellipsis; white-space: nowrap; }
	.empty__history li small { overflow: hidden; max-width: 48%; color: var(--ink-muted); font-family: var(--font-mono); text-overflow: ellipsis; white-space: nowrap; }
	.empty__forget { justify-self: center; border: 0; background: transparent; color: var(--ink-muted); font-size: 10px; cursor: pointer; }
	.empty__forget:hover { color: rgb(253 164 175); }
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
