# PRD: VPS Control Room

> **Status (2026-06):** This document reflects the **shipped architecture**, not
> the original v1 plan. The runtime is **HTTP-only**: frontend → agent HTTP/WS
> API → host. There is **no data layer between the frontend and the agent**, and
> **no Convex** — the agent persists state to JSON on the host. Anything described
> under "Roadmap / not yet built" is intentionally a plan, not a claim of what
> ships today. For the canonical runtime summary, see `CLAUDE.md`; for operator
> docs, see `README.md`, `docs/AI-ONBOARDING.md`, and `docs/runbook.md`.

Project slug: `vps-control-room`
Repository: `git@github.com:<your-username>/vps-control-room.git`
Access mode: `Tailscale only`
Target host: `Ubuntu 24.04.4 LTS`, `8 vCPU`, `31 GiB RAM`, `Bun 1.3.x` + `Node.js v22.x`
Package manager: **bun** (lockfile `bun.lock`); the frontend runs on the bun
runtime, the agent daemon stays on Node 22 (node-pty).

## 1. Summary

VPS Control Room is a mobile-first PWA dashboard for driving a single VPS through
a web browser. It is a single-owner control surface, not a public SaaS or a
remote-desktop replacement.

The browser sees a safe web UI; a local host agent owns all privileged access,
gated by a shared gateway secret and bound to loopback by default. What ships
today centers on:

- a multi-pane terminal workspace (xterm.js + websocket ptys, workspaces, session
  tabs, reconnect buffers)
- AI agent / skills launchers per pane (Claude / Codex / Gemini / OpenClaw)
- an Alfa patrol/watcher system that observes panes and emits server-side pings
- host operations through the agent: file CRUD (path-jailed to home/projects),
  host telemetry, and command exec
- single-secret auth over a Tailscale-only domain

The dashboard must stay usable even if other host services (Dokploy, n8n, etc.)
are misbehaving, because the panel and agent run as their own systemd units and do
not depend on any of them to start.

## 2. Product Goals

### 2.1 Primary goals

- Give a single VPS operator a fast, visual, browser-based control surface for the
  host — terminals, files, telemetry — without manual SSH for everyday work.
- Run AI agent CLIs (Claude / Codex / Gemini / OpenClaw) in managed panes with
  activity awareness and heartbeat cues.
- Let one or more panes be patrolled/watched (Alfa) so long-running agents can be
  supervised and pinged.
- Keep host access confined to one trusted component (the agent) behind an
  authenticated gateway, with the frontend never shelling out directly.
- Stay reachable from a phone over Tailscale via a PWA layout.

### 2.2 Desired outcomes

- The operator can open a terminal pane and run a command within seconds of login.
- Multiple agent panes can run concurrently, each showing its activity state
  (idle / working / planning / asking / done).
- Workspace and pane state survive a browser reload and sync across browsers/devices.
- File browsing and host telemetry are available without leaving the dashboard.
- The panel and agent auto-restart under systemd and never expose the host to the
  public internet.

### 2.3 Non-goals

- Not a public multi-tenant SaaS; single-owner only.
- Not a full RBAC / user-management system.
- Not a replacement for Dokploy or a general PaaS.
- Not exposed to the public internet — Tailscale-gated by design.
- Not a command sandbox: the agent runs arbitrary shell commands for the single
  authenticated owner by design. The security boundary is the perimeter (gateway
  secret, loopback bind, Tailscale), not a per-command allowlist.

## 3. User and Use Cases

### 3.1 Primary user

- A single VPS operator / owner.

### 3.2 User profile

- Manages a VPS running many apps and automations.
- Wants browser-based access to terminals and host state from anywhere on their
  tailnet, including a phone.
- Runs AI coding agents on the host and wants to supervise several at once.
- Still needs real control (run commands, browse/edit files) but through a guarded
  surface rather than a raw shell exposed to the network.

### 3.3 Core use cases

- Open one or more terminal panes and run commands on the host.
- Launch an AI agent (Claude / Codex / Gemini / OpenClaw) into a pane, in regular
  or bypass mode, and watch its activity.
