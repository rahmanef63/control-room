// Patrol ping queue — in-memory, agent-owned.
// Replaces the prior browser-fired queue. Lost on agent restart by design:
// the scheduler re-emits on the next tick if targets still meet criteria.

import { randomUUID } from "crypto";

import type { PatrolPing } from "../../../packages/contracts/index.js";

export type { PatrolPing };

const MAX_QUEUE = 200;
const ACK_TTL_MS = 10 * 60 * 1000;

const store: PatrolPing[] = [];

function prune(): void {
  const now = Date.now();
  const kept = store.filter(
    (ping) => !ping.acknowledged || now - (ping.acknowledgedAt ?? 0) < ACK_TTL_MS,
  );
  if (kept.length !== store.length) {
    store.length = 0;
    store.push(...kept.slice(-MAX_QUEUE));
  } else if (store.length > MAX_QUEUE) {
    store.splice(0, store.length - MAX_QUEUE);
  }
}

export function enqueuePing(
  input: Omit<PatrolPing, "id" | "enqueuedAt" | "acknowledged" | "acknowledgedAt">,
): PatrolPing {
  prune();
  const ping: PatrolPing = {
    ...input,
    id: randomUUID(),
    enqueuedAt: Date.now(),
    acknowledged: false,
  };
  store.push(ping);
  return ping;
}

export function listPings(opts?: {
  onlyPending?: boolean;
  since?: number;
  sessionId?: string;
  alfaId?: string;
}): PatrolPing[] {
  prune();
  let queue = store.slice();
  if (opts?.onlyPending) queue = queue.filter((ping) => !ping.acknowledged);
  if (opts?.since !== undefined) queue = queue.filter((ping) => ping.enqueuedAt >= opts.since!);
  if (opts?.sessionId) queue = queue.filter((ping) => ping.sessionId === opts.sessionId);
  if (opts?.alfaId) queue = queue.filter((ping) => ping.alfaId === opts.alfaId);
  return queue;
}

export function acknowledgePing(id: string): PatrolPing | undefined {
  const ping = store.find((entry) => entry.id === id);
  if (!ping) return undefined;
  if (!ping.acknowledged) {
    ping.acknowledged = true;
    ping.acknowledgedAt = Date.now();
  }
  return ping;
}
