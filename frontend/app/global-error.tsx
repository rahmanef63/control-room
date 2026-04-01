'use client';

import { useEffect } from 'react';

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /loading chunk [\d]+ failed/i.test(error.message) ||
    /failed to fetch dynamically imported module/i.test(error.message)
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isChunkLoadError(error)) return;

    // A stale HTML page is referencing chunks that no longer exist after a
    // redeploy. Clear the SW navigation cache and hard-reload to fetch fresh
    // HTML containing the correct chunk hashes. Guard with sessionStorage so
    // we only auto-reload once (avoid infinite reload loops).
    const key = 'chunk-reload';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    if ('caches' in window) {
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((n) => !n.startsWith('vps-static'))
            .map((n) => caches.delete(n))
        )
      ).then(() => window.location.reload());
    } else {
      window.location.reload();
    }
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="pwa-safe-shell bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
          <div className="space-y-2">
            <p className="dashboard-label">Critical error</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Something went wrong
            </h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred in the control room.'}
            </p>
            {error.digest && (
              <p className="font-mono text-xs text-muted-foreground/60">
                Digest: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('chunk-reload');
              if (isChunkLoadError(error)) {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="dashboard-action-link"
            data-tone="primary"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