- Group panes into workspaces (tab groups) and switch between them.
- Patrol/watch a pane with Alfa so a supervising agent is pinged on events.
- Browse and edit host files through the file explorer.
- Inspect host telemetry (CPU / RAM / disk / network).
- Run scheduled (cron) jobs (validated for type + length bounds).

## 4. Design Principles

- **Host-first**: anything needing host access runs in the agent, never in the browser.
- **Single trust boundary**: the agent is the only component that touches the host
  (pty, filesystem, systemd, Docker socket, journal, fail2ban, ufw).
- **Perimeter trust**: the agent runs commands for a single authenticated owner;
  every privileged endpoint requires the gateway secret, and filesystem ops are
  path-jailed to home/projects. Commands themselves are unrestricted by design.
- **Tailscale only**: the dashboard is never published to the public internet.
- **Single user**: simple, strict auth (shared secret → signed cookie); no complex
  user management.
- **Resilient**: panel and agent are independent systemd units; one collector or
  pane failing must not take down the rest.
- **Portable**: clone the repo, fill env, build, enable systemd, run.

## 5. Architecture

### 5.1 Logical structure

The monorepo has these parts:

- `frontend/` — the Next.js 15 App Router PWA (UI + thin proxy API routes)
- `agent/` — the host agent (Node 22, runs on the VPS, holds all host access)
- `packages/` — shared `contracts/` (TS types) and `runtime-config/` (envs + agent profiles)
- `ops/traefik/` — Traefik dynamic-config template
- `scripts/` — deploy, systemd installer, build-id stamper

There is intentionally **no `backend/` HTTP app and no Convex data layer on the hot
path**. The browser cannot read the Docker socket, systemd, host logs, or the
filesystem directly, so the component that interacts with the OS is the host
**agent**, reached over HTTP/WS — not a normal web backend and not a sync database.

### 5.2 Runtime data flow (HTTP-only)

```
browser ──► frontend (Next.js, :4000)
                │   HMAC-signed cookie auth; thin proxy routes add the
                │   control-room secret header
                ▼
            agent (Node 22, :4001)  ──► host: pty (node-pty), filesystem,
                │   HTTP + WebSocket      systemd, Docker socket, journal,
                │                         fail2ban, headless browser
                ▼
            agent/var/*.json  (workspace + session state, log.json)
```

1. The user acts in the frontend (open pane, type, browse files, launch an agent).
2. The frontend's Next.js proxy routes forward the request to the agent's HTTP/WS
   API, attaching the control-room secret via the `x-control-room-secret` header.
3. The agent authenticates the gateway secret, then executes on the host (pty I/O,
   path-jailed fs ops, command exec, telemetry, browser CRUD, patrol).
4. Results stream back over HTTP/WS; durable state (workspaces, sessions, log) is
   persisted as JSON under the agent's `STATE_DIR` (`agent/var/`).

No reactive database sits between the frontend and the agent. Cross-pane UI state
(colors, heartbeat) is shared in-browser via a module-level
`useSyncExternalStore` snapshot, hydrated from `localStorage`; cross-browser
workspace state is the agent's authoritative JSON (last-write-wins).

### 5.3 Runtime placement

- `frontend`: Next.js app on the host via `systemd`
  (`vps-control-room-frontend.service`, port `4000`).
- `agent`: Node process on the host via `systemd`
  (`vps-control-room-agent.service`, HTTP + WS on `4001`). Binds loopback by
  default so the privileged host API is not network-exposed.
- The agent is the **only** component allowed to interact with the Docker socket,
  `systemctl`, `journalctl`, `fail2ban-client`, `ufw`, the filesystem, ptys, and a
  headless browser.

### 5.4 Convex: not used

Convex is **not** part of Control Room's runtime. State persists to JSON on the
agent host (`agent/var/`, `~/.openclaw/`). The standalone Convex CLI that once
referenced it has been removed; any `CONVEX_*` left in older scripts is dead
configuration the dashboard never reads.

## 6. Tech Stack

