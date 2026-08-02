'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { useCrons } from '@/features/crons/hooks/use-crons';
import { useTemplates } from '@/features/templates/hooks/use-templates';
import type { LauncherTab } from '@/features/terminals/components/launcher-drawer';
import { SessionTabs } from '@/features/terminals/components/session-tabs';
import { TerminalsMain } from '@/features/terminals/components/terminals-main';
import { TerminalsTopbar } from '@/features/terminals/components/terminals-topbar';
import { WorkspaceTabs } from '@/features/terminals/components/workspace-tabs';

const LauncherDrawer = dynamic(
  () =>
    import('@/features/terminals/components/launcher-drawer').then((m) => m.LauncherDrawer),
  { ssr: false }
);
const SettingsDrawer = dynamic(
  () =>
    import('@/features/terminals/components/settings-drawer').then((m) => m.SettingsDrawer),
  { ssr: false }
);
const CronsDrawer = dynamic(
  () => import('@/features/crons/components/crons-drawer').then((m) => m.CronsDrawer),
  { ssr: false }
);
const TemplatesDrawer = dynamic(
  () =>
    import('@/features/templates/components/templates-drawer').then((m) => m.TemplatesDrawer),
  { ssr: false }
);
const AlfaRegistryDialog = dynamic(
  () =>
    import('@/features/terminals/components/patrol/alfa-registry-dialog').then(
      (m) => m.AlfaRegistryDialog
    ),
  { ssr: false }
);
const HistoryDrawer = dynamic(
  () => import('@/features/terminals/components/history-drawer').then((m) => m.HistoryDrawer),
  { ssr: false }
);
const DevicesDrawer = dynamic(
  () => import('@/features/terminals/components/devices-drawer').then((m) => m.DevicesDrawer),
  { ssr: false }
);
const OverviewDrawer = dynamic(
  () => import('@/features/terminals/components/overview-drawer').then((m) => m.OverviewDrawer),
  { ssr: false }
);
import { useAppSettings } from '@/features/terminals/hooks/use-app-settings';
import { useFullscreen } from '@/features/terminals/hooks/use-fullscreen';
import { useIsMobile } from '@/features/terminals/hooks/use-media-query';
import { useAlfaWatchers, type AlfaWatcher } from '@/features/terminals/hooks/use-alfa-watchers';
import { usePaneAgentOverrides } from '@/features/terminals/hooks/use-pane-agent-overrides';
import { usePatrolPings } from '@/features/terminals/hooks/use-patrol-pings';
import { useTerminalPreferences } from '@/features/terminals/hooks/use-terminal-preferences';
import { useSessionColors } from '@/features/terminals/hooks/use-session-colors';
import { useTerminalSessions } from '@/features/terminals/hooks/use-terminal-sessions';
import { useWakeLock } from '@/features/terminals/hooks/use-wake-lock';
import { useWorkspaces } from '@/features/terminals/hooks/use-workspaces';
import { downloadBackup, pickAndImportBackup } from '@/features/terminals/lib/backup';
import { DEFAULT_WORKSPACE_ID, type ActivityState } from '@/features/terminals/lib/utils';
import type { TerminalSession } from '@/shared/types/contracts';
import { usePwaInstall } from '@/shared/pwa/use-pwa-install';

