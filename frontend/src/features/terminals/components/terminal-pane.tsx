'use client';

import '@xterm/xterm/css/xterm.css';

import { startTransition, useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Clipboard,
  ClipboardPaste,
  ChevronsDown,
  ChevronsUp,
  Command,
  CornerDownLeft,
  Eraser,
} from 'lucide-react';

import type { TerminalSession } from '@/shared/types/contracts';
import { Button } from '@/components/ui/button';

import {
  connectionBadgeClasses,
  formatTimestamp,
  getStreamUrl,
  type ConnectionState,
} from '@/features/terminals/lib/utils';

interface TerminalSocketEvent {
  type: 'bootstrap' | 'output' | 'status' | 'error' | 'pong';
  buffer?: string;
  data?: string;
  message?: string;
  session?: TerminalSession;
}

export function TerminalPane({
  session,
  onUpdate,
  onClose,
}: {
  session: TerminalSession;
  onUpdate: (session: TerminalSession) => void;
  onClose: (id: string) => void;
}) {
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
  const [error, setError] = useState<string | null>(null);
  const [ctrlHold, setCtrlHold] = useState(false);
  const canSendInput = session.status === 'running';

  const focusTerminal = () => {
    terminalRef.current?.focus();
  };

  async function postAction(pathname: 'input' | 'resize', payload: Record<string, unknown>) {
    try {
      await fetch(`/api/terminals/${encodeURIComponent(session.id)}/${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      setError('Terminal request failed');
    }
  }

  function sendInput(data: string) {
    if (!canSendInput) return;
    void postAction('input', { data });
    focusTerminal();
  }

  function sendControlKey(key: string) {
    if (!/^[a-z]$/i.test(key)) return;
    sendInput(String.fromCharCode(key.toUpperCase().charCodeAt(0) & 0x1f));
  }

  function sendMobileKey(key: string) {
    if (ctrlHold && /^[a-z]$/i.test(key)) {
      sendControlKey(key);
      setCtrlHold(false);
      return;
    }

    sendInput(key);
  }

  function trackOutput(chunk: string) {
    if (!chunk) return;
    const next = `${lastOutputRef.current}${chunk}`;
    lastOutputRef.current = next.slice(-6000);
  }

  async function pasteFromClipboard() {
    if (!canSendInput || !navigator?.clipboard?.readText) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        sendInput(text);
      }
    } catch {
      setError('Clipboard read blocked');
    }
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

  function clearTerminal() {
    terminalRef.current?.clear();
    sendControlKey('l');
  }

  function scrollViewUp() {
    terminalRef.current?.scrollLines(-10);
  }

  function scrollViewBottom() {
    terminalRef.current?.scrollToBottom();
  }

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.16,
      scrollback: 8000,
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
    fitAddon.fit();
    terminalRef.current = term;

    const resizeTerminal = () => {
      if (!fitAddonRef.current || !terminalRef.current) return;

      fitAddonRef.current.fit();
      void postAction('resize', {
        cols: terminalRef.current.cols,
        rows: terminalRef.current.rows,
      });
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
        const payload = JSON.parse(message.data) as TerminalSocketEvent;

        switch (payload.type) {
          case 'bootstrap':
            term.reset();
            if (payload.buffer) {
              trackOutput(payload.buffer);
              term.write(payload.buffer);
            }
            if (payload.session) {
              term.options.disableStdin = payload.session.status !== 'running';
              onUpdateRef.current(payload.session);
            }
            break;
          case 'output':
            if (payload.data) {
              trackOutput(payload.data);
              term.write(payload.data);
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
      term.dispose();
    };
  }, [session.id]);

  return (
    <article data-profile={session.profile} className="dashboard-terminal-pane">
      <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-4 md:px-5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{session.title}</h3>
            <span className="dashboard-chip">
              {session.profile}
            </span>
            {session.model ? (
              <span className="dashboard-chip" data-tone="accent">
                {session.model}
              </span>
            ) : null}
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${connectionBadgeClasses(
                connectionState
              )}`}
            >
              {connectionState}
            </span>
          </div>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{session.command}</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span>PID {session.pid}</span>
            <span>
              {session.cols}x{session.rows}
            </span>
            <span>updated {formatTimestamp(session.updated_at)}</span>
            {session.environment_label ? <span>env {session.environment_label}</span> : null}
          </div>
          {(session.skills ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {(session.skills ?? []).map((skill) => (
                <span key={skill} className="dashboard-chip">
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <Button
          onClick={() => onClose(session.id)}
          variant="outline"
          size="sm"
          className="rounded-full"
        >
          Close
        </Button>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive md:px-5">
          {error}
        </div>
      ) : null}

      <div className="dashboard-terminal-screen" onClick={focusTerminal}>
        <div
          ref={containerRef}
          className="relative z-10 h-full w-full overflow-hidden rounded-[calc(var(--radius)+0.3rem)] border border-border/60 bg-[#101418]"
        />
      </div>

      <div className="dashboard-terminal-controls">
        <div className="mx-auto grid max-w-xl gap-1.5">
          <div className="grid grid-cols-7 gap-1.5">
            <Button
              type="button"
              title="Interrupt (Ctrl+C)"
              aria-label="Interrupt process"
              onClick={() => sendControlKey('c')}
              disabled={!canSendInput}
              variant="outline"
              data-tone={canSendInput ? 'warning' : undefined}
              className="dashboard-terminal-control h-10 rounded-[10px] px-2 text-base leading-none"
            >
              <Ban className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Paste"
              aria-label="Paste from clipboard"
              onClick={() => void pasteFromClipboard()}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-10 rounded-[10px] px-2"
            >
              <ClipboardPaste className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Copy selected or latest output"
              aria-label="Copy selected or latest output"
              onClick={() => void copyTerminalContent()}
              variant="outline"
              className="dashboard-terminal-control h-10 rounded-[10px] px-2"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Enter"
              aria-label="Send enter"
              onClick={() => sendInput('\r')}
              disabled={!canSendInput}
              variant="outline"
              data-tone="accent"
              className="dashboard-terminal-control h-10 rounded-[10px] px-2"
            >
              <CornerDownLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Clear"
              aria-label="Clear terminal"
              onClick={clearTerminal}
              disabled={!canSendInput}
              variant="outline"
              className="dashboard-terminal-control h-10 rounded-[10px] px-2"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Scroll view up"
              aria-label="Scroll terminal output up"
              onClick={scrollViewUp}
              variant="outline"
              className="dashboard-terminal-control h-10 rounded-[10px] px-2"
            >
              <ChevronsUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Scroll to bottom"
              aria-label="Scroll to latest output"
              onClick={scrollViewBottom}
              variant="outline"
              data-tone="accent"
              className="dashboard-terminal-control h-10 rounded-[10px] px-2"
            >
              <ChevronsDown className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-8 gap-1.5">
            <Button type="button" title="Back tab" aria-label="Send shift tab" onClick={() => sendInput('\x1b[Z')} disabled={!canSendInput} variant="outline" className="dashboard-terminal-control h-10 rounded-[10px] px-2 text-xs font-semibold">Tab←</Button>
            <Button type="button" title="Up" aria-label="Move up" onClick={() => sendInput('\x1b[A')} disabled={!canSendInput} variant="outline" className="dashboard-terminal-control h-10 rounded-[10px] px-2"><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" title="Down" aria-label="Move down" onClick={() => sendInput('\x1b[B')} disabled={!canSendInput} variant="outline" className="dashboard-terminal-control h-10 rounded-[10px] px-2"><ArrowDown className="h-4 w-4" /></Button>
            <Button type="button" title="Tab" aria-label="Send tab" onClick={() => sendInput('\t')} disabled={!canSendInput} variant="outline" className="dashboard-terminal-control h-10 rounded-[10px] px-2 text-xs font-semibold">Tab→</Button>
            <Button type="button" title={ctrlHold ? 'Ctrl hold active' : 'Enable ctrl hold'} aria-label="Toggle ctrl hold" onClick={() => setCtrlHold((value) => !value)} disabled={!canSendInput} variant="outline" data-tone={ctrlHold ? 'accent' : undefined} className="dashboard-terminal-control h-10 rounded-[10px] px-2"><Command className="h-4 w-4" /></Button>
            <Button type="button" title="Ctrl + C" aria-label="Send ctrl c" onClick={() => sendControlKey('c')} disabled={!canSendInput} variant="outline" className="dashboard-terminal-control h-10 rounded-[10px] px-2 text-xs font-semibold">Ctrl+C</Button>
            <Button type="button" title="Send key 1" aria-label="Send key 1" onClick={() => sendMobileKey('1')} disabled={!canSendInput} variant="outline" data-tone="accent" className="dashboard-terminal-control h-10 rounded-[10px] px-2 text-base leading-none">1</Button>
            <Button type="button" title="Send key 2" aria-label="Send key 2" onClick={() => sendMobileKey('2')} disabled={!canSendInput} variant="outline" data-tone="accent" className="dashboard-terminal-control h-10 rounded-[10px] px-2 text-base leading-none">2</Button>
          </div>
        </div>
      </div>
    </article>
  );
}
