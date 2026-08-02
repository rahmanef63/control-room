'use client';

import { useCallback, useEffect, useState } from 'react';

import { readLocal, writeLocal } from '@/features/terminals/lib/local-storage';
import {
  APP_SETTINGS_STORAGE_KEY,
  SOFT_KEYBOARD_KEYS,
  type SoftKeyboardKey,
} from '@/features/terminals/lib/utils';

export interface NotificationSettings {
  /** Pulse an outer-glow ring on the pane while the agent is working. */
  heartbeatGlow: boolean;
}

export interface SoftKeyboardSettings {
  visibility: Record<SoftKeyboardKey, boolean>;
  /** Show keyboard in grid (show-all) view. Mobile defaults true via media query, desktop default = this. */
  showInGrid: boolean;
  /** Master hide override — when true, hide keyboard everywhere. */
  hideKeyboard: boolean;
}

export interface AppSettings {
  notifications: NotificationSettings;
  softKeyboard: SoftKeyboardSettings;
}

function defaultVisibility(): Record<SoftKeyboardKey, boolean> {
  const map = {} as Record<SoftKeyboardKey, boolean>;
  for (const key of SOFT_KEYBOARD_KEYS) {
    map[key.id] = true;
  }
  return map;
}

const DEFAULT_SETTINGS: AppSettings = {
  notifications: {
    heartbeatGlow: true,
  },
  softKeyboard: {
    visibility: defaultVisibility(),
    showInGrid: false,
    hideKeyboard: false,
  },
};

function readSettings(): AppSettings {
  const parsed = readLocal<Partial<AppSettings> | null>(APP_SETTINGS_STORAGE_KEY, null);
  return parsed ? mergeSettings(parsed) : DEFAULT_SETTINGS;
}

function mergeSettings(input: Partial<AppSettings>): AppSettings {
  const visibility = { ...defaultVisibility(), ...(input.softKeyboard?.visibility ?? {}) };
  return {
    notifications: { ...DEFAULT_SETTINGS.notifications, ...(input.notifications ?? {}) },
    softKeyboard: {
      visibility,
      showInGrid: input.softKeyboard?.showInGrid ?? DEFAULT_SETTINGS.softKeyboard.showInGrid,
      hideKeyboard: input.softKeyboard?.hideKeyboard ?? DEFAULT_SETTINGS.softKeyboard.hideKeyboard,
    },
  };
}

function writeSettings(settings: AppSettings): void {
  writeLocal(APP_SETTINGS_STORAGE_KEY, settings);
}

export interface UseAppSettingsResult {
  settings: AppSettings;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  updateSoftKeyboard: (patch: Partial<SoftKeyboardSettings>) => void;
  setSoftKeyVisible: (key: SoftKeyboardKey, visible: boolean) => void;
  toggleGridKeyboard: () => void;
  toggleHideKeyboard: () => void;
  resetDefaults: () => void;
}

export function useAppSettings(): UseAppSettingsResult {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeSettings(settings);
  }, [settings, hydrated]);

  const updateNotifications = useCallback((patch: Partial<NotificationSettings>) => {
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, ...patch },
    }));
  }, []);

  const updateSoftKeyboard = useCallback((patch: Partial<SoftKeyboardSettings>) => {
    setSettings((current) => ({
      ...current,
      softKeyboard: { ...current.softKeyboard, ...patch },
    }));
  }, []);

  const setSoftKeyVisible = useCallback((key: SoftKeyboardKey, visible: boolean) => {
    setSettings((current) => ({
      ...current,
      softKeyboard: {
        ...current.softKeyboard,
        visibility: { ...current.softKeyboard.visibility, [key]: visible },
      },
    }));
  }, []);

  const toggleGridKeyboard = useCallback(() => {
    setSettings((current) => ({
      ...current,
      softKeyboard: { ...current.softKeyboard, showInGrid: !current.softKeyboard.showInGrid },
    }));
  }, []);

  const toggleHideKeyboard = useCallback(() => {
    setSettings((current) => ({
      ...current,
      softKeyboard: { ...current.softKeyboard, hideKeyboard: !current.softKeyboard.hideKeyboard },
    }));
  }, []);

  const resetDefaults = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  return {
    settings,
    updateNotifications,
    updateSoftKeyboard,
    setSoftKeyVisible,
    toggleGridKeyboard,
    toggleHideKeyboard,
    resetDefaults,
  };
}
