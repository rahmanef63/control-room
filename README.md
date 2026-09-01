# VPS Control Room — v2.0

[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)
&nbsp;![PWA installable](https://img.shields.io/badge/PWA-installable-38bdf8)
&nbsp;![SvelteKit 2](https://img.shields.io/badge/SvelteKit-2-ff3e00)
&nbsp;![Node 22](https://img.shields.io/badge/Node-22-339933)
&nbsp;![self-hosted](https://img.shields.io/badge/self--hosted-single--owner-a855f7)

A mobile-first PWA dashboard for driving a single VPS through a web browser:
multi-pane terminals (up to 16 concurrent ptys), AI agent launchers, host
ops, and audit — all behind a single shared secret and a Tailscale-only
domain.

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
┌─ frontend/  SvelteKit 2 + Svelte 5 runes + Tailwind 4, adapter-node on Bun
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
| ⚡ **One-line** | `bunx rahman-cr install --vps user@ip --domain X` | ~10 min | Already have SSH + Tailscale key + domain ready |
| 🛠️ **Manual** | follow [docs/ONBOARDING.md](docs/ONBOARDING.md) | ~30 min | Want to read each step before running it |
| 💻 **Local (this PC)** | one line — see [docs/INSTALL-LOCAL.md](docs/INSTALL-LOCAL.md) | ~5 min | Run the whole thing on your laptop — no VPS, SSH, or domain |

Step-by-step roadmap (VPS prep → SSH → Tailscale → DNS → install → verify):
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
browser ──► frontend (SvelteKit adapter-node on Bun)            ─┐
                ▼                          │ HMAC-signed cookie auth
                HTTP / WS (control-room   ─┘ over Tailscale
                secret)
                ▼
            agent (Node 22) ──► host kernel, Docker socket, systemd,
                                fail2ban, journalctl, file system
                ▼
            agent/var/*.json  (workspace state, future log.json)
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
- Origin is locked down by Traefik to the Tailscale domain.

---

## Features

### Terminal workspace

- **Up to 16 concurrent pty sessions** (`MAX_TERMINAL_SESSIONS` in
  `agent/src/terminal/manager.ts`). Opening a 17th evicts the
  least-recently-updated session (LRU) rather than erroring. Each session keeps a
  ring buffer of up to 250k chars and survives short reconnects.
- **Per-pane WebSocket stream** with auto-reconnect and connection chip
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
  are stored on the agent in `agent/var/workspaces.json` via
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

### Auth & access

- **HMAC-SHA256 cookie**: `CONTROL_ROOM_SECRET` gates `/api/auth/login`;
  on success a cookie signed with `CONTROL_ROOM_SESSION_SECRET` (different
  value) is set for `SESSION_EXPIRY_HOURS` (default 72 — 3 days; middleware
  slides it forward on activity, so an active dashboard never logs out).
- **Tailscale only**: production is bound to a Tailscale-only domain via
  Traefik. Public Internet should never reach the panel.
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

Workspace state is shared via `agent/var/workspaces.json`, so opening the
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

This installs unit files with `WorkingDirectory` pointing at the repo path
the script was invoked from, and `EnvironmentFile` pointing at
`<repo>/.env.local`.

### Traefik

A dynamic-config template lives at `ops/traefik/vps-control-room.yml`. The
deploy script envsubst's it and syncs to `/etc/dokploy/traefik/dynamic/`
on each run. Bind your Tailscale-only domain there.

---

## Deploy

```bash
bash scripts/deploy.sh main
```

What it does (in order):

1. Acquires `/tmp/vps-control-room-deploy.lock` so deploys cannot race.
2. Validates `.env.local` and the Traefik template.
3. In normal mode, fast-forwards from `origin/<branch>` without discarding local work. For an explicitly local deployment, `DEPLOY_FROM_WORKTREE=1` builds the current worktree without fetching, pulling, or changing GitHub state.
4. Installs the canonical frontend with the frozen Bun lockfile, then runs `svelte-check`, unit tests, `vite build`, and `git diff --check`.
5. Copies the adapter-node build into an immutable `frontend/releases/svelte-<timestamp>-<sha>/` release.
6. Tests/builds/restarts the Node agent only when `agent/` changed; frontend-only deploys verify that the agent PID stays unchanged.
7. Syncs Traefik and regenerates the Svelte-native systemd unit.
8. Switches the frontend unit to the new immutable release. Adapter-node receives a bounded graceful drain window for long-lived SSE connections. If the new service fails health/login checks, the previous release is restored automatically.
9. Stops stale migration preview units and prunes old inactive releases while retaining rollback material.

### GitHub Actions

`.github/workflows/deploy.yml` is `workflow_dispatch:` only. Push does not
auto-trigger. To trigger remotely: GitHub → Actions → "Deploy VPS Control
Room" → Run workflow. The workflow stages env from
`$HOME/.config/control-room/.env.local` on the self-hosted runner before
delegating to `scripts/deploy.sh`.

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
| `STATE_DIR` | `<agent cwd>/var` | Where `/state/*` + `log.json` live. |
| `HOST_TELEMETRY_INTERVAL_MS` | `15000` | Agent telemetry sample period. |

The frontend does not require a public client-side origin secret/config pair. Deploys set `PUBLIC_BUILD_ID` at build time, while `ORIGIN` identifies the canonical production origin.

---

## Customization

- **Soft keyboard keys** — `frontend/src/features/terminals/lib/utils.ts`,
  `SOFT_KEYBOARD_KEYS`. Toggle per-key visibility in Settings.
- **Agent profiles** — `packages/runtime-config/index.js` lists each agent
  (id, launchCommand, terminalProfile, model).
- **Activity heuristics** — `frontend/src/features/terminals/lib/utils.ts`
  (`detectIdleActivity`) classifies recent output. Tweak there if your
  agent's "asking for confirmation" prompt doesn't match.
- **Grid row height** — adjust `--terminal-tops-h` in
  `frontend/app/styles/terminals/pane-stack.css` if you add or remove a top bar.
- **Heartbeat glow** — `frontend/app/styles/terminals/heartbeat.css`, the
  `pane-heartbeat-glow` keyframes.

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
- Check `frontend/public/sw.js` first two lines — they should show the
  current commit prefix. If not, `bash scripts/bump-version.sh $(git rev-parse HEAD | cut -c1-12)`
  manually and redeploy.

### Cross-browser workspace state is stale
- The agent JSON at `agent/var/workspaces.json` is last-write-wins. If two
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
├── docs/                              # install, onboarding, runbook, AUDIT-2026-06,
│                                      # PROGRESS-2026-06, NATIVE-WINDOWS
├── .env.example
├── PRD.md                             # full product spec
└── README.md                          # this file
```

---

## License

[MIT](LICENSE) — use it, fork it, ship it. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the PR flow and [SECURITY.md](SECURITY.md) for the threat model.
