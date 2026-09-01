# VPS Control Room — Deploy Pattern

`scripts/deploy.sh` is the deployment SSOT. Do not invent a parallel deployment path in an agent command.

## Preconditions

- Confirm the intended worktree/branch and current HEAD.
- Confirm whether the user permits remote GitHub changes. If not, use local worktree deployment mode and do not fetch/pull/push.
- Confirm `.env.local`, Traefik template, Bun, and systemd prerequisites exist.
- Frontend-only work must not restart the Node agent.

## Local gates

```bash
bun install --cwd frontend --frozen-lockfile
bun run --cwd frontend check
bun run --cwd frontend test
bun run --cwd frontend build
git diff --check
```

Run agent tests/build only if `agent/` changed:

```bash
bun install --cwd agent --frozen-lockfile
bun run --cwd agent test:all
bun run --cwd agent build
```

## Deployment model

The deploy script:

1. serializes deployments with a lock;
2. optionally fast-forwards a requested remote branch, or uses `DEPLOY_FROM_WORKTREE=1` for the current local tree;
3. builds the canonical SvelteKit frontend;
4. creates an immutable `frontend/releases/svelte-<timestamp>-<sha>/` release;
5. regenerates the Svelte-native systemd unit;
6. switches the frontend service to the new release;
7. verifies local health/login and restores the previous release automatically on failure;
8. restarts the agent only if agent source changed;
9. verifies/preserves agent PID on frontend-only deploys;
10. cleans stale inactive migration previews/releases only after a successful switch.

## Post-deploy verification

- public `/login` responds over HTTPS
- `/api/health` responds
- protected APIs still reject unauthenticated access
- HTML/assets are Svelte `/_app/immutable/` assets
- real xterm output arrives through SSE
- terminal input/resize/reconnect still works
- agent PID is unchanged for frontend-only work
- transient preview port/process is absent
- rollback release still exists

For UI work, include the relevant mobile/safe-area matrix. Never report GitHub CI as passing unless GitHub checks actually ran.
