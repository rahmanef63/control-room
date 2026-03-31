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
  Command,
  CornerDownLeft,
  Eraser,
} from 'lucide-react';

import type { TerminalSession } from '@/lib/types';
import { Button } from '@/components/ui/button';

import {
  connectionBadgeClasses,
  formatTimestamp,
  getStreamUrl,
  type ConnectionState,
} from '@/components/terminals/utils';

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

  const tone =
    session.profile === 'codex'
      ? 'from-cyan-500/15'
      : session.profile === 'claude'
      ? 'from-orange-500/15'
      : session.profile === 'gemini'
      ? 'from-emerald-500/15'
      : session.profile === 'openclaw'
      ? 'from-fuchsia-500/15'
      : 'from-slate-200/10';

  return (
    <article className={`relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br ${tone} via-transparent to-black/20`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%)]" />

      <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white">{session.title}</h3>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
              {session.profile}
            </span>
            {session.model ? (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
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
          <p className="truncate font-mono text-[11px] text-slate-400">{session.command}</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
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
                <span
                  key={skill}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <button
          onClick={() => onClose(session.id)}
          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-white/20 hover:text-white"
        >
          Close
        </button>
      </div>

      {error ? (
        <div className="border-b border-rose-500/20 bg-rose-500/10 px-5 py-2 text-xs text-rose-200">
          {error}
        </div>
      ) : null}

      <div
        className="relative h-[440px] bg-[#08111f] p-2"
        onClick={focusTerminal}
      >
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-cyan-500/10 to-transparent" />
        <div
          ref={containerRef}
          className="relative z-10 h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-[#08111f]"
        />
      </div>

      <div className="border-t border-white/10 bg-black/35 px-2.5 py-2">
        <div className="mx-auto grid max-w-xl gap-1.5">
          <div className="grid grid-cols-5 gap-1.5">
            <Button
              type="button"
              title="Interrupt (Ctrl+C)"
              aria-label="Interrupt process"
              onClick={() => sendControlKey('c')}
              disabled={!canSendInput}
              variant="outline"
              className={`h-10 rounded-[10px] border px-2 text-base leading-none transition-all ${
                canSendInput
                  ? 'border-orange-300/45 bg-orange-400/15 text-orange-100 shadow-[0_0_0.8rem_rgba(251,146,60,0.18)]'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
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
              className="h-10 rounded-[10px] border-white/10 bg-white/5 px-2 text-slate-100 hover:border-white/20 hover:bg-white/10"
            >
              <ClipboardPaste className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              title="Copy selected or latest output"
              aria-label="Copy selected or latest output"
              onClick={() => void copyTerminalContent()}
              variant="outline"
              className="h-10 rounded-[10px] border-white/10 bg-white/5 px-2 text-slate-100 hover:border-white/20 hover:bg-white/10"
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
              className="h-10 rounded-[10px] border-cyan-400/30 bg-cyan-400/12 px-2 text-cyan-100 shadow-[0_0_0.75rem_rgba(34,211,238,0.2)] hover:border-cyan-300/50 hover:bg-cyan-400/20"
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
              className="h-10 rounded-[10px] border-white/10 bg-white/5 px-2 text-slate-100 hover:border-white/20 hover:bg-white/10"
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-8 gap-1.5">
            <Button type="button" title="Back tab" aria-label="Send shift tab" onClick={() => sendInput('\x1b[Z')} disabled={!canSendInput} variant="outline" className="h-10 rounded-[10px] border-white/10 bg-white/5 px-2 text-xs font-semibold text-slate-100 hover:border-white/20 hover:bg-white/10">Tab←</Button>
            <Button type="button" title="Up" aria-label="Move up" onClick={() => sendInput('\x1b[A')} disabled={!canSendInput} variant="outline" className="h-10 rounded-[10px] border-white/10 bg-white/5 px-2 text-slate-100 hover:border-white/20 hover:bg-white/10"><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" title="Down" aria-label="Move down" onClick={() => sendInput('\x1b[B')} disabled={!canSendInput} variant="outline" className="h-10 rounded-[10px] border-white/10 bg-white/5 px-2 text-slate-100 hover:border-white/20 hover:bg-white/10"><ArrowDown className="h-4 w-4" /></Button>
            <Button type="button" title="Tab" aria-label="Send tab" onClick={() => sendInput('\t')} disabled={!canSendInput} variant="outline" className="h-10 rounded-[10px] border-white/10 bg-white/5 px-2 text-xs font-semibold text-slate-100 hover:border-white/20 hover:bg-white/10">Tab→</Button>
            <Button type="button" title={ctrlHold ? 'Ctrl hold active' : 'Enable ctrl hold'} aria-label="Toggle ctrl hold" onClick={() => setCtrlHold((value) => !value)} disabled={!canSendInput} variant="outline" className={`h-10 rounded-[10px] px-2 ${ctrlHold ? 'border-cyan-300/50 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10'}`}><Command className="h-4 w-4" /></Button>
            <Button type="button" title="Ctrl + C" aria-label="Send ctrl c" onClick={() => sendControlKey('c')} disabled={!canSendInput} variant="outline" className="h-10 rounded-[10px] border-white/10 bg-white/5 px-2 text-xs font-semibold text-slate-100 hover:border-white/20 hover:bg-white/10">Ctrl+C</Button>
            <Button type="button" title="Send key 1" aria-label="Send key 1" onClick={() => sendMobileKey('1')} disabled={!canSendInput} variant="outline" className="h-10 rounded-[10px] border-fuchsia-400/30 bg-fuchsia-400/10 px-2 text-base leading-none text-fuchsia-100 hover:border-fuchsia-300/40 hover:bg-fuchsia-400/20">1</Button>
            <Button type="button" title="Send key 2" aria-label="Send key 2" onClick={() => sendMobileKey('2')} disabled={!canSendInput} variant="outline" className="h-10 rounded-[10px] border-fuchsia-400/30 bg-fuchsia-400/10 px-2 text-base leading-none text-fuchsia-100 hover:border-fuchsia-300/40 hover:bg-fuchsia-400/20">2</Button>
          </div>
        </div>
      </div>
    </article>
  );
}
