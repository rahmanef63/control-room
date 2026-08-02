'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Minus, Paintbrush, Plus, RadioTower, Shuffle } from 'lucide-react';

import {
  SESSION_COLOR_PALETTE,
  useSessionColors,
} from '@/features/terminals/hooks/use-session-colors';
import { clampFontSize, MAX_FONT_SIZE, MIN_FONT_SIZE } from '@/features/terminals/lib/utils';
import type { TerminalSession } from '@/shared/types/contracts';

interface BroadcastDropdownProps {
  sessions: TerminalSession[];
  broadcast: boolean;
  onToggleBroadcast: () => void;
  broadcastTargets: Set<string>;
  onBroadcastTargetsChange: (next: Set<string>) => void;
  fontSizes: Record<string, number>;
  onFontSizeChange: (sessionId: string, size: number) => void;
  defaultFontSize: number;
  /** When true the row collapses into a square icon — used on the mobile
   *  "More" dropdown where buttons are full-width pills. */
  compact?: boolean;
}

/**
 * Broadcast dropdown — scopes input fan-out to a checkbox-selected set of
 * panes, and exposes zoom + color batch controls that apply to that set.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ Broadcast input ✓ (toggle ALL panes / off)   │
 *   │ Targets:                                     │
 *   │  ☐ rahman design                             │
 *   │  ☑ zianinn                                   │
 *   │  ☐ Rr                                        │
 *   │ Quick:  [All] [None]  · 2 selected           │
 *   │ Zoom:   [−] [+]                              │
 *   │ Color:  ◻ ◼ ◼ ◼ ◼ … (palette swatches)       │
 *   └──────────────────────────────────────────────┘
 *
 * Empty target set + broadcast on = legacy fan-out-to-every-running-pane
 * (preserved so the previous one-button workflow still works).
 */
export function BroadcastDropdown({
  sessions,
  broadcast,
  onToggleBroadcast,
  broadcastTargets,
  onBroadcastTargetsChange,
  fontSizes,
  onFontSizeChange,
  defaultFontSize,
  compact = false,
}: BroadcastDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { setColor } = useSessionColors();
  void onToggleBroadcast; // checkbox set is the single source of truth — toggle no longer wired

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

  /** Targets that should receive zoom / color batch ops. */
  function batchTargetIds(): string[] {
    if (broadcastTargets.size > 0) return Array.from(broadcastTargets);
    return running.map((s) => s.id);
  }

  function applyZoom(delta: number) {
    for (const id of batchTargetIds()) {
      const current = fontSizes[id] ?? defaultFontSize;
      onFontSizeChange(id, clampFontSize(current + delta));
    }
  }

  function applyColor(color: string) {
    for (const id of batchTargetIds()) setColor(id, color);
  }

  /**
   * Give each target a random palette color, with no duplicates within
   * the batch unless the batch is bigger than the palette. Picks a fresh
   * shuffle each click — so re-clicking re-randomises.
   */
  function applyRandomColor() {
    const ids = batchTargetIds();
    if (ids.length === 0) return;
    const pool = [...SESSION_COLOR_PALETTE];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    ids.forEach((id, index) => {
      setColor(id, pool[index % pool.length]);
    });
  }

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
            ? `Broadcasting to ${fanoutCount} pane${fanoutCount === 1 ? '' : 's'}`
            : 'Broadcast / batch control'
        }
        aria-label="Broadcast and batch controls"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <RadioTower className="h-4 w-4" />
        <span className="topbar-label">Broadcast</span>
        {selectedCount > 0 ? (
          <span className="topbar-broadcast-badge">{selectedCount}</span>
        ) : null}
        <ChevronDown className="topbar-broadcast-chev h-3 w-3" />
      </button>

      {open ? (
        <div
          className="topbar-broadcast-popover"
          role="dialog"
          aria-label="Broadcast and batch controls"
        >
          <div className="topbar-broadcast-status" data-active={broadcast || undefined}>
            <span className="topbar-broadcast-status-dot" />
            <span className="topbar-broadcast-status-text">
              {broadcast
                ? `Broadcasting → ${fanoutCount} pane${fanoutCount === 1 ? '' : 's'}`
                : 'Broadcast off — tick a target to enable'}
            </span>
          </div>

          <div className="topbar-broadcast-section">
            <div className="topbar-broadcast-section-head">
              <span className="topbar-broadcast-eyebrow">Targets</span>
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
                ? 'No selection — zoom/color/broadcast apply to every running pane.'
                : `${selectedCount} selected — zoom/color/broadcast scope to this set.`}
            </p>
          </div>

          <div className="topbar-broadcast-section">
            <span className="topbar-broadcast-eyebrow">Zoom</span>
            <div className="topbar-broadcast-zoom">
              <button
                type="button"
                onClick={() => applyZoom(-1)}
                title={`Zoom out (min ${MIN_FONT_SIZE}px)`}
              >
                <Minus className="h-3.5 w-3.5" /> Smaller
              </button>
              <button
                type="button"
                onClick={() => applyZoom(1)}
                title={`Zoom in (max ${MAX_FONT_SIZE}px)`}
              >
                <Plus className="h-3.5 w-3.5" /> Larger
              </button>
            </div>
          </div>

          <div className="topbar-broadcast-section">
            <div className="topbar-broadcast-section-head">
              <span className="topbar-broadcast-eyebrow">
                <Paintbrush className="inline h-3 w-3" /> Color
              </span>
              <button
                type="button"
                className="topbar-broadcast-random"
                onClick={applyRandomColor}
                title="Random palette pick per target (re-click reshuffles)"
              >
                <Shuffle className="h-3 w-3" /> Random
              </button>
            </div>
            <div className="topbar-broadcast-palette">
              {SESSION_COLOR_PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className="topbar-broadcast-swatch"
                  style={{ background: swatch }}
                  title={`Apply ${swatch}`}
                  onClick={() => applyColor(swatch)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
