// log.json — append-only audit log with 30-day TTL.
// Single bounded JSON audit log under the configured agent state directory.

import { promises as fs } from "fs";
import path from "path";

const DEFAULT_DIR = path.resolve(process.cwd(), "var");
const STATE_DIR = process.env.STATE_DIR ?? DEFAULT_DIR;
const LOG_PATH = path.join(STATE_DIR, "log.json");

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ENTRIES = 10_000; // hard cap to keep file readable

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

let writeQueue: Promise<void> = Promise.resolve();

async function readEntries(): Promise<LogEntry[]> {
  try {
    const raw = await fs.readFile(LOG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LogEntry[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeEntries(entries: LogEntry[]): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const tmp = `${LOG_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(entries), "utf8");
  await fs.rename(tmp, LOG_PATH);
}

export function appendLog(entry: Omit<LogEntry, "id" | "timestamp"> & { timestamp?: number }): void {
  const full: LogEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: entry.timestamp ?? Date.now(),
    level: entry.level,
    source: entry.source,
    message: entry.message,
    data: entry.data,
  };
  // Serialize writes so concurrent callers don't race the tmp+rename swap.
  writeQueue = writeQueue.then(async () => {
    const existing = await readEntries();
    existing.push(full);
    // Drop expired + truncate to MAX_ENTRIES (keep most recent).
    const cutoff = Date.now() - TTL_MS;
    const fresh = existing
      .filter((e) => e.timestamp >= cutoff)
      .slice(-MAX_ENTRIES);
    await writeEntries(fresh);
  }).catch(() => {
    // Swallow — logging must never crash the agent. The next append retries
    // with a fresh promise chain.
    writeQueue = Promise.resolve();
  });
}

export async function readLog(opts?: { since?: number; level?: LogLevel; limit?: number }): Promise<LogEntry[]> {
  const entries = await readEntries();
  let out = entries;
  if (opts?.since !== undefined) out = out.filter((e) => e.timestamp >= opts.since!);
  if (opts?.level) out = out.filter((e) => e.level === opts.level);
  if (opts?.limit) out = out.slice(-opts.limit);
  return out;
}

export async function cleanupLog(): Promise<{ removed: number; kept: number }> {
  const entries = await readEntries();
  const cutoff = Date.now() - TTL_MS;
  const fresh = entries.filter((e) => e.timestamp >= cutoff);
  await writeEntries(fresh);
  return { removed: entries.length - fresh.length, kept: fresh.length };
}