export default function TerminalsPage() {
  const router = useRouter();
  const { canInstall, install } = usePwaInstall();
  const preferences = useTerminalPreferences();
  const workspaces = useWorkspaces();
  const appSettings = useAppSettings();
  const isMobile = useIsMobile();

  const sessionsState = useTerminalSessions({
    resolveActiveWorkspaceId: () => workspaces.activeId,
    resolveSourceWorkspaceId: (id) => workspaces.resolveSessionWorkspace(id),
    onAssignWorkspace: workspaces.assignSession,
  });

  const paneAgentOverrides = usePaneAgentOverrides();
  const alfaWatchers = useAlfaWatchers();

  const fullscreenState = useFullscreen();
  const fullscreen = fullscreenState.isFullscreen;
  // useFullscreen returns a fresh object literal each render, but enter/toggle are
  // useCallback'd — destructure the stable inner refs so handlers below (and the
  // panes they reach) don't churn and defeat the TerminalPane memo.
  const { enter: enterFullscreen, toggle: toggleFullscreen } = fullscreenState;
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherTab, setLauncherTab] = useState<LauncherTab>('base');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cronsOpen, setCronsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [alfaPatrolOpen, setAlfaPatrolOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [activityStates, setActivityStates] = useState<Record<string, ActivityState>>({});

  const cronsState = useCrons(cronsOpen);
  const templatesState = useTemplates();

  const {
    profiles,
    environments,
    agentProfiles,
    sessions: allSessions,
    activeId,
    setActiveId,
    loading,
    error,
    creatingKey,
    createSession,
    closeSession,
    duplicateSession,
    launchTemplate,
    updateSession,
    reorderSessions,
    broadcastInput,
    history,
    restoreHistory,
    restoreHistoryEntry,
    removeHistoryEntry,
    clearHistory,
    restoring,
  } = sessionsState;

  const {
    fontSizes,
    setFontSize,
    viewMode,
    setViewMode,
    gridCols,
    setGridCols,
    broadcast,
    setBroadcast,
    broadcastTargets,
    setBroadcastTargets,
  } = preferences;

  // Checkbox-driven broadcast: an empty target set means broadcast is OFF.
  // Selecting any checkbox flips broadcast ON for that exact set. The
  // source pane is always included in the fan-out so its own keystrokes
  // still reach its PTY (the source skips the local POST path when
  // broadcasting — see TerminalPane onData). The legacy "broadcast to
  // every running pane" toggle is reachable via the dropdown's "All"
  // shortcut, which checks every running pane.
  const broadcastEnabled = broadcastTargets.size > 0;
  void broadcast; // legacy toggle retained on preferences for storage compat
  const broadcastInputScoped = useCallback(
    (data: string, sourceId?: string) => {
      if (broadcastTargets.size === 0) return;
      const ids = new Set(broadcastTargets);
      if (sourceId) ids.add(sourceId);
      for (const id of ids) {
        void fetch(`/api/terminals/${encodeURIComponent(id)}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        });
      }
    },
    [broadcastTargets]
  );
  void broadcastInput; // unused now — checkbox set is the single source of truth

  const sessionWorkspaceOf = useCallback(
    (sessionId: string) => workspaces.sessionMap[sessionId] ?? DEFAULT_WORKSPACE_ID,
    [workspaces.sessionMap]
  );

  const sessions = useMemo(
    () => allSessions.filter((session) => sessionWorkspaceOf(session.id) === workspaces.activeId),
    [allSessions, sessionWorkspaceOf, workspaces.activeId]
  );

  const isSessionVisible = useCallback(
    (sessionId: string) => sessionWorkspaceOf(sessionId) === workspaces.activeId,
    [sessionWorkspaceOf, workspaces.activeId]
  );

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const session of allSessions) {
      const ws = sessionWorkspaceOf(session.id);
      counts[ws] = (counts[ws] ?? 0) + 1;
    }
    return counts;
  }, [allSessions, sessionWorkspaceOf]);

  const workspaceHistory = useMemo(
    () =>
      history.filter(
        (entry) => (entry.workspaceId ?? DEFAULT_WORKSPACE_ID) === workspaces.activeId
      ),
    [history, workspaces.activeId]
  );

  // Keep activeId pointing to a session in the current workspace
  useEffect(() => {
    if (sessions.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !sessions.some((session) => session.id === activeId)) {
      setActiveId(sessions[0].id);
    }
  }, [sessions, activeId, setActiveId]);

  // Mobile portrait: default to single view (column-friendly), but only on first load
  const initialViewSetRef = useState({ done: false });
  useEffect(() => {
    if (initialViewSetRef[0].done) return;
    if (isMobile) {
      setViewMode('single');
    }
    initialViewSetRef[0].done = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  const hasRunningSession = useMemo(
    () => allSessions.some((session) => session.status === 'running'),
    [allSessions]
  );
  useWakeLock(hasRunningSession);

  const keyboardVisible = !appSettings.settings.softKeyboard.hideKeyboard;

  const handleActivityChange = useCallback((id: string, state: ActivityState) => {
    setActivityStates((current) => (current[id] === state ? current : { ...current, [id]: state }));
  }, []);

  // Prune stale agent overrides when sessions disappear.
  useEffect(() => {
    paneAgentOverrides.pruneTo(allSessions.map((session) => session.id));
  }, [allSessions, paneAgentOverrides]);

  // Prune watchers whose alfa terminal closed or whose targets are gone.
  // Detection runs in the agent now (patrol scheduler), so no browser watcher.
  useEffect(() => {
    alfaWatchers.pruneTo(allSessions.map((session) => session.id));
  }, [allSessions, alfaWatchers]);

  // Prune stale session-color overrides (the store outlives sessions in
  // localStorage and used to grow forever). Keep colors for live sessions AND
  // history-restorable ones, so a restored pane returns with its picked color.
  // Skip while loading — pruning against a not-yet-fetched session list would
  // wipe every stored color on mount.
  const { pruneTo: pruneColors } = useSessionColors();
  useEffect(() => {
    if (loading) return;
    pruneColors([
      ...allSessions.map((session) => session.id),
      ...history.map((entry) => entry.id),
    ]);
  }, [loading, allSessions, history, pruneColors]);

  const patrolPings = usePatrolPings({ enabled: alfaPatrolOpen });

  const patrolActiveCount = useMemo(
    () =>
      allSessions.reduce(
        (count, session) => count + (alfaWatchers.isWatchedByAny(session.id) ? 1 : 0),
        0
      ),
    [allSessions, alfaWatchers]
  );

  // useAlfaWatchers handles the server round-trip internally (atomic POST /
  // DELETE against /api/alfa/watchers, never the bulk PUT). The dialog just
  // calls the hook; the API is the single source of truth shared with the
  // /vps-alfa skill.
  const handleSaveWatcher = useCallback(
    (watcher: AlfaWatcher, injectSkills?: string[]) => {
      alfaWatchers.registerOrUpdate(watcher);
      if (injectSkills && injectSkills.length > 0) {
        // Promote can optionally seed the converted pane with /vps-alfa or
        // sub-skills so the human doesn't have to type them by hand.
        // Stagger by 600ms so each `/skill` parses cleanly in the TUI.
        injectSkills.forEach((cmd, index) => {
          setTimeout(() => {
            void fetch(`/api/terminals/${encodeURIComponent(watcher.id)}/input`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: cmd }),
            });
          }, 400 + index * 600);
        });
      }
    },
    [alfaWatchers]
  );

  const handleDeregisterWatcher = useCallback(
    async (alfaId: string) => alfaWatchers.deregister(alfaId),
    [alfaWatchers]
  );

  const agentOverrideIds = useMemo(
    () => new Set(Object.keys(paneAgentOverrides.overrides)),
    [paneAgentOverrides.overrides]
  );

  const focusSession = useCallback(
    (id: string) => {
      setActiveId(id);
      setViewMode('single');
      void enterFullscreen();
    },
    [setActiveId, setViewMode, enterFullscreen]
  );

  // Stable handlers for props that flow down into every TerminalPane.
  const handleToggleFullscreen = useCallback(() => void toggleFullscreen(), [toggleFullscreen]);
  const handleDuplicateSession = useCallback(
    (session: TerminalSession) => void duplicateSession(session),
    [duplicateSession]
  );

  // Stable handlers for the chrome (topbar / workspace tabs), so those
  // memoized components skip the re-render caused by every activity tick.
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openCrons = useCallback(() => setCronsOpen(true), []);
  const openTemplates = useCallback(() => setTemplatesOpen(true), []);
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const openDevices = useCallback(() => setDevicesOpen(true), []);
  const openOverview = useCallback(() => setOverviewOpen(true), []);
  const openAlfaPatrol = useCallback(() => setAlfaPatrolOpen(true), []);
  const handleToggleViewMode = useCallback(
    () => setViewMode((mode) => (mode === 'grid' ? 'single' : 'grid')),
    [setViewMode]
  );
  const handleToggleBroadcast = useCallback(() => setBroadcast((value) => !value), [setBroadcast]);
  const handleInstall = useCallback(() => void install(), [install]);
  const handleRefresh = useCallback(() => router.refresh(), [router]);
  const { createWorkspace } = workspaces;
  const handleCreateWorkspace = useCallback(() => void createWorkspace(), [createWorkspace]);

  const openLauncher = useCallback((tab: LauncherTab) => {
    setLauncherTab(tab);
    setLauncherOpen(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }, [router]);

  const handleExportBackup = useCallback(() => {
    try {
      downloadBackup();
    } catch (err) {
      console.error('Backup export failed', err);
    }
  }, []);

  const handleImportBackup = useCallback(async () => {
    if (!confirm('Import backup will REPLACE workspaces, templates, settings, and history. Continue?')) {
      return;
    }
    try {
      const payload = await pickAndImportBackup();
      if (payload) {
        alert('Backup imported. Reloading…');
        window.location.reload();
      }
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Void wrappers declared after their async sources (deps evaluate immediately,
  // so referencing them earlier would hit the temporal dead zone).
  const handleLogoutClick = useCallback(() => void handleLogout(), [handleLogout]);
  const handleImportBackupClick = useCallback(
    () => void handleImportBackup(),
    [handleImportBackup]
  );

  return (
    <div
      className="terminal-shell"
      data-platform={isMobile ? 'mobile' : 'desktop'}
      data-fullscreen={fullscreen || undefined}
    >
      <WorkspaceTabs
        workspaces={workspaces.workspaces}
        activeId={workspaces.activeId}
        sessionCounts={sessionCounts}
        onSelect={workspaces.setActive}
        onCreate={handleCreateWorkspace}
        onRename={workspaces.renameWorkspace}
        onDelete={workspaces.deleteWorkspace}
      />

      <TerminalsTopbar
        sessions={sessions}
        agentProfileCount={agentProfiles.length}
        viewMode={viewMode}
        gridCols={gridCols}
        broadcast={broadcastEnabled}
        canInstall={canInstall}
        keyboardHidden={appSettings.settings.softKeyboard.hideKeyboard}
        onOpenLauncher={openLauncher}
        onToggleViewMode={handleToggleViewMode}
        onGridColsChange={setGridCols}
        onToggleBroadcast={handleToggleBroadcast}
        broadcastTargets={broadcastTargets}
        onBroadcastTargetsChange={setBroadcastTargets}
        fontSizes={fontSizes}
        onFontSizeChange={setFontSize}
        onToggleKeyboardHidden={appSettings.toggleHideKeyboard}
        onOpenSettings={openSettings}
        onOpenCrons={openCrons}
        onOpenTemplates={openTemplates}
        onOpenHistory={openHistory}
        onOpenDevices={openDevices}
        onOpenOverview={openOverview}
        onOpenAlfaPatrol={openAlfaPatrol}
        patrolActiveCount={patrolActiveCount}
        patrolPendingCount={patrolPings.pendingCount}
        onInstall={handleInstall}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackupClick}
        onRefresh={handleRefresh}
        onLogout={handleLogoutClick}
      />

      <SessionTabs
        sessions={sessions}
        activeId={activeId}
        viewMode={viewMode}
        activityStates={activityStates}
        onSelect={setActiveId}
        onClose={closeSession}
        onReorder={reorderSessions}
      />

      {error ? (
        <div className="mx-3 mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <TerminalsMain
        loading={loading}
        sessions={sessions}
        allSessions={allSessions}
        isSessionVisible={isSessionVisible}
        activeId={activeId}
        viewMode={viewMode}
        gridCols={gridCols}
        fullscreen={fullscreen}
        fontSizes={fontSizes}
        agentProfiles={agentProfiles}
        broadcast={broadcastEnabled}
        broadcastTargets={broadcastTargets}
        history={workspaceHistory}
        restoring={restoring}
        activityStates={activityStates}
        softKeyVisible={appSettings.settings.softKeyboard.visibility}
        keyboardVisible={keyboardVisible}
        workspaces={workspaces.workspaces}
        resolveSessionWorkspace={workspaces.resolveSessionWorkspace}
        heartbeatGlow={appSettings.settings.notifications.heartbeatGlow}
        onUpdateSession={updateSession}
        onCloseSession={closeSession}
        onDuplicateSession={handleDuplicateSession}
        onMoveToWorkspace={workspaces.assignSession}
        onToggleFullscreen={handleToggleFullscreen}
        onFontSizeChange={setFontSize}
        onActivityChange={handleActivityChange}
        onRequestFocus={focusSession}
        onBroadcastInput={broadcastInputScoped}
        onRestoreHistory={() => void restoreHistory(workspaces.activeId)}
        onClearHistory={() => clearHistory(workspaces.activeId)}
        agentOverrides={paneAgentOverrides.overrides}
        onBindAgent={paneAgentOverrides.bindAgent}
        onUnbindAgent={paneAgentOverrides.clearOverride}
      />

      <LauncherDrawer
        open={launcherOpen}
        tab={launcherTab}
        onOpenChange={setLauncherOpen}
        onTabChange={setLauncherTab}
        profiles={profiles}
        environments={environments}
        agentProfiles={agentProfiles}
        creatingKey={creatingKey}
        onLaunchProfile={(profileKey) =>
          void createSession({ profile: profileKey }, `profile:${profileKey}`)
        }
        onLaunchAgent={(agentId, opts) =>
          void createSession({ agentProfileId: agentId, ...opts }, `agent:${agentId}`)
        }
        onLaunchEnvironment={(environmentId) =>
          void createSession({ profile: 'shell', environmentId }, `env:${environmentId}`)
        }
      />

      <DevicesDrawer open={devicesOpen} onOpenChange={setDevicesOpen} />
      <OverviewDrawer open={overviewOpen} onOpenChange={setOverviewOpen} />

      <HistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history}
        liveIds={new Set(allSessions.map((session) => session.id))}
        watchers={alfaWatchers.watchers}
        onOpenEntry={(entry) => void restoreHistoryEntry(entry)}
        onRemoveEntry={removeHistoryEntry}
        onClearHistory={() => clearHistory()}
      />

      <SettingsDrawer
        open={settingsOpen}
        notifications={appSettings.settings.notifications}
        softKeyboard={appSettings.settings.softKeyboard}
        onClose={() => setSettingsOpen(false)}
        onUpdateNotifications={appSettings.updateNotifications}
        onUpdateSoftKeyboard={appSettings.updateSoftKeyboard}
        onSetSoftKeyVisible={appSettings.setSoftKeyVisible}
        onResetDefaults={appSettings.resetDefaults}
      />

      <CronsDrawer
        open={cronsOpen}
        loading={cronsState.loading}
        error={cronsState.error}
        crons={cronsState.crons}
        profiles={profiles}
        agentProfiles={agentProfiles}
        environments={environments}
        sessions={allSessions}
        onClose={() => setCronsOpen(false)}
        onRefresh={() => void cronsState.refresh()}
        onCreate={cronsState.createCron}
        onUpdate={cronsState.updateCron}
        onDelete={cronsState.deleteCron}
        onRun={cronsState.runCron}
      />

      <TemplatesDrawer
        open={templatesOpen}
        templates={templatesState.templates}
        profiles={profiles}
        agentProfiles={agentProfiles}
        environments={environments}
        workspaces={workspaces.workspaces}
        activeSession={
          allSessions.find((session) => session.id === activeId) ?? null
        }
        activeWorkspaceId={workspaces.activeId}
        onClose={() => setTemplatesOpen(false)}
        onCreate={templatesState.createTemplate}
        onUpdate={templatesState.updateTemplate}
        onDelete={templatesState.deleteTemplate}
        onDuplicate={templatesState.duplicateTemplate}
        onLaunch={(template) => {
          if (template.workspaceId && template.workspaceId !== workspaces.activeId) {
            workspaces.setActive(template.workspaceId);
          }
          void launchTemplate(template);
          setTemplatesOpen(false);
        }}
      />

      <AlfaRegistryDialog
        open={alfaPatrolOpen}
        onClose={() => setAlfaPatrolOpen(false)}
        watchers={alfaWatchers.watchers}
        allSessions={allSessions}
        pings={patrolPings.pings}
        agentOverridesIds={agentOverrideIds}
        onSave={handleSaveWatcher}
        onDeregister={handleDeregisterWatcher}
        onAckPing={(pingId) => void patrolPings.acknowledge(pingId)}
      />
    </div>
  );
}
