<script lang="ts">
  import {
    Bookmark,
    Gauge,
    Grid2X2,
    History as HistoryIcon,
    Menu,
    Plus,
    Rocket,
    Rows3,
    Settings2,
    ShieldCheck,
    X
  } from 'lucide-svelte';

  import { Button } from '$lib/components/ui/button';
  import InstallAppControl from '$lib/pwa/InstallAppControl.svelte';
  import BroadcastMenu from './BroadcastMenu.svelte';
  import TerminalProfileIcon from './TerminalProfileIcon.svelte';
  import { sessionColors } from './session-colors.svelte';
  import { resolveSessionVisualState, type TerminalTelemetry } from './telemetry';
  import type { TerminalSession } from './types';
  import type { GridCols, ViewMode } from './use-terminal-preferences.svelte';
  import type { LauncherTab } from './launcher';

  interface Props {
    sessions: TerminalSession[];
    activeId: string | null;
    telemetry: Record<string, TerminalTelemetry>;
    viewMode: ViewMode;
    gridCols: GridCols;
    broadcastTargets: Set<string>;
    templateCount: number;
    historyCount: number;
    onSetActive: (id: string) => void;
    onCloseSession: (id: string) => void | Promise<void>;
    onNewShell: () => void | Promise<void>;
    onSetViewMode: (mode: ViewMode) => void;
    onSetGridCols: (cols: GridCols) => void;
    onBroadcastChange: (targets: Iterable<string>) => void;
    onOpenLauncher: (tab: LauncherTab) => void;
    onOpenHistory: () => void;
    onOpenOverview: () => void;
    onOpenSettings: () => void;
    onOpenDevices: () => void;
    onLogout: () => void | Promise<void>;
  }

  let {
    sessions,
    activeId,
    telemetry,
    viewMode,
    gridCols,
    broadcastTargets,
    templateCount,
    historyCount,
    onSetActive,
    onCloseSession,
    onNewShell,
    onSetViewMode,
    onSetGridCols,
    onBroadcastChange,
    onOpenLauncher,
    onOpenHistory,
    onOpenOverview,
    onOpenSettings,
    onOpenDevices,
    onLogout
  }: Props = $props();

  let mobileActionsOpen = $state(false);
</script>

