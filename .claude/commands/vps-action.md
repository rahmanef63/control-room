# VPS Control Room — Action Pattern

Use this pattern only when a frontend interaction needs **terminal-adjacent** host behavior (for example bounded file/cwd/state support). If the action is provider management, generic service orchestration, deployment of another project, scheduling, or browser automation, it is out of Control Room core.

## Boundary

```text
Svelte component
  -> authenticated SvelteKit `+server.ts` route
  -> `$lib/server/gateway` / `proxyGatewayJson`
  -> authenticated Node agent endpoint
  -> host operation
```

Never execute filesystem/shell/host operations directly from browser code or a frontend component. Keep the agent surface minimal and do not create a generic host-exec endpoint.

## Frontend component

Keep UI state local and explicit:

```svelte
<script lang="ts">
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function runAction() {
    busy = true;
    error = null;
    try {
      const response = await fetch('/api/example/action', { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busy = false;
    }
  }
</script>
```

Sensitive/destructive actions need a clear confirmation UX and must remain inaccessible to unauthenticated requests.

## SvelteKit server route

```ts
import type { RequestHandler } from './$types';
import { proxyGatewayJson } from '$lib/server/proxy';
import { requireSession } from '$lib/server/require-session';

export const POST: RequestHandler = async (event) => {
  const denied = await requireSession(event);
  if (denied) return denied;
  return proxyGatewayJson('/example/action', { method: 'POST' });
};
```

Validate user-controlled input before forwarding it. Do not put gateway credentials in browser-visible code.

## Agent endpoint

- Re-authenticate the gateway secret at the agent boundary.
- Validate input and path/target constraints.
- Implement a dedicated bounded operation for the terminal helper; do not invent a second or generic shell-execution pathway.
- Log useful audit metadata without secrets.
- Return bounded, structured errors.

## Verification

Test unauthorized access, successful execution, expected failure, repeated clicks/idempotency where relevant, and UI recovery. Then run the owning frontend/agent quality gates from `CLAUDE.md`.
