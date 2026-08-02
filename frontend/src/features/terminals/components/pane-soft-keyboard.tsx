'use client';

import { type ReactNode, useRef } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Ban,
  Clipboard,
  ClipboardPaste,
  CopyCheck,
  Eraser,
  Paperclip,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { SoftKeyboardKey } from '@/features/terminals/lib/utils';

interface PaneSoftKeyboardProps {
  canSendInput: boolean;
  softKeyVisible: Record<SoftKeyboardKey, boolean>;
  onSendInput: (data: string) => void;
  onSendControlKey: (key: string) => void;
  onPaste: () => void;
  onCopy: () => void;
  onSelectAllAndCopy: () => void;
  onClear: () => void;
  /** Upload files chosen via the attach button (mobile has no drag-and-drop). */
  onAttachFiles?: (files: File[]) => void;
}

interface KeyDef {
  id: SoftKeyboardKey;
  label: string;
  title: string;
  tone?: 'warning' | 'accent';
  className?: string;
  isClipboard?: boolean;
  render: () => ReactNode;
}

// Two-row layout: input-control keys on top, navigation on bottom.
// Anything else (paste/copy/clear/enter/ctrlHold/select-all) can still be
// enabled via app settings; they fall back into the secondary row.
const ROW_1_IDS: SoftKeyboardKey[] = ['esc', 'shiftTab', 'tab', 'interrupt'];
const ROW_2_IDS: SoftKeyboardKey[] = [
  'left',
  'up',
  'down',
  'right',
  'clear',
  'paste',
  'copy',
  'selectAll',
];

const KEY_DEFS: Partial<Record<SoftKeyboardKey, KeyDef>> = {
  esc: {
    id: 'esc',
    label: 'Esc',
    title: 'Esc',
    render: () => <span className="kbd-glyph-text">Esc</span>,
  },
  tab: {
    id: 'tab',
    label: 'Tab',
    title: 'Tab',
    tone: 'accent',
    className: 'kbd-key-tab',
    render: () => (
      <span className="kbd-tab-content">
        <span className="kbd-tab-glyph">⇥</span>
        <span className="kbd-tab-label">TAB</span>
      </span>
    ),
  },
  interrupt: {
    id: 'interrupt',
    label: 'Ctrl+C',
    title: 'Interrupt (Ctrl+C)',
    tone: 'warning',
    render: () => <Ban className="h-4 w-4" />,
  },
  left: {
    id: 'left',
    label: 'Left',
    title: 'Left',
    render: () => <ArrowLeft className="h-4 w-4" />,
  },
  up: {
    id: 'up',
    label: 'Up',
    title: 'Up',
    render: () => <ArrowUp className="h-4 w-4" />,
  },
  down: {
    id: 'down',
    label: 'Down',
    title: 'Down',
    render: () => <ArrowDown className="h-4 w-4" />,
  },
  right: {
    id: 'right',
    label: 'Right',
    title: 'Right',
    render: () => <ArrowRight className="h-4 w-4" />,
  },
  clear: {
    id: 'clear',
    label: 'Clear',
    title: 'Clear screen',
    render: () => <Eraser className="h-4 w-4" />,
  },
  shiftTab: {
    id: 'shiftTab',
    label: 'Shift+Tab',
    title: 'Shift+Tab',
    render: () => <span className="kbd-glyph-text">⇤</span>,
  },
  paste: {
    id: 'paste',
    label: 'Paste',
    title: 'Paste from clipboard',
    isClipboard: true,
    render: () => <ClipboardPaste className="h-4 w-4" />,
  },
  copy: {
    id: 'copy',
    label: 'Copy',
    title: 'Copy selection or recent output',
    isClipboard: true,
    render: () => <Clipboard className="h-4 w-4" />,
  },
  selectAll: {
    id: 'selectAll',
    label: 'Select all',
    title: 'Select all + copy',
    tone: 'accent',
    isClipboard: true,
    render: () => <CopyCheck className="h-4 w-4" />,
  },
};

export function PaneSoftKeyboard({
  canSendInput,
  softKeyVisible,
  onSendInput,
  onSendControlKey,
  onPaste,
  onCopy,
  onSelectAllAndCopy,
  onClear,
  onAttachFiles,
}: PaneSoftKeyboardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handle(id: SoftKeyboardKey) {
    switch (id) {
      case 'esc':
        return onSendInput('\x1b');
      case 'tab':
        return onSendInput('\t');
      case 'interrupt':
        return onSendControlKey('c');
      case 'left':
        return onSendInput('\x1b[D');
      case 'up':
        return onSendInput('\x1b[A');
      case 'down':
        return onSendInput('\x1b[B');
      case 'right':
        return onSendInput('\x1b[C');
      case 'clear':
        return onClear();
      case 'shiftTab':
        return onSendInput('\x1b[Z');
      case 'paste':
        return onPaste();
      case 'copy':
        return onCopy();
      case 'selectAll':
        return onSelectAllAndCopy();
    }
  }

  function renderKey(id: SoftKeyboardKey) {
    if (!softKeyVisible[id]) return null;
    const def = KEY_DEFS[id];
    if (!def) return null;
    return (
      <Button
        key={id}
        type="button"
        title={def.title}
        aria-label={def.label}
        onClick={() => handle(id)}
        disabled={!canSendInput && !def.isClipboard}
        variant="outline"
        data-tone={def.tone}
        className={`kbd-key ${def.className ?? ''}`}
      >
        {def.render()}
      </Button>
    );
  }

  const attachKey =
    onAttachFiles && canSendInput ? (
      <Button
        key="attach"
        type="button"
        title="Attach file (upload + drop path at prompt)"
        aria-label="Attach file"
        onClick={() => fileInputRef.current?.click()}
        variant="outline"
        data-tone="accent"
        className="kbd-key kbd-key-attach"
      >
        <Paperclip className="h-4 w-4" />
      </Button>
    ) : null;

  // Place the attach key right after Tab; if Tab is hidden, append to the row.
  const row1: ReactNode[] = [];
  for (const id of ROW_1_IDS) {
    const node = renderKey(id);
    if (node) row1.push(node);
    if (id === 'tab' && attachKey) row1.push(attachKey);
  }
  if (attachKey && !row1.includes(attachKey)) row1.push(attachKey);
  const row2 = ROW_2_IDS.map(renderKey).filter(Boolean);

  return (
    <div className="terminal-pane-controls">
      {onAttachFiles ? (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) onAttachFiles(files);
            event.target.value = '';
          }}
        />
      ) : null}
      {row1.length > 0 ? <div className="kbd-row">{row1}</div> : null}
      {row2.length > 0 ? <div className="kbd-row">{row2}</div> : null}
    </div>
  );
}
