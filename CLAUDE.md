# VPS Control Room

## Project

- Repo: `git@github.com:rahmanef63/control-room.git`
- Path: clone anywhere — systemd units are generated relative to the repo root by `scripts/install-systemd.sh`
- Domain: `vps.rahmanef.com` (Tailscale only)
- Host: Ubuntu 24.04.4 LTS, 8 vCPU, 31 GiB RAM, Bun 1.3.x + Node.js v22.22.1
- Package manager: **bun** (lockfile `bun.lock`). Node.js 22 must stay installed — the agent daemon runs on it.
- Deploy: systemd-managed (`vps-control-room-frontend.service`, `vps-control-room-agent.service`) via `scripts/deploy.sh main`. Workflow_dispatch only — no auto-deploy on push.

## Architecture (current — 2026-05-27)

```
frontend/ (Next.js 15 App Router + React 19 + Tailwind 4 + shadcn/ui)
  └── PWA dashboard, multi-pane xterm.js terminals (up to 16 ptys, LRU-evicted)
  └── REST + SSE to agent (no Convex on the hot path)

agent/ (Node.js 22 TypeScript, runs on host via systemd)
  └── collectors → in-memory + JSON state under ~/.openclaw/, /tmp/openclaw-*/
  └── executor → runs shell actions in a pty (single-owner trust model)
  └── HTTP API on AGENT_HEALTH_PORT (default 4001)
  └── pty manager spawns per-session shells, alfa patrol watchers
```

Data flow (runtime): **user → frontend (Next.js) → agent HTTP API (`/api/terminals`, `/api/state`, `/api/health`, `/api/patrol`, …) → host (pty, fs, systemctl).** No Convex on the hot path — the agent persists state to JSON under `~/.openclaw/`.

## Key Decisions

- Agent is the ONLY component with host access (Docker socket, systemctl, journalctl, fail2ban, ufw).
- Frontend NEVER executes host commands directly — always through the agent's authenticated HTTP gateway (`x-control-room-secret`).
- Security model is **perimeter**, not per-command sandboxing: single-owner web shell, agent bound loopback by default, gateway secret + Tailscale-only origin. The authenticated owner runs arbitrary commands in a pty by design — there is no command allowlist.
- Auth: HMAC-SHA256 signed cookie, single user, `CONTROL_ROOM_SECRET` for login, `CONTROL_ROOM_SESSION_SECRET` for signing.
- Agent actions are logged to JSON audit (no Convex `audit_log`).
- Color/heartbeat state via `useSyncExternalStore` module-level snapshot — sync across all panes realtime, hydrated from localStorage.

### Runtime split — Bun frontend, Node agent (2026-08-06)

- Frontend runs on the Bun runtime (`bun --bun next …`); bun also does every install/script.
- The agent **daemon stays on Node** (`ExecStart=/usr/bin/node <repo>/agent/dist/index.js`). Measured on Bun 1.3.14: node-pty loads and spawns but `onData` never fires, so every terminal is silently blank. `Bun.Terminal` does stream, but gives the child no controlling tty and no `setsid` — no job control, so Ctrl-C and the process-group kill in `TerminalManager.killSessionTree` break.

## Env Files

- `.env.local` at repo root (not committed, chmod 600)
- `.env.example` for reference

Required (frontend + agent):
- `CONTROL_ROOM_SECRET` — login secret, openssl rand -hex 32
- `CONTROL_ROOM_SESSION_SECRET` — different value, signs cookie
- `NEXT_PUBLIC_APP_URL` — `https://<tailnet-domain>`
- `NEXT_PUBLIC_APP_HOST` — hostname only

Optional:
- `AGENT_GATEWAY_SECRET` — dedicated machine secret for frontend→agent calls; falls back to `CONTROL_ROOM_SECRET`. Set it so the login password isn't reused as the gateway bearer.
- `CONTROL_ROOM_PORT` (4000) — Next.js bind
- `CONTROL_ROOM_HOST` — agent reach-address for frontend
- `AGENT_HEALTH_PORT` (4001)
- `AGENT_HEALTH_HOST` (127.0.0.1) — agent bind interface; loopback by default so the privileged host-control API isn't network-exposed. Set 0.0.0.0 only for cross-host.
- `HOST_TELEMETRY_INTERVAL_MS` (15000)
- `DOCKER_SOCKET_PATH` (/var/run/docker.sock)
- `SESSION_EXPIRY_HOURS` (72 = 3 days; middleware slides it forward on activity, so an active dashboard never logs out — cap only applies after this many hours idle)

