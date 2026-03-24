'use client';

import '@xterm/xterm/css/xterm.css';

import { startTransition, useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

import type { TerminalSession } from '@/lib/types';

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
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);
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

  function scrollLines(amount: number) {
    terminalRef.current?.scrollLines(amount);
  }

  function scrollToEdge(edge: 'top' | 'bottom') {
    if (!terminalRef.current) return;

    if (edge === 'top') {
      terminalRef.current.scrollToTop();
      return;
    }

    terminalRef.current.scrollToBottom();
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
              term.write(payload.buffer);
            }
            if (payload.session) {
              term.options.disableStdin = payload.session.status !== 'running';
              onUpdateRef.current(payload.session);
            }
            break;
          case 'output':
            if (payload.data) {
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

      <div className="border-t border-white/10 bg-black/20 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Touch controls
          </p>
          <button
            type="button"
            onClick={focusTerminal}
            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-400/15"
          >
            Focus keyboard
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            <button
              type="button"
              onClick={() => sendInput('\t')}
              disabled={!canSendInput}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tab
            </button>
            <button
              type="button"
              onClick={() => sendInput('\x1b')}
              disabled={!canSendInput}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Esc
            </button>
            <button
              type="button"
              onClick={() => sendInput('\r')}
              disabled={!canSendInput}
              className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enter
            </button>
            <button
              type="button"
              onClick={() => sendInput('\x1b[A')}
              disabled={!canSendInput}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => sendInput('\x1b[B')}
              disabled={!canSendInput}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => sendInput('\x1b[D')}
              disabled={!canSendInput}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => sendInput('\x1b[C')}
              disabled={!canSendInput}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Right
            </button>
            <button
              type="button"
              onClick={() => sendInput('\x7f')}
              disabled={!canSendInput}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Backspace
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <button
              type="button"
              onClick={() => sendControlKey('c')}
              disabled={!canSendInput}
              className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs font-medium text-orange-100 transition-colors hover:border-orange-300/40 hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ctrl+C
            </button>
            <button
              type="button"
              onClick={() => sendControlKey('l')}
              disabled={!canSendInput}
              className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs font-medium text-orange-100 transition-colors hover:border-orange-300/40 hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ctrl+L
            </button>
            <button
              type="button"
              onClick={() => sendControlKey('d')}
              disabled={!canSendInput}
              className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs font-medium text-orange-100 transition-colors hover:border-orange-300/40 hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ctrl+D
            </button>
            <button
              type="button"
              onClick={() => sendControlKey('u')}
              disabled={!canSendInput}
              className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs font-medium text-orange-100 transition-colors hover:border-orange-300/40 hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ctrl+U
            </button>
            <button
              type="button"
              onClick={() => sendControlKey('a')}
              disabled={!canSendInput}
              className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs font-medium text-orange-100 transition-colors hover:border-orange-300/40 hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ctrl+A
            </button>
            <button
              type="button"
              onClick={() => sendControlKey('e')}
              disabled={!canSendInput}
              className="rounded-2xl border border-orange-400/20 bg-orange-400/10 px-3 py-2 text-xs font-medium text-orange-100 transition-colors hover:border-orange-300/40 hover:bg-orange-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ctrl+E
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => scrollLines(-12)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white"
            >
              Scroll -
            </button>
            <button
              type="button"
              onClick={() => scrollLines(12)}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white"
            >
              Scroll +
            </button>
            <button
              type="button"
              onClick={() => scrollToEdge('top')}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white"
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => scrollToEdge('bottom')}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-white/20 hover:text-white"
            >
              Latest
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