| Layer | Technology |
|---|---|
| UI framework | Next.js 15 App Router + React 19 |
| Styling | Tailwind CSS |
| Component library | shadcn/ui |
| Terminal | xterm.js (frontend) ↔ node-pty (agent) over WebSocket |
| Frontend → agent transport | HTTP + WebSocket (REST proxy routes + ws stream) |
| Host integration | Node.js 22, raw `child_process` (no command allowlist), Docker socket HTTP |
| Durable state | JSON files under the agent's `STATE_DIR` (`agent/var/`) |
| Auth | shared secret via env + HMAC-SHA256 signed session cookie |
| Process manager | systemd |
| Edge routing | Traefik (Tailscale-only domain) |
| Host OS | Ubuntu 24.04.4 LTS |

Notes:

- Live pty output streams over a per-pane WebSocket; other agent data is plain
  HTTP. There is no SSE-as-backbone and no reactive sync DB.
- Collectors and the executor live in the **agent**, never in a Next.js route handler.
- The Next.js `api/*` routes are thin proxies that authenticate and forward to the
  agent — they do not execute host commands themselves.

## 7. Functional Requirements (shipped)

### 7.1 Terminal workspace

- **Up to 16 concurrent pty sessions** (`MAX_TERMINAL_SESSIONS` in
  `agent/src/terminal/manager.ts`). Opening a 17th evicts the least-recently-updated
  session (LRU) rather than erroring. Each session keeps a ring buffer (~250k chars)
  and survives short reconnects.
- **Per-pane WebSocket stream** with auto-reconnect and a connection chip
  (`connecting / open / closed`).
- **Profiles**: plain `shell`, plus AI agent launchers (`claude`, `codex`,
  `gemini`, `openclaw`), defined in `packages/runtime-config/`.
- **Activity detection**: agent panes classify `idle → working → planning →
  asking → done` from output patterns, driving the heartbeat glow.
- **Broadcast input**: send the same keystrokes to every visible pane.
- **Duplicate / rename** panes inline.

### 7.2 Workspaces (tab groups)

- Create / rename / delete workspaces from the top bar; each pane maps to a
  workspace, and switching tabs filters which panes mount in the grid.
- **Cross-browser sync**: workspace list, session→workspace map, and active id are
  stored on the agent (`agent/var/workspaces.json`) via `GET/PUT /state/workspaces`.
  The frontend hydrates from `localStorage` first (instant render), then overwrites
  with the agent's authoritative copy. Edits are debounced and pushed back;
  last-write-wins, no realtime push.

### 7.3 Pane actions menu (kebab)

A single-row pane header (`[title] [activity chip] [⋮]`) opens a tabbed modal:

- **Agents** — configured agent profiles, each with `Regular` and `Bypass`
  (`--dangerously-skip-permissions` / `--yolo`) launches.
- **Skills** — global skills (`~/.agents/skills`, `~/.claude/skills`) plus project
  skills resolved by walking up from the pane's `cwd` to a marker
  (`.git`, `package.json`, `deno.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`).
- **Actions** — View (maximize / focus + 4-step zoom), Pane (Browse folders,
  Duplicate), Move-to-workspace, and Close (danger).

### 7.4 View modes and mobile

- **Single** (tab strip) and **Grid** (tiled, `Auto` or fixed 1–4 columns).
- **Desktop grid**: each row is `(100dvh − var(--terminal-tops-h)) / 2` so two rows
  fit and a third begins the scroll instead of squashing panes.
- **Mobile**: portrait collapses to one column with a per-pane two-row soft keyboard
  above the OS keyboard (Esc / Shift+Tab / Tab / Ctrl+C; arrows + optional
  Clear / Paste / Copy / Select-all).

### 7.5 Heartbeat glow

- **Heartbeat glow**: pulsing outer-ring around any pane whose agent activity is
  `working` / `planning` / `asking`. Honors `prefers-reduced-motion`. Only AI agent
  panes trigger the glow (plain shells stay quiet), and a "Test heartbeat" button
  in Settings previews it.

### 7.6 Alfa patrol / watcher system

