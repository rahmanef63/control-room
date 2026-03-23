'use client';

import '@xterm/xterm/css/xterm.css';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import {
  Bot,
  Boxes,
  Command,
  Cpu,
  Folder,
  PanelTop,
  RefreshCw,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';

import type {
  RuntimeEnvironmentSummary,
  RuntimeResolvedAgentProfile,
  TerminalProfile,
  TerminalSession,
} from '@/lib/types';

interface TerminalProfileOption {
  profile: TerminalProfile;
  title: string;
  description: string;
}

interface TerminalListResponse {
  profiles: TerminalProfileOption[];
  sessions: TerminalSession[];
  environments: RuntimeEnvironmentSummary[];
  agentProfiles: RuntimeResolvedAgentProfile[];
}

interface TerminalSocketEvent {
  type: 'bootstrap' | 'output' | 'status' | 'error' | 'pong';
  buffer?: string;
  data?: string;
  message?: string;
  session?: TerminalSession;
}

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const SESSION_STORAGE_KEY = 'vps-control-room.terminal-sessions';

function getSocketUrl(sessionId: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/terminals?sessionId=${encodeURIComponent(sessionId)}`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function connectionBadgeClasses(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    case 'reconnecting':
      return 'bg-yellow-500/10 text-yellow-200 border-yellow-500/20';
    case 'connecting':
      return 'bg-sky-500/10 text-sky-200 border-sky-500/20';
    case 'disconnected':
    default:
      return 'bg-rose-500/10 text-rose-200 border-rose-500/20';
  }
}

function profileAccent(profile: TerminalProfile): string {
  switch (profile) {
    case 'codex':
      return 'from-cyan-500/20 via-sky-500/10 to-transparent';
    case 'claude':
      return 'from-orange-500/20 via-amber-500/10 to-transparent';
    case 'gemini':
      return 'from-emerald-500/20 via-lime-500/10 to-transparent';
    case 'openclaw':
      return 'from-fuchsia-500/20 via-pink-500/10 to-transparent';
    case 'shell':
    default:
      return 'from-slate-100/10 via-slate-100/5 to-transparent';
  }
}

function renderProfileIcon(profile: TerminalProfile) {
  if (profile === 'shell') {
    return <TerminalSquare className="h-5 w-5" />;
  }
  if (profile === 'openclaw') {
    return <Boxes className="h-5 w-5" />;
  }
  if (profile === 'codex') {
    return <Command className="h-5 w-5" />;
  }
  if (profile === 'claude') {
    return <Sparkles className="h-5 w-5" />;
  }
  return <Bot className="h-5 w-5" />;
}

function LauncherCard({
  profile,
  busy,
  onLaunch,
}: {
  profile: TerminalProfileOption;
  busy: boolean;
  onLaunch: () => void;
}) {
  return (
    <button
      onClick={onLaunch}
      disabled={busy}
      className={`group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${profileAccent(
        profile.profile
      )} px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_80px_-40px_rgba(14,165,233,0.45)] disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_45%)] opacity-70" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white">
            {renderProfileIcon(profile.profile)}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{busy ? 'Launching...' : profile.title}</p>
            <p className="mt-1 max-w-[22rem] text-xs leading-5 text-slate-300">
              {profile.description}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
          {profile.profile}
        </span>
      </div>
    </button>
  );
}

