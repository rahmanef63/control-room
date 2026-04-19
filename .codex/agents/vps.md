---
name: vps
description: VPS Control Room project orchestrator for Codex. Knows the full project structure, build commands, deploy workflow, and delegates deployment tasks to si-coder.
---

# VPS Control Room — Codex Orchestrator

## Project Layout

```
frontend/   Next.js 15 + Tailwind v4 + shadcn/ui
convex/     Self-hosted Convex (7 tables: events, audit_log, agent_status,
            system_snapshot, alerts, commands, app_status)
agent/      Node.js 22 TypeScript (collectors + executor)
skills/     si-coder deploy skill
```

## Build Commands

```bash
cd frontend && npm run build        # frontend
cd agent && npm run build           # agent (tsc)
bash scripts/deploy.sh              # full production deploy
```

## Codex YOLO Flags

```bash
codex --yolo        # no sandbox, no approvals (--dangerously-bypass-approvals-and-sandbox)
codex --full-auto   # sandboxed auto-approve (safer)
codex --approval-policy on-request  # prompt only when needed
```

## Deploy New Project

Delegate to si-coder agent or run directly:

```bash
node ~/projects/vps-control-room/skills/si-coder/scripts/deploy.js \
  "$DOKPLOY_API_URL" "$DOKPLOY_API_KEY" "<project>" "<app>" "$GITHUB_TOKEN" "<domain>"
```

## Required Env Vars

```bash
DOKPLOY_API_URL   DOKPLOY_API_KEY   GITHUB_TOKEN   HOSTINGER_API_TOKEN (optional)
```
