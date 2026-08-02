'use client';

import { useCallback, useEffect, useState } from 'react';

export interface UseFullscreenResult {
  isFullscreen: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const enter = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch {
      // Fall through — CSS layer handles fallback
    }
    setIsFullscreen(true);
  }, []);

  const exit = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    } catch {
      // ignore
    }
    setIsFullscreen(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isFullscreen) {
      await exit();
    } else {
      await enter();
    }
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}
