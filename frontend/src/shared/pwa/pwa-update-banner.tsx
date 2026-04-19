'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw, X } from 'lucide-react';

export function PwaUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('sw:updateavailable', handler);
    return () => window.removeEventListener('sw:updateavailable', handler);
  }, []);

  if (!visible) return null;

  function handleUpdate() {
    setReloading(true);
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
      })
      .catch(() => {
        // fallback: just reload
      })
      .finally(() => {
        window.location.reload();
      });
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-cyan-400/20 bg-card/95 px-4 py-3 shadow-[0_16px_48px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-cyan-400/12 text-cyan-300">
        <RefreshCcw className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Update available</p>
        <p className="text-xs text-muted-foreground">Reload to get the latest version.</p>
      </div>
      <button
        onClick={handleUpdate}
        disabled={reloading}
        className="shrink-0 rounded-xl border border-cyan-400/25 bg-cyan-400/12 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20 disabled:opacity-60"
      >
        {reloading ? 'Reloading…' : 'Reload'}
      </button>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss update notification"
        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
