'use client';

import { memo, useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Boxes,
  ChevronDown,
  CircleUser,
  Cpu,
  Gauge,
  Grid2x2,
  History,
  LogOut,
  Plus,
  Rows,
  Settings,
  TerminalSquare,
} from 'lucide-react';

import type { LauncherTab } from '@/features/terminals/components/launcher-drawer';
import { AlfaPatrolButton } from '@/features/terminals/components/patrol/alfa-patrol-button';
import { SendKeysMenu } from '@/features/terminals/components/terminals-broadcast';
import type { GridCols, ViewMode } from '@/features/terminals/hooks/use-terminal-preferences';
import type { TerminalSession } from '@/shared/types/contracts';

interface TerminalsTopbarProps {
  sessions: TerminalSession[];
  agentProfileCount: number;

  onOpenLauncher: (tab: LauncherTab) => void;

  viewMode: ViewMode;
  gridCols: GridCols;
  onToggleViewMode: () => void;
  onGridColsChange: (value: GridCols) => void;

  broadcast: boolean;
  broadcastTargets: Set<string>;
  onBroadcastTargetsChange: (next: Set<string>) => void;

  patrolActiveCount: number;
  patrolPendingCount: number;
  onOpenAlfaPatrol: () => void;

  onOpenOverview: () => void;
  onOpenSettings: () => void;

  onOpenHistory: () => void;
  onLogout: () => void;
}

/** Only one topbar menu may be open at a time — they overlap on mobile. */
type OpenMenu = 'new' | 'account' | null;

