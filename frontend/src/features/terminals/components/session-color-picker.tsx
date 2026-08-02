'use client';

import { useEffect, useRef, useState } from 'react';

import { SESSION_COLOR_PALETTE } from '@/features/terminals/hooks/use-session-colors';

interface SessionColorPickerProps {
  sessionId: string;
  color: string;
  hasOverride: boolean;
  onPick: (color: string) => void;
  onClear: () => void;
  /** When true the swatch is read-only — used by target panes that
   *  inherit their color from a parent alfa watcher. */
  disabled?: boolean;
  /** Override the swatch's tooltip (e.g. to explain inheritance). */
  title?: string;
  /** Controlled open state — lets the mobile cluster drive the palette. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the swatch trigger and render the palette as a centered sheet. */
  hideTrigger?: boolean;
}

/**
 * Small color swatch + popover palette. Click toggles the palette, picking
 * a swatch dispatches `onPick`; the dotted swatch dispatches `onClear` to
 * fall back to the hash-derived default.
 */
export function SessionColorPicker({
  sessionId,
  color,
  hasOverride,
  onPick,
  onClear,
  disabled = false,
  title,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: SessionColorPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(open) : value;
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    // Sheet mode closes via its own backdrop.
    if (!hideTrigger) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hideTrigger]);

  const palette = (
    <>
      {SESSION_COLOR_PALETTE.map((swatch) => (
        <button
          key={swatch}
          type="button"
          style={{ background: swatch }}
          data-active={color === swatch || undefined}
          onClick={() => {
            onPick(swatch);
            setOpen(false);
          }}
        />
      ))}
      {hasOverride ? (
        <button
          type="button"
          data-empty
          className="session-color-swatch"
          title="Reset to default"
          onClick={() => {
            onClear();
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {hideTrigger ? null : (
        <button
          type="button"
          className="session-color-swatch"
          data-disabled={disabled || undefined}
          disabled={disabled}
          style={{ ['--session-color' as string]: color }}
          title={title ?? `Color for ${sessionId.slice(0, 8)} — click to change`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (disabled) return;
            setOpen((value) => !value);
          }}
        />
      )}

      {open ? (
        hideTrigger ? (
          <div className="pane-sheet-overlay" role="dialog" aria-modal="true">
            <div className="pane-sheet-backdrop" onClick={() => setOpen(false)} />
            <div
              className="pane-sheet-panel session-color-picker session-color-picker-sheet"
              onClick={(event) => event.stopPropagation()}
            >
              {palette}
            </div>
          </div>
        ) : (
          <div
            className="session-color-picker"
            style={{ top: 'calc(100% + 4px)', left: 0 }}
            onClick={(event) => event.stopPropagation()}
          >
            {palette}
          </div>
        )
      ) : null}
    </div>
  );
}