<header class="terminal-commandbar">
  <nav class="session-tabs" aria-label="Terminal sessions">
    {#each sessions as session (session.id)}
      {@const visualState = resolveSessionVisualState(session, telemetry[session.id]?.activityState)}
      <div
        class="session-tab"
        style:--session-color={sessionColors.colorOf(session.id)}
        data-active={session.id === activeId || undefined}
        data-state={visualState}
      >
        <button type="button" class="session-tab__main" onclick={() => onSetActive(session.id)}>
          <span class="session-tab__profile"><TerminalProfileIcon profile={session.profile} size={13} /></span>
          <span class="session-tab__dot" data-status={visualState} aria-label={visualState}></span>
          <span class="session-tab__title">{session.title || session.profile}</span>
        </button>
        <button
          type="button"
          class="session-tab__close"
          onclick={() => void onCloseSession(session.id)}
          aria-label={`Close ${session.title || session.profile}`}
        >×</button>
      </div>
    {/each}
  </nav>

  <div class="terminal-commandbar__quick">
    <Button class="new-shell-button" variant="ghost" size="sm" aria-label="+ New shell" title="New shell" onclick={() => void onNewShell()}>
      <Plus size={14} /><span class="toolbar-label">New shell</span>
    </Button>
    <Button class="mobile-launch-button" variant="outline" size="sm" aria-label="Open terminal launcher" title="Launcher" onclick={() => onOpenLauncher('base')}>
      <Rocket size={14} />
    </Button>
    <button
      type="button"
      class="mobile-actions-trigger"
      aria-label="Open terminal controls"
      aria-controls="terminal-topbar-controls"
      aria-expanded={mobileActionsOpen}
      title="More terminal controls"
      onclick={() => (mobileActionsOpen = true)}
    >
      <Menu size={16} />
    </button>
  </div>

  {#if mobileActionsOpen}
    <button
      type="button"
      class="topbar-actions-backdrop"
      aria-label="Close terminal controls"
      onclick={() => (mobileActionsOpen = false)}
    ></button>
  {/if}

  <div id="terminal-topbar-controls" class="topbar__controls" data-open={mobileActionsOpen || undefined} role="group" aria-label="Terminal toolbar">
    <div class="mobile-actions-heading">
      <div>
        <strong>Terminal controls</strong>
        <span>{sessions.length} session{sessions.length === 1 ? '' : 's'} in workspace</span>
      </div>
      <button type="button" aria-label="Close terminal controls" onclick={() => (mobileActionsOpen = false)}>
        <X size={16} />
      </button>
    </div>

    <div class="view-mode-control" role="group" aria-label="Terminal layout">
      <Button
        variant={viewMode === 'single' ? 'default' : 'outline'}
        size="sm"
        aria-pressed={viewMode === 'single'}
        title="Single terminal"
        onclick={() => onSetViewMode('single')}
      ><Rows3 size={14} /><span class="toolbar-label">Single</span></Button>
      <Button
        variant={viewMode === 'grid' ? 'default' : 'outline'}
        size="sm"
        aria-pressed={viewMode === 'grid'}
        title="Terminal grid"
        onclick={() => onSetViewMode('grid')}
      ><Grid2X2 size={14} /><span class="toolbar-label">Grid</span></Button>
    </div>

    {#if viewMode === 'grid'}
      <label class="grid-cols-control">
        <span>Cols</span>
        <select value={gridCols} onchange={(event) => onSetGridCols(event.currentTarget.value as GridCols)}>
          <option value="auto">Auto</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
        </select>
      </label>
    {/if}

    <span class="toolbar-divider" aria-hidden="true"></span>
    <BroadcastMenu {sessions} targets={broadcastTargets} onChange={onBroadcastChange} />
    <Button variant="outline" size="sm" onclick={() => { mobileActionsOpen = false; onOpenLauncher('base'); }} aria-label="Open terminal launcher" title="Launcher"><Rocket size={14} /><span class="toolbar-label">Launch</span></Button>
    <Button variant="outline" size="sm" onclick={() => { mobileActionsOpen = false; onOpenLauncher('saved'); }} aria-label="Open saved terminal templates" title="Saved terminals"><Bookmark size={14} /><span class="toolbar-label">Saved</span> {#if templateCount > 0}<span class="topbar-count">{templateCount}</span>{/if}</Button>
    <Button variant="outline" size="sm" onclick={() => { mobileActionsOpen = false; onOpenHistory(); }} aria-label="Open terminal history" title="Terminal history"><HistoryIcon size={14} /><span class="toolbar-label">History</span> {#if historyCount > 0}<span class="topbar-count">{historyCount}</span>{/if}</Button>

    <div class="toolbar-utility-actions">
      <span class="toolbar-divider" aria-hidden="true"></span>
      <Button variant="outline" size="sm" onclick={() => { mobileActionsOpen = false; onOpenOverview(); }} aria-label="Open system overview"><Gauge size={14} /> Overview</Button>
      <InstallAppControl />
      <Button variant="outline" size="sm" onclick={() => { mobileActionsOpen = false; onOpenSettings(); }} aria-label="Open settings"><Settings2 size={14} /> Settings</Button>
      <Button variant="outline" size="sm" onclick={() => { mobileActionsOpen = false; onOpenDevices(); }}><ShieldCheck size={14} /> Devices</Button>
      <Button variant="outline" size="sm" onclick={() => { mobileActionsOpen = false; void onLogout(); }}>Sign out</Button>
    </div>
  </div>
</header>
