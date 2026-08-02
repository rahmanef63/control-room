'use client';

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { Loader2, RotateCcw, TerminalSquare, X } from 'lucide-react';

import { TerminalPane } from '@/features/terminals/components/terminal-pane';
import { PaneErrorBoundary } from '@/features/terminals/components/pane-error-boundary';
import { useAlfaWatchers } from '@/features/terminals/hooks/use-alfa-watchers';
import { useSessionColors } from '@/features/terminals/hooks/use-session-colors';
import type { TerminalHistoryEntry } from '@/features/terminals/hooks/use-terminal-sessions';
import type { PaneAgentOverrides } from '@/features/terminals/hooks/use-pane-agent-overrides';
import type { GridCols, ViewMode } from '@/features/terminals/hooks/use-terminal-preferences';
import {
  DEFAULT_FONT_SIZE,
  shortenCwd,
  type ActivityState,
  type SoftKeyboardKey,
} from '@/features/terminals/lib/utils';
import type { RuntimeResolvedAgentProfile, TerminalSession } from '@/shared/types/contracts';

interface TerminalsMainProps {
  loading: boolean;
  sessions: TerminalSession[];
  allSessions: TerminalSession[];
  isSessionVisible: (sessionId: string) => boolean;
  activeId: string | null;
  viewMode: ViewMode;
  gridCols: GridCols;
  fullscreen: boolean;
  fontSizes: Record<string, number>;
  agentProfiles: RuntimeResolvedAgentProfile[];
  broadcast: boolean;
  broadcastTargets: Set<string>;
  history: TerminalHistoryEntry[];
  restoring: boolean;
  activityStates: Record<string, ActivityState>;
  softKeyVisible: Record<SoftKeyboardKey, boolean>;
  keyboardVisible: boolean;
  workspaces: Array<{ id: string; name: string; color?: string }>;
  resolveSessionWorkspace: (sessionId: string) => string;
  heartbeatGlow: boolean;
  onUpdateSession: (session: TerminalSession) => void;
  onCloseSession: (id: string) => void;
  onDuplicateSession: (session: TerminalSession) => void;
  onMoveToWorkspace: (sessionId: string, workspaceId: string) => void;
  onToggleFullscreen: () => void;
  onFontSizeChange: (id: string, size: number) => void;
  onActivityChange: (id: string, state: ActivityState) => void;
  onRequestFocus: (id: string) => void;
  onBroadcastInput: (data: string, sourceId?: string) => void;
  onRestoreHistory: () => void;
  onClearHistory: () => void;
  agentOverrides: PaneAgentOverrides;
  onBindAgent: (sessionId: string, agentProfileId: string) => void;
  onUnbindAgent: (sessionId: string) => void;
}

