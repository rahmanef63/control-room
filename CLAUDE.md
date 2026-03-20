# VPS Control Room

## Project

- Repo: `git@github.com:rahmanef63/vps-rahmanef.com.git`
- Path: `/home/rahman/projects/vps-rahmanef`
- Domain: `vps.rahmanef.com` (Tailscale only)
- Host: Ubuntu 24.04.4 LTS, 8 vCPU, 31 GiB RAM, Node.js v22.22.1
- Package manager: **npm**

## Architecture

```
frontend/ (Next.js 15 App Router + Tailwind + shadcn/ui)
  └── subscribes to Convex → displays live data, sends commands

convex/ (self-hosted, realtime sync + command queue + audit)
  └── shared data layer between frontend and agent

agent/ (Node.js 22 TypeScript, runs on host via systemd)
  └── collectors → Convex mutations
  └── executor → polls commands table, validates allowlist, executes
```

Data flow: agent collects → Convex stores → frontend subscribes → user triggers action → Convex queues command → agent executes → result back to Convex → frontend displays.

## Key Decisions

- Agent is the ONLY component with host access (Docker socket, systemctl, journalctl, fail2ban, ufw).
- Frontend NEVER executes host commands directly.
- Commands use allowlist validation — no arbitrary shell.
- Auth: HMAC-SHA256 signed cookie, single user, `CONTROL_ROOM_SECRET` for login, `CONTROL_ROOM_SESSION_SECRET` for signing.
- Convex connection to agent uses `CONVEX_ADMIN_KEY`.
- All actions logged to `audit_log` table.

## Convex Tables

`events`, `audit_log`, `agent_status`, `system_snapshot`, `alerts`, `commands`, `app_status` — see PRD section 11 for full schema with indexes.

## Env Files

- `.env.local` at repo root (not committed)
- `.env.example` for reference
- Secrets: `CONTROL_ROOM_SECRET`, `CONTROL_ROOM_SESSION_SECRET`, `CONVEX_ADMIN_KEY`, `DOKPLOY_API_KEY`
- NEVER put secrets in `NEXT_PUBLIC_*`

## Build & Run

```bash
# Frontend
cd frontend && npm install && npm run build
# Runs via systemd: node frontend/.next/standalone/server.js

# Agent
cd agent && npm install && npm run build
# Runs via systemd: node agent/dist/index.js

# Convex
npx convex deploy
```

## Agents & Skills

This project uses specialized agents for token efficiency. Each agent has a narrow scope:

- `/vps-prd` — Quick PRD reference (compressed)
- `/vps-convex-fn` — Convex function patterns for this project
- `/vps-page` — Dashboard page creation pattern
- `/vps-collector` — Host collector creation pattern
- `/vps-action` — Action pipeline addition pattern
- `/vps-deploy` — Deploy workflow

Agents:
- `vps-alfa` — Main orchestrator, delegates to specialists, generates new skills
- `vps-frontend` — Frontend pages and components
- `vps-convex` — Convex schema and functions
- `vps-host-agent` — Collectors and executor

## Rules

- Read PRD.md for full specs when needed, but prefer skills for patterns.
- Every Convex table MUST have indexes defined in schema.ts.
- Every dashboard page MUST have an error.tsx sibling.
- Every collector MUST be wrapped in try/catch — one failure must not stop others.
- Every action MUST go through allowlist validation before execution.
- Commit messages: imperative mood, explain why not what.
