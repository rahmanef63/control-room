'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PatrolPing } from '@/shared/types/contracts';

export type { PatrolPing };

interface UsePatrolPingsOptions {
  enabled: boolean;
  intervalMs?: number;
}

export interface UsePatrolPingsResult {
  pings: PatrolPing[];
  pendingCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  acknowledge: (id: string) => Promise<void>;
}

export function usePatrolPings({
  enabled,
  intervalMs = 8000,
}: UsePatrolPingsOptions): UsePatrolPingsResult {
  const [pings, setPings] = useState<PatrolPing[]>([]);
  const [loading, setLoading] = useState(false);
  const inflightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/patrol/pending?all=1', { cache: 'no-store' });
      if (!response.ok) return;
      const payload = (await response.json()) as { pings?: PatrolPing[] };
      setPings(payload.pings ?? []);
    } catch {
      // network blip; will retry next tick
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, refresh]);

  const acknowledge = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/patrol/pending/${encodeURIComponent(id)}/ack`, { method: 'POST' });
        void refresh();
      } catch {
        // ignore; retry by manual refresh
      }
    },
    [refresh]
  );

  const pendingCount = pings.filter((ping) => !ping.acknowledged).length;

  return { pings, pendingCount, loading, refresh, acknowledge };
}
