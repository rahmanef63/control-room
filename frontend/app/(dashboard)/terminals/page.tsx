'use client';

import '@xterm/xterm/css/xterm.css';

import { startTransition, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import type { TerminalProfile, TerminalSession } from '@/lib/types';

interface TerminalProfileOption {
  profile: TerminalProfile;
  title: string;
  description: string;
}

interface TerminalListResponse {
  profiles: TerminalProfileOption[];
  sessions: TerminalSession[];
}

interface TerminalStreamEvent {
  type: 'connected' | 'bootstrap' | 'output' | 'status';
  buffer?: string;
  data?: string;
  session?: TerminalSession;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function TerminalPane({
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
  const inputBufferRef = useRef('');
  const flushTimerRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>(
    'connecting'
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
      fontSize: 13,
      lineHeight: 1.15,
      scrollback: 5000,
      theme: {
        background: '#08111f',
        foreground: '#d8e1f0',
        cursor: '#f8fafc',
        black: '#08111f',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#f472b6',
        cyan: '#22d3ee',
        white: '#d8e1f0',
        brightBlack: '#334155',
        brightRed: '#fca5a5',
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

    const flushInput = async () => {
      if (!inputBufferRef.current) return;

      const payload = inputBufferRef.current;
      inputBufferRef.current = '';
      flushTimerRef.current = null;

      try {
        await fetch(`/api/terminals/${session.id}/input`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payload }),
        });
      } catch {
        setError('Failed to send input');
      }
    };

    term.onData((data) => {
      inputBufferRef.current += data;
      if (flushTimerRef.current === null) {
        flushTimerRef.current = window.setTimeout(flushInput, 25);
      }
    });

    const resizeTerminal = async () => {
      if (!fitAddonRef.current || !terminalRef.current) return;
      fitAddonRef.current.fit();

      const cols = terminalRef.current.cols;
      const rows = terminalRef.current.rows;

      try {
        const response = await fetch(`/api/terminals/${session.id}/resize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cols, rows }),
        });

        if (response.ok) {
          const payload = (await response.json()) as { session: TerminalSession };
          onUpdateRef.current(payload.session);
        }
      } catch {
        setError('Failed to resize terminal');
      }
    };

    resizeObserverRef.current = new ResizeObserver(() => {
      startTransition(() => {
        void resizeTerminal();
      });
    });
    resizeObserverRef.current.observe(containerRef.current);
    void resizeTerminal();

    const eventSource = new EventSource(`/api/terminals/${session.id}/stream`);
    eventSourceRef.current = eventSource;
    eventSource.onopen = () => {
      setConnectionState('connected');
      setError(null);
    };
    eventSource.onmessage = (message) => {
      const payload = JSON.parse(message.data) as TerminalStreamEvent;

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
            onUpdateRef.current(payload.session);
            if (payload.session.status === 'exited') {
              term.options.disableStdin = true;
              term.writeln('');
              term.writeln(
                `\x1b[33m[session exited${payload.session.exit_code !== undefined ? ` code=${payload.session.exit_code}` : ''}]\x1b[0m`
              );
            }
          }
          break;
        default:
          break;
      }
    };
    eventSource.onerror = () => {
      setConnectionState('disconnected');
      setError('Stream disconnected');
    };

    return () => {
      eventSource.close();
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
      }
      resizeObserverRef.current?.disconnect();
      term.dispose();
    };
  }, [session.id]);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{session.title}</h3>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                session.status === 'running'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {session.status}
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                connectionState === 'connected'
                  ? 'bg-blue-500/10 text-blue-300'
                  : connectionState === 'connecting'
                  ? 'bg-yellow-500/10 text-yellow-300'
                  : 'bg-red-500/10 text-red-300'
              }`}
            >
              {connectionState}
            </span>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{session.command}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            PID {session.pid} · {session.cols}x{session.rows} · updated {formatTimestamp(session.updated_at)}
          </p>
        </div>

        <button
          onClick={() => onClose(session.id)}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Close
        </button>
      </div>

      {error ? (
        <div className="border-b border-border bg-red-950/20 px-4 py-2 text-xs text-red-300">{error}</div>
      ) : null}

      <div className="h-[420px] bg-[#08111f] p-2">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </article>
  );
}

export default function TerminalsPage() {
  const [profiles, setProfiles] = useState<TerminalProfileOption[]>([]);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingProfile, setCreatingProfile] = useState<TerminalProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/terminals');
        const payload = (await response.json()) as TerminalListResponse;

        if (cancelled) return;

        setProfiles(payload.profiles);
        setSessions(payload.sessions);
      } catch {
        if (!cancelled) {
          setError('Failed to load terminal sessions');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createSession(profile: TerminalProfile) {
    setCreatingProfile(profile);
    setError(null);

    try {
      const response = await fetch('/api/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      });

      const payload = (await response.json()) as { session?: TerminalSession; error?: string };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error || 'Failed to create terminal');
      }

      setSessions((current) => [payload.session!, ...current]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create terminal');
    } finally {
      setCreatingProfile(null);
    }
  }

  async function closeSession(id: string) {
    try {
      await fetch(`/api/terminals/${id}`, { method: 'DELETE' });
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch {
      setError('Failed to close terminal');
    }
  }

  function updateSession(nextSession: TerminalSession) {
    setSessions((current) =>
      current.map((session) => (session.id === nextSession.id ? nextSession : session))
    );
  }

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Terminals</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Open multiple PTY-backed terminals at once. Each pane is independent and can start as an
          empty host shell or jump directly into Codex, Claude, Gemini, or OpenClaw.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap gap-3">
          {profiles.map((profile) => {
            const busy = creatingProfile === profile.profile;
            return (
              <button
                key={profile.profile}
                onClick={() => createSession(profile.profile)}
                disabled={creatingProfile !== null}
                className="min-w-[180px] rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="text-sm font-semibold text-foreground">
                  {busy ? 'Launching...' : profile.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{profile.description}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Missing binaries fall back to a regular shell so the pane is still usable.
        </p>
      </section>

      {error ? (
        <div className="rounded-lg border border-red-900 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-sm text-muted-foreground">
          Loading terminal sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-sm text-muted-foreground">
          No active terminals yet. Start with <span className="font-medium text-foreground">Empty Terminal</span>{' '}
          or launch one of the agent profiles above.
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {sessions.map((session) => (
            <TerminalPane
              key={session.id}
              session={session}
              onUpdate={updateSession}
              onClose={closeSession}
            />
          ))}
        </section>
      )}
    </div>
  );
}
