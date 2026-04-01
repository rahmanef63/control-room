import { randomUUID } from "crypto";

import * as pty from "node-pty";
import type { IPty } from "node-pty";

import { resolveTerminalLaunch } from "./profiles.js";
import type {
  TerminalCreateRequest,
  TerminalGatewayEvent,
  TerminalSession as TerminalSessionRecord,
} from "../../../packages/contracts/index.js";

type Subscriber = (event: TerminalGatewayEvent) => void;

interface ManagedSession {
  session: TerminalSessionRecord;
  terminal: IPty;
  buffer: string;
  subscribers: Set<Subscriber>;
  cleanupTimer: NodeJS.Timeout | null;
}

const MAX_BUFFER_CHARS = 250_000;
const MAX_TERMINAL_SESSIONS = 12;
const EXITED_SESSION_TTL_MS = 30 * 60 * 1000;

function cloneSession(session: TerminalSessionRecord): TerminalSessionRecord {
  return { ...session };
}

function truncateBuffer(buffer: string): string {
  if (buffer.length <= MAX_BUFFER_CHARS) {
    return buffer;
  }
  return buffer.slice(buffer.length - MAX_BUFFER_CHARS);
}

class TerminalManager {
  private readonly sessions = new Map<string, ManagedSession>();

  listSessions(): TerminalSessionRecord[] {
    return Array.from(this.sessions.values())
      .map(({ session }) => cloneSession(session))
      .sort((a, b) => b.created_at - a.created_at);
  }

  createSession(request: TerminalCreateRequest): TerminalSessionRecord {
    if (this.sessions.size >= MAX_TERMINAL_SESSIONS) {
      throw new Error(`Terminal session limit reached (${MAX_TERMINAL_SESSIONS})`);
    }

    const launch = resolveTerminalLaunch(request);
    const now = Date.now();
    const id = randomUUID();

    const terminal = pty.spawn(launch.command, launch.args, {
      name: "xterm-256color",
      cols: 120,
      rows: 32,
      cwd: launch.cwd,
      env: {
        ...launch.env,
      },
    });

    const session: TerminalSessionRecord = {
      id,
      profile: launch.profile,
      title: launch.title,
      command: [launch.command, ...launch.args].join(" "),
      pid: terminal.pid,
      cwd: launch.cwd,
      rows: 32,
      cols: 120,
      status: "running",
      created_at: now,
      updated_at: now,
      environment_id: launch.environment?.id,
      environment_label: launch.environment?.label,
      agent_profile_id: launch.agentProfile?.id,
      model: launch.agentProfile?.model,
      skills: launch.agentProfile?.skills,
    };

    const managed: ManagedSession = {
      session,
      terminal,
      buffer: "",
      subscribers: new Set(),
      cleanupTimer: null,
    };

    terminal.onData((data) => {
      managed.buffer = truncateBuffer(managed.buffer + data);
      managed.session.updated_at = Date.now();
      this.broadcast(managed, {
        type: "output",
        sessionId: managed.session.id,
        data,
      });
    });

    terminal.onExit(({ exitCode, signal }) => {
      managed.session.status = "exited";
      managed.session.updated_at = Date.now();
      managed.session.exit_code = exitCode;
      managed.session.exit_signal = signal;
      this.broadcast(managed, {
        type: "status",
        session: cloneSession(managed.session),
      });
      this.scheduleCleanup(managed.session.id);
    });

    this.sessions.set(id, managed);
    return cloneSession(session);
  }

  getSession(id: string): TerminalSessionRecord {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error("Terminal session not found");
    }
    return cloneSession(managed.session);
  }

  subscribe(id: string, subscriber: Subscriber): () => void {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error("Terminal session not found");
    }

    if (managed.cleanupTimer) {
      clearTimeout(managed.cleanupTimer);
      managed.cleanupTimer = null;
    }

    managed.subscribers.add(subscriber);
    subscriber({
      type: "bootstrap",
      buffer: managed.buffer,
      session: cloneSession(managed.session),
    });

    return () => {
      managed.subscribers.delete(subscriber);
      if (managed.session.status === "exited" && managed.subscribers.size === 0) {
        this.scheduleCleanup(id);
      }
    };
  }

  sendInput(id: string, data: string): void {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error("Terminal session not found");
    }
    if (managed.session.status !== "running") {
      throw new Error("Terminal session has already exited");
    }

    managed.terminal.write(data);
    managed.session.updated_at = Date.now();
  }

  resize(id: string, cols: number, rows: number): TerminalSessionRecord {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error("Terminal session not found");
    }

    const nextCols = Math.max(20, Math.floor(cols));
    const nextRows = Math.max(10, Math.floor(rows));

    if (managed.session.status === "running") {
      managed.terminal.resize(nextCols, nextRows);
    }

    managed.session.cols = nextCols;
    managed.session.rows = nextRows;
    managed.session.updated_at = Date.now();

    this.broadcast(managed, {
      type: "status",
      session: cloneSession(managed.session),
    });

    return cloneSession(managed.session);
  }

  closeSession(id: string): void {
    const managed = this.sessions.get(id);
    if (!managed) {
      return;
    }

    if (managed.cleanupTimer) {
      clearTimeout(managed.cleanupTimer);
      managed.cleanupTimer = null;
    }

    if (managed.session.status === "running") {
      managed.terminal.kill();
    }

    this.sessions.delete(id);
  }

  private scheduleCleanup(id: string): void {
    const managed = this.sessions.get(id);
    if (!managed || managed.cleanupTimer) {
      return;
    }

    managed.cleanupTimer = setTimeout(() => {
      const latest = this.sessions.get(id);
      if (!latest) {
        return;
      }
      if (latest.subscribers.size === 0 && latest.session.status === "exited") {
        this.sessions.delete(id);
      } else {
        latest.cleanupTimer = null;
      }
    }, EXITED_SESSION_TTL_MS);
  }

  private broadcast(managed: ManagedSession, event: TerminalGatewayEvent): void {
    for (const subscriber of managed.subscribers) {
      subscriber(event);
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __vpsControlRoomAgentTerminalManager: TerminalManager | undefined;
}

export const terminalManager =
  globalThis.__vpsControlRoomAgentTerminalManager ??
  (globalThis.__vpsControlRoomAgentTerminalManager = new TerminalManager());