- A pane can be patrolled by Alfa: a watcher observes activity and the agent emits
  **server-side patrol pings** (`/patrol/pending`, with per-ping `ack`), so a
  supervising agent runs headless without needing an open browser tab.
- Watcher registration is exposed through the frontend (`/api/alfa/watchers`) and
  the agent's patrol scheduler/queue (`agent/src/patrol/`).

### 7.7 File explorer and file CRUD

- The file explorer dialog is backed by the agent's filesystem API:
  `GET /fs/list`, `/fs/read`, `/fs/write`, `/fs/mkdir`, `/fs/move`, `/fs/copy`,
  `/fs/delete`, `/fs/usage` (`agent/src/fs/`). The frontend reaches these through
  proxy routes (e.g. `api/fs/list`).
- Lets the operator browse, `cd`, and perform file CRUD from the dashboard.

### 7.8 Headless browser CRUD agent (optional, external)

- **Optional add-on, not bundled.** control-room ships no browser runtime; the
  agent proxies to a paired **os-vps** deployment that runs the headless browser
  (set `OS_VPS_URL` + `OS_AGENT_TOKEN`; inert until both are set). Routes are
  exposed under `:4001/browser/*` (`agent/src/browser/`), reached from the
  frontend via `api/browser/crud`. Read/write (CRUD) automation against web
  targets — see `docs/browser-crud.md`.

### 7.9 Host telemetry and exec

- **Telemetry**: the agent samples host metrics (CPU / RAM / disk / network) on an
  interval (`HOST_TELEMETRY_INTERVAL_MS`, default 15s) via `agent/src/collectors/`.
  Each collector is wrapped in try/catch so one failure does not stop the others.
- **Command exec**: `POST /exec` runs a shell command on the host via
  `agent/src/exec/run.ts`, gated by the gateway secret (single-owner trust — the
  pty terminals already provide the same arbitrary-command access by design).

### 7.10 Cron jobs

- A small cron runner (`agent/src/cron/`) with an HTTP API; the frontend has a
  cron drawer (`frontend/src/features/crons/`, routes `api/crons`,
  `api/crons/[id]`, `api/crons/[id]/run`) to inspect schedules and trigger ad-hoc
  runs. Cron actions are validated for type and length bounds
  (`agent/src/cron/validate.ts`, max 4000 chars) — not against a command allowlist.

### 7.11 Templates

- Save a pane configuration (profile, cwd, model, agent flags) as a named template
  and relaunch with one click (`frontend/src/features/templates/`, persisted to
  `localStorage`).

### 7.12 Audit log

- Agent actions are recorded to the agent's JSON audit log (under the
  agent's `STATE_DIR`, surfaced via `/log` and `api/log`). The CLI tags its actions
  `requested_by=manual-cli` so they are distinguishable from web-dashboard actions.
- There is **no Convex `audit_log` table** on the runtime path; the audit trail is
  the agent-side JSON log.

### 7.13 PWA + cache recovery

- Service worker stamped per build (`vps-control-room-v<commit12>`); cache-recovery
  defenses include an early-asset error trap, `forceFreshReload()`, and a
  `VersionGuard` polling `GET /api/version`. Installable as a PWA on iOS/Android.

## 8. Non-Functional Requirements

### 8.1 Availability

- Frontend and agent auto-restart via systemd (`Restart=always`).
- The dashboard stays usable even if other host services are down — they are not
  startup dependencies of the panel or agent.
- One failing collector or pane must not break the rest of the UI; each dashboard
  page has an `error.tsx` sibling and collectors are individually guarded.

### 8.2 Performance

- Terminal interaction should feel local over a normal Tailscale link.
- Telemetry sampling is interval-based, not an aggressive loop.
- Light production servers (built, not `next dev`) are used in real deployments to
  avoid CPU spikes when many panes are open.

### 8.3 Security

- The panel binds to host/Tailscale per config; the agent binds loopback by default
  so the privileged host API is not network-exposed (set `0.0.0.0` only for
  cross-host use).
- Every agent endpoint requires the control-room secret header (constant-time
  compared); every dashboard route requires a valid session cookie.
