# VPS Control Room — Svelte Page Pattern

Use this pattern for new frontend pages or substantial page refactors. Root `CLAUDE.md` remains the SSOT.

## Location

```text
frontend/src/routes/<route>/+page.svelte
frontend/src/routes/<route>/+page.server.ts     # only when server-side page loading is useful
frontend/src/routes/<route>/+error.svelte       # when route-level recovery needs custom UX
frontend/src/lib/features/<feature>/            # reusable feature logic/components
```

Do not build large feature logic directly into `+page.svelte`; keep the route as orchestration and place domain logic in a vertical slice.

## Svelte 5 state

```svelte
<script lang="ts">
  let loading = $state(true);
  let error = $state<string | null>(null);
  let items = $state<Item[]>([]);
  let count = $derived(items.length);

  async function refresh() {
    loading = true;
    error = null;
    try {
      const response = await fetch('/api/example');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      items = await response.json();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }
</script>
```

Use `$props()`, `$state`, `$derived`, `$effect`, and snippets. Do not introduce legacy component syntax or shared writable/readable stores.

## Data boundary

Frontend pages talk to authenticated SvelteKit server routes. Those server routes may proxy to the Node agent through `$lib/server/gateway`. Host access never occurs in the page/component itself.

For privileged proxy routes:

```ts
const denied = await requireSession(event);
if (denied) return denied;
return proxyGatewayJson('/some-agent-path');
```

Terminal live output is a special case: browser SSE is bridged server-side to the agent WebSocket. Do not invent a direct browser-to-agent socket.

## UX states

Every async surface should deliberately handle:

1. loading
2. empty
3. data
4. recoverable error

Use route-level `+error.svelte` for route failures and `<svelte:boundary>` when a local component/pane should fail independently.

## Responsive rules

Respect `src/app.css` safe-area variables and `100dvh` conventions. Test narrow portrait, landscape, and touch-target/focus behavior for interactive pages.

## Gate

```bash
bun run --cwd frontend check
bun run --cwd frontend test
bun run --cwd frontend build
git diff --check
```
