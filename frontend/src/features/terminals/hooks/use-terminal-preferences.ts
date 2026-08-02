'use client';

import { useCallback, useEffect, useState } from 'react';

import { readLocal, writeLocal } from '@/features/terminals/lib/local-storage';
import {
  clampFontSize,
  FONT_SIZE_STORAGE_KEY,
  GRID_COLS_STORAGE_KEY,
  VIEW_MODE_STORAGE_KEY,
} from '@/features/terminals/lib/utils';

export type ViewMode = 'single' | 'grid';
export type GridCols = 'auto' | '1' | '2' | '3' | '4';

const GRID_COL_VALUES: GridCols[] = ['auto', '1', '2', '3', '4'];

export interface TerminalPreferences {
  fontSizes: Record<string, number>;
  setFontSize: (id: string, size: number) => void;
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  gridCols: GridCols;
  setGridCols: React.Dispatch<React.SetStateAction<GridCols>>;
  broadcast: boolean;
  setBroadcast: React.Dispatch<React.SetStateAction<boolean>>;
  /** Session ids targeted by the broadcast dropdown. Empty set = legacy
   *  behaviour (broadcast to every running pane). Non-empty = scoped. */
  broadcastTargets: Set<string>;
  setBroadcastTargets: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useTerminalPreferences(): TerminalPreferences {
  const [fontSizes, setFontSizes] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [gridCols, setGridCols] = useState<GridCols>('auto');
  const [broadcast, setBroadcast] = useState(false);
  const [broadcastTargets, setBroadcastTargets] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // fontSizes is stored as JSON; clamp each entry on read.
    const parsed = readLocal<Record<string, number>>(FONT_SIZE_STORAGE_KEY, {});
    const cleaned: Record<string, number> = {};
    for (const [id, size] of Object.entries(parsed)) {
      cleaned[id] = clampFontSize(Number(size));
    }
    setFontSizes(cleaned);
    // viewMode / gridCols are stored as bare strings (not JSON) — read raw.
    try {
      const storedView = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (storedView === 'grid' || storedView === 'single') {
        setViewMode(storedView);
      }
      const storedCols = window.localStorage.getItem(GRID_COLS_STORAGE_KEY);
      if (storedCols && GRID_COL_VALUES.includes(storedCols as GridCols)) {
        setGridCols(storedCols as GridCols);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    writeLocal(FONT_SIZE_STORAGE_KEY, fontSizes);
  }, [fontSizes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GRID_COLS_STORAGE_KEY, gridCols);
    } catch {
      // ignore
    }
  }, [gridCols]);

  const setFontSize = useCallback((id: string, size: number) => {
    setFontSizes((current) => ({ ...current, [id]: clampFontSize(size) }));
  }, []);

  return {
    fontSizes,
    setFontSize,
    viewMode,
    setViewMode,
    gridCols,
    setGridCols,
    broadcast,
    setBroadcast,
    broadcastTargets,
    setBroadcastTargets,
  };
}