- The security boundary is the perimeter — gateway-secret auth on every privileged
  endpoint, loopback bind, Tailscale-only origin — plus filesystem path-jailing to
  home/projects roots. Commands themselves are not allowlist-validated; the
  single authenticated owner runs arbitrary shell by design.
- Secrets are never sent to the client (never in `NEXT_PUBLIC_*`).
- Only the agent may access the Docker socket and other privileged host interfaces.

### 8.4 Operability

- Health endpoints exist for both components (`GET /api/health` on the frontend,
  `GET /health` on the agent).
- Both run under systemd with readable `journalctl` logs.
- Env config is concise and documented in `.env.example` and `README.md`.

## 9. Collector and Host-Integration Design

Collectors and the executor run in the **agent**, never in a Next.js route.

### 9.1 System telemetry collector

Source: `/proc/stat`, `/proc/meminfo`, `/proc/uptime`, `/proc/net/dev`,
`/proc/loadavg`, and disk usage.
Output: CPU total/per-core, RAM, disk per mount, uptime, network in/out, load avg.
Interval: `HOST_TELEMETRY_INTERVAL_MS` (default 15s).
Note: on Windows local installs, CPU/RAM/disk report real values but load average
and network rates read zero (the OS does not expose them).

### 9.2 Docker socket (optional)

Source: Docker socket (`DOCKER_SOCKET_PATH`, default `/var/run/docker.sock`).
Used where container visibility/actions are wired in; optional and only active when
the socket is reachable and the agent user is in the `docker` group.

### 9.3 Filesystem

Source: the host filesystem via the agent's `fs` module (list / read / write /
mkdir / move / copy / delete / usage), each scoped and guarded.

### 9.4 Headless browser (optional, external)

Source: an optional paired **os-vps** deployment the agent proxies to
(`agent/src/browser/`), exposed under `/browser/*` for CRUD automation. Inert
unless `OS_VPS_URL` + `OS_AGENT_TOKEN` are set — see §7.8.

## 10. Command Execution Model

All host commands run inside the **agent**.

### 10.1 No command allowlist — the perimeter is the boundary

- There is **no command allowlist**. `POST /exec` runs the raw shell string via
  `child_process.exec` (`agent/src/exec/run.ts`), and the pty terminals run arbitrary
  commands by design — this is a single-owner web shell.
