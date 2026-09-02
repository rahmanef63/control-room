# VPS Control Room — Canonical Agent Instructions

## Project

- Repo: `git@github.com:rahmanef63/control-room.git`
- Production domain: `vps.rahmanef.com`
- Host target: Ubuntu 24.04, Bun build/package tooling, Node.js 22 agent runtime
- Package manager: Bun
- Frontend SSOT: `frontend/`
- Agent SSOT: `agent/`
- Deploy: `scripts/deploy.sh <branch>`; GitHub Actions is manual/workflow-dispatch only

## Architecture

```text
browser
  -> SvelteKit 2 / Svelte 5 frontend (:4000, adapter-node on Node 22 in production)
       -> ordinary agent APIs over authenticated HTTP
       -> terminal browser stream over SSE
       -> frontend server bridges SSE to the agent terminal WebSocket
  -> Node 22 host agent (:4001, loopback by default)
       -> node-pty, filesystem, telemetry, Docker/systemd/journal integrations
```

The agent is the only component with host access. The frontend never shells out directly and never exposes `AGENT_GATEWAY_SECRET` or `CONTROL_ROOM_SECRET` to browser JavaScript. Durable cross-browser state lives in agent-side JSON; UI-local state uses Svelte rune-backed modules and localStorage where appropriate. There is no Convex data layer on the hot path.

SI-Coder is the SSOT for provider identities, named connections and provider credentials. Control Room may expose SI-Coder status/management through the agent's secret-safe tool bridge, but must never create a parallel provider-secret store or read/serialize raw SI-Coder connection values. Direct credential creation/rotation must remain a secure terminal handoff.

## Non-negotiable frontend rules

- Use **SvelteKit 2 + Svelte 5 runes**.
- Use current Svelte event/property syntax. Do not introduce legacy `export let`, `$:`, `on:click`, `<slot>`, or writable/readable shared-store patterns.
- Prefer `$state`, `$derived`, `$effect`, snippets, component props via `$props()`, and rune-backed `.svelte.ts` state modules.
- Keep one frontend SSOT under `frontend/`; never create a compatibility frontend or framework placeholder directory.
- Use `lucide-svelte`, not React icon packages.
- Route APIs live under `frontend/src/routes/api/**/+server.ts`.
- Authentication is enforced globally by `src/hooks.server.ts` and privileged proxy routes re-check the session for defense in depth.
- Terminal output to the browser is SSE. Do not convert it back to a browser-to-agent WebSocket or expose the gateway secret client-side.
- Use `<svelte:boundary>` for pane-level isolation and `+error.svelte` for route-level failures where needed.
- Preserve safe-area handling from `src/app.css` for notch, Dynamic Island, landscape cutouts, and home indicators.
- Mobile portrait terminal grids must remain usable at narrow widths; do not regress the one-column mobile behavior or pane action sheet.

## Agent rules

- The agent daemon stays on **Node.js 22** because `node-pty` behavior is required for interactive terminal semantics.
- Do not migrate the agent daemon to Bun without explicit measured proof that PTY data, controlling-TTY behavior, Ctrl-C, job control, resize, and process-group teardown all remain correct.
- Every privileged agent endpoint must require the gateway secret before executing.
- SI-Coder tool execution must be resolved from its installed `.mso/functions.json`, exclude `sc.verify`, and preserve the canonical `node scripts/sc-agent.js <action>` command shape. Never execute arbitrary manifest commands from the browser.
- Collectors must fail independently; one collector failure must not terminate the agent.
- Do not change `agent/` for frontend-only work unless the change is required and explicitly justified.

## Auth and environment

Required secrets:

- `CONTROL_ROOM_SECRET` — human login secret
- `CONTROL_ROOM_SESSION_SECRET` — separate HMAC session-cookie key
- `AGENT_GATEWAY_SECRET` — recommended dedicated frontend-to-agent machine secret

Production frontend settings:

- `CONTROL_ROOM_DOMAIN` — hostname used by the Traefik template
- `ORIGIN` — canonical public origin, e.g. `https://vps.rahmanef.com`
- `BODY_SIZE_LIMIT` — adapter-node request-body cap; keep above the terminal upload ceiling
- `PORT=4000`, `HOST=0.0.0.0` are supplied by systemd

Agent defaults:

- `AGENT_HEALTH_PORT=4001`
- `AGENT_HEALTH_HOST=127.0.0.1`
- `TERMINAL_GATEWAY_URL=http://127.0.0.1:4001` when explicitly overridden

Never place secrets in client-visible environment values or serialized page data.

## Build, test, and run

```bash
# Frontend
bun install --cwd frontend --frozen-lockfile
bun run --cwd frontend check
bun run --cwd frontend test
bun run --cwd frontend build

# Agent
bun install --cwd agent --frozen-lockfile
bun run --cwd agent test:all
bun run --cwd agent build

# Root gates
bun run test
bun run build
git diff --check
```

The production frontend is the adapter-node output started with:

```bash
node build/index.js
```

The production agent is started with:

```bash
node agent/dist/index.js
```

## Deployment and rollback

`scripts/deploy.sh` is the deployment SSOT.

- Normal mode fast-forwards from the requested remote branch.
- `DEPLOY_FROM_WORKTREE=1` deploys the current local worktree and must not fetch, pull, push, or otherwise change GitHub state.
- Frontend and agent deploys create immutable releases under `/srv/control-room/{frontend,agent}/releases/`; stable `current` symlinks are the only runtime switch.
- Mutable state is outside Git under `/var/lib/control-room/`; production env is root-owned `/etc/control-room/control-room.env`.
- A failed agent gateway, frontend health/login, or public HTTPS verification restores the previous frontend+agent pair.
- The last deployed agent commit is tracked explicitly so worktree-mode deploys cannot miss agent source changes.
- Old inactive releases are pruned only after a verified switch; active targets must never be pruned.
- Long-lived SSE connections receive a bounded graceful drain window during frontend restart.

Before a production switch, require check, ESLint, coverage gates, Playwright/Axe responsive regression, build, and `git diff --check`. For UI changes, also run the relevant browser/mobile regression. After switching, verify public HTTPS, login/auth protection, `/api/health`, xterm/SSE behavior, and the agent PID.

## Local CLI

`scripts/local/control.mjs` is the cross-platform local-control SSOT. The Windows scripts delegate or mirror its behavior.

- `vps-cr build` builds adapter-node frontend output plus the Node agent.
- `vps-cr start` uses `frontend/build/index.js` when available and Vite dev otherwise.
- `vps-cr app` opens the same Svelte frontend in a lightweight app-mode browser window.
- `vps-cr doctor` validates Bun, Node, env, dependencies, secrets, device store, and health.

## Code organization

- Favor vertical slices under `frontend/src/lib/features/<feature>/`.
- Shared UI primitives live under `frontend/src/lib/components/ui/`.
- Server-only helpers live under `frontend/src/lib/server/`.
- Shared cross-process contracts belong in `packages/contracts/`; do not directly import frontend implementation code into the agent or vice versa.
- Delete absorbed/obsolete implementations instead of keeping redirect files or compatibility shims.
- Keep SSOT/DRY boundaries explicit and prefer small orchestration components over monolithic route files.

## Verification expectations

For frontend changes:

1. `bun run --cwd frontend check`
2. `bun run --cwd frontend test`
3. `bun run --cwd frontend build`
4. `git diff --check`
5. browser smoke for login/API/terminal stream
6. mobile matrix when layout, fullscreen, keyboard, drawer, safe-area, or xterm fitting changes

For deployment changes, additionally verify the generated systemd unit points to `frontend`/adapter-node, release rollback remains possible, stale preview processes are absent, and the agent is unchanged unless intentionally rebuilt.

## Git rules

- Do not push, merge, rebase a remote branch, revoke credentials, or change GitHub state unless the user explicitly asks.
- Local commits are allowed as traceable checkpoints when appropriate.
- Conventional commits, imperative mood; explain the reason rather than narrating the diff.