NEVER put secrets in `NEXT_PUBLIC_*` (leaks to client bundle).

## Build & Run

```bash
# Frontend (PWA dashboard)
bun install --cwd frontend && bun run --cwd frontend build
# systemd: bun --bun node_modules/.bin/next start --hostname 0.0.0.0 --port 4000

# Agent (host executor)
bun install --cwd agent && bun run --cwd agent build
# systemd: node agent/dist/index.js   (daemon stays on Node — see Runtime split)
```

Deploy on the VPS:
```bash
git pull origin main
bash scripts/deploy.sh main
```

SW cache invalidation:
```bash
bash scripts/bump-version.sh   # stamps COMMIT_SHA into frontend build
```

## Agents & Skills

Specialized agents for token efficiency. Each has narrow scope:

- `/vps-prd` — Quick PRD reference (compressed)
- `/vps-page` — Dashboard page creation pattern
- `/vps-collector` — Host collector creation pattern
- `/vps-action` — Action pipeline addition pattern
- `/vps-deploy` — Deploy workflow
- `/vps-control-room` — Project playbook for runtime, deploy, firewall, asset delivery
- `/vps-alfa` — Patrol/multi-pane orchestration
- `/vps-cr` — Drive the LOCAL `vps-cr` CLI (start/stop, doctor, config, device acc/list/revoke, status)

Agents:
- `vps-alfa` — Main orchestrator, delegates to specialists, generates new skills
- `vps-frontend` — Frontend pages and components
- `vps-host-agent` — Collectors and executor
- `vps-control-room-master` — Project-specific coordinator for deploy/runtime issues
- `si-coder` — Zero-human full-stack deployment: build from scratch, GitHub, Dokploy, DNS
- `codex` — OpenAI Codex CLI coordinator + si-coder deployment
- `gemini` — Google Gemini CLI coordinator + si-coder deployment
- `openclaw` — OpenClaw TUI coordinator, skill management, multi-agent orchestration

Skills (built-in to this VPS, installed at `~/.agents/skills/`):
- `vps-alfa` — Alfa patrol agent with mode-aware behavior (static / senior-fullstack)
- `si-coder` — Deploy script + SKILL.md for zero-human Dokploy deployment (see `skills/si-coder/`)
- Run `bash scripts/install-skills.sh` to sync skills from repo to `~/.agents/skills/`

## Distribution

Installer: `bunx rahman-cr install --vps user@<ip> --domain <tailnet>` clones this repo, generates two secrets, runs `install-systemd.sh` + `deploy.sh main`. The `rahman-cr` npm package is published separately — its source is NOT vendored in this repo (there is no `resources/packages/cr/`). Docs at https://resource.rahmanef.com/control-room.

**Local (no VPS):** `install.sh` / `install.ps1` one-liners + the cross-platform `vps-cr` CLI (`scripts/local/control.mjs`, Windows wrapper `scripts/win-local/vps-cr.ps1`). When asked to onboard a user to a LOCAL install, follow the playbook in `docs/AI-ONBOARDING.md` (human guide: `docs/INSTALL-LOCAL.md`).

Local run paths (lightest → fullest), see `docs/NATIVE-WINDOWS.md`:
- `vps-cr term [n]` / `vps-cr ssh [target]` — native Windows Terminal panes (no browser); Windows-only helpers.
- `vps-cr app` — full dashboard in a native WebView2/Edge app window (all features, ~a few hundred MB vs multiple GB in a heavy browser). Cross-platform (`appWindow()` in control.mjs).
- `vps-cr build` — production build; `vps-cr` / `app` / `start` then launch the prod servers (light) instead of `next dev`, falling back to dev if unbuilt. Fixes the CPU freeze when opening many panes.
- A real packaged `.exe` (Tauri, reuses WebView2) is the planned phase-2; needs the Rust toolchain.

## Rules

- Read PRD.md for full specs when needed, but prefer skills for patterns.
- Every dashboard page MUST have an error.tsx sibling.
- Every collector MUST be wrapped in try/catch — one failure must not stop others.
- Every privileged agent endpoint MUST require the gateway secret before executing.
- All hooks must run on every render — keep them above early `if (!open) return null` exits to avoid React error #310.
- Commit messages: imperative mood, explain why not what.