- The real guards are perimeter, not per-command:
  - **Gateway-secret auth** on every privileged endpoint (`x-control-room-secret`,
    constant-time compared — `agent/src/terminal/auth.ts`,
    `requireGatewayAuth` in `agent/src/app/http-json.ts`).
  - **Loopback bind** by default (`127.0.0.1`, `AGENT_HEALTH_HOST`), so the
    privileged host API is never network-exposed.
  - **Filesystem path-jailing**: file ops are confined to home/projects roots
    (`agent/src/fs/explorer.ts`, `agent/src/fs/mutate.ts` — "Path outside allowed
    roots"). This is path containment for FS operations, not command allowlisting.
  - **Tailscale-only origin** via Traefik, behind single shared-secret auth → signed
    cookie.

### 10.2 Validation

- Filesystem operations validate their target path against the allowed roots.
- Cron actions are validated for type and length bounds only
  (`agent/src/cron/validate.ts`, max 4000 chars).
- Sensitive UI actions can require explicit confirmation.

### 10.3 Result lifecycle

- `queued` → `running` → `success` / `failed` / `timeout` / `cancelled`.

## 11. Frontend Route Structure

Frontend lives in `frontend/`, App Router. The terminal workspace is the core
feature surface (`frontend/src/features/terminals/`).

```text
frontend/
├── app/
│   ├── login/                          # HMAC login page
│   ├── view/                           # main authenticated dashboard
│   ├── api/
│   │   ├── auth/login | logout | devices
│   │   ├── terminals/                  # session / input / resize / stream / buffer / upload
│   │   ├── state/[key]/                # agent JSON state proxy (workspaces, …)
│   │   ├── fs/list                     # file explorer proxy
│   │   ├── skills/                     # global + project skills (cwd-aware)
│   │   ├── browser/crud                # headless-browser CRUD proxy
│   │   ├── alfa/watchers[/id]          # patrol watcher registration
│   │   ├── patrol/pending[/id/ack]     # server-side patrol pings
│   │   ├── crons[/id[/run]]            # cron drawer
│   │   ├── log/                        # agent audit/log.json proxy
│   │   ├── health/                     # GET health check
│   │   └── version/                    # build id (cache-busting)
│   └── styles/                         # base, drawers, keyboard, terminals…
├── src/
│   ├── features/
│   │   ├── terminals/                  # the entire terminal workspace
│   │   │   ├── components/             # pane, kebab, soft keyboard …
│   │   │   ├── hooks/                  # sessions, workspaces, settings …
│   │   │   └── server/                 # agent fetcher helpers
│   │   ├── crons/
│   │   └── templates/
│   └── shared/
└── middleware.ts                       # auth guard — redirect to /login if cookie invalid
```

Notes:

- Frontend `api/*` routes are thin proxies: they authenticate the request, attach
  the `x-control-room-secret` header, and forward to the agent. They do not execute
  host commands.
- Live pty output is a WebSocket stream (`api/terminals/[id]/stream`), not a route
  handler loop.
- Every dashboard surface has an `error.tsx` so one panel crashing does not take
  down the whole dashboard.

## 12. Repo Structure

```text
.
├── frontend/                # Next.js 15 PWA (UI + thin proxy api/*)
│   ├── app/                 # login, view, api/*, styles
│   ├── src/features/        # terminals, crons, templates
│   └── middleware.ts
├── agent/                   # Node 22 host agent (all host access)
│   └── src/
│       ├── app/             # bootstrap + health-server (HTTP + WS)
│       ├── terminal/        # pty manager + ws/http gateways
│       ├── collectors/      # host telemetry
│       ├── fs/              # explorer + file CRUD (path-jailed) + skills listing
│       ├── exec/            # host command exec, no allowlist
│       ├── browser/         # headless browser CRUD
│       ├── patrol/          # Alfa scheduler + ping queue
│       ├── cron/            # cron runner + HTTP triggers
│       ├── state/           # JSON state store + log.json
│       ├── config.ts
│       └── index.ts
├── packages/
│   ├── contracts/           # shared TS types
│   └── runtime-config/      # environments + agent profiles
├── ops/traefik/             # dynamic-config template
├── scripts/
│   ├── deploy.sh            # canonical deploy (run on host)
│   ├── install-systemd.sh   # one-shot systemd setup
│   ├── bump-version.sh      # build-id stamper
│   └── cleanup-terminal-runtime.sh
├── docs/                    # install, onboarding, runbook, audits, native-shell
├── .env.example
├── PRD.md                   # this file
└── README.md
```

## 13. Environment Variables

Required (frontend + agent):

```env
CONTROL_ROOM_SECRET=          # login secret + agent gateway header; openssl rand -hex 32
CONTROL_ROOM_SESSION_SECRET=  # different value; HMAC key for the session cookie
NEXT_PUBLIC_APP_URL=          # https://<tailnet-domain>
NEXT_PUBLIC_APP_HOST=         # hostname only
```

Optional:

```env
AGENT_GATEWAY_SECRET=         # dedicated machine secret for frontend→agent; falls back to CONTROL_ROOM_SECRET
CONTROL_ROOM_PORT=4000        # frontend bind
CONTROL_ROOM_HOST=            # agent reach-address for frontend
AGENT_HEALTH_PORT=4001        # agent HTTP + WS listen port
AGENT_HEALTH_HOST=127.0.0.1   # agent bind interface; loopback by default
TERMINAL_GATEWAY_URL=http://127.0.0.1:4001   # frontend → agent base URL
STATE_DIR=                    # where /state/* + log.json live (default <agent cwd>/var)
HOST_TELEMETRY_INTERVAL_MS=15000
DOCKER_SOCKET_PATH=/var/run/docker.sock
SESSION_EXPIRY_HOURS=24        # cookie lifetime (middleware slides it forward on activity)
```

Notes:

- Never put secrets in `NEXT_PUBLIC_*` — those are baked into the client bundle.
- `CONTROL_ROOM_SESSION_SECRET` must differ from `CONTROL_ROOM_SECRET`: the former
  signs cookies, the latter gates login + the agent gateway header.

## 14. Auth Design

Single-user and Tailscale-only, so auth is deliberately simple:

- The login page accepts a secret token.
- The server verifies it against `CONTROL_ROOM_SECRET`.
- On success it sets an **HMAC-SHA256** signed session cookie keyed by
  `CONTROL_ROOM_SESSION_SECRET` (a separate key from the login secret).
- Every dashboard page and proxy route requires a valid cookie; the agent
  additionally requires the secret header on every endpoint.

Cookie flags: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age` from
`SESSION_EXPIRY_HOURS`. The auth middleware slides the expiry forward on activity,
so an active session does not log out; the cap applies only after idle.

Local installs set `CONTROL_ROOM_LOCAL_TRUST=1` so a correct password auto-approves
the machine (no device-approval step); on a VPS that flag is off and a device must
be approved once.

Must not: store the raw secret in `localStorage`, resend the raw secret on every
request, or persist sessions in a database (a stateless signed cookie is enough).

## 15. systemd Deployment

Two units:

- `vps-control-room-frontend.service`
- `vps-control-room-agent.service`

Both are generated by `scripts/install-systemd.sh` relative to the repo root, with
`WorkingDirectory` at the repo path and `EnvironmentFile` at `<repo>/.env.local`.
`WantedBy=multi-user.target`, `Restart=always`.

- Frontend: `bun --bun node_modules/.bin/next start --hostname 0.0.0.0 --port 4000`.
- Agent: `node agent/dist/index.js` — the daemon stays on Node: under Bun 1.3
  node-pty never emits data and `Bun.Terminal` gives the child no controlling
  tty (no job control, no `setsid`), breaking Ctrl-C and process-group kill.

The agent user must be in the `docker` group for the optional Docker collector, and
a narrow sudoers drop-in (`/etc/sudoers.d/vps-control-room`) grants only the
specific `systemctl` / `fail2ban-client` commands the app uses — never blanket root.

### 15.1 Build and deploy flow

Deploy is run on the host:

```bash
git pull origin main
bash scripts/deploy.sh main
```

`scripts/deploy.sh` (in order): acquires a flock lock; requires `.env.local` and the
Traefik template; on CI it does `git reset --hard origin/<branch>`, otherwise builds
the working tree; runs the typecheck preflight; stamps the build id
(`scripts/bump-version.sh`); builds the frontend into `.next-staging`; rebuilds the
agent if its source changed; restarts both systemd services; atomically promotes
`.next-staging → .next` (keeping `.next-previous` for one-shot rollback); syncs the
Traefik dynamic config; and verifies both services are active.

> The deploy script and `docs/runbook.md` still contain a Convex deploy step. That
> is the disclosed pending refactor — it is not required for the HTTP-only
> dashboard to run, and the CLI is the only consumer of Convex.

### 15.2 Edge routing (Traefik)

A dynamic-config template lives at `ops/traefik/vps-control-room.yml`; the deploy
script envsubst's and syncs it into Traefik's dynamic-config directory on each run.
It routes the Tailscale-only domain to the frontend (`:4000`) and the terminal
gateway / WebSocket (`/ws/terminals`) to the agent (`:4001`).

### 15.3 GitHub Actions

`.github/workflows/deploy.yml` is `workflow_dispatch:` only — a push does not
auto-deploy. Day-to-day deploys happen on the host via `scripts/deploy.sh`.

## 16. Local Install (no VPS)

The project also runs entirely on a laptop (Windows / macOS / Linux) with no VPS,
SSH, or domain, via `install.sh` / `install.ps1` and the cross-platform `vps-cr`
CLI:

- `vps-cr` — start both parts + open the default browser.
- `vps-cr app` — full dashboard in a native WebView2/Edge window (light).
- `vps-cr term [n]` / `vps-cr ssh [target]` — native terminal/SSH panes (no browser).
- `vps-cr build` — build the light production servers (recommended once).
- `vps-cr doctor [--fix]`, `vps-cr status`, `vps-cr stop`, device-management subcommands.

For AI-assisted local onboarding, follow `docs/AI-ONBOARDING.md`; the human guide is
`docs/INSTALL-LOCAL.md`.

## 17. Distribution

- Installer: `bunx rahman-cr install --vps user@<ip> --domain <tailnet>` clones the
  repo, generates two secrets, runs `install-systemd.sh` + `deploy.sh main`. The
  `rahman-cr` npm package is published separately (its source is not vendored here).
- `bunx rahman-cr ai claude` walks a user through setup interactively.
- A real packaged `.exe` (Tauri, reusing WebView2) is planned for a later phase.

## 18. Risks and Mitigations

### Risk: the control room becomes a new attack surface

- Tailscale only; signed-session auth; per-endpoint secret header (constant-time
  compared); agent bound loopback by default so the privileged host API is never
  network-exposed; agent JSON audit log. The shell is reachable only through the
  authenticated, loopback-bound perimeter, not over the open network.

### Risk: the agent is too powerful

- Single-owner trust by design: the agent runs arbitrary commands for the one
  authenticated owner. It is contained by the perimeter (gateway secret, loopback
  bind, Tailscale), filesystem path-jailing to home/projects roots, and a narrow
  sudoers drop-in — not by a command allowlist.

### Risk: another host service is down

- Panel and agent are independent systemd units with `Restart=always`; the
  dashboard does not depend on Dokploy/n8n/etc. to start; individual collectors are
  guarded so one failure does not cascade.

### Risk: stale browser build after deploy

- Per-build service-worker cache name + `VersionGuard` polling `/api/version`
  auto-purge the old cache; `forceFreshReload()` is available as a hard reset.

## 19. Roadmap / Not Yet Built

These were in the original v1 plan or are natural extensions. They are **not shipped
as dedicated UI today** and are listed here so the distinction is clear.

### 19.1 Dedicated monitoring panels

- A unified **Overview** dashboard (CPU/RAM/disk/uptime/network cards + quick status
  badges for core services).
- Dedicated panels for **Dokploy apps**, **n8n**, **Ollama**, **UFW/firewall**,
  **fail2ban**, and **SSH security** events. Host telemetry collection exists in the
  agent, but these are not built as bespoke dashboard pages.
- An **Apps & Services** panel (Docker/Dokploy app health, ports, last deploy,
  restart actions with confirmation) and an **Agents** process panel.
- An **Events timeline** (append-only, live) and a filterable **Audit** UI beyond
  the current agent-side JSON log surfaced via `/log`.
- An alerting system with thresholds (CPU/RAM/disk warn/critical) and active /
  resolved alert lifecycle.

### 19.2 Action surfaces

- A future guarded **Command Console** (it could add a preset command allowlist and
  read-only mode — neither exists today) and a structured **action pipeline** UI
  (restart container/service, redeploy via Dokploy, unban IP) with confirmation
  dialogs. The agent today exposes raw command exec and a path-jailed filesystem
  API; both the preset allowlist and the dedicated action UI are roadmap.

### 19.3 Native packaging

- A packaged native app (Tauri / WebView2) for a real installable `.exe` and
  store distribution.

## 20. Definition of Done (shipped baseline)

The shipped baseline is considered done because:

- The repo has `frontend/` and `agent/`, with shared code in `packages/`.
- The frontend logs in (HMAC cookie) and serves the terminal-workspace dashboard.
- The agent owns host access (pty, fs, exec, telemetry, browser) over HTTP/WS, with
  no data layer between frontend and agent.
- Multi-pane terminals, workspaces, agent/skills launchers, Alfa patrol, file CRUD,
  host telemetry, and cron all work end-to-end.
- Every privileged endpoint requires the gateway secret, the agent binds loopback by
  default, and filesystem ops are path-jailed to home/projects roots; the audit trail
  is the agent-side JSON log.
- Both components run under systemd with auto-restart, behind a Tailscale-only
  Traefik route.
