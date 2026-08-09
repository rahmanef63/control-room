'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Keyboard } from 'lucide-react';

import type { TerminalSession } from '@/shared/types/contracts';

interface SendKeysMenuProps {
  sessions: TerminalSession[];
  broadcast: boolean;
  broadcastTargets: Set<string>;
  onBroadcastTargetsChange: (next: Set<string>) => void;
  /** Full-width pill layout instead of the inline bar chip (`[data-compact]`
   *  in broadcast.css) — for stacked/narrow containers. */
  compact?: boolean;
}

/**
 * Send-keys menu — types once, delivers to several panes at once.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ ● Sending your typing to 2 panes — click…    │
 *   │ Type in any pane; every ticked pane gets it. │
 *   │ SEND TO                          [All][None] │
 *   │  ☐ rahman design                             │
 *   │  ☑ zianinn                                   │
 *   │  ☑ Rr                                        │
 *   └──────────────────────────────────────────────┘
 *
 * The ticked set IS the state, not a filter on top of a flag: screen.tsx
 * derives armed from `broadcastTargets.size`, so arming fills the set and
 * disarming empties it. There is deliberately no separate boolean to keep in
 * sync — the legacy `broadcast` preference is still written to storage for
 * backwards compat but nothing reads it (see the `void broadcast` note in
 * screen.tsx), so mirroring it here would only create a second, drifting
 * source of truth for one piece of state.
 */
export function SendKeysMenu({
  sessions,
  broadcast,
  broadcastTargets,
  onBroadcastTargetsChange,
  compact = false,
}: SendKeysMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const running = sessions.filter((s) => s.status === 'running');
  const selectedCount = broadcastTargets.size;
  const fanoutCount = selectedCount === 0 ? running.length : selectedCount;

  function panes(count: number) {
    return `${count} pane${count === 1 ? '' : 's'}`;
  }

  function toggleTarget(id: string) {
    const next = new Set(broadcastTargets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onBroadcastTargetsChange(next);
  }

  function selectAll() {
    onBroadcastTargetsChange(new Set(running.map((s) => s.id)));
  }

  function selectNone() {
    onBroadcastTargetsChange(new Set());
  }

  /** Arm = every running pane receives typing unless a narrower set is ticked. */
  function setArmed(next: boolean) {
    if (next) {
      if (selectedCount === 0) selectAll();
    } else {
      selectNone();
    }
  }

  const armSummary = broadcast
    ? `Sending your typing to ${panes(fanoutCount)} — click to stop`
    : selectedCount > 0
      ? `Off — click to start sending to ${panes(selectedCount)}`
      : `Off — click to start sending to all ${panes(running.length)}`;

  return (
    <div ref={ref} className="topbar-broadcast">
      <button
        type="button"
        className="topbar-icon-button topbar-broadcast-trigger"
        data-tone={broadcast ? 'danger' : undefined}
        data-compact={compact || undefined}
        data-open={open || undefined}
        title={
          broadcast
            ? `Your typing goes to ${panes(fanoutCount)} at once`
            : 'Send keys — type once, several panes receive it'
        }
        aria-label={
          broadcast
            ? `Send keys — currently typing into ${panes(fanoutCount)}`
            : 'Send keys to several panes at once'
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Keyboard className="h-4 w-4" />
        <span className="topbar-label">Send keys</span>
        {selectedCount > 0 ? (
          <span className="topbar-broadcast-badge">{selectedCount}</span>
        ) : null}
        <ChevronDown className="topbar-broadcast-chev h-3 w-3" />
      </button>

      {open ? (
        <div
          className="topbar-broadcast-popover"
          role="dialog"
          aria-label="Send keys to several panes at once"
        >
          <button
            type="button"
            className="topbar-broadcast-status text-left"
            data-active={broadcast || undefined}
            aria-pressed={broadcast}
            disabled={!broadcast && running.length === 0}
            onClick={() => setArmed(!broadcast)}
          >
            <span className="topbar-broadcast-status-dot" />
            <span className="topbar-broadcast-status-text">{armSummary}</span>
          </button>

          <p className="topbar-broadcast-hint">
            Type in any pane and the same keystrokes are delivered to every ticked pane —
            one command, several shells.
          </p>

          <div className="topbar-broadcast-section">
            <div className="topbar-broadcast-section-head">
              <span className="topbar-broadcast-eyebrow">Send to</span>
              <div className="topbar-broadcast-quick">
                <button type="button" onClick={selectAll}>All</button>
                <button type="button" onClick={selectNone}>None</button>
              </div>
            </div>
            {running.length === 0 ? (
              <p className="topbar-broadcast-empty">No running panes.</p>
            ) : (
              <ul className="topbar-broadcast-targets">
                {running.map((session) => {
                  const checked = broadcastTargets.has(session.id);
                  return (
                    <li key={session.id}>
                      <label className="topbar-broadcast-target">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTarget(session.id)}
                        />
                        <span className="topbar-broadcast-target-title" title={session.cwd}>
                          {session.title}
                        </span>
                        <span className="topbar-broadcast-target-meta">
                          {session.inner_agent ?? session.profile}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="topbar-broadcast-hint">
              {selectedCount === 0
                ? 'Nothing ticked — your typing stays in the pane you are using.'
                : `${panes(selectedCount)} ticked, plus whichever pane you type in.`}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
