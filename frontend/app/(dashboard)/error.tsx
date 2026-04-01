'use client';

import { useEffect } from 'react';

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /loading chunk [\d]+ failed/i.test(error.message) ||
    /failed to fetch dynamically imported module/i.test(error.message)
  );
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!isChunkLoadError(error)) return;
    const key = 'chunk-reload';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    window.location.reload();
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={() => {
          sessionStorage.removeItem('chunk-reload');
          if (isChunkLoadError(error)) {
            window.location.reload();
          } else {
            reset();
          }
        }}
        className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
