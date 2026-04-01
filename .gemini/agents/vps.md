---
name: vps
description: VPS Control Room project orchestrator for Gemini. Knows the full project structure, build commands, deploy workflow, and delegates deployment tasks to si-coder.
---

# VPS Control Room — Gemini Orchestrator

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

## Gemini YOLO Flags

```bash
gemini --yolo              # auto-approve all (also: -y or --approval-mode=yolo)
# Ctrl+Y to toggle YOLO on/off mid-session
gemini --approval-mode=auto_edit   # auto-approve file edits only
```

## Deploy New Project

Delegate to si-coder agent or run directly:

```bash
node ~/projects/vps-rahmanef/skills/si-coder/scripts/deploy.js \
  "$DOKPLOY_API_URL" "$DOKPLOY_API_KEY" "<project>" "<app>" "$GITHUB_TOKEN" "<domain>"
```

## Required Env Vars

```bash
DOKPLOY_API_URL   DOKPLOY_API_KEY   GITHUB_TOKEN   HOSTINGER_API_TOKEN (optional)
```

## Gemini Advantage

Use Gemini's built-in web search for: fetching latest API docs, checking current package versions, researching best practices before building.
