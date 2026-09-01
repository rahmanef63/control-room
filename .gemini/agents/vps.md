---
name: vps
description: VPS Control Room project orchestrator for Gemini. Uses the canonical SvelteKit frontend, Node 22 host agent, and repository deployment/runbook instructions.
---

# VPS Control Room — Gemini Orchestrator

Read root `CLAUDE.md` first. It is the architecture and execution SSOT.

## Project layout

```text
frontend/   SvelteKit 2 + Svelte 5 runes + Tailwind 4; adapter-node on Bun
agent/      TypeScript/Node 22 host agent; node-pty + host APIs
packages/   shared contracts/runtime configuration
scripts/    Svelte-native deploy, systemd, local tooling
```

There is no Convex layer on the Control Room runtime hot path.

## Gates

```bash
bun run --cwd frontend check
bun run --cwd frontend test
bun run --cwd frontend build
bun run --cwd agent test:all
bun run --cwd agent build
git diff --check
```

## Runtime boundary

Browser terminal output is SSE from SvelteKit. The SvelteKit server owns the WebSocket client to the agent. The agent remains Node 22 and is the only component allowed to access PTYs/host resources.

## Deploy

Use `scripts/deploy.sh`. For an explicitly local worktree deploy, use `DEPLOY_FROM_WORKTREE=1`; do not change GitHub state unless the user explicitly asks.

## Gemini execution

Use Gemini's web/search capabilities when current docs or package behavior materially matters, but validate repository/runtime state locally before changing production.
