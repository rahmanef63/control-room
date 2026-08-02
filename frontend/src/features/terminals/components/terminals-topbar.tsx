'use client';

import { memo, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Clock,
  Cpu,
  Download,
  DownloadCloud,
  Gauge,
  Globe,
  Grid2x2,
  History,
  Keyboard,
  KeyboardOff,
  LogOut,
  MoreVertical,
  Plus,
  RefreshCw,
  Rows,
  Settings,
  ShieldCheck,
  TerminalSquare,
  UploadCloud,
} from 'lucide-react';

import type { LauncherTab } from '@/features/terminals/components/launcher-drawer';
import { AlfaPatrolButton } from '@/features/terminals/components/patrol/alfa-patrol-button';
import { BroadcastDropdown } from '@/features/terminals/components/terminals-broadcast';
import type { GridCols, ViewMode } from '@/features/terminals/hooks/use-terminal-preferences';
import { DEFAULT_FONT_SIZE } from '@/features/terminals/lib/utils';
import type { TerminalSession } from '@/shared/types/contracts';

interface TerminalsTopbarProps {
  sessions: TerminalSession[];
  agentProfileCount: number;
  viewMode: ViewMode;
  gridCols: GridCols;
  broadcast: boolean;
  canInstall: boolean;
  keyboardHidden: boolean;
  onOpenLauncher: (tab: LauncherTab) => void;
  onToggleViewMode: () => void;
  onGridColsChange: (value: GridCols) => void;
  onToggleBroadcast: () => void;
  broadcastTargets: Set<string>;
  onBroadcastTargetsChange: (next: Set<string>) => void;
  fontSizes: Record<string, number>;
  onFontSizeChange: (sessionId: string, size: number) => void;
  onToggleKeyboardHidden: () => void;
  onOpenSettings: () => void;
  onOpenCrons: () => void;
  onOpenTemplates: () => void;
  onOpenHistory: () => void;
  onOpenDevices: () => void;
  onOpenOverview: () => void;
  onOpenAlfaPatrol: () => void;
  patrolActiveCount: number;
  patrolPendingCount: number;
  onInstall: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}

