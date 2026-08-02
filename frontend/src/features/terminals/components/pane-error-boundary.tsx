'use client';

import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/shared/components/error-boundary';

// Wraps a terminal pane so a render/xterm crash shows recoverable UI instead of
// silently unmounting the pane (AUDIT §2). The pty itself keeps running on the
// agent, so "Reload pane" reconnects to the same live session.
export function PaneErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ reset }) => (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[calc(var(--radius)+0.25rem)] border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">This pane crashed</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            The terminal view hit an error. The session is still alive on the agent — reload to
            reconnect.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Reload pane
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
