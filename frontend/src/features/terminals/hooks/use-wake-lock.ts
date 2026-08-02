'use client';

import { useEffect, useRef } from 'react';

interface WakeLockSentinel {
  release: () => Promise<void>;
  released: boolean;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface NavigatorWakeLock {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>;
  };
}

export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & NavigatorWakeLock;
    if (!nav.wakeLock) return;

    let cancelled = false;

    async function acquire() {
      try {
        const sentinel = await nav.wakeLock!.request('screen');
        if (cancelled) {
          await sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        // ignore — WakeLock may be denied
      }
    }

    async function release() {
      if (!sentinelRef.current) return;
      try {
        await sentinelRef.current.release();
      } catch {
        // ignore
      }
      sentinelRef.current = null;
    }

    if (active) {
      void acquire();
    } else {
      void release();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && active && !sentinelRef.current) {
        void acquire();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void release();
    };
  }, [active]);
}
