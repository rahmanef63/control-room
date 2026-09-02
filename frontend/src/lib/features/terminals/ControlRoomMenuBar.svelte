<script lang="ts">
  import {
    Bookmark,
    ChevronDown,
    Gauge,
    Grid2X2,
    History as HistoryIcon,
    LogOut,
    Rocket,
    Rows3,
    Settings2,
    ShieldCheck,
    SquareTerminal
  } from 'lucide-svelte';

  import InstallAppControl from '$lib/pwa/InstallAppControl.svelte';
  import type { LauncherTab } from './launcher';
  import type { ViewMode } from './use-terminal-preferences.svelte';

  interface Props {
    workspaceName: string;
    sessionCount: number;
    viewMode: ViewMode;
    onNewShell: () => void | Promise<void>;
    onSetViewMode: (mode: ViewMode) => void;
    onOpenLauncher: (tab: LauncherTab) => void;
    onOpenHistory: () => void;
    onOpenOverview: () => void;
    onOpenSettings: () => void;
    onOpenDevices: () => void;
    onLogout: () => void | Promise<void>;
  }

  let {
    workspaceName,
    sessionCount,
    viewMode,
    onNewShell,
    onSetViewMode,
    onOpenLauncher,
    onOpenHistory,
    onOpenOverview,
    onOpenSettings,
    onOpenDevices,
    onLogout
  }: Props = $props();

  function closeMenu(event: MouseEvent): void {
    const details = (event.currentTarget as HTMLElement).closest('details');
    details?.removeAttribute('open');
  }
</script>

<div class="app-menubar" role="group" aria-label="Control Room application menu">
  <div class="app-menubar__identity">
    <span class="app-menubar__mark"><SquareTerminal size={14} /></span>
    <strong>Control Room</strong>
    <span class="app-menubar__workspace" title={workspaceName}>{workspaceName}</span>
  </div>

  <div class="app-menubar__menus">
    <details class="app-menu">
      <summary>Terminal <ChevronDown size={11} /></summary>
      <div class="app-menu__popover">
        <button type="button" onclick={(event) => { closeMenu(event); void onNewShell(); }}>
          <SquareTerminal size={14} /><span>New shell</span><kbd>+</kbd>
        </button>
        <button type="button" onclick={(event) => { closeMenu(event); onOpenLauncher('base'); }}>
          <Rocket size={14} /><span>Launcher…</span>
        </button>
        <button type="button" onclick={(event) => { closeMenu(event); onOpenLauncher('saved'); }}>
          <Bookmark size={14} /><span>Saved terminals</span>
        </button>
        <button type="button" onclick={(event) => { closeMenu(event); onOpenHistory(); }}>
          <HistoryIcon size={14} /><span>History</span>
        </button>
      </div>
    </details>

    <details class="app-menu">
      <summary>View <ChevronDown size={11} /></summary>
      <div class="app-menu__popover">
        <button type="button" data-selected={viewMode === 'single' || undefined} onclick={(event) => { closeMenu(event); onSetViewMode('single'); }}>
          <Rows3 size={14} /><span>Single terminal</span>
        </button>
        <button type="button" data-selected={viewMode === 'grid' || undefined} onclick={(event) => { closeMenu(event); onSetViewMode('grid'); }}>
          <Grid2X2 size={14} /><span>Terminal grid</span>
        </button>
        <button type="button" onclick={(event) => { closeMenu(event); onOpenOverview(); }}>
          <Gauge size={14} /><span>System overview</span>
        </button>
      </div>
    </details>

    <details class="app-menu app-menu--end">
      <summary>Window <ChevronDown size={11} /></summary>
      <div class="app-menu__popover">
        <button type="button" onclick={(event) => { closeMenu(event); onOpenDevices(); }}>
          <ShieldCheck size={14} /><span>Trusted devices</span>
        </button>
        <button type="button" onclick={(event) => { closeMenu(event); onOpenSettings(); }}>
          <Settings2 size={14} /><span>Settings</span>
        </button>
        <button type="button" class="app-menu__danger" onclick={(event) => { closeMenu(event); void onLogout(); }}>
          <LogOut size={14} /><span>Sign out</span>
        </button>
      </div>
    </details>
  </div>

  <div class="app-menubar__status">
    <span class="app-menubar__live"><span></span>{sessionCount} live</span>
    <div class="app-menubar__install"><InstallAppControl /></div>
  </div>
</div>
