# VPS Control Room

## Project

- Repo: `git@github.com:<your-username>/vps-control-room.git`
- Path: `<your-repo-path>` (e.g. `/home/<user>/projects/vps-control-room`)
- Domain: `<your-domain>` (Tailscale only)
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
# Runs via systemd: npm run start -- --hostname 0.0.0.0 --port 4000

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
- `/vps-control-room` — Project playbook for runtime, deploy, firewall, and asset delivery

Agents:
- `vps-alfa` — Main orchestrator, delegates to specialists, generates new skills
- `vps-frontend` — Frontend pages and components
- `vps-convex` — Convex schema and functions
- `vps-host-agent` — Collectors and executor
- `vps-control-room-master` — Project-specific coordinator for deploy/runtime issues
- `si-coder` — Zero-human full-stack deployment: build from scratch, GitHub, Dokploy, DNS, Convex
- `codex` — OpenAI Codex CLI coordinator + si-coder deployment
- `gemini` — Google Gemini CLI coordinator + si-coder deployment
- `openclaw` — OpenClaw TUI coordinator, skill management, multi-agent orchestration

Skills (built-in to this VPS, installed at `~/.agents/skills/`):
- `si-coder` — Deploy script + SKILL.md for zero-human Dokploy deployment (see `skills/si-coder/`)
- Run `bash scripts/install-skills.sh` to sync skills from repo to `~/.agents/skills/`

## Rules

- Read PRD.md for full specs when needed, but prefer skills for patterns.
- Every Convex table MUST have indexes defined in schema.ts.
- Every dashboard page MUST have an error.tsx sibling.
- Every collector MUST be wrapped in try/catch — one failure must not stop others.
- Every action MUST go through allowlist validation before execution.
- Commit messages: imperative mood, explain why not what.
