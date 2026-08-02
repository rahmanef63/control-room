'use client';

import { useCallback, useEffect, useState } from 'react';

import { readLocal, writeLocal } from '@/features/terminals/lib/local-storage';
import { PANE_AGENT_OVERRIDES_STORAGE_KEY } from '@/features/terminals/lib/utils';

export interface PaneAgentOverride {
  agentProfileId: string;
  boundAt: number;
}

export type PaneAgentOverrides = Record<string, PaneAgentOverride>;

const readStored = (): PaneAgentOverrides =>
  readLocal<PaneAgentOverrides>(PANE_AGENT_OVERRIDES_STORAGE_KEY, {});
const writeStored = (value: PaneAgentOverrides): void =>
  writeLocal(PANE_AGENT_OVERRIDES_STORAGE_KEY, value);

export interface UsePaneAgentOverridesResult {
  overrides: PaneAgentOverrides;
  bindAgent: (sessionId: string, agentProfileId: string) => void;
  clearOverride: (sessionId: string) => void;
  agentOverrideOf: (sessionId: string) => PaneAgentOverride | undefined;
  pruneTo: (liveSessionIds: string[]) => void;
}

export function usePaneAgentOverrides(): UsePaneAgentOverridesResult {
  const [overrides, setOverrides] = useState<PaneAgentOverrides>({});

  useEffect(() => {
    setOverrides(readStored());
  }, []);

  const bindAgent = useCallback((sessionId: string, agentProfileId: string) => {
    setOverrides((current) => {
      const next: PaneAgentOverrides = {
        ...current,
        [sessionId]: { agentProfileId, boundAt: Date.now() },
      };
      writeStored(next);
      return next;
    });
  }, []);

  const clearOverride = useCallback((sessionId: string) => {
    setOverrides((current) => {
      if (!(sessionId in current)) return current;
      const next = { ...current };
      delete next[sessionId];
      writeStored(next);
      return next;
    });
  }, []);

  const agentOverrideOf = useCallback(
    (sessionId: string) => overrides[sessionId],
    [overrides]
  );

  const pruneTo = useCallback((liveSessionIds: string[]) => {
    const liveSet = new Set(liveSessionIds);
    setOverrides((current) => {
      const next: PaneAgentOverrides = {};
      let changed = false;
      for (const [id, value] of Object.entries(current)) {
        if (liveSet.has(id)) next[id] = value;
        else changed = true;
      }
      if (!changed) return current;
      writeStored(next);
      return next;
    });
  }, []);

  return { overrides, bindAgent, clearOverride, agentOverrideOf, pruneTo };
}
