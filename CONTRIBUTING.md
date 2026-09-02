# Contributing to VPS Control Room

Control Room is a single-owner, self-hosted terminal/operations PWA. Frontend and agent have deliberately different trust boundaries: the SvelteKit frontend owns browser UX and authenticated proxying; the Node 22 agent owns PTYs and host access.

Read `CLAUDE.md` before changing architecture or runtime behavior.

## Local setup

```bash
git clone <your-fork-or-repo>
cd control-room
cp .env.example .env.local
cp .env.local frontend/.env.local
bun install --cwd frontend
bun install --cwd agent
```

For local-only use, configure `CONTROL_ROOM_SECRET`, `CONTROL_ROOM_SESSION_SECRET`, `AGENT_GATEWAY_SECRET`, `CONTROL_ROOM_HOST=127.0.0.1`, and the local ports. `vps-cr config` can generate/synchronize the local env files for you.

Run the services with `vps-cr`, `vps-cr start`, or separately:

```bash
bun run --cwd agent dev
bun run --cwd frontend dev -- --host 127.0.0.1 --port 4000
```

Host-only collectors that are unavailable on your machine should fail independently rather than crash the app.

## Project layout

```text
frontend/    SvelteKit 2 + Svelte 5 PWA; adapter-node production output
agent/       Node 22 host agent; PTY gateway, telemetry, host APIs
scripts/     deploy, systemd installer, local/Windows tooling
ops/         Traefik dynamic configuration
packages/    shared contracts + runtime configuration
docs/        install, onboarding, runbook, historical audits
```

Treat frontend and agent as separate trust/runtime units. Do not cross-import their implementation code. Shared contracts belong in `packages/contracts`.

## Frontend conventions

- Svelte 5 runes only for new/modified code.
- Do not introduce `export let`, reactive `$:` statements, `on:click`, legacy `<slot>`, or writable/readable shared-store patterns.
- Use `$props()`, `$state`, `$derived`, `$effect`, snippets, and rune-backed `.svelte.ts` modules as appropriate.
- UI primitives live in `frontend/src/lib/components/ui/`.
- Feature code belongs in `frontend/src/lib/features/<feature>/`.
- Server-only session/gateway helpers belong in `frontend/src/lib/server/`.
- API endpoints are SvelteKit `+server.ts` routes.
- Terminal output to the browser is SSE. The frontend server owns the agent WebSocket; do not expose the agent gateway secret to browser code.
- Preserve safe-area, mobile, fullscreen, keyboard, and xterm-fit behavior when touching terminal layout.
- Prefer Tailwind utilities and local component styles over one-off inline styling.
- Delete obsolete implementations instead of keeping compatibility placeholders.

## Agent conventions

- The daemon stays on Node.js 22 because interactive `node-pty` semantics are required.
- Every privileged endpoint must authenticate the gateway secret before acting.
- One collector failure must not terminate the process.
- Avoid modifying `agent/` for frontend-only work.
- New terminal profiles require a clear explanation of what they spawn and their resource/security implications.

## Branches and commits

- Common branch patterns: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
- Keep changes coherent; avoid unrelated cleanup in feature diffs unless it is required to preserve SSOT.
- Conventional commits are preferred, e.g. `fix(terminal): preserve first row after mobile refit`.
- Use imperative mood and explain why the change exists.
- Do not push, merge, or rewrite remote history unless the task explicitly calls for it.

## Quality gates

The repository-level SSOT is:

```bash
bun run verify
```

It runs Svelte check, ESLint, frontend + agent coverage gates, production builds,
and the isolated Playwright suite. The browser suite covers 320×568, 360×800,
390×844, 430×932, 768×1024, 1366×768, and 844×390 landscape, plus Axe
WCAG A/AA critical/serious checks and the login visual baseline.

Focused commands remain available:

```bash
bun run check
bun run lint
bun run test:coverage
bun run build
bun run test:e2e
```

For changes to real PTY semantics, perform the production/local-agent smoke after
the isolated suite: create, input, resize, buffer, SSE reconnect, and close.
Deploy/install changes must additionally verify both immutable release targets,
agent loopback binding, the frontend-only Traefik route, runtime state/env
permissions, and automatic pair rollback material.

## Security rules

- Never commit `.env.local`, tokens, passwords, session cookies, private keys, or browser credentials.
- Never print complete environment objects or auth headers.
- Never expose secrets through browser-visible environment variables, page data, logs, or error payloads.
- Keep the agent loopback-bound unless a deliberate cross-host design provides equivalent authentication and network isolation.
- No third-party telemetry beacons. The product is self-hosted.
- Treat the authenticated terminal as intentionally powerful; the perimeter/auth boundary is critical.

See `SECURITY.md` for vulnerability reporting.

## Pull requests

A useful PR description should state the problem, architecture impact, verification performed, and any operational/rollback considerations. Distinguish local gates from GitHub checks; do not claim CI passed when no GitHub check ran.
