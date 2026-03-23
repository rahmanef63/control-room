import { randomUUID } from 'crypto';

import * as pty from 'node-pty';
import type { IPty } from 'node-pty';

import type { TerminalProfile, TerminalSession } from '@/lib/types';
import { resolveTerminalLaunch } from '@/lib/server/terminal-profiles';

type TerminalEvent =
  | { type: 'bootstrap'; buffer: string; session: TerminalSession }
  | { type: 'output'; data: string }
  | { type: 'status'; session: TerminalSession };

type TerminalSubscriber = (event: TerminalEvent) => void;

interface ManagedTerminalSession {
  terminal: IPty;
  buffer: string;
  subscribers: Set<TerminalSubscriber>;
  session: TerminalSession;
}

const MAX_BUFFER_CHARS = 200_000;
const MAX_TERMINAL_SESSIONS = 12;

function truncateBuffer(input: string): string {
  if (input.length <= MAX_BUFFER_CHARS) {
    return input;
  }

  return input.slice(input.length - MAX_BUFFER_CHARS);
}

function cloneSession(session: TerminalSession): TerminalSession {
  return { ...session };
}

class TerminalManager {
  private readonly sessions = new Map<string, ManagedTerminalSession>();

  listSessions(): TerminalSession[] {
    return Array.from(this.sessions.values())
      .map(({ session }) => cloneSession(session))
      .sort((a, b) => b.created_at - a.created_at);
  }

  createSession(profile: TerminalProfile): TerminalSession {
    if (this.sessions.size >= MAX_TERMINAL_SESSIONS) {
      throw new Error(`Terminal session limit reached (${MAX_TERMINAL_SESSIONS})`);
    }

    const launch = resolveTerminalLaunch(profile);
    const now = Date.now();
    const id = randomUUID();

    const terminal = pty.spawn(launch.command, launch.args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 32,
      cwd: launch.cwd,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    const session: TerminalSession = {
      id,
      profile,
      title: launch.title,
      command: [launch.command, ...launch.args].join(' '),
      pid: terminal.pid,
      cwd: launch.cwd,
      rows: 32,
      cols: 120,
      status: 'running',
      created_at: now,
      updated_at: now,
    };

    const managed: ManagedTerminalSession = {
      terminal,
      buffer: '',
      subscribers: new Set(),
      session,
    };

    terminal.onData((data) => {
      managed.buffer = truncateBuffer(managed.buffer + data);
      managed.session.updated_at = Date.now();
      this.broadcast(managed, { type: 'output', data });
    });

    terminal.onExit(({ exitCode, signal }) => {
      managed.session.status = 'exited';
      managed.session.updated_at = Date.now();
      managed.session.exit_code = exitCode;
      managed.session.exit_signal = signal;
      this.broadcast(managed, { type: 'status', session: cloneSession(managed.session) });
    });

    this.sessions.set(id, managed);

    return cloneSession(session);
  }

  getSession(id: string): TerminalSession {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error('Terminal session not found');
    }

    return cloneSession(managed.session);
  }

  subscribe(id: string, subscriber: TerminalSubscriber): () => void {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error('Terminal session not found');
    }

    managed.subscribers.add(subscriber);
    subscriber({
      type: 'bootstrap',
      buffer: managed.buffer,
      session: cloneSession(managed.session),
    });

    return () => {
      managed.subscribers.delete(subscriber);
    };
  }

  sendInput(id: string, data: string): void {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error('Terminal session not found');
    }

    if (managed.session.status !== 'running') {
      throw new Error('Terminal session has already exited');
    }

    managed.terminal.write(data);
    managed.session.updated_at = Date.now();
  }

  resize(id: string, cols: number, rows: number): TerminalSession {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error('Terminal session not found');
    }

    if (managed.session.status === 'running') {
      managed.terminal.resize(Math.max(20, Math.floor(cols)), Math.max(10, Math.floor(rows)));
    }

    managed.session.cols = Math.max(20, Math.floor(cols));
    managed.session.rows = Math.max(10, Math.floor(rows));
    managed.session.updated_at = Date.now();

    return cloneSession(managed.session);
  }

  closeSession(id: string): void {
    const managed = this.sessions.get(id);
    if (!managed) {
      return;
    }

    if (managed.session.status === 'running') {
      managed.terminal.kill();
    }

    this.sessions.delete(id);
  }

  private broadcast(managed: ManagedTerminalSession, event: TerminalEvent): void {
    for (const subscriber of managed.subscribers) {
      subscriber(event);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __vpsControlRoomTerminalManager: TerminalManager | undefined;
}

export const terminalManager =
  globalThis.__vpsControlRoomTerminalManager ??
  (globalThis.__vpsControlRoomTerminalManager = new TerminalManager());
