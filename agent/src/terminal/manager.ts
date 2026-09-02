import { randomUUID } from "crypto";
import { execFile } from "child_process";
import fs from "fs";

import * as pty from "node-pty";
import type { IPty } from "node-pty";

import { ScrollbackBuffer } from "./buffer.js";
import { resolveTerminalLaunch } from "./profiles.js";
import { appendLog } from "../state/log.js";
import type {
  TerminalCreateRequest,
  TerminalGatewayEvent,
  TerminalInnerAgent,
  TerminalSession as TerminalSessionRecord,
} from "../../../packages/contracts/index.js";

type Subscriber = (event: TerminalGatewayEvent) => void;

interface ManagedSession {
  session: TerminalSessionRecord;
  terminal: IPty;
  buffer: ScrollbackBuffer;
  subscribers: Set<Subscriber>;
  cleanupTimer: NodeJS.Timeout | null;
  innerAgentCachedAt: number;
  innerAgentRefreshing: boolean;
}

const MAX_TERMINAL_SESSIONS = 16;
const EXITED_SESSION_TTL_MS = 30 * 60 * 1000;
const INNER_AGENT_TTL_MS = 15_000;
const INNER_AGENT_RE = /\b(claude|codex|gemini|openclaw)\b/;

// Non-blocking: spawns `pstree` asynchronously so a slow fork never stalls the
// agent event loop (which also serves pty I/O + SSE). Result lands in the
// cache via callback; callers read the cached value, never wait on this.
function detectInnerAgent(pid: number, done: (agent: TerminalInnerAgent | null) => void): void {
  execFile("pstree", ["-p", String(pid)], { encoding: "utf8", timeout: 1_000 }, (err, stdout) => {
    if (err) {
      done(null);
      return;
    }
    const match = stdout.match(INNER_AGENT_RE);
    done(match ? (match[1] as TerminalInnerAgent) : null);
  });
}

function cloneSession(session: TerminalSessionRecord): TerminalSessionRecord {
  return { ...session };
}

function readLiveCwd(pid: number): string | undefined {
  try {
    return fs.readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return undefined;
  }
}

class TerminalManager {
  private readonly sessions = new Map<string, ManagedSession>();

  listSessions(): TerminalSessionRecord[] {
    return Array.from(this.sessions.values())
      .map((managed) => {
        const cloned = cloneSession(managed.session);
        if (cloned.status === "running") {
          const liveCwd = readLiveCwd(cloned.pid);
          if (liveCwd) cloned.cwd = liveCwd;
          this.refreshInnerAgent(managed);
          cloned.inner_agent = managed.session.inner_agent;
        }
        return cloned;
      })
      .sort((a, b) => b.created_at - a.created_at);
  }

  private refreshInnerAgent(managed: ManagedSession): void {
    const now = Date.now();
    if (managed.innerAgentRefreshing) return;
    if (now - managed.innerAgentCachedAt < INNER_AGENT_TTL_MS) return;
    managed.innerAgentRefreshing = true;
    detectInnerAgent(managed.session.pid, (agent) => {
      managed.session.inner_agent = agent;
      managed.innerAgentCachedAt = Date.now();
      managed.innerAgentRefreshing = false;
    });
  }

  // Lightweight snapshots for callers that only need terminal metadata.
  // only need id/status/updated_at/title. No pstree spawn, no /proc readlink.
  peekSessions(): TerminalSessionRecord[] {
    return Array.from(this.sessions.values()).map((managed) => cloneSession(managed.session));
  }

  peekSession(id: string): TerminalSessionRecord | undefined {
    const managed = this.sessions.get(id);
    return managed ? cloneSession(managed.session) : undefined;
  }