export function TerminalsMain({
  loading,
  sessions,
  allSessions,
  isSessionVisible,
  activeId,
  viewMode,
  gridCols,
  fullscreen,
  fontSizes,
  agentProfiles,
  broadcast,
  broadcastTargets,
  history,
  restoring,
  activityStates,
  softKeyVisible,
  keyboardVisible,
  workspaces,
  resolveSessionWorkspace,
  heartbeatGlow,
  onUpdateSession,
  onCloseSession,
  onDuplicateSession,
  onMoveToWorkspace,
  onToggleFullscreen,
  onFontSizeChange,
  onActivityChange,
  onRequestFocus,
  onBroadcastInput,
  onRestoreHistory,
  onClearHistory,
  agentOverrides,
  onBindAgent,
  onUnbindAgent,
}: TerminalsMainProps) {
  const liveIds = new Set(sessions.map((session) => session.id));
  const restorable = history.filter((entry) => !liveIds.has(entry.id));
  const showOverlay = loading || sessions.length === 0;

  // Track the *actual* number of grid rows currently rendered so we can
  // stretch a single row to fill the whole grid area (2× the per-row
  // height baseline). Distinct offsetTop values on the visible slots
  // gives us the row count regardless of how the columns resolved
  // (gridCols can be 'auto' which depends on viewport width).
  const stackRef = useRef<HTMLDivElement | null>(null);
  const [paneRows, setPaneRows] = useState(1);

  // The row count only changes when the set of visible slots changes (add/close
  // pane, workspace switch), the grid shape changes (viewMode/gridCols/
  // fullscreen), or the container resizes — which the ResizeObserver below
  // covers between effect runs. Keying the effect on exactly those inputs
  // (instead of running every render) avoids a forced layout read (offsetTop)
  // plus an observer teardown/recreate on every parent re-render — which
  // happens on every pane activity tick.
  const visibleKey = useMemo(
    () =>
      allSessions
        .filter((session) => isSessionVisible(session.id))
        .map((session) => session.id)
        .join('|'),
    [allSessions, isSessionVisible]
  );

  useLayoutEffect(() => {
    // Layout inputs that re-trigger measurement without being read in the body.
    void gridCols;
    void fullscreen;
    void visibleKey;
    const el = stackRef.current;
    if (!el) {
      setPaneRows(1);
      return;
    }
    const measure = () => {
      if (viewMode !== 'grid') {
        setPaneRows(1);
        return;
      }
      const slots = el.querySelectorAll<HTMLElement>(
        ".terminal-pane-slot[data-workspace-visible='true']"
      );
      const tops = new Set<number>();
      slots.forEach((slot) => {
        if (slot.offsetParent === null) return;
        tops.add(Math.round(slot.offsetTop));
      });
      setPaneRows(Math.max(1, tops.size));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, gridCols, fullscreen, visibleKey]);

  const stackStyle: CSSProperties | undefined =
    gridCols !== 'auto'
      ? ({ '--grid-cols': gridCols } as CSSProperties)
      : undefined;

  // Per-pane border + heartbeat color resolution:
  // - If the pane is an alfa watcher, use its own picked color.
  // - If the pane is a target watched by an alfa, inherit that alfa's
  //   color so all panes under the same patrol share a visual group.
  // - Otherwise, use the pane's own picked color (or undefined → CSS
  //   falls back to the default border).
  const { colorOf } = useSessionColors();
  const { watchers, isAlfa, watchersOfTarget } = useAlfaWatchers();
  const paneRoleAndColor = useMemo(() => {
    const map = new Map<string, { role: 'alfa' | 'target' | 'solo'; color?: string }>();
    for (const session of allSessions) {
      if (isAlfa(session.id)) {
        map.set(session.id, { role: 'alfa', color: colorOf(session.id) });
        continue;
      }
      const owners = watchersOfTarget(session.id);
      if (owners.length > 0) {
        const parent = owners[0];
        map.set(session.id, {
          role: 'target',
          color: colorOf(parent.id) ?? colorOf(session.id),
        });
        continue;
      }
      map.set(session.id, { role: 'solo', color: colorOf(session.id) });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `watchers` forces recompute when the watcher set changes; isAlfa/watchersOfTarget are stable closures over it.
  }, [allSessions, colorOf, isAlfa, watchersOfTarget, watchers]);

  return (
    <main className="terminal-main">
      {allSessions.length > 0 ? (
        <div
          ref={stackRef}
          className="terminal-pane-stack"
          data-view={viewMode}
          data-grid-cols={gridCols}
          data-pane-rows={viewMode === 'grid' ? paneRows : undefined}
          style={stackStyle}
        >
          {allSessions.map((session) => {
            const visible = isSessionVisible(session.id);
            const slotActive = viewMode === 'grid' ? true : session.id === activeId;
            const slotActivity = activityStates[session.id];
            const roleColor = paneRoleAndColor.get(session.id);
            const slotStyle: CSSProperties | undefined = roleColor?.color
              ? ({ '--session-color': roleColor.color } as CSSProperties)
              : undefined;
            return (
              <div
                key={session.id}
                className="terminal-pane-slot"
                data-active={slotActive}
                data-workspace-visible={visible ? 'true' : 'false'}
                data-activity={slotActivity ?? undefined}
                data-alfa-role={roleColor?.role}
                aria-hidden={!slotActive || !visible}
                style={slotStyle}
              >
                <PaneErrorBoundary>
                  <TerminalPane
                  session={session}
                  active={slotActive && visible}
                  onUpdate={onUpdateSession}
                  onClose={onCloseSession}
                  onDuplicate={onDuplicateSession}
                  fullscreen={fullscreen}
                  onToggleFullscreen={onToggleFullscreen}
                  fontSize={fontSizes[session.id] ?? DEFAULT_FONT_SIZE}
                  onFontSizeChange={onFontSizeChange}
                  onActivityChange={onActivityChange}
                  viewMode={viewMode}
                  onRequestFocus={onRequestFocus}
                  agentProfiles={agentProfiles}
                  broadcast={broadcast}
                  isBroadcastTarget={broadcastTargets.has(session.id)}
                  onBroadcastInput={onBroadcastInput}
                  softKeyVisible={softKeyVisible}
                  keyboardVisible={keyboardVisible}
                  workspaces={workspaces}
                  currentWorkspaceId={resolveSessionWorkspace(session.id)}
                  onMoveToWorkspace={onMoveToWorkspace}
                  heartbeatGlow={heartbeatGlow}
                  boundAgentProfileId={agentOverrides[session.id]?.agentProfileId}
                  onBindAgent={onBindAgent}
                  onUnbindAgent={onUnbindAgent}
                  />
                </PaneErrorBoundary>
              </div>
            );
          })}
        </div>
      ) : null}
      {showOverlay ? (
        loading ? (
          <div className="terminal-empty terminal-empty-overlay">Loading terminal sessions…</div>
        ) : (
          <div className="terminal-empty terminal-empty-overlay">
            <TerminalSquare className="h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-sm font-semibold text-foreground">No terminal open</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Tap <span className="font-semibold text-foreground">New</span> or{' '}
              <span className="font-semibold text-foreground">AI</span> to launch a shell, agent, or environment.
            </p>
            {restorable.length > 0 ? (
              <div className="mt-6 w-full max-w-sm rounded-lg border border-border/60 bg-card/60 p-4 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Last session · {restorable.length} terminal{restorable.length === 1 ? '' : 's'}
                  </p>
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="topbar-icon-button h-7 w-7"
                    title="Forget last session"
                    aria-label="Forget last session"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                  {restorable.slice(0, 6).map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-2 truncate">
                      <span className="truncate font-medium text-foreground/90">{entry.title}</span>
                      <span className="font-mono text-[10px] text-muted-foreground/80">
                        {shortenCwd(entry.cwd, 26)}
                      </span>
                    </li>
                  ))}
                  {restorable.length > 6 ? (
                    <li className="text-[10px] italic text-muted-foreground/70">
                      +{restorable.length - 6} more
                    </li>
                  ) : null}
                </ul>
                <button
                  type="button"
                  onClick={onRestoreHistory}
                  disabled={restoring}
                  className="new-terminal-trigger mt-4 w-full justify-center"
                >
                  {restoring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>{restoring ? 'Restoring…' : 'Restore where I left off'}</span>
                </button>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </main>
  );
}
