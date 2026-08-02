'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { tryLoadWebglRenderer } from '@/features/terminals/lib/webgl-renderer';

import type { TerminalSession } from '@/shared/types/contracts';
import {
  clampFontSize,
  DEFAULT_FONT_SIZE,
  detectIdleActivity,
  getStreamUrl,
  TERMINAL_SCROLLBACK,
  type ActivityState,
  type ConnectionState,
} from '@/features/terminals/lib/utils';
import {
  filesFromDrop,
  imageFileFromBlob,
  partitionBySize,
  quoteShellPath,
} from '@/features/terminals/lib/upload';

interface TerminalSocketEvent {
  type: 'bootstrap' | 'output' | 'status' | 'error' | 'pong';
  buffer?: string;
  data?: string;
  message?: string;
  session?: TerminalSession;
}

const ACTIVITY_LABELS: Record<ActivityState, string> = {
  idle: 'Idle',
  working: 'Working…',
  asking: 'Asking confirmation',
  planning: 'Creating plan',
  waiting: 'Waiting for input',
  done: 'Done',
};

export interface UsePaneTerminalOptions {
  session: TerminalSession;
  active: boolean;
  fullscreen: boolean;
  fontSize: number;
  boundAgentProfileId?: string;
  broadcast: boolean;
  onUpdate: (session: TerminalSession) => void;
  onActivityChange: (id: string, state: ActivityState) => void;
  onBroadcastInput: (data: string, sourceId?: string) => void;
  onFontSizeChange: (id: string, size: number) => void;
}

/**
 * Owns a pane's xterm instance + SSE stream lifecycle and all terminal I/O
 * (input, resize, upload, clipboard, rename, zoom, activity tracking). Kept
 * out of the component so the view layer stays declarative — the component
 * mounts `containerRef`, wires handlers to its chrome, and renders.
 */
