'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  CronCreateInput,
  CronEntry,
  CronUpdateInput,
} from '@/features/crons/types';

export interface UseCronsResult {
  crons: CronEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCron: (input: CronCreateInput) => Promise<CronEntry | null>;
  updateCron: (id: string, input: CronUpdateInput) => Promise<CronEntry | null>;
  deleteCron: (id: string) => Promise<boolean>;
  runCron: (id: string) => Promise<void>;
}

export function useCrons(enabled: boolean): UseCronsResult {
  const [crons, setCrons] = useState<CronEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCrons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/crons');
      const payload = (await response.json()) as { crons?: CronEntry[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Failed to load crons');
      setCrons(payload.crons ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crons');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchCrons();
  }, [enabled, fetchCrons]);

  const createCron = useCallback(
    async (input: CronCreateInput): Promise<CronEntry | null> => {
      setError(null);
      try {
        const response = await fetch('/api/crons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const payload = (await response.json()) as { cron?: CronEntry; error?: string };
        if (!response.ok || !payload.cron) {
          throw new Error(payload.error || 'Failed to create cron');
        }
        setCrons((current) => [...current, payload.cron!]);
        return payload.cron;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create cron');
        return null;
      }
    },
    []
  );

  const updateCron = useCallback(
    async (id: string, input: CronUpdateInput): Promise<CronEntry | null> => {
      setError(null);
      try {
        const response = await fetch(`/api/crons/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const payload = (await response.json()) as { cron?: CronEntry; error?: string };
        if (!response.ok || !payload.cron) {
          throw new Error(payload.error || 'Failed to update cron');
        }
        setCrons((current) =>
          current.map((entry) => (entry.id === id ? payload.cron! : entry))
        );
        return payload.cron;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update cron');
        return null;
      }
    },
    []
  );

  const deleteCron = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      const response = await fetch(`/api/crons/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (response.status !== 204 && !response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || 'Failed to delete cron');
      }
      setCrons((current) => current.filter((entry) => entry.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cron');
      return false;
    }
  }, []);

  const runCron = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      const response = await fetch(`/api/crons/${encodeURIComponent(id)}/run`, {
        method: 'POST',
      });
      const payload = (await response.json()) as { cron?: CronEntry; error?: string };
      if (!response.ok || !payload.cron) {
        throw new Error(payload.error || 'Failed to run cron');
      }
      setCrons((current) =>
        current.map((entry) => (entry.id === id ? payload.cron! : entry))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run cron');
    }
  }, []);

  return {
    crons,
    loading,
    error,
    refresh: fetchCrons,
    createCron,
    updateCron,
    deleteCron,
    runCron,
  };
}
