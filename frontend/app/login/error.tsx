'use client';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-lg font-semibold text-destructive">Login unavailable</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || 'Something went wrong loading the sign-in screen.'}
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
