import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <p className="dashboard-label">404</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          This route doesn't exist in the control room.
        </p>
      </div>
      <Link
        href="/"
        className="dashboard-action-link"
        data-tone="primary"
      >
        Back to overview
      </Link>
    </div>
  );
}
