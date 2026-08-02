'use client';

// Mounts the shell layer: detects the platform once on the client, stamps
// data-os / data-display-mode / data-touch on <html> (so tokens.css can branch
// with zero JS), and owns the active theme. Additive and non-breaking — feature
// screens are untouched.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { detectPlatform, SERVER_DEFAULT, type Platform } from './detect';
import {
  applyTheme,
  applyOsSkin,
  getStoredTheme,
  getStoredOsSkin,
  storeTheme,
  storeOsSkin,
  type ResolvedTheme,
  type ThemeChoice,
} from './theme';
import type { OS } from './detect';

interface PlatformContextValue {
  platform: Platform;
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (choice: ThemeChoice) => void;
  osSkin: boolean;
  setOsSkin: (on: boolean) => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [platform, setPlatform] = useState<Platform>(SERVER_DEFAULT);
  const [theme, setThemeState] = useState<ThemeChoice>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [osSkin, setOsSkinState] = useState(false);

  // Detect platform + hydrate the stored appearance once on the client.
  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);

    const root = document.documentElement;
    root.dataset.os = detected.os;
    root.dataset.displayMode = detected.displayMode;
    root.dataset.touch = String(detected.isTouch);

    const stored = getStoredTheme();
    setThemeState(stored);
    setResolvedTheme(applyTheme(stored));

    const skin = getStoredOsSkin();
    setOsSkinState(skin);
    applyOsSkin(skin);
  }, []);

  // When following the system, react to OS light/dark changes live.
  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setResolvedTheme(applyTheme('system'));
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  const value = useMemo<PlatformContextValue>(
    () => ({
      platform,
      theme,
      resolvedTheme,
      setTheme: (choice: ThemeChoice) => {
        setThemeState(choice);
        storeTheme(choice);
        setResolvedTheme(applyTheme(choice));
      },
      osSkin,
      setOsSkin: (on: boolean) => {
        setOsSkinState(on);
        storeOsSkin(on);
        applyOsSkin(on);
      },
    }),
    [platform, theme, resolvedTheme, osSkin],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

function usePlatformContext(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  // Tolerate use outside the provider (e.g. isolated tests) with safe defaults.
  return (
    ctx ?? {
      platform: SERVER_DEFAULT,
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: () => {},
      osSkin: false,
      setOsSkin: () => {},
    }
  );
}

export function usePlatform(): Platform {
  return usePlatformContext().platform;
}

export function useTheme(): {
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (choice: ThemeChoice) => void;
} {
  const { theme, resolvedTheme, setTheme } = usePlatformContext();
  return { theme, resolvedTheme, setTheme };
}

// Everything the Appearance UI needs: detected OS (for labelling), theme, and the
// opt-in per-OS skin toggle.
export function useAppearance(): {
  os: OS;
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (choice: ThemeChoice) => void;
  osSkin: boolean;
  setOsSkin: (on: boolean) => void;
} {
  const { platform, theme, resolvedTheme, setTheme, osSkin, setOsSkin } = usePlatformContext();
  return { os: platform.os, theme, resolvedTheme, setTheme, osSkin, setOsSkin };
}
