<script lang="ts">
  import { History as HistoryIcon } from 'lucide-svelte';

  import { Button } from '$lib/components/ui/button';
  import { terminalSessions } from '$lib/state/terminal-sessions.svelte';
  import PaneChrome from './PaneChrome.svelte';
  import PaneErrorBoundary from './PaneErrorBoundary.svelte';
  import Terminal from './Terminal.svelte';
  import { paneAgentOverrides } from './pane-agent-overrides.svelte';
  import { sessionColors } from './session-colors.svelte';
  import { terminalHistory } from './terminal-history.svelte';
  import { DEFAULT_FONT_SIZE, type SoftKeyboardKey, type TerminalSession } from './types';
  import type { TerminalHistoryEntry } from './history';
  import type { TerminalTelemetry } from './telemetry';
  import type { GridCols, ViewMode } from './use-terminal-preferences.svelte';
  import type { Workspace } from './use-workspaces.svelte';

  interface Props {
    workspaces: Workspace[];
    activeWorkspaceId: string;
    resolveWorkspace: (sessionId: string) => string;
    activeWorkspaceSessions: TerminalSession[];
    activeRestorableHistory: TerminalHistoryEntry[];
    historyRestoring: boolean;
    telemetry: Record<string, TerminalTelemetry>;
    viewMode: ViewMode;
    gridCols: GridCols;
    fontSizes: Record<string, number>;
    fullscreen: boolean;
    heartbeatGlow: boolean;
    keyboardHidden: boolean;
    softKeyVisible: Record<SoftKeyboardKey, boolean>;
    paneIsWorkspaceVisible: (sessionId: string) => boolean;
    paneIsActive: (sessionId: string) => boolean;
    paneIsBroadcastTarget: (sessionId: string) => boolean;
    onInjectAgent: (sessionId: string, agentProfileId: string, command: string) => void;
    onCommand: (sessionId: string, command: string) => void;
    onDuplicate: (session: TerminalSession) => Promise<void>;
    onMoveToWorkspace: (sessionId: string, workspaceId: string) => void;
    onFontSizeChange: (sessionId: string, size: number) => void;
    onFocus: (sessionId: string) => void;
    onToggleFullscreen: () => void;
    onClose: (sessionId: string) => Promise<void>;
    onTelemetry: (sessionId: string, value: TerminalTelemetry) => void;
    onBroadcastData: (sourceId: string, data: string) => boolean;
    onRestoreHistory: () => Promise<void>;
    onNewShell: () => Promise<void>;
  }

  let {
    workspaces,
    activeWorkspaceId,
    resolveWorkspace,
    activeWorkspaceSessions,
    activeRestorableHistory,
    historyRestoring,
    telemetry,
    viewMode,
    gridCols,
    fontSizes,
    fullscreen,
    heartbeatGlow,
    keyboardHidden,
    softKeyVisible,
    paneIsWorkspaceVisible,
    paneIsActive,
    paneIsBroadcastTarget,
    onInjectAgent,
    onCommand,
    onDuplicate,
    onMoveToWorkspace,
    onFontSizeChange,
    onFocus,
    onToggleFullscreen,
    onClose,
    onTelemetry,
    onBroadcastData,
    onRestoreHistory,
    onNewShell
  }: Props = $props();
</script>

<main class="terminal-stage">
  {#if terminalSessions.loading && terminalSessions.sessions.length === 0}
    <p class="hint">Loading terminal sessions…</p>
  {:else if terminalSessions.error}
    <p class="hint hint--error">{terminalSessions.error}</p>
  {/if}

  {#if terminalSessions.sessions.length > 0}
    <div class="terminal-grid" data-view={viewMode} data-grid-cols={gridCols}>
      {#each terminalSessions.sessions as session (session.id)}
        {@const workspaceVisible = paneIsWorkspaceVisible(session.id)}
        {@const active = paneIsActive(session.id)}
        {@const paneTelemetry = telemetry[session.id]}
        {@const paneColor = sessionColors.colorOf(session.id)}
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
              style:--session-color={paneColor}
              data-heartbeat={heartbeatGlow && paneTelemetry?.activityState === 'working' || undefined}
            >
              <PaneChrome
                {session}
                {workspaces}
                currentWorkspaceId={resolveWorkspace(session.id)}
                fontSize={fontSizes[session.id] ?? DEFAULT_FONT_SIZE}
                {viewMode}
                connectionState={paneTelemetry?.connectionState ?? 'connecting'}
                rttMs={paneTelemetry?.rttMs ?? null}
                activityState={paneTelemetry?.activityState ?? 'idle'}
                activityLabel={paneTelemetry?.activityLabel ?? 'Idle'}
                showActivity={paneTelemetry?.showActivity ?? false}
                {fullscreen}
                color={paneColor}
                hasColorOverride={sessionColors.hasOverride(session.id)}
                agentProfiles={terminalSessions.agentProfiles}
                boundAgentProfileId={paneAgentOverrides.overrideOf(session.id)?.agentProfileId}
                onBindAgent={(agentProfileId) => paneAgentOverrides.bind(session.id, agentProfileId)}
                onInjectAgent={(agentProfileId, command) => onInjectAgent(session.id, agentProfileId, command)}
                onCommand={(command) => onCommand(session.id, command)}
                onUnbindAgent={() => paneAgentOverrides.clear(session.id)}
                onColorPick={(color) => sessionColors.setColor(session.id, color)}
                onColorClear={() => sessionColors.clearColor(session.id)}
                onRename={(id, title) => terminalSessions.rename(id, title)}
                onDuplicate={onDuplicate}
                onMoveToWorkspace={onMoveToWorkspace}
                onFontSizeChange={onFontSizeChange}
                onFocus={onFocus}
                onToggleFullscreen={onToggleFullscreen}
                onClose={onClose}
              />
              {#if paneIsBroadcastTarget(session.id)}
                <div class="pane-broadcast-banner">Broadcast target — typing in any sibling pane is mirrored here.</div>
              {/if}
              <div class="pane-terminal-host">
                <Terminal
                  {session}
                  active={workspaceVisible && active}
                  fontSize={fontSizes[session.id] ?? DEFAULT_FONT_SIZE}
                  {fullscreen}
                  keyboardVisible={!keyboardHidden}
                  {softKeyVisible}
                  boundAgentProfileId={paneAgentOverrides.overrideOf(session.id)?.agentProfileId}
                  onUpdate={(updated) => terminalSessions.patchFromStream(updated)}
                  onTelemetry={onTelemetry}
                  onFontSizeChange={onFontSizeChange}
                  onData={onBroadcastData}
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
          <Button onclick={() => void onRestoreHistory()} disabled={historyRestoring}>
            <HistoryIcon size={14} /> {historyRestoring ? 'Restoring…' : 'Restore where I left off'}
          </Button>
          <button type="button" class="empty__forget" onclick={() => terminalHistory.clear(activeWorkspaceId)}>Forget this history</button>
        </div>
      {:else}
        <p>No terminal sessions in this workspace.</p>
        <Button onclick={() => void onNewShell()}>Launch a shell</Button>
      {/if}
    </div>
  {/if}
</main>
