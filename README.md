# VPS Control Room — v2.0

[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)
&nbsp;![PWA installable](https://img.shields.io/badge/PWA-installable-38bdf8)
&nbsp;![SvelteKit 2](https://img.shields.io/badge/SvelteKit-2-ff3e00)
&nbsp;![Node 22](https://img.shields.io/badge/Node-22-339933)
&nbsp;![self-hosted](https://img.shields.io/badge/self--hosted-single--owner-a855f7)

A mobile-first PWA dashboard for driving a single VPS through a web browser:
multi-pane terminals (up to 16 concurrent ptys), AI agent launchers, host
ops, and audit — behind signed device-aware sessions, an HTTPS perimeter,
and a loopback-only privileged agent.

![VPS Control Room authenticated terminal dashboard — desktop, rendered locally from the dev server](./docs/media/dashboard-desktop.png)

<p align="center">
  <img src="./docs/media/dashboard-mobile.png" alt="VPS Control Room authenticated terminal dashboard on a phone-width viewport, rendered locally" width="280" />
</p>

<p align="center"><sub>Real authenticated captures of the running app, taken from the SvelteKit frontend with a local agent gateway and real terminal panes.</sub></p>

> **What's new in v2.0**: single-kebab pane header, per-terminal skills
> (project + global), Move-to-workspace, 4-step zoom, heartbeat
> outer-glow with a Test-heartbeat button, cross-browser workspace
> sync via agent-side JSON, exact 2-row desktop grid, two-row mobile
> soft keyboard with prominent Tab, plus local laptop install via `vps-cr`.

## Capabilities at a glance

| Terminals | AI agents | Host ops | Mobile |
|:---:|:---:|:---:|:---:|
| 16 ptys, reconnect buffers, broadcast input | Claude / Codex / Gemini / OpenClaw launchers with regular or bypass modes | Agent-owned systemd, Docker, journal, telemetry and file APIs | PWA layout, soft keyboard with Tab, one-column portrait mode |

This is intentionally not a public SaaS or remote-desktop replacement. It is a
single-owner control surface: the browser sees a safe web UI, while the local
agent owns host access behind an authenticated, loopback-bound gateway.

```
┌─ frontend/  SvelteKit 2 + Svelte 5 runes + Tailwind 4, adapter-node on Node 22
├─ agent/     Node 22 host agent — pty gateway, host telemetry, log.json
└─ scripts/   Svelte-native deploy + systemd installer + local tooling
```

> **Build id**: every deploy stamps a 12-char commit prefix into
> `GET /api/version`, `PUBLIC_BUILD_ID`, and the service-worker cache
> namespace. `scripts/deploy.sh main` rebuilds, restarts systemd, and refreshes
> Traefik. Auto-deploy via GitHub Actions is intentionally disabled (the
> workflow is `workflow_dispatch:` only) — day-to-day deploys happen on the
> host.

---

## Install

| Path | Command | Time | Best for |
|------|---------|------|----------|
| 🤖 **AI-assisted** | `bunx rahman-cr ai claude` | ~20 min | Paste prompt into Claude / Codex / Gemini, get walked through every step |
| ⚡ **One-line** | `bunx rahman-cr install --vps user@ip --domain X` | ~10 min | Already have SSH + a domain ready |
| 🛠️ **Manual** | follow [docs/ONBOARDING.md](docs/ONBOARDING.md) | ~30 min | Want to read each step before running it |
| 💻 **Local (this PC)** | one line — see [docs/INSTALL-LOCAL.md](docs/INSTALL-LOCAL.md) | ~5 min | Run the whole thing on your laptop — no VPS, SSH, or domain |

Step-by-step roadmap (VPS prep → SSH → optional Tailscale → DNS → install → verify):
**[docs/INSTALL.md](docs/INSTALL.md)**

Just want it on **your own computer**? One command on Windows / macOS / Linux —
**[docs/INSTALL-LOCAL.md](docs/INSTALL-LOCAL.md)**. Want an AI to set it up for you
from zero? **[docs/AI-ONBOARDING.md](docs/AI-ONBOARDING.md)**.

### Quick reference

| If you want to… | Read |
|-----------------|------|
| **Install on your VPS** | [docs/INSTALL.md](docs/INSTALL.md) — full roadmap with three paths |
| **Just understand the steps** | [docs/ONBOARDING.md](docs/ONBOARDING.md) — five-phase walkthrough |
| **Fix a bug / send a PR** | [CONTRIBUTING.md](CONTRIBUTING.md) — local dev in 5 min, no VPS needed |
| **Report a vulnerability** | [SECURITY.md](SECURITY.md) — GitHub Security Advisory, not public issues |
| **Run a local dev server (any OS)** | [docs/INSTALL.md → Phase L](docs/INSTALL.md#phase-l--local--dev-install-any-os-no-vps) — Linux / macOS / Windows, no VPS. SvelteKit dev uses `frontend/.env.local`; the local CLI keeps it synchronized with the root env file. |

---

## Architecture

Three tiers, one direction-of-trust:

```
browser ──HTTPS/SSE──► Traefik ──► frontend (Node 22 adapter-node, unprivileged web user)
                                      │
                                      │ machine-authenticated HTTP/WS
                                      ▼
                                 127.0.0.1:4001
                                 agent (Node 22, privileged host boundary)
                                      │
                                      ├─► pty / host / Docker / systemd
                                      ├─► SI-Coder safe tool adapter ─► ~/.config/si-coder/
                                      └─► /var/lib/control-room/agent/*.json

runtime releases: /srv/control-room/{frontend,agent}/releases
runtime env:      /etc/control-room/control-room.env
```

**Rules of trust**

- The **agent** is the only component with host access. The frontend never
  shells out directly — it reaches the agent only over the authenticated
  gateway (`x-control-room-secret` header), added by the SvelteKit server proxy routes.
- This is a single-owner web shell: the authenticated owner runs commands in a
  real pty by design. There is **no command allowlist** — the perimeter is the
  security boundary, not per-command sandboxing.
- The agent binds loopback (`127.0.0.1`) by default (`AGENT_HEALTH_HOST`), so
  the privileged host API is never network-exposed.
- Auth: HMAC-SHA256 cookie signed with `CONTROL_ROOM_SESSION_SECRET`, gated by
  `CONTROL_ROOM_SECRET` at login.
- The dashboard may be internet-reachable over HTTPS. Traefik is the only public application boundary; the agent is never routed publicly. Tailscale remains an optional additional network restriction.

---

## Features

### Terminal workspace

- **Up to 16 concurrent pty sessions** (`MAX_TERMINAL_SESSIONS` in
  `agent/src/terminal/manager.ts`). Opening a 17th evicts the
  least-recently-updated session (LRU) rather than erroring. Each session keeps a
  ring buffer of up to 250k chars and survives short reconnects.
- **Per-pane SSE stream** with auto-reconnect and connection chip; SvelteKit owns the loopback WebSocket to the agent
  (`connecting / open / closed`).
- **Profiles**: plain `shell`, plus AI agent launchers (`claude`, `codex`,
  `gemini`, `openclaw`). Built-in profiles live in
  `agent/src/terminal/profiles.ts`; agent metadata in `packages/runtime-config/`.
- **Activity detection**: agent panes track `idle → working → planning →
  asking → done` from output patterns. Drives the heartbeat glow.
- **Broadcast input**: send the same keystrokes to every visible pane —
  useful for running the same command across multiple containers/dirs.
- **Duplicate terminal**: clone profile + cwd into a new pane.
- **Rename inline**: click the title, edit, ⏎ to save.

### Workspaces (tab groups)

- Create / rename / delete workspaces from the top bar. Each pane is mapped
  to a workspace; switching tabs filters which panes are mounted in the grid.
- **Cross-browser sync**: workspace list + session→workspace map + active id
  are stored on the agent in `/var/lib/control-room/agent/workspaces.json` via
  `GET/PUT /state/workspaces`. The frontend hydrates from `localStorage`
  first (instant render), then overwrites with the agent's authoritative
  copy. Edits are debounced 600 ms and pushed back. Last-write-wins; no
  realtime push.

### Pane actions menu (kebab)

The pane header is one row: `[title chip] [activity chip] [⋮ kebab]`. The
kebab opens a tabbed modal:

- **Agents** — list of configured agent profiles. Each row offers `Regular`
  and `Bypass` (`--dangerously-skip-permissions` / `--yolo`) launches.
- **Skills** — global skills (`~/.agents/skills`, `~/.claude/skills`) plus
  project skills resolved by walking up from the pane's `cwd` until a
  marker (`.git`, `package.json`, `deno.json`, `pyproject.toml`,
  `Cargo.toml`, `go.mod`) is found. Project hits are shown first.
- **Actions**
  - **View**: Maximize / Focus (toggles fullscreen in single view or
    focuses one pane in grid view) + 4-step zoom (`⏬` jump to MIN, `−`,
    `+`, `⏫` jump to MAX).
  - **Pane**: Browse folders (opens the file explorer dialog) and
    Duplicate.
  - **Move to workspace**: list of workspaces. Current one is disabled and
    labelled "current".
  - **Danger**: Close terminal (red).

### View modes

- **Single** — one pane at a time, tab strip on top to switch.
- **Grid** — all panes in the active workspace tiled. Columns: `Auto` or
  fixed 1–4 per row.
- **Desktop grid**: each row is exactly `(100dvh − var(--terminal-tops-h)) /
  2` tall, so two rows fit on screen and a third row starts the scroll
  instead of squashing every pane.
- **Mobile**: portrait collapses to 1 column. Pane header is one row (title
  + kebab), decorative chips drop, fonts shrink.

### Soft keyboard (mobile)

Mobile shows a per-pane two-row soft keyboard above the OS keyboard:

- Row 1 — `Esc`, `Shift+Tab`, `Tab` (wider), `Ctrl+C`.
- Row 2 — `←` `↑` `↓` `→`, plus optional `Clear`, `Paste`, `Copy`,
  `Select all` (each toggleable in settings).

Desktop hides the soft keyboard entirely — the physical keyboard already
covers it, and hiding lets the terminal fill the full pane height.

### Heartbeat outer-glow

- **Heartbeat glow**: a pulsing outer-ring animation around any pane whose
  agent activity is `working`, `planning`, or `asking`. Toggle in Settings.
  Honors `prefers-reduced-motion`.
- **Test heartbeat**: Settings → Notifications → "Test heartbeat" pulses every
  pane for 4 s by stamping `data-heartbeat-test='on'` on `<html>`.

The glow only fires on AI agent sessions (Claude / Codex / Gemini), because
activity detection is heuristic on agent output. Plain shell sessions stay
still.

### File explorer

Pane action → Browse folders opens a dialog backed by `GET /fs/list?path=…`
on the agent. Lets you `cd` into a directory directly from the modal.

### Cron jobs

`agent/src/cron/` hosts a small cron runner with an HTTP API. Frontend has
a "Cron jobs" drawer to inspect schedules, recent runs, and trigger ad-hoc
executions. Each cron action is validated (type + length bounds) before it runs.

### Templates

Save current pane configuration (profile, cwd, model, agent flags) as a
named template; relaunch with one click. Persisted to `localStorage`
(can be promoted to agent-side JSON the same way workspaces were).

### Provider Store (SI-Coder SSOT)

Control Room does **not** maintain a second provider/credential database. The
Providers drawer is a UI/control-plane over the installed SI-Coder provider
store and its machine-safe tool surface:

```text
browser Providers UI
  → authenticated SvelteKit API
  → loopback Control Room agent
  → SI-Coder `.mso/functions.json` / `scripts/sc-agent.js`
  → ~/.config/si-coder/{connections.json,connections/.../*.env}
```

- The hierarchy is the same as SI-Coder: **User → Provider → named Connection → Credential field**.
- Provider readiness, auth method, scope, defaults and credential **status** can
  be viewed; plaintext credential values are never returned.
- Named connections can be created, selected as default or deleted through the
  same `sc.user.*` tool contracts used by SI-Coder MCP/MSO clients.
- Live provider verification runs through `sc.user.provider.verify`.
- **Set securely** asks SI-Coder for a credential handoff, opens a real Control
  Room terminal and injects only the non-secret `sc user credential-set …`
  command. The credential itself is entered at SI-Coder's hidden terminal
  prompt, never in browser JSON.
- OAuth/external connections remain externally managed. Control Room shows the
  connection identity/alias but does not copy access or refresh tokens.
- SI-Coder is auto-discovered from `~/.local/bin/sc`; use `SI_CODER_ROOT` only
  for a non-standard installation path.

The agent exposes a generic authenticated `/si-coder/tools` +
`/si-coder/tools/call` bridge, sourced from SI-Coder's own function manifest,
so future Control Room agent features can reuse the same tool-calling contract
without inventing another schema.

### Auth & access

- **HMAC-SHA256 cookie**: `CONTROL_ROOM_SECRET` gates `/api/auth/login`;
  on success a cookie signed with `CONTROL_ROOM_SESSION_SECRET` (different
  value) is set for `SESSION_EXPIRY_HOURS` (default 72 — 3 days; middleware
  slides it forward on activity, so an active dashboard never logs out).
- **HTTPS perimeter**: Traefik exposes only the Svelte frontend. The privileged agent stays on `127.0.0.1:4001`; there is no public `/ws/terminals` route. Tailscale can still be used as defense in depth.
- Same secret guards every agent HTTP endpoint (`/fs/list`, `/skills`,
  `/state/*`, terminal gateway), passed via `x-control-room-secret` header
  by the SvelteKit server proxy routes.

### PWA + cache recovery

- Service worker stamped per build (`vps-control-room-v<commit12>`).
- Cache-recovery defenses: inline `<head>` early-asset error trap,
  `forceFreshReload()` (SW unregister + cache purge + `_v=` bust),
  `VersionGuard` polling `/api/version` every 5 min and on
  visibility/focus, plus extension-noise suppression.
- Installable as a PWA on iOS/Android (manifest + apple-touch-icon).
- OS-specific theming via `data-os` skins; Windows run paths in
  **[docs/NATIVE-WINDOWS.md](docs/NATIVE-WINDOWS.md)**.

### Terminals across browsers

Workspace state is shared via `/var/lib/control-room/agent/workspaces.json`, so opening the
panel in a new browser tab/device shows the same workspaces, the same
session→workspace map, and the same active workspace. Live pty output
itself is on the agent, so multiple browsers connecting to the same
session id stream the same buffer.

---

## Setup

### One-time prerequisites on the VPS

```bash
sudo apt-get install -y nodejs        # or via nvm — Node 22+ (the agent daemon runs on Node)
curl -fsSL https://bun.sh/install | bash   # Bun 1.3+ — package manager + frontend runtime
sudo usermod -aG docker $USER         # if you want docker collector
```

### Clone + install

```bash
git clone git@github.com:<you>/control-room.git
cd control-room
cp .env.example .env.local
$EDITOR .env.local                    # fill CONTROL_ROOM_SECRET et al.

bun install --cwd frontend
bun install --cwd agent
```

### systemd services

```bash
sudo bash scripts/install-systemd.sh
sudo systemctl enable --now vps-control-room-agent vps-control-room-frontend
```

Production is detached from the Git checkout. Immutable releases live under
`/srv/control-room/`, mutable state under `/var/lib/control-room/`, and the
root-owned runtime environment at `/etc/control-room/control-room.env`.
The frontend runs as the dedicated `control-room-web` user; the host agent
remains the only privileged boundary.

### Traefik

A dynamic-config template lives at `ops/traefik/vps-control-room.yml`. The
deploy script envsubst's it and syncs to `/etc/dokploy/traefik/dynamic/`
on each run. Only the Svelte frontend is routed; port 4001 is loopback-only and must never be added as a Traefik service.

---

## Deploy

```bash
bash scripts/deploy.sh main
```

What it does (in order):

1. Acquires a deploy lock and builds from either a fast-forwarded branch or an explicitly selected local worktree.
2. Migrates runtime state into `/var/lib/control-room/` and writes a canonical, root-only environment file under `/etc/control-room/`; obsolete Convex/Next keys are not injected into the runtime.
3. Runs Svelte check, ESLint, coverage gates, isolated Playwright/Axe responsive tests, the production build, and `git diff --check`.
4. Stages immutable frontend **and agent** releases under `/srv/control-room/.../releases`.
5. Compares the last deployed agent commit against the candidate commit; agent changes are never inferred from two reads of the same worktree HEAD.
6. Switches the agent symlink first when required and verifies its authenticated HTTP gateway. On failure, the previous agent/frontend pair is restored.
7. Switches the frontend symlink and verifies local health/login, then publishes the frontend-only Traefik route and verifies public HTTPS.
8. Writes a deployment event to `~/.local/state/control-room-deploy/deploy-events.jsonl`, records the deployed agent commit, and retains five rollback releases by default.

### GitHub Actions

`.github/workflows/deploy.yml` is `workflow_dispatch:` only. Push does not
auto-trigger. To trigger remotely: GitHub → Actions → "Deploy VPS Control
Room" → Run workflow. The workflow stages env from
`$HOME/.config/control-room/.env.local` on the self-hosted runner before
delegating to `scripts/deploy.sh`. A separate `verify.yml` runs check, lint, coverage, build, Playwright responsive tests, Axe accessibility checks, and the visual baseline on pushes/PRs once these commits are published.

---

## Configuration

Environment variables (all optional except auth secrets):

| Variable | Default | Purpose |
|----------|---------|---------|
| `CONTROL_ROOM_SECRET` | (none) | Required at login + gateway header. |
| `CONTROL_ROOM_SESSION_SECRET` | (none) | HMAC key for session cookies. |
| `AGENT_GATEWAY_SECRET` | falls back to `CONTROL_ROOM_SECRET` | Dedicated frontend→agent machine secret. |
| `SESSION_EXPIRY_HOURS` | `72` | Cookie lifetime (3 days; slides forward on activity). |
| `CONTROL_ROOM_PORT` | `4000` | Local/manual frontend listen port. Production systemd binds `:4000`. |
| `CONTROL_ROOM_DOMAIN` | (none) | Public hostname used by the Traefik deploy template. |
| `ORIGIN` | trusted proxy/public origin | Canonical SvelteKit production origin; recommended to set explicitly. |
| `BODY_SIZE_LIMIT` | `30M` | adapter-node request-body cap; sized above terminal upload limits. |
| `AGENT_HEALTH_PORT` | `4001` | Agent HTTP + WS listen port. |
| `AGENT_HEALTH_HOST` | `127.0.0.1` | Agent bind interface (loopback by default). |
| `TERMINAL_GATEWAY_URL` | `http://127.0.0.1:4001` | Frontend → agent base URL. |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | Docker socket (optional). |
| `STATE_DIR` | `/var/lib/control-room/agent` in production | Where `/state/*` + `log.json` live. |
| `HOST_TELEMETRY_INTERVAL_MS` | `15000` | Agent telemetry sample period. |

The frontend does not require a public client-side origin secret/config pair. Deploys set `PUBLIC_BUILD_ID` at build time, while `ORIGIN` identifies the canonical production origin.

---

## Customization

- **Soft keyboard keys** — `frontend/src/lib/features/terminals/types.ts` defines the key catalog and `soft-keyboard.ts` defines supported actions. Toggle per-key visibility in Settings.
- **Agent profiles** — `packages/runtime-config/index.js` lists each agent
  (id, launchCommand, terminalProfile, model).
- **Activity heuristics** — `frontend/src/lib/features/terminals/telemetry.ts` (`detectIdleActivity`) classifies recent output. Tweak there if your agent's "asking for confirmation" prompt doesn't match.
- **Terminal grid/layout** — `frontend/src/routes/control-room-page.css` owns responsive grid columns, shell spacing, and pane framing.
- **Heartbeat glow** — `frontend/src/routes/control-room-page.css`, keyed by `data-heartbeat` on each pane frame.

---

## Troubleshooting

### Oldest pane vanished when I opened a new one
At 16 live sessions (`MAX_TERMINAL_SESSIONS` in
`agent/src/terminal/manager.ts`) the agent evicts the least-recently-updated
session to make room — it doesn't show an error. Close panes you don't need, or
bump the constant and redeploy for a higher cap.

### Pane shows "connecting" forever
- `systemctl status vps-control-room-agent` — agent process up?
- `journalctl -u vps-control-room-agent -n 100` — pty failures?
- `curl -sf http://127.0.0.1:4001/health -H "x-control-room-secret: $SECRET"`
- Make sure `TERMINAL_GATEWAY_URL` points at the agent's actual port.

### Heartbeat glow doesn't appear during normal use
- Glow only fires for agent sessions (`claude`/`codex`/`gemini`/...),
  not for plain `shell` panes — activity detection is keyed to agent
  output patterns. Run "Test heartbeat" to preview the animation.

### After deploy the browser shows the old build
- The service worker auto-purges its cache when `GET /api/version`
  reports a different build id. Ctrl-Shift-R forces an immediate refresh.
- Check `GET /api/version` against the active release and inspect `frontend/src/service-worker.ts` if cache invalidation behavior changes. The build id is injected during the normal deploy; there is no separate version-bump script.

### Cross-browser workspace state is stale
- The agent JSON at `/var/lib/control-room/agent/workspaces.json` is last-write-wins. If two
  browsers were both editing, the most recent PUT wins. The other browser
  catches up on next page load (no realtime push).

---

## Project layout

```
.
├── agent/
│   ├── src/
│   │   ├── app/                       # bootstrap + health-server (HTTP + WS)
│   │   ├── collectors/                # system telemetry (CPU/RAM/disk/net)
│   │   ├── cron/                      # scheduler + HTTP triggers
│   │   ├── fs/                        # explorer + skill listing
│   │   ├── state/                     # JSON state store + log.json
│   │   └── terminal/                  # pty manager + ws/http gateways
│   └── dist/
├── frontend/
│   ├── src/routes/                    # SvelteKit pages + server API routes
│   │   ├── api/auth/                  # HMAC login + logout
│   │   ├── api/terminals/             # pty session/input/resize/SSE stream
│   │   ├── api/state/[key]/           # agent JSON state proxy
│   │   ├── api/log/                   # agent log.json proxy
│   │   ├── api/skills/                # global + project skills (cwd-aware)
│   │   └── browser/                    # optional browser CRUD console
│   └── src/lib/                       # vertical slices, shared UI/state/server helpers
│       ├── features/terminals/        # terminal workspace + Svelte rune state
│       ├── components/                # drawers + UI primitives
│       └── server/                    # authenticated agent gateway helpers
├── ops/traefik/                       # dynamic-config template
├── packages/
│   ├── contracts/                     # shared TS types
│   └── runtime-config/                # environments + agent profiles
├── scripts/
│   ├── deploy.sh                      # canonical deploy (run on host)
│   ├── install-systemd.sh             # one-shot systemd setup
│   └── cleanup-terminal-runtime.sh
├── docs/                              # install, onboarding, runbook, QA, NATIVE-WINDOWS
├── .env.example
├── PRD.md                             # full product spec
└── README.md                          # this file
```

---

## License

[MIT](LICENSE) — use it, fork it, ship it. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the PR flow and [SECURITY.md](SECURITY.md) for the threat model.