function EnvironmentCard({
  environment,
  busy,
  onLaunch,
}: {
  environment: RuntimeEnvironmentSummary;
  busy: boolean;
  onLaunch: () => void;
}) {
  return (
    <button
      onClick={onLaunch}
      disabled={busy}
      className="group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(8,17,31,0.88))] px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.12),transparent_34%)]" />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-cyan-100">
            <Folder className="h-5 w-5" />
          </div>
          <div className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
            {environment.envVarCount} env
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{busy ? 'Opening shell...' : environment.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">{environment.description}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          <p className="truncate font-mono text-[11px] text-cyan-200">{environment.cwd}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {environment.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Parsed keys: {environment.envKeys.slice(0, 5).join(', ') || 'none'}
        </p>
      </div>
    </button>
  );
}

function AgentPresetCard({
  profile,
  busy,
  onLaunch,
}: {
  profile: RuntimeResolvedAgentProfile;
  busy: boolean;
  onLaunch: () => void;
}) {
  return (
    <button
      onClick={onLaunch}
      disabled={busy}
      className={`group relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br ${profileAccent(
        profile.terminalProfile
      )} px-5 py-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_28px_80px_-44px_rgba(34,211,238,0.42)] disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_40%)]" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white">
            {renderProfileIcon(profile.terminalProfile)}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
              {profile.model}
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
              {profile.terminalProfile}
            </span>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">{busy ? 'Starting agent...' : profile.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">{profile.description}</p>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Bound environment</p>
            <p className="mt-2 text-sm text-cyan-100">{profile.environmentLabel ?? 'Not assigned'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Skills</p>
            <p className="mt-2 text-xl font-semibold text-white">{profile.skills.length}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
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
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const sessionRef = useRef(session);
  const isUnmountingRef = useRef(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string | null>(null);

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

    const sendMessage = (payload: Record<string, unknown>) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
      }
    };

    const resizeTerminal = () => {
      if (!fitAddonRef.current || !terminalRef.current) return;

      fitAddonRef.current.fit();
      sendMessage({
        type: 'resize',
        cols: terminalRef.current.cols,
        rows: terminalRef.current.rows,
      });
    };

    const connect = () => {
      if (isUnmountingRef.current) return;

      setConnectionState(reconnectAttemptsRef.current === 0 ? 'connecting' : 'reconnecting');

      const socket = new WebSocket(getSocketUrl(session.id));
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        reconnectAttemptsRef.current = 0;
        setConnectionState('connected');
        setError(null);
        resizeTerminal();
      });

      socket.addEventListener('message', (message) => {
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
      });

      socket.addEventListener('close', () => {
        socketRef.current = null;

        if (isUnmountingRef.current) {
          return;
        }

        if (sessionRef.current.status === 'running') {
          reconnectAttemptsRef.current += 1;
          setConnectionState('reconnecting');
          const delay = Math.min(1000 * 2 ** (reconnectAttemptsRef.current - 1), 8000);
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        } else {
          setConnectionState('disconnected');
        }
      });

      socket.addEventListener('error', () => {
        setError('Socket dropped, trying to reattach…');
      });
    };

    term.onData((data) => {
      sendMessage({ type: 'input', data });
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
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      resizeObserverRef.current?.disconnect();
      socketRef.current?.close();
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
            <span>{session.cols}x{session.rows}</span>
            <span>updated {formatTimestamp(session.updated_at)}</span>
            {session.environment_label ? <span>env {session.environment_label}</span> : null}
          </div>
          {session.skills && session.skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {session.skills.map((skill) => (
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

      <div className="relative h-[440px] bg-[#08111f] p-2">
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-cyan-500/10 to-transparent" />
        <div ref={containerRef} className="relative z-10 h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-[#08111f]" />
      </div>
    </article>
  );
}

export default function TerminalsPage() {
  const [profiles, setProfiles] = useState<TerminalProfileOption[]>([]);
  const [environments, setEnvironments] = useState<RuntimeEnvironmentSummary[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<RuntimeResolvedAgentProfile[]>([]);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/terminals');
        const payload = (await response.json()) as TerminalListResponse;
        if (cancelled) return;

        const persistedIds =
          typeof window !== 'undefined'
            ? JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) ?? '[]')
            : [];
        const orderedSessions =
          Array.isArray(persistedIds) && persistedIds.length > 0
            ? [
                ...payload.sessions.filter((session) => persistedIds.includes(session.id)),
                ...payload.sessions.filter((session) => !persistedIds.includes(session.id)),
              ]
            : payload.sessions;

        setProfiles(payload.profiles);
        setEnvironments(payload.environments);
        setAgentProfiles(payload.agentProfiles);
        setSessions(orderedSessions);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(sessions.map((session) => session.id))
    );
  }, [sessions]);

  async function createSession(body: Record<string, unknown>, key: string) {
    setCreatingKey(key);
    setError(null);

    try {
      const response = await fetch('/api/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { session?: TerminalSession; error?: string };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error || 'Failed to create terminal');
      }

      setSessions((current) => [
        payload.session!,
        ...current.filter((item) => item.id !== payload.session!.id),
      ]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create terminal');
    } finally {
      setCreatingKey(null);
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
    setSessions((current) => {
      const exists = current.some((session) => session.id === nextSession.id);
      if (!exists) {
        return [nextSession, ...current];
      }
      return current.map((session) => (session.id === nextSession.id ? nextSession : session));
    });
  }

  const runningCount = useMemo(
    () => sessions.filter((session) => session.status === 'running').length,
    [sessions]
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="grid gap-4 xl:grid-cols-[1.3fr_minmax(360px,0.9fr)]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(8,47,73,0.92),rgba(15,23,42,0.98))] p-6 shadow-[0_40px_120px_-60px_rgba(14,165,233,0.65)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.12),transparent_24%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-slate-300">
                <PanelTop className="h-3.5 w-3.5" />
                Live Agent Cockpit
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Multi-agent terminals, bound environments, and reconnect-safe sessions.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Launch an empty shell inside a known workspace or jump straight into Codex,
                  Claude, Gemini, or OpenClaw with environment variables and skill context already attached.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-[340px]">
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Live panes</p>
                <p className="mt-2 text-3xl font-semibold text-white">{sessions.length}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Running</p>
                <p className="mt-2 text-3xl font-semibold text-white">{runningCount}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Environments</p>
                <p className="mt-2 text-3xl font-semibold text-white">{environments.length}</p>
              </div>
              <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Agent presets</p>
                <p className="mt-2 text-3xl font-semibold text-white">{agentProfiles.length}</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.55)]">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <RefreshCw className="h-4 w-4 text-cyan-300" />
            Connection behavior
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <li>WebSocket transport is used for live PTY output and input.</li>
            <li>Pane status distinguishes `connecting`, `reconnecting`, and `connected`.</li>
            <li>Sessions live in the host agent and reattach after browser reloads.</li>
            <li>Open terminal IDs are remembered locally and restored on page reload.</li>
          </ul>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.45)]">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
            <TerminalSquare className="h-4 w-4 text-cyan-300" />
            Base terminals
          </div>
          <p className="mb-4 text-sm text-slate-400">
            Spawn an empty shell or jump straight into a CLI agent. Missing binaries fall back to a shell.
          </p>
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <LauncherCard
                key={profile.profile}
                profile={profile}
                busy={creatingKey === `profile:${profile.profile}`}
                onLaunch={() => createSession({ profile: profile.profile }, `profile:${profile.profile}`)}
              />
            ))}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.45)]">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
            <Cpu className="h-4 w-4 text-orange-300" />
            Agent presets
          </div>
          <p className="mb-4 text-sm text-slate-400">
            These presets carry the AI model, target environment, and skill list so you can launch the right agent in one click.
          </p>
          <div className="grid gap-3 xl:grid-cols-2">
            {agentProfiles.map((profile) => (
              <AgentPresetCard
                key={profile.id}
                profile={profile}
                busy={creatingKey === `agent:${profile.id}`}
                onLaunch={() => createSession({ agentProfileId: profile.id }, `agent:${profile.id}`)}
              />
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.82))] p-5 shadow-[0_30px_90px_-60px_rgba(14,165,233,0.45)]">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
          <Folder className="h-4 w-4 text-cyan-300" />
          Environment launcher
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Each environment block is parsed into variables and passed directly into the host PTY before the terminal starts.
        </p>
        <div className="grid gap-3 xl:grid-cols-3">
          {environments.map((environment) => (
            <EnvironmentCard
              key={environment.id}
              environment={environment}
              busy={creatingKey === `env:${environment.id}`}
              onLaunch={() =>
                createSession(
                  { profile: 'shell', environmentId: environment.id },
                  `env:${environment.id}`
                )
              }
            />
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 px-5 py-12 text-sm text-slate-400">
          Loading terminal sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-black/20 px-5 py-12 text-sm text-slate-400">
          No active terminals yet. Launch one of the presets above to start.
        </div>
      ) : (
        <section className="grid gap-4 2xl:grid-cols-2">
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
