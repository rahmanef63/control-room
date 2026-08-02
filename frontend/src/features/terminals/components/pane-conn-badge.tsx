'use client';

import type { ConnectionState } from '@/features/terminals/lib/utils';

// Header status chip: SSE link state + live input round-trip latency. Gives the
// user a direct read on "is typing lag the connection or the box". RTT is the
// EWMA of input-POST round-trips (browser → agent ack); null until first key.
export function ConnLatencyBadge({
  state,
  rttMs,
}: {
  state: ConnectionState;
  rttMs: number | null;
}) {
  const dot =
    state === 'connected'
      ? 'bg-emerald-400'
      : state === 'connecting' || state === 'reconnecting'
        ? 'bg-amber-400 animate-pulse'
        : 'bg-rose-500';
  // Color the number by perceived snappiness, not by link state.
  const rttColor =
    rttMs === null
      ? 'text-muted-foreground'
      : rttMs < 80
        ? 'text-emerald-300'
        : rttMs < 200
          ? 'text-amber-300'
          : 'text-rose-300';
  const label =
    state === 'connected'
      ? 'Stream connected'
      : state === 'connecting'
        ? 'Connecting…'
        : state === 'reconnecting'
          ? 'Reconnecting…'
          : 'Disconnected';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/40 px-1.5 py-0.5 text-[10px] tabular-nums"
      title={`${label}${rttMs === null ? '' : ` · input round-trip ~${rttMs}ms`}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className={rttColor}>{rttMs === null ? '—' : `${rttMs}ms`}</span>
    </span>
  );
}
