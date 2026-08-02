'use client';

import { Bot, Check, Eye, Pencil, X } from 'lucide-react';

import { ConnLatencyBadge } from '@/features/terminals/components/pane-conn-badge';
import { PaneActivityChip } from '@/features/terminals/components/pane-activity-chip';
import {
  PaneMenuCluster,
  type PaneMenuClusterProps,
} from '@/features/terminals/components/pane-menu-cluster';
import type { ActivityState, ConnectionState } from '@/features/terminals/lib/utils';
import type { AlfaWatcher } from '@/features/terminals/hooks/use-alfa-watchers';
import type { TerminalSession } from '@/shared/types/contracts';

interface PaneHeaderProps {
  session: TerminalSession;
  // rename
  renaming: boolean;
  renameValue: string;
  renameBusy: boolean;
  onRenameValueChange: (value: string) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSubmitRename: () => void;
  // activity
  showActivity: boolean;
  activityState: ActivityState;
  activityLabel: string;
  // alfa chips
  selfIsAlfa: boolean;
  selfWatcher?: AlfaWatcher;
  isTargetPane: boolean;
  parentAlfaLabel?: string;
  paneColor: string;
  // connection
  connectionState: ConnectionState;
  rttMs: number | null;
  // menu cluster
  menu: PaneMenuClusterProps;
}

/** Pane title bar: rename control, status/alfa chips, latency badge, and the
 *  responsive action cluster. Pure presentation — all behavior is wired in by
 *  the parent via props. */
export function PaneHeader({
  session,
  renaming,
  renameValue,
  renameBusy,
  onRenameValueChange,
  onStartRename,
  onCancelRename,
  onSubmitRename,
  showActivity,
  activityState,
  activityLabel,
  selfIsAlfa,
  selfWatcher,
  isTargetPane,
  parentAlfaLabel,
  paneColor,
  connectionState,
  rttMs,
  menu,
}: PaneHeaderProps) {
  return (
    <header className="terminal-pane-header">
      <div className="title-block">
        <div className="title-block-row title-name-row">
          {renaming ? (
            <div className="flex flex-1 items-center gap-1.5">
              <input
                value={renameValue}
                autoFocus
                onChange={(event) => onRenameValueChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSubmitRename();
                  if (event.key === 'Escape') onCancelRename();
                }}
                className="min-w-0 flex-1 rounded-md border border-border/80 bg-background/70 px-2 py-1 text-sm font-semibold text-foreground outline-none focus:border-sky-400/50"
                placeholder="Container name"
                maxLength={80}
                disabled={renameBusy}
              />
              <button
                type="button"
                onClick={onSubmitRename}
                disabled={renameBusy}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 disabled:opacity-60"
                aria-label="Save name"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onCancelRename}
                disabled={renameBusy}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/60 text-muted-foreground disabled:opacity-60"
                aria-label="Cancel rename"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartRename}
              className="title-name-btn"
              title={`${session.title} · ${session.cwd}`}
            >
              <h2 className="truncate text-sm font-semibold text-foreground">{session.title}</h2>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60" />
            </button>
          )}
          {showActivity ? (
            <PaneActivityChip state={activityState} label={activityLabel} />
          ) : null}
          {selfIsAlfa ? (
            <span
              className="alfa-pane-chip"
              data-role="alfa"
              title={`This pane is an ALFA watching ${selfWatcher?.watchedSessionIds.length ?? 0} terminal(s)`}
            >
              <Bot className="h-3 w-3" /> ALFA
              <span className="alfa-pane-chip-count">
                {selfWatcher?.watchedSessionIds.length ?? 0}
              </span>
            </span>
          ) : isTargetPane ? (
            <span
              className="alfa-pane-chip"
              data-role="target"
              style={{ ['--session-color' as string]: paneColor }}
              title={`Patrol target of alfa "${parentAlfaLabel}"`}
            >
              <Eye className="h-3 w-3" /> TARGET
              <span className="alfa-pane-chip-owner">◄ {parentAlfaLabel}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <ConnLatencyBadge state={connectionState} rttMs={rttMs} />
        <PaneMenuCluster {...menu} />
      </div>
    </header>
  );
}