function TerminalsTopbarComponent({
  sessions,
  agentProfileCount,
  viewMode,
  gridCols,
  broadcast,
  canInstall,
  keyboardHidden,
  onOpenLauncher,
  onToggleViewMode,
  onGridColsChange,
  onToggleBroadcast,
  broadcastTargets,
  onBroadcastTargetsChange,
  fontSizes,
  onFontSizeChange,
  onToggleKeyboardHidden,
  onOpenSettings,
  onOpenCrons,
  onOpenTemplates,
  onOpenHistory,
  onOpenDevices,
  onOpenOverview,
  onOpenAlfaPatrol,
  patrolActiveCount,
  patrolPendingCount,
  onInstall,
  onExportBackup,
  onImportBackup,
  onRefresh,
  onLogout,
}: TerminalsTopbarProps) {
  const runningCount = sessions.filter((s) => s.status === 'running').length;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  function close() {
    setMoreOpen(false);
  }

  return (
    <header className="terminal-topbar">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/70">
          <TerminalSquare className="h-4 w-4 text-sky-300" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            VPS Terminals
          </p>
          <p className="truncate text-xs text-foreground">
            {sessions.length} pane{sessions.length === 1 ? '' : 's'} · {runningCount} running
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onOpenLauncher('base')}
          className="new-terminal-trigger"
          aria-label="New terminal"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenLauncher('agents')}
          className="ai-terminal-trigger"
          aria-label="Launch AI agent"
          title="Launch AI agent"
        >
          <Cpu className="h-4 w-4" />
          <span className="hidden sm:inline">AI</span>
          {agentProfileCount > 0 ? (
            <span className="ai-terminal-badge">{agentProfileCount}</span>
          ) : null}
        </button>

        <AlfaPatrolButton
          patrolActiveCount={patrolActiveCount}
          pendingPingsCount={patrolPendingCount}
          onClick={onOpenAlfaPatrol}
        />

        <button
          type="button"
          onClick={onToggleKeyboardHidden}
          className="topbar-icon-button"
          title={keyboardHidden ? 'Show soft keyboard' : 'Hide soft keyboard'}
          aria-label={keyboardHidden ? 'Show soft keyboard' : 'Hide soft keyboard'}
          data-tone={keyboardHidden ? 'danger' : undefined}
        >
          {keyboardHidden ? (
            <KeyboardOff className="h-4 w-4" />
          ) : (
            <Keyboard className="h-4 w-4" />
          )}
        </button>

        <div className="topbar-more-wrapper" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className="topbar-icon-button topbar-more-trigger"
            aria-label="More actions"
            aria-haspopup="menu"
            aria-controls="topbar-more-menu"
            aria-expanded={moreOpen}
            title="More"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          <div id="topbar-more-menu" role="menu" className="topbar-secondary" data-open={moreOpen ? 'true' : undefined}>
            {sessions.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onToggleViewMode();
                    close();
                  }}
                  className="topbar-icon-button"
                  title={viewMode === 'grid' ? 'Minimize to single view' : 'Show all terminals'}
                  aria-label={viewMode === 'grid' ? 'Minimize to single view' : 'Show all terminals'}
                  data-tone={viewMode === 'grid' ? 'accent' : undefined}
                >
                  {viewMode === 'grid' ? (
                    <Rows className="h-4 w-4" />
                  ) : (
                    <Grid2x2 className="h-4 w-4" />
                  )}
                  <span className="topbar-label">
                    {viewMode === 'grid' ? 'Single view' : 'Show all'}
                  </span>
                </button>
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
                <BroadcastDropdown
                  sessions={sessions}
                  broadcast={broadcast}
                  onToggleBroadcast={onToggleBroadcast}
                  broadcastTargets={broadcastTargets}
                  onBroadcastTargetsChange={onBroadcastTargetsChange}
                  fontSizes={fontSizes}
                  onFontSizeChange={onFontSizeChange}
                  defaultFontSize={DEFAULT_FONT_SIZE}
                />
              </>
            ) : null}
            {canInstall ? (
              <button
                type="button"
                onClick={() => {
                  onInstall();
                  close();
                }}
                className="topbar-icon-button"
                title="Install as app"
                aria-label="Install app"
              >
                <Download className="h-4 w-4" />
                <span className="topbar-label">Install</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onOpenOverview();
                close();
              }}
              className="topbar-icon-button"
              title="System overview"
              aria-label="Open system overview"
            >
              <Gauge className="h-4 w-4" />
              <span className="topbar-label">Overview</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenHistory();
                close();
              }}
              className="topbar-icon-button"
              title="Terminal history"
              aria-label="Open terminal history"
            >
              <History className="h-4 w-4" />
              <span className="topbar-label">History</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenDevices();
                close();
              }}
              className="topbar-icon-button"
              title="Trusted devices"
              aria-label="Open trusted devices"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="topbar-label">Devices</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenTemplates();
                close();
              }}
              className="topbar-icon-button"
              title="Templates"
              aria-label="Open templates"
            >
              <Bookmark className="h-4 w-4" />
              <span className="topbar-label">Templates</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenCrons();
                close();
              }}
              className="topbar-icon-button"
              title="Cron jobs"
              aria-label="Open cron jobs"
            >
              <Clock className="h-4 w-4" />
              <span className="topbar-label">Cron jobs</span>
            </button>
            <Link
              href="/browser"
              onClick={() => close()}
              className="topbar-icon-button"
              title="Browser CRUD"
              aria-label="Open browser CRUD"
            >
              <Globe className="h-4 w-4" />
              <span className="topbar-label">Browser</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                close();
              }}
              className="topbar-icon-button"
              title="Settings"
              aria-label="Open settings"
            >
              <Settings className="h-4 w-4" />
              <span className="topbar-label">Settings</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onRefresh();
                close();
              }}
              className="topbar-icon-button"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="topbar-label">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onExportBackup();
                close();
              }}
              className="topbar-icon-button"
              title="Export backup"
              aria-label="Export backup"
            >
              <DownloadCloud className="h-4 w-4" />
              <span className="topbar-label">Export backup</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onImportBackup();
                close();
              }}
              className="topbar-icon-button"
              title="Import backup"
              aria-label="Import backup"
            >
              <UploadCloud className="h-4 w-4" />
              <span className="topbar-label">Import backup</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onLogout();
                close();
              }}
              className="topbar-icon-button"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="topbar-label">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Memoized: the parent re-renders on every pane activity tick; with the
// screen-level handlers now stable, the topbar's props don't change on those
// ticks, so it skips the render entirely.
export const TerminalsTopbar = memo(TerminalsTopbarComponent);
