'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCcw, X } from 'lucide-react';

import { forceFreshReload } from '@/shared/runtime/force-fresh-reload';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const FOCUS_DEBOUNCE_MS = 30 * 1000;

const BAKED_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'unknown';
const DISMISS_STORAGE_KEY = 'vps-cr-vguard-dismissed';

async function fetchServerBuildId(): Promise<string | null> {
  try {
    const res = await fetch('/api/version', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as { buildId?: string };
    return json.buildId ?? null;
  } catch {
    return null;
  }
}

export function VersionGuard() {
  const [latest, setLatest] = useState<string | null>(null);
  const [dismissedBuild, setDismissedBuild] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const check = useCallback(async () => {
    const v = await fetchServerBuildId();
    if (!v || v === 'unknown') return;
    setLatest(v);
  }, []);

  useEffect(() => {
    if (BAKED_BUILD_ID === 'unknown') return; // dev — skip

    let lastPolledAt = 0;
    void check();
    lastPolledAt = Date.now();

    const interval = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastPolledAt < FOCUS_DEBOUNCE_MS) return;
      lastPolledAt = Date.now();
      void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [check]);

  // Persist dismissal per build id so a reload — and any other open tab —
  // stops re-nagging for the same version (AUDIT §3).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (stored) setDismissedBuild(stored);
    } catch {
      /* storage blocked */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISMISS_STORAGE_KEY) setDismissedBuild(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const stale =
    !!latest &&
    latest !== BAKED_BUILD_ID &&
    BAKED_BUILD_ID !== 'unknown' &&
    latest !== dismissedBuild;
  if (!stale) return null;

  async function handleRefresh() {
    setWorking(true);
    await forceFreshReload();
  }

  function handleDismiss() {
    setDismissedBuild(latest);
    try {
      if (latest) localStorage.setItem(DISMISS_STORAGE_KEY, latest);
    } catch {
      /* storage blocked */
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[110] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-400/30 bg-card/95 px-4 py-3 shadow-[0_16px_48px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
        <RefreshCcw className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">New version available</p>
        <p className="text-xs text-muted-foreground">Hard-refresh to clear cache &amp; storage.</p>
      </div>
      <button
        onClick={() => void handleRefresh()}
        disabled={working}
        className="shrink-0 rounded-xl border border-amber-400/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/25 disabled:opacity-60"
      >
        {working ? 'Cleaning…' : 'Refresh'}
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