function TerminalsTopbarComponent({
  sessions,
  agentProfileCount,
  onOpenLauncher,
  viewMode,
  gridCols,
  onToggleViewMode,
  onGridColsChange,
  broadcast,
  broadcastTargets,
  onBroadcastTargetsChange,
  patrolActiveCount,
  patrolPendingCount,
  onOpenAlfaPatrol,
  onOpenOverview,
  onOpenSettings,
  onOpenHistory,
  onLogout,
}: TerminalsTopbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const newMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click / Escape — the behaviour the deleted kebab had.
  // Scoped to the wrapper of the *open* menu so a click on any other topbar
  // control both closes the menu and still reaches that control.
  useEffect(() => {
    if (!openMenu) return;
    const wrapper = openMenu === 'new' ? newMenuRef.current : accountMenuRef.current;
    function onDoc(event: MouseEvent) {
      if (!wrapper) return;
      if (!wrapper.contains(event.target as Node)) setOpenMenu(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenMenu(null);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  function launch(tab: LauncherTab) {
    setOpenMenu(null);
    onOpenLauncher(tab);
  }

  /** onToggleViewMode flips; clicking the already-active segment must no-op. */
  function selectView(mode: ViewMode) {
    if (viewMode !== mode) onToggleViewMode();
  }

  return (
    <header className="terminal-topbar">
      <span className="topbar-identity" aria-hidden="true">
        <TerminalSquare className="h-4 w-4 text-sky-300" />
      </span>

      <div className="topbar-actions">
        <div className="topbar-split" ref={newMenuRef}>
          <button
            type="button"
            onClick={() => launch('base')}
            className="new-terminal-trigger topbar-split-main"
          >
            <Plus className="h-4 w-4" />
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={() => setOpenMenu((value) => (value === 'new' ? null : 'new'))}
            className="new-terminal-trigger topbar-split-caret"
            aria-label="Choose what to launch"
            aria-haspopup="menu"
            aria-controls="topbar-new-menu"
            aria-expanded={openMenu === 'new'}
            data-open={openMenu === 'new' || undefined}
          >
            <ChevronDown className="topbar-caret h-3.5 w-3.5" />
          </button>

          {openMenu === 'new' ? (
            <div id="topbar-new-menu" role="menu" className="topbar-menu">
              <button
                type="button"
                role="menuitem"
                className="topbar-menu-item"
                onClick={() => launch('base')}
              >
                <TerminalSquare className="h-4 w-4" />
                <span>Base shell</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="topbar-menu-item"
                onClick={() => launch('agents')}
              >
                <Cpu className="h-4 w-4" />
                <span>AI agents</span>
                {/* Inventory count of configured profiles, not unread news —
                    it belongs on this row, not on the whole New button. */}
                {agentProfileCount > 0 ? (
                  <span className="ai-terminal-badge">{agentProfileCount}</span>
                ) : null}
              </button>
              <button
                type="button"
                role="menuitem"
                className="topbar-menu-item"
                onClick={() => launch('envs')}
              >
                <Boxes className="h-4 w-4" />
                <span>Environments</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="topbar-menu-item"
                onClick={() => launch('saved')}
              >
                <Bookmark className="h-4 w-4" />
                <span>Saved</span>
              </button>
            </div>
          ) : null}
        </div>

        {sessions.length > 1 ? (
          <>
            <div className="topbar-segmented" role="group" aria-label="Pane layout">
              <button
                type="button"
                className="topbar-segment"
                data-active={viewMode === 'grid' || undefined}
                aria-pressed={viewMode === 'grid'}
                onClick={() => selectView('grid')}
                title="Show all terminals"
              >
                <Grid2x2 className="h-3.5 w-3.5" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                className="topbar-segment"
                data-active={viewMode !== 'grid' || undefined}
                aria-pressed={viewMode !== 'grid'}
                onClick={() => selectView('single')}
                title="Single view"
              >
                <Rows className="h-3.5 w-3.5" />
                <span>Single</span>
              </button>
            </div>
            {viewMode === 'grid' ? (
              <select
                value={gridCols}
                onChange={(event) => onGridColsChange(event.target.value as GridCols)}
                className="grid-cols-select"
                aria-label="Terminals per row"
                title="Terminals per row"
              >
                <option value="auto">Auto</option>
                <option value="1">1 / row</option>
                <option value="2">2 / row</option>
                <option value="3">3 / row</option>
                <option value="4">4 / row</option>
              </select>
            ) : null}
          </>
        ) : null}

        <SendKeysMenu
          sessions={sessions}
          broadcast={broadcast}
          broadcastTargets={broadcastTargets}
          onBroadcastTargetsChange={onBroadcastTargetsChange}
        />

        <span className="topbar-patrol">
          <AlfaPatrolButton
            patrolActiveCount={patrolActiveCount}
            pendingPingsCount={patrolPendingCount}
            onClick={onOpenAlfaPatrol}
          />
        </span>

        <button
          type="button"
          onClick={onOpenOverview}
          className="topbar-icon-button"
          title="Host metrics"
        >
          <Gauge className="h-4 w-4" />
          <span className="topbar-label">Host metrics</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="topbar-icon-button"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
          <span className="topbar-label">Settings</span>
        </button>

        <div className="topbar-account" ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setOpenMenu((value) => (value === 'account' ? null : 'account'))}
            className="topbar-icon-button topbar-account-trigger"
            aria-haspopup="menu"
            aria-controls="topbar-account-menu"
            aria-expanded={openMenu === 'account'}
            data-open={openMenu === 'account' || undefined}
            title="Account"
          >
            <CircleUser className="h-4 w-4" />
            <span className="topbar-label">Account</span>
            <ChevronDown className="topbar-caret h-3 w-3" />
          </button>

          {openMenu === 'account' ? (
            <div
              id="topbar-account-menu"
              role="menu"
              className="topbar-menu"
              data-align="end"
            >
              <button
                type="button"
                role="menuitem"
                className="topbar-menu-item"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenHistory();
                }}
              >
                <History className="h-4 w-4" />
                <span>Reopen a terminal…</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="topbar-menu-item"
                data-tone="danger"
                onClick={() => {
                  setOpenMenu(null);
                  onLogout();
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// Memoized: the parent re-renders on every pane activity tick; with the
// screen-level handlers now stable, the topbar's props don't change on those
// ticks, so it skips the render entirely.
export const TerminalsTopbar = memo(TerminalsTopbarComponent);
