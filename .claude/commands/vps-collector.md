# VPS Control Room — Agent Collector Pattern

Use this pattern for host telemetry/collector work under `agent/`.

## Principles

- Collectors run in the Node 22 agent, never in the frontend.
- One collector failure must not terminate the agent or block unrelated collectors.
- Keep collection bounded in time/output and avoid unbounded process spawning.
- Prefer existing host abstractions/utilities over duplicate shell wrappers.
- Persist shared durable state through the existing agent JSON/state layer when persistence is required.
- Never add a database dependency just to expose collector output to the UI.

## Shape

```ts
export async function collectExample(): Promise<ExampleSnapshot | null> {
  try {
    // Gather bounded host data using the existing collector/exec helpers.
    return snapshot;
  } catch (error) {
    // Log a bounded diagnostic; never include secrets/environment dumps.
    return null;
  }
}
```

## Frontend exposure

Expose collector results through an authenticated agent HTTP endpoint and the corresponding SvelteKit proxy route. The browser must not access privileged host interfaces directly.

## Verification

- success path
- unavailable dependency/path returns a safe empty/null result
- timeout/failure does not terminate agent
- output shape remains stable
- gateway endpoint rejects unauthenticated requests

Then run:

```bash
bun run --cwd agent test:all
bun run --cwd agent build
git diff --check
```
