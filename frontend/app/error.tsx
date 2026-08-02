'use client';

export default function FeatureError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dashboard-page flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || 'An unexpected error occurred in this section.'}
      </p>
      <button
        onClick={reset}
        className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Try again
      </button>
    </div>
  );
}
