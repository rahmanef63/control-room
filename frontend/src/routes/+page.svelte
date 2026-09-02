<script lang="ts">
	import './control-room-page.css';
	import { resolve } from '$app/paths';
	import { onMount, untrack } from 'svelte';

	import ControlRoomTopbar from '$lib/features/terminals/ControlRoomTopbar.svelte';
	import ControlRoomOverlays from '$lib/features/terminals/ControlRoomOverlays.svelte';
	import TerminalWorkspaceStage from '$lib/features/terminals/TerminalWorkspaceStage.svelte';
	import WorkspaceTabs from '$lib/features/terminals/WorkspaceTabs.svelte';
	import { resolveBroadcastFanout } from '$lib/features/terminals/broadcast';
	import { downloadBackup, pickAndImportBackup } from '$lib/features/terminals/backup';
	import { OrderedTerminalInputQueue } from '$lib/features/terminals/input-queue';
	import { agentLaunchRequest, environmentLaunchRequest, profileLaunchRequest, type LauncherTab } from '$lib/features/terminals/launcher';
	import type { TerminalHistoryEntry } from '$lib/features/terminals/history';
	import { useTerminalPreferences } from '$lib/features/terminals/use-terminal-preferences.svelte';
	import type { TerminalCreateRequest } from '$lib/features/terminals/types';
	import { useAppSettings } from '$lib/features/terminals/use-app-settings.svelte';
	import { useFullscreen } from '$lib/features/terminals/use-fullscreen.svelte';
	import type { TerminalTelemetry } from '$lib/features/terminals/telemetry';
	import { paneAgentOverrides } from '$lib/features/terminals/pane-agent-overrides.svelte';
	import { sessionColors } from '$lib/features/terminals/session-colors.svelte';
	import { terminalHistory } from '$lib/features/terminals/terminal-history.svelte';
	import { useWakeLock } from '$lib/features/terminals/use-wake-lock.svelte';
	import { DEFAULT_WORKSPACE_ID, useWorkspaces } from '$lib/features/terminals/use-workspaces.svelte';
	import { terminalSessions } from '$lib/state/terminal-sessions.svelte';
	import { templatesState } from '$lib/features/templates/templates.svelte';
	import { templateLaunchRequest, type TerminalTemplate } from '$lib/features/templates/templates';
	import { cronsState } from '$lib/features/crons/crons.svelte';
	import { alfaWatchers } from '$lib/features/patrol/alfa-watchers.svelte';
	import { patrolPings } from '$lib/features/patrol/patrol-pings.svelte';
	import { activeWatchedCount } from '$lib/features/patrol/alfa';

	const workspaces = useWorkspaces();
	const preferences = useTerminalPreferences();
	const fullscreen = useFullscreen();
	const appSettings = useAppSettings();
	useWakeLock(() => terminalSessions.runningCount > 0);
	const pageInputQueue = new OrderedTerminalInputQueue(async (id, data) => {
		const response = await fetch(`/api/terminals/${encodeURIComponent(id)}/input`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ data })
		});
		if (!response.ok) throw new Error(`Terminal input failed: ${response.status}`);
	});
	let devicesOpen = $state(false);
	let settingsOpen = $state(false);
	let historyOpen = $state(false);
	let overviewOpen = $state(false);
	let templatesOpen = $state(false);
	let cronsOpen = $state(false);
	let alfaPatrolOpen = $state(false);
	let launcherOpen = $state(false);
	let launcherTab = $state<LauncherTab>('base');
	let launcherCreatingKey = $state<string | null>(null);
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
	let patrolWatchedCount = $derived(activeWatchedCount(alfaWatchers.watchers, terminalSessions.sessions));

	onMount(() => {
		paneAgentOverrides.init();
		sessionColors.init();
		terminalHistory.init();
		templatesState.init();
		alfaWatchers.init();
		void terminalSessions.refresh().finally(() => {
			sessionsLoaded = true;
		});
		return () => {
			alfaWatchers.destroy();
			patrolPings.destroy();
		};
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

	// Pane-agent overrides intentionally follow React's live-session-only cleanup.
	$effect(() => {
		const liveIds = terminalSessions.sessions.map((session) => session.id);
		if (!sessionsLoaded || !paneAgentOverrides.hydrated) return;
		untrack(() => paneAgentOverrides.pruneTo(liveIds));
	});

	// Server watcher state is authoritative. Never prune a warm local cache until
	// the first successful remote watcher refresh has completed.
	$effect(() => {
		const liveIds = terminalSessions.sessions.map((session) => session.id);
		if (!sessionsLoaded || !alfaWatchers.remoteReady) return;
		untrack(() => alfaWatchers.pruneTo(liveIds));
	});

	// Keep pending badges fresh whenever Patrol is in use, without polling on an
	// installation that has no ALFA configured.
	$effect(() => {
		patrolPings.setEnabled(alfaPatrolOpen || alfaWatchers.watchers.length > 0);
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

	async function createInActiveWorkspace(
		request: TerminalCreateRequest,
		creatingKey: string | null = null
	): Promise<boolean> {
		const workspaceId = workspaces.activeId;
		if (creatingKey) launcherCreatingKey = creatingKey;
		try {
			const session = await terminalSessions.create(request);
			if (!session) return false;
			workspaces.assignSession(session.id, workspaceId);
			terminalHistory.upsert(session, workspaceId);
			return true;
		} finally {
			if (creatingKey && launcherCreatingKey === creatingKey) launcherCreatingKey = null;
		}
	}

	async function newShell(): Promise<void> {
		await createInActiveWorkspace(profileLaunchRequest('shell'));
	}

	function openLauncher(tab: LauncherTab = 'base'): void {
		launcherTab = tab;
		launcherOpen = true;
	}

	async function launchTemplate(template: TerminalTemplate): Promise<boolean> {
		const targetWorkspace = template.workspaceId ?? workspaces.activeId;
		if (template.workspaceId && template.workspaceId !== workspaces.activeId) {
			workspaces.setActive(template.workspaceId);
		}
		const creatingKey = `template:${template.id}`;
		launcherCreatingKey = creatingKey;
		try {
			const created = await terminalSessions.create(templateLaunchRequest(template));
			if (!created) return false;
			workspaces.assignSession(created.id, targetWorkspace);

			if (template.customTitle && template.customTitle !== created.title) {
				await terminalSessions.rename(created.id, template.customTitle);
			}
			const session = terminalSessions.sessions.find((item) => item.id === created.id) ?? created;
			terminalHistory.upsert(session, targetWorkspace);

			if (template.initialCommand) {
				await new Promise((resolveDelay) => setTimeout(resolveDelay, 600));
				pageInputQueue.enqueue(session.id, `${template.initialCommand}\r`);
				await pageInputQueue.flush(session.id);
			}
			return true;
		} finally {
			if (launcherCreatingKey === creatingKey) launcherCreatingKey = null;
		}
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


	function exportBackup(): void {
		try {
			downloadBackup();
		} catch (error) {
			alert(`Backup export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async function importBackup(): Promise<void> {
		if (!confirm('Import backup will REPLACE workspaces, templates, settings, history and pane preferences. Continue?')) return;
		try {
			const result = await pickAndImportBackup();
			if (!result) return;
			window.location.reload();
		} catch (error) {
			alert(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
		}
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

		for (const id of ids) pageInputQueue.enqueue(id, data);
		return true;
	}

	function sendPaneCommand(sessionId: string, command: string): void {
		const session = terminalSessions.sessions.find((item) => item.id === sessionId);
		if (!session || session.status !== 'running' || !command.trim()) return;
		pageInputQueue.enqueue(sessionId, `${command}\r`);
	}

	function injectPaneAgent(sessionId: string, agentProfileId: string, command: string): void {
		sendPaneCommand(sessionId, command);
		paneAgentOverrides.bind(sessionId, agentProfileId);
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

	<ControlRoomTopbar
		sessions={activeWorkspaceSessions}
		activeId={terminalSessions.activeId}
		telemetry={paneTelemetry}
		viewMode={preferences.viewMode}
		gridCols={preferences.gridCols}
		broadcastTargets={preferences.broadcastTargets}
		templateCount={templatesState.templates.length}
		cronCount={cronsState.crons.length}
		watchedCount={patrolWatchedCount}
		pendingPingCount={patrolPings.pendingCount}
		historyCount={restorableHistoryCount}
		onSetActive={terminalSessions.setActive.bind(terminalSessions)}
		onCloseSession={closeSession}
		onNewShell={newShell}
		onSetViewMode={preferences.setViewMode}
		onSetGridCols={preferences.setGridCols}
		onBroadcastChange={preferences.setBroadcastTargets}
		onOpenLauncher={openLauncher}
		onOpenCrons={() => (cronsOpen = true)}
		onOpenPatrol={() => (alfaPatrolOpen = true)}
		onOpenHistory={() => (historyOpen = true)}
		onOpenOverview={() => (overviewOpen = true)}
		onOpenSettings={() => (settingsOpen = true)}
		onOpenDevices={() => (devicesOpen = true)}
		onLogout={logout}
	/>

	<ControlRoomOverlays
		{launcherOpen}
		{launcherTab}
		{launcherCreatingKey}
		{overviewOpen}
		{cronsOpen}
		{templatesOpen}
		patrolOpen={alfaPatrolOpen}
		{historyOpen}
		{devicesOpen}
		{settingsOpen}
		{historyRestoring}
		workspaces={workspaces.workspaces}
		activeWorkspaceId={workspaces.activeId}
		resolveWorkspace={workspaces.resolveSessionWorkspace}
		liveIds={liveSessionIds}
		notifications={appSettings.settings.notifications}
		softKeyboard={appSettings.settings.softKeyboard}
		onLauncherOpenChange={(value) => (launcherOpen = value)}
		onLauncherTabChange={(value) => (launcherTab = value)}
		onLaunchProfile={(profile) => createInActiveWorkspace(profileLaunchRequest(profile), `profile:${profile}`)}
		onLaunchEnvironment={(environmentId) => createInActiveWorkspace(environmentLaunchRequest(environmentId), `env:${environmentId}`)}
		onLaunchAgent={(agentId, options) => createInActiveWorkspace(agentLaunchRequest(agentId, options), `agent:${agentId}`)}
		onLaunchTemplate={launchTemplate}
		onManageTemplates={() => (templatesOpen = true)}
		onOverviewClose={() => (overviewOpen = false)}
		onCronsClose={() => (cronsOpen = false)}
		onTemplatesClose={() => (templatesOpen = false)}
		onPatrolClose={() => (alfaPatrolOpen = false)}
		onInjectCommand={sendPaneCommand}
		onHistoryOpenChange={(value) => (historyOpen = value)}
		onOpenHistoryEntry={openHistoryEntry}
		onSettingsOpenChange={(value) => (settingsOpen = value)}
		onDevicesOpenChange={(value) => (devicesOpen = value)}
		onUpdateNotifications={appSettings.updateNotifications}
		onUpdateSoftKeyboard={appSettings.updateSoftKeyboard}
		onSetSoftKeyVisible={appSettings.setSoftKeyVisible}
		onOpenDevices={() => (devicesOpen = true)}
		onExportBackup={exportBackup}
		onImportBackup={importBackup}
		onResetDefaults={appSettings.resetDefaults}
	/>

	<TerminalWorkspaceStage
		workspaces={workspaces.workspaces}
		activeWorkspaceId={workspaces.activeId}
		resolveWorkspace={workspaces.resolveSessionWorkspace}
		{activeWorkspaceSessions}
		{activeRestorableHistory}
		{historyRestoring}
		telemetry={paneTelemetry}
		viewMode={preferences.viewMode}
		gridCols={preferences.gridCols}
		fontSizes={preferences.fontSizes}
		fullscreen={fullscreen.isFullscreen}
		heartbeatGlow={appSettings.settings.notifications.heartbeatGlow}
		keyboardHidden={appSettings.settings.softKeyboard.hideKeyboard}
		softKeyVisible={appSettings.settings.softKeyboard.visibility}
		{paneIsWorkspaceVisible}
		{paneIsActive}
		{paneIsBroadcastTarget}
		onInjectAgent={injectPaneAgent}
		onCommand={sendPaneCommand}
		onDuplicate={duplicateSession}
		onMoveToWorkspace={moveSession}
		onFontSizeChange={preferences.setFontSize}
		onFocus={focusSession}
		onToggleFullscreen={toggleFullscreen}
		onClose={closeSession}
		onTelemetry={updatePaneTelemetry}
		onBroadcastData={broadcastInput}
		onRestoreHistory={restoreActiveWorkspaceHistory}
		onNewShell={newShell}
	/>
</div>
