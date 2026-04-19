'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadForChunkError } from '@/shared/runtime/chunk-load-recovery';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkLoadFailed = isChunkLoadError(error);

  useEffect(() => {
    if (chunkLoadFailed) {
      reloadForChunkError();
    }
  }, [chunkLoadFailed]);

  return (
    <html lang="en" className="dark">
      <body className="pwa-safe-shell bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
          <div className="space-y-2">
            <p className="dashboard-label">Critical error</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {chunkLoadFailed ? 'App update required' : 'Something went wrong'}
            </h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              {chunkLoadFailed
                ? 'This tab is using an older build. Reload to sync the latest app files.'
                : error.message || 'An unexpected error occurred in the control room.'}
            </p>
            {error.digest && (
              <p className="font-mono text-xs text-muted-foreground/60">
                Digest: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (chunkLoadFailed) {
                window.location.reload();
                return;
              }

              reset();
            }}
            className="dashboard-action-link"
            data-tone="primary"
          >
            {chunkLoadFailed ? 'Reload app' : 'Try again'}
          </button>
        </div>
      </body>
    </html>
  );
}
