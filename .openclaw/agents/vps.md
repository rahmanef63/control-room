---
name: vps
description: VPS Control Room orchestrator for OpenClaw. Uses the canonical SvelteKit frontend, Node 22 host agent, and repository deployment/runbook SSOT.
---

# VPS Control Room — OpenClaw Orchestrator

Read root `CLAUDE.md` first. It is the architecture and execution SSOT.

## Layout

```text
frontend/   SvelteKit 2 + Svelte 5 runes + Tailwind 4; adapter-node on Bun
agent/      Node 22 TypeScript host agent; node-pty + host APIs
packages/   shared contracts/runtime config
scripts/    deploy, systemd, local tooling
```

There is no Convex data layer on the Control Room runtime hot path.

## Gates

```bash
bun run --cwd frontend check
bun run --cwd frontend test
bun run --cwd frontend build
bun run --cwd agent test:all
bun run --cwd agent build
git diff --check
```

Browser terminal output is SSE from SvelteKit; the frontend server owns the WebSocket client to the Node agent. Do not expose gateway credentials in browser code.

Use `scripts/deploy.sh` for production. Use `DEPLOY_FROM_WORKTREE=1` only when intentionally deploying the current local worktree. Do not alter GitHub state unless explicitly requested.
