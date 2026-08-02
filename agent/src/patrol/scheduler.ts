// Patrol scheduler — runs inside the agent. Reads alfa-watchers state,
// inspects each watched terminal's silence age + buffer tail, and enqueues
// `waiting` / `done` pings without needing the browser open.
//
// Detection v1: time-since-last-output. If a target has been silent for
// `silenceThresholdMs` (default 30s), emit `waiting`. Per (alfa, target)
// cooldown prevents storms. `done` is detected as a short quiet window
// (1.5s) following a recent burst — see DONE_BURST_AGE_MS.

import { loadavg } from "os";

import { logger } from "../logger.js";
import { readJsonState } from "../state/store.js";
import { terminalManager } from "../terminal/manager.js";
import type { AlfaWatcher } from "../../../packages/contracts/index.js";

import { enqueuePing } from "./queue.js";

const DEFAULT_SILENCE_MS = 30_000;
const DONE_QUIET_MS = 1_500;
const DONE_BURST_AGE_MS = 8_000;
const TICK_MS = 3_000;
const COOLDOWN_MS = 60_000;
// Suppress nudges when 1-min loadavg crosses this. 0 disables the gate.
// 8 = full saturation on this 8-vCPU box. Prevents patrol piling new work
// onto a contended CPU — the trigger behind the 2026-05-28 build-storm →
// Hostinger CPU-throttle → 502 incident.
const LOAD_GATE = Number(process.env.PATROL_LOAD_GATE ?? "8");

type EventKind = "waiting" | "done";

interface PerTargetState {
  lastEmittedKind?: EventKind;
  lastEmittedAt?: number;
  lastSeenUpdatedAt?: number;
}

const stateByKey = new Map<string, PerTargetState>();

function keyOf(alfaId: string, sessionId: string): string {
  return `${alfaId}::${sessionId}`;
}

function promptFor(watcher: AlfaWatcher, sessionId: string): string {
  const custom = watcher.instructions[sessionId];
  return (custom && custom.trim()) || watcher.defaultInstruction;
}

async function loadWatchers(): Promise<AlfaWatcher[]> {
  const value = await readJsonState<Record<string, AlfaWatcher>>("alfa-watchers");
  if (!value || typeof value !== "object") return [];
  return Object.values(value);
}

function tick(watchers: AlfaWatcher[]): void {
  const now = Date.now();

  if (LOAD_GATE > 0) {
    const load1 = loadavg()[0];
    if (load1 >= LOAD_GATE) {
      logger.warn("Patrol gated: host load high, suppressing nudges", {
        source: "patrol",
        load1: Number(load1.toFixed(2)),
        gate: LOAD_GATE,
      });
      return;
    }
  }

  const liveIds = new Set(terminalManager.peekSessions().map((session) => session.id));
  const wantedKeys = new Set<string>();

  for (const watcher of watchers) {
    if (!liveIds.has(watcher.id)) continue; // alfa pane gone
    for (const sessionId of watcher.watchedSessionIds) {
      if (!liveIds.has(sessionId)) continue;
      const key = keyOf(watcher.id, sessionId);
      wantedKeys.add(key);

      const target = terminalManager.peekSession(sessionId);
      if (!target) continue;
      if (target.status !== "running") continue;

      const ageMs = now - target.updated_at;
      const state = stateByKey.get(key) ?? {};
      const previousUpdatedAt = state.lastSeenUpdatedAt;
      state.lastSeenUpdatedAt = target.updated_at;

      // Reset emitted state once new output arrives.
      if (
        state.lastEmittedKind &&
        previousUpdatedAt !== undefined &&
        target.updated_at > previousUpdatedAt
      ) {
        state.lastEmittedKind = undefined;
      }

      const silenceThreshold = watcher.silenceThresholdMs ?? DEFAULT_SILENCE_MS;
      const cooldownExpired =
        state.lastEmittedAt === undefined || now - state.lastEmittedAt >= COOLDOWN_MS;

      let kindToEmit: EventKind | null = null;
      if (ageMs >= silenceThreshold) {
        kindToEmit = "waiting";
      } else if (
        previousUpdatedAt !== undefined &&
        ageMs >= DONE_QUIET_MS &&
        ageMs < DONE_BURST_AGE_MS &&
        previousUpdatedAt !== target.updated_at - 1 // sanity
      ) {
        // Transient quiet right after a burst — likely task finished. Only
        // emit once before silence escalates to `waiting`.
        if (state.lastEmittedKind !== "done") kindToEmit = "done";
      }

      if (!kindToEmit) {
        stateByKey.set(key, state);
        continue;
      }
      if (state.lastEmittedKind === kindToEmit) {
        stateByKey.set(key, state);
        continue;
      }
      if (!cooldownExpired) {
        stateByKey.set(key, state);
        continue;
      }

      enqueuePing({
        alfaId: watcher.id,
        sessionId,
        title: target.title,
        prompt: promptFor(watcher, sessionId),
        activityState: kindToEmit,
        firedAt: now,
      });
      state.lastEmittedKind = kindToEmit;
      state.lastEmittedAt = now;
      stateByKey.set(key, state);
    }
  }

  // Drop tracking for keys whose watcher/target disappeared.
  for (const key of Array.from(stateByKey.keys())) {
    if (!wantedKeys.has(key)) stateByKey.delete(key);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPatrolScheduler(): void {
  if (timer) return;
  logger.info("Patrol scheduler starting", { source: "patrol" });
  timer = setInterval(() => {
    void loadWatchers()
      .then(tick)
      .catch((err) => {
        logger.warn("Patrol tick failed", { source: "patrol", error: String(err) });
      });
  }, TICK_MS);
}

export function stopPatrolScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