export function usePaneTerminal({
  session,
  active,
  fullscreen,
  fontSize,
  boundAgentProfileId,
  broadcast,
  onUpdate,
  onActivityChange,
  onBroadcastInput,
  onFontSizeChange,
}: UsePaneTerminalOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const sessionRef = useRef(session);
  const isUnmountingRef = useRef(false);
  const lastOutputRef = useRef('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  // Live input round-trip latency (browser → agent → ack), EWMA. Measured only
  // on real keystroke POSTs so an idle pane costs nothing. Surfaced in header.
  const rttEwmaRef = useRef<number | null>(null);
  const rttFlushRef = useRef(0);
  const [rttMs, setRttMs] = useState<number | null>(null);
  // Defer the heavy xterm + SSE init until the pane is first shown. Mounting
  // every session's terminal at once (all workspaces) spikes browser RAM —
  // 18 panes × (1500-line scrollback canvas + ~420KB ANSI replay). Latches on
  // so a pane stays alive after the user switches away (scrollback preserved).
  const [armed, setArmed] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title);
  const [renameBusy, setRenameBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const broadcastRef = useRef(broadcast);
  const onBroadcastInputRef = useRef(onBroadcastInput);
  const [activityState, setActivityState] = useState<ActivityState>('idle');
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivityChangeRef = useRef(onActivityChange);
  const canSendInput = session.status === 'running';
  const isAgent = boundAgentProfileId !== undefined || session.profile !== 'shell';
  const resolvedFontSize = clampFontSize(fontSize || DEFAULT_FONT_SIZE);

  useEffect(() => {
    onActivityChangeRef.current = onActivityChange;
  }, [onActivityChange]);

  useEffect(() => {
    broadcastRef.current = broadcast;
  }, [broadcast]);

  useEffect(() => {
    onBroadcastInputRef.current = onBroadcastInput;
  }, [onBroadcastInput]);

  useEffect(() => {
    onActivityChangeRef.current(session.id, activityState);
  }, [activityState, session.id]);

  function markWorking() {
    if (!isAgent) return;
    setActivityState('working');
    if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
    waitingTimerRef.current = setTimeout(() => {
      setActivityState((current) => {
        if (current !== 'working') return current;
        return detectIdleActivity(lastOutputRef.current);
      });
    }, 1400);
  }

  const focusTerminal = () => {
    terminalRef.current?.focus();
  };

  async function postAction(pathname: 'input' | 'resize', payload: Record<string, unknown>) {
    const startedAt = pathname === 'input' ? performance.now() : 0;
    try {
      await fetch(`/api/terminals/${encodeURIComponent(session.id)}/${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (pathname === 'input') {
        const dt = performance.now() - startedAt;
        const prev = rttEwmaRef.current;
        const next = prev === null ? dt : prev * 0.7 + dt * 0.3;
        rttEwmaRef.current = next;
        // Throttle the state write — keystrokes can fire dozens/sec and each
        // setState re-renders the pane. At most ~2 paints/sec for the badge.
        const nowTs = performance.now();
        if (nowTs - rttFlushRef.current > 500) {
          rttFlushRef.current = nowTs;
          setRttMs(Math.round(next));
        }
      }
    } catch {
      setError('Terminal request failed');
    }
  }

  function sendInput(data: string) {
    if (!canSendInput) return;
    void postAction('input', { data });
    focusTerminal();
  }

  // Drag-and-drop media: upload each dropped file to the host (per-session
  // dir under ~/.os/uploads/<sid>/), then inject the quoted absolute path(s)
  // at the prompt. User presses Enter — we never auto-run.
  async function uploadDroppedFiles(rawFiles: File[]) {
    if (!canSendInput || rawFiles.length === 0) return;
    setError(null);
    // Reject oversized files client-side so we don't waste a round-trip the
    // agent would just 413.
    const { ok: files, tooBig } = partitionBySize(rawFiles);
    if (tooBig.length > 0) {
      setError(`Too big (max 25 MiB): ${tooBig.map((f) => f.name).join(', ')}`);
    }
    if (files.length === 0) return;
    setUploading(true);
    try {
      const paths: string[] = [];
      for (const file of files) {
        try {
          const res = await fetch(
            `/api/terminals/${encodeURIComponent(session.id)}/upload?name=${encodeURIComponent(file.name)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: file,
            }
          );
          if (!res.ok) {
            const detail = (await res.json().catch(() => ({}))) as { error?: string };
            setError(detail.error ?? `Upload failed: ${file.name}`);
            continue;
          }
          const data = (await res.json()) as { path?: string };
          if (data.path) paths.push(data.path);
        } catch {
          setError(`Upload failed: ${file.name}`);
        }
      }
      if (paths.length > 0) {
        sendInput(`${paths.map(quoteShellPath).join(' ')} `);
      }
    } finally {
      setUploading(false);
    }
  }

  function sendControlKey(key: string) {
    if (!/^[a-z]$/i.test(key)) return;
    sendInput(String.fromCharCode(key.toUpperCase().charCodeAt(0) & 0x1f));
  }

  function trackOutput(chunk: string) {
    if (!chunk) return;
    const next = `${lastOutputRef.current}${chunk}`;
    lastOutputRef.current = next.slice(-6000);
  }

  function startRename() {
    setRenameValue(session.title);
    setRenaming(true);
  }

  function cancelRename() {
    setRenaming(false);
    setRenameValue(session.title);
  }

  async function submitRename() {
    const next = renameValue.trim();
    if (!next || next === session.title) {
      cancelRename();
      return;
    }
    setRenameBusy(true);
    try {
      const response = await fetch(`/api/terminals/${encodeURIComponent(session.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      const payload = (await response.json()) as { session?: TerminalSession; error?: string };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error || 'Rename failed');
      }
      onUpdateRef.current({ ...payload.session, skills: payload.session.skills ?? [] });
      setRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setRenameBusy(false);
    }
  }

  // Filters dropped folders (unreadable as bytes) and warns; uploads the rest.
  function handleDrop(dataTransfer: DataTransfer) {
    const { files, skippedDirs } = filesFromDrop(dataTransfer);
    if (skippedDirs.length > 0) {
      setError(`Folders not supported: ${skippedDirs.join(', ')}`);
    }
    if (files.length > 0) void uploadDroppedFiles(files);
  }

  async function pasteFromClipboard() {
    if (!canSendInput) return;

    // Prefer the rich clipboard so a copied screenshot uploads as a file
    // instead of pasting binary garbage into the shell. Falls back to text.
    if (navigator?.clipboard?.read) {
      try {
        const items = await navigator.clipboard.read();
        const images: File[] = [];
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) images.push(imageFileFromBlob(await item.getType(imgType), images.length));
        }
        if (images.length > 0) {
          await uploadDroppedFiles(images);
          return;
        }
      } catch {
        // Permission denied or no rich items — fall through to text paste.
      }
    }

    if (!navigator?.clipboard?.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sendInput(text);
      }
    } catch {
      setError('Clipboard read blocked');
    }
  }

  // Handles a native paste event (Ctrl+V) bubbling up from the xterm textarea:
  // uploads any image item and lets text paste fall through to xterm.
  function handlePasteEvent(data: DataTransfer | null): boolean {
    if (!data || !canSendInput) return false;
    const images: File[] = [];
    for (const item of Array.from(data.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) images.push(file);
      }
    }
    if (images.length === 0) return false;
    void uploadDroppedFiles(images);
    return true;
  }

  async function copyTerminalContent() {
    const terminal = terminalRef.current;
    if (!terminal || !navigator?.clipboard?.writeText) return;

    const selected = terminal.hasSelection() ? terminal.getSelection() : '';
    const text = selected || lastOutputRef.current;

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Clipboard write blocked');
    }
  }

  async function selectAndCopyAll() {
    const terminal = terminalRef.current;
    if (!terminal || !navigator?.clipboard?.writeText) return;

    try {
      terminal.selectAll();
    } catch {
      // noop
    }
    const text = terminal.hasSelection() ? terminal.getSelection() : lastOutputRef.current;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Clipboard write blocked');
    }
  }

  function clearTerminal() {
    terminalRef.current?.clear();
    sendControlKey('l');
  }

  function changeDir(path: string) {
    if (!canSendInput) return;
    sendInput(`cd ${quoteShellPath(path)}\r`);
  }

  function injectCommand(raw: string) {
    if (!canSendInput || !raw) return;
    sendInput(`${raw}\r`);
  }

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (active) setArmed(true);
  }, [active]);

  useEffect(() => {
    if (!renaming) {
      setRenameValue(session.title);
    }
  }, [session.title, renaming]);

  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => {
      const fitAddon = fitAddonRef.current;
      const term = terminalRef.current;
      const container = containerRef.current;
      if (!fitAddon || !term || !container) return;
      if (container.offsetParent === null) return;
      try {
        fitAddon.fit();
      } catch {
        return;
      }
      if (term.cols > 0 && term.rows > 0) {
        void postAction('resize', { cols: term.cols, rows: term.rows });
      }
      term.focus();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, session.id, fullscreen]);

  useEffect(() => {
    if (!armed) return;
    if (!containerRef.current) return;
    isUnmountingRef.current = false;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: resolvedFontSize,
      lineHeight: 1.18,
      scrollback: TERMINAL_SCROLLBACK,
      allowProposedApi: true,
      rightClickSelectsWord: true,
      macOptionClickForcesSelection: true,
      theme: {
        background: '#08111f',
        foreground: '#d7e3f6',
        cursor: '#f8fafc',
        black: '#08111f',
        red: '#fb7185',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#f472b6',
        cyan: '#22d3ee',
        white: '#d7e3f6',
        brightBlack: '#334155',
        brightRed: '#fda4af',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#f9a8d4',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc',
      },
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    tryLoadWebglRenderer(term); // GPU renderer when available; DOM fallback otherwise
    fitAddon.fit();
    terminalRef.current = term;

    const resizeTerminal = () => {
      const fitAddon = fitAddonRef.current;
      const term = terminalRef.current;
      const container = containerRef.current;
      if (!fitAddon || !term || !container) return;
      if (container.offsetParent === null) return;
      try {
        fitAddon.fit();
      } catch {
        return;
      }
      if (term.cols > 0 && term.rows > 0) {
        void postAction('resize', { cols: term.cols, rows: term.rows });
      }
    };

    const connect = () => {
      if (isUnmountingRef.current) return;

      setConnectionState(reconnectAttemptsRef.current === 0 ? 'connecting' : 'reconnecting');

      const eventSource = new EventSource(getStreamUrl(session.id));
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnectionState('connected');
        setError(null);
        resizeTerminal();
      };

      eventSource.onmessage = (message) => {
        let payload: TerminalSocketEvent;
        try {
          payload = JSON.parse(message.data) as TerminalSocketEvent;
        } catch {
          return;
        }

        switch (payload.type) {
          case 'bootstrap':
            term.reset();
            if (payload.buffer) {
              trackOutput(payload.buffer);
              term.write(payload.buffer);
              if (isAgent) setActivityState('waiting');
            }
            if (payload.session) {
              term.options.disableStdin = payload.session.status !== 'running';
              onUpdateRef.current(payload.session);
              if (payload.session.status === 'exited') setActivityState('done');
            }
            break;
          case 'output':
            if (payload.data) {
              trackOutput(payload.data);
              term.write(payload.data);
              markWorking();
            }
            break;
          case 'status':
            if (payload.session) {
              term.options.disableStdin = payload.session.status !== 'running';
              onUpdateRef.current(payload.session);
              if (payload.session.status === 'exited') {
                term.writeln('');
                term.writeln(
                  `\x1b[33m[session exited${payload.session.exit_code !== undefined ? ` code=${payload.session.exit_code}` : ''}]\x1b[0m`
                );
                setActivityState('done');
                if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
              }
            }
            break;
          case 'error':
            setError(payload.message ?? 'Terminal gateway error');
            break;
          case 'pong':
          default:
            break;
        }
      };

      eventSource.addEventListener('error', () => {
        eventSourceRef.current = null;

        if (isUnmountingRef.current) {
          return;
        }

        if (sessionRef.current.status === 'running') {
          reconnectAttemptsRef.current += 1;
          setConnectionState('reconnecting');
          setError('Stream dropped, reconnecting…');
        } else {
          setConnectionState('disconnected');
        }
      });
    };

    term.onData((data) => {
      if (broadcastRef.current) {
        // Pass session.id so the scoped broadcaster always includes the
        // source pane in its fan-out — otherwise the user would type and
        // see nothing locally when this pane isn't in the target set.
        onBroadcastInputRef.current(data, session.id);
        return;
      }
      void postAction('input', { data });
    });

    resizeObserverRef.current = new ResizeObserver(() => {
      startTransition(() => {
        resizeTerminal();
      });
    });
    resizeObserverRef.current.observe(containerRef.current);

    connect();

    return () => {
      isUnmountingRef.current = true;
      resizeObserverRef.current?.disconnect();
      eventSourceRef.current?.close();
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, armed]);

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    if (term.options.fontSize === resolvedFontSize) return;
    term.options.fontSize = resolvedFontSize;
    const fitAddon = fitAddonRef.current;
    const container = containerRef.current;
    if (!fitAddon || !container || container.offsetParent === null) return;
    try {
      fitAddon.fit();
    } catch {
      return;
    }
    if (term.cols > 0 && term.rows > 0) {
      void postAction('resize', { cols: term.cols, rows: term.rows });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fit only when the font size changes; postAction is invoked imperatively.
  }, [resolvedFontSize]);

  function zoom(delta: number) {
    const next = clampFontSize(resolvedFontSize + delta);
    if (next !== resolvedFontSize) onFontSizeChange(session.id, next);
  }

  function zoomTo(size: number) {
    const next = clampFontSize(size);
    if (next !== resolvedFontSize) onFontSizeChange(session.id, next);
  }

  function railScroll(lines: number) {
    terminalRef.current?.scrollLines(lines);
  }

  const showActivity = isAgent && (activityState !== 'idle' || session.status === 'exited');

  return {
    containerRef,
    connectionState,
    rttMs,
    error,
    setError,
    activityState,
    activityLabel: ACTIVITY_LABELS[activityState],
    showActivity,
    canSendInput,
    isAgent,
    resolvedFontSize,
    dragOver,
    setDragOver,
    uploading,
    // input / io
    sendInput,
    sendControlKey,
    uploadDroppedFiles,
    handleDrop,
    handlePasteEvent,
    pasteFromClipboard,
    copyTerminalContent,
    selectAndCopyAll,
    clearTerminal,
    changeDir,
    injectCommand,
    zoom,
    zoomTo,
    railScroll,
    focusTerminal,
    // rename
    renaming,
    renameValue,
    renameBusy,
    setRenameValue,
    startRename,
    cancelRename,
    submitRename,
  };
}
