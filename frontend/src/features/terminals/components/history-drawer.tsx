'use client';

import { Bot, Eye, History, RotateCcw, Trash2, X } from 'lucide-react';

import { TerminalProfileIcon } from '@/features/terminals/components/terminal-profile-icon';
import type { AlfaWatcher } from '@/features/terminals/hooks/use-alfa-watchers';
import type { TerminalHistoryEntry } from '@/features/terminals/hooks/use-terminal-sessions';
import { shortenCwd } from '@/features/terminals/lib/utils';

export interface HistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: TerminalHistoryEntry[];
  liveIds: Set<string>;
  watchers: AlfaWatcher[];
  onOpenEntry: (entry: TerminalHistoryEntry) => void;
  onRemoveEntry: (id: string) => void;
  onClearHistory: () => void;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

/**
 * Terminal history — every pane that has been open, including closed ones, so
 * the user can see "what each terminal was for" and reopen/restore it. Live
 * entries focus the pane; closed entries are recreated from their stored spec.
 * Shows the owning alfa for panes that are (or were) patrol targets.
 */
export function HistoryDrawer({
  open,
  onOpenChange,
  history,
  liveIds,
  watchers,
  onOpenEntry,
  onRemoveEntry,
  onClearHistory,
}: HistoryDrawerProps) {
  if (!open) return null;

  function close() {
    onOpenChange(false);
  }

  function ownerOf(id: string): AlfaWatcher | undefined {
    return watchers.find((w) => w.watchedSessionIds.includes(id));
  }

  const sorted = history.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="launcher-drawer-backdrop" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Terminal history"
        onClick={(event) => event.stopPropagation()}
        className="launcher-drawer-sheet"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sky-300" />
            <div>
              <p className="text-sm font-semibold text-foreground">Terminal history</p>
              <p className="text-[11px] text-muted-foreground">
                {sorted.length} entr{sorted.length === 1 ? 'y' : 'ies'} · reopen, restore, or clear
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {sorted.length > 0 ? (
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-muted-foreground hover:text-rose-300"
                title="Clear all history"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground"
              aria-label="Close history"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-3 py-3">
          {sorted.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">
              No history yet. Terminals you open will be listed here.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {sorted.map((entry) => {
                const live = liveIds.has(entry.id);
                const owner = ownerOf(entry.id);
                const ownerLabel = owner ? owner.label?.trim() || owner.id.slice(0, 8) : undefined;
                const isAlfa = watchers.some((w) => w.id === entry.id);
                return (
                  <li
                    key={entry.id}
                    className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-2.5 py-2"
                    data-live={live ? 'true' : undefined}
                  >
                    <span className="shrink-0 text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">
                      <TerminalProfileIcon profile={entry.profile} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {entry.title}
                        </span>
                        <span
                          className="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
                          style={{
                            background: live ? 'rgba(52,211,153,0.16)' : 'rgba(148,163,184,0.14)',
                            color: live ? 'rgb(110,231,183)' : 'rgb(148,163,184)',
                          }}
                        >
                          {live ? 'open' : 'closed'}
                        </span>
                        {isAlfa ? (
                          <span className="alfa-pane-chip shrink-0" data-role="alfa">
                            <Bot className="h-3 w-3" /> ALFA
                          </span>
                        ) : ownerLabel ? (
                          <span className="alfa-pane-chip shrink-0" data-role="target" title={`Target of alfa "${ownerLabel}"`}>
                            <Eye className="h-3 w-3" />
                            <span className="alfa-pane-chip-owner">◄ {ownerLabel}</span>
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {shortenCwd(entry.cwd, 40)} · {relativeTime(entry.updatedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenEntry(entry);
                        close();
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 text-[11px] text-sky-200"
                      title={live ? 'Focus this pane' : 'Restore this terminal'}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {live ? 'Focus' : 'Restore'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveEntry(entry.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-rose-300"
                      aria-label="Remove from history"
                      title="Remove from history"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
