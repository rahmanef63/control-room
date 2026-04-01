'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            onClick={reset}
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
