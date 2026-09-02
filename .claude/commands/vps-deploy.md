# VPS Control Room — Deploy Pattern

`scripts/deploy.sh` is the deployment SSOT. Do not invent a parallel deployment path in an agent command.

The bundled production route currently targets the repository's Dokploy/Traefik dynamic-config layout; another reverse proxy needs an intentional adaptation rather than copied paths.

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
3. prepares canonical runtime/state/env locations;
4. verifies frontend check/lint/coverage/audit/Playwright/build/bundle budget;
5. verifies/builds an immutable agent release only when agent source changed or no valid deployed agent exists;
6. stages immutable frontend + agent releases and records the previous pair;
7. refreshes the canonical systemd units;
8. switches and verifies the agent when required;
9. switches and verifies the frontend;
10. publishes/verifies the frontend-only Traefik route;
11. restores the previous frontend + agent pair (and previous proxy config when needed) if candidate verification fails;
12. records success and prunes stale inactive releases/uploads.

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