  createSession(request: TerminalCreateRequest): TerminalSessionRecord {
    if (this.sessions.size >= MAX_TERMINAL_SESSIONS) {
      this.evictForNewSession();
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
        // Expose a generic session identity to terminal-local tools without coupling to any integration.
        CONTROL_ROOM_SESSION_ID: id,
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
      buffer: new ScrollbackBuffer(),
      subscribers: new Set(),
      cleanupTimer: null,
      innerAgentCachedAt: 0,
      innerAgentRefreshing: false,
    };

    appendLog({
      level: "info",
      source: "terminal",
      message: "spawn",
      data: { id, profile: launch.profile, command: session.command, pid: terminal.pid, cwd: launch.cwd },
    });

    terminal.onData((data) => {
      managed.buffer.append(data);
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
    const cloned = cloneSession(managed.session);
    if (cloned.status === "running") {
      const liveCwd = readLiveCwd(cloned.pid);
      if (liveCwd) cloned.cwd = liveCwd;
      this.refreshInnerAgent(managed);
      cloned.inner_agent = managed.session.inner_agent;
    }
    return cloned;
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
      buffer: managed.buffer.toString(),
      session: cloneSession(managed.session),
    });

    return () => {
      managed.subscribers.delete(subscriber);
      if (managed.session.status === "exited" && managed.subscribers.size === 0) {
        this.scheduleCleanup(id);
      }
    };
  }

  getBuffer(id: string, lines = 200): { buffer: string; lines: string[] } {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error("Terminal session not found");
    }
    const buffer = managed.buffer.toString();
    const split = buffer.split(/\r?\n/);
    const tail = lines > 0 ? split.slice(-lines) : split;
    return { buffer, lines: tail };
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

  renameSession(id: string, title: string): TerminalSessionRecord {
    const managed = this.sessions.get(id);
    if (!managed) {
      throw new Error("Terminal session not found");
    }

    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error("Title cannot be empty");
    }
    if (trimmed.length > 80) {
      throw new Error("Title too long (max 80 chars)");
    }

    managed.session.title = trimmed;
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
      this.killSessionTree(managed);
    }

    appendLog({
      level: "info",
      source: "terminal",
      message: "close",
      data: { id, profile: managed.session.profile, pid: managed.session.pid },
    });

    this.sessions.delete(id);
  }

  // Tear down the shell AND its whole child tree (claude, `next build`, …).
  // node-pty's forkpty() setsid's the shell, so the shell's pid IS its
  // process-group id; SIGKILL to the negative pid reaps the entire group in
  // one syscall instead of orphaning detached descendants like terminal.kill()
  // (single-PID SIGHUP) did. We also call terminal.kill() so node-pty cleans
  // its own state. ponytail: children that double-fork+setsid into their OWN
  // session escape this group kill — the operator's cgroup MemorySwapMax cap is
  // the backstop for those (no recursive /proc walker on purpose).
  private killSessionTree(managed: ManagedSession): void {
    const pid = managed.session.pid; // == pgid (forkpty setsid)
    if (process.platform === "win32") {
      // ConPTY has no POSIX process groups; process.kill(-pid) is invalid.
      try {
        managed.terminal.kill();
      } catch {
        /* already gone */
      }
      return;
    }
    // GUARD: never signal pid <= 1 (kill(0|-1) would hit the agent itself).
    if (Number.isInteger(pid) && pid > 1) {
      try {
        process.kill(-pid, "SIGKILL"); // negative pid => whole process group
      } catch {
        /* group already dead (ESRCH) or not permitted (EPERM) */
      }
    }
    try {
      managed.terminal.kill();
    } catch {
      /* already gone */
    }
  }

  // At the session cap, make room for a new pane instead of rejecting it.
  // Prefer evicting an already-exited session; otherwise drop the most idle
  // running one (smallest updated_at) so the pane the user is actively using
  // is the last to go. Kills the pty and frees its buffer/subscribers.
  private evictForNewSession(): void {
    let victim: ManagedSession | null = null;
    for (const managed of this.sessions.values()) {
      if (managed.session.status === "exited") {
        victim = managed;
        break;
      }
      if (!victim || managed.session.updated_at < victim.session.updated_at) {
        victim = managed;
      }
    }
    if (!victim) return;
    appendLog({
      level: "info",
      source: "terminal",
      message: "evict",
      data: {
        id: victim.session.id,
        reason: "session_limit",
        status: victim.session.status,
      },
    });
    this.closeSession(victim.session.id);
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
