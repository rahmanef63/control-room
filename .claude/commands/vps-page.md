# VPS Control Room — Dashboard Page Pattern

Gunakan skill ini saat membuat atau memodifikasi halaman dashboard.

## File Structure per Page

```
frontend/app/(dashboard)/<pageName>/
  ├── page.tsx       # main page component
  └── error.tsx      # error boundary (WAJIB)
```

## Page Template

```tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
// import components sesuai kebutuhan

export default function PageNamePage() {
  const data = useQuery(api.<domain>.listItems, {});

  // Loading state
  if (data === undefined) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Page Title</h1>
        <div className="grid gap-4">
          {/* Skeleton loading */}
          <div className="h-32 rounded-sm bg-muted animate-pulse" />
          <div className="h-32 rounded-sm bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Page Title</h1>
        <div className="flex items-center justify-center h-64 rounded-sm border border-dashed">
          <p className="text-muted-foreground">No data available.</p>
        </div>
      </div>
    );
  }

  // Data state
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Page Title</h1>
      {/* Render data */}
    </div>
  );
}
```

## Error Boundary Template (WAJIB untuk setiap page)

```tsx
"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <p className="text-destructive">Something went wrong loading this panel.</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
```

## Dashboard Layout Pattern

```tsx
// frontend/app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/Sidebar";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { ConvexProvider } from "@/lib/convex";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6">
          <ConnectionStatus />
          {children}
        </main>
      </div>
    </ConvexProvider>
  );
}
```

## Component Patterns

**MetricCard**: `{ label: string, value: string | number, unit?: string, trend?: "up" | "down" | "stable" }`
**StatusBadge**: `{ status: string, label?: string }` — green=running/healthy, yellow=warning, red=error/stopped, gray=unknown
**ConfirmActionDialog**: WAJIB untuk sensitive actions (container.stop, dokploy.redeploy, fail2ban.unban)

## Convex Subscription di Page

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";

// Query (auto-subscribe, live update)
const data = useQuery(api.appStatus.listApps, {});

// Mutation (untuk trigger action)
const enqueueCommand = useMutation(api.commands.enqueueCommand);

// Trigger action
async function handleRestart(targetId: string) {
  await enqueueCommand({
    action: "container.restart",
    target_type: "container",
    target_id: targetId,
    requested_by: "manual-dashboard",
  });
}
```

## Rules

- SELALU buat error.tsx untuk setiap page folder.
- SELALU handle 3 state: loading (skeleton), empty, data.
- JANGAN fetch data di server component — semua data lewat Convex subscription (client component).
- JANGAN taruh host command di frontend — tulis command ke Convex, agent yang eksekusi.
- Gunakan shadcn/ui components dari `@/components/ui/`.
