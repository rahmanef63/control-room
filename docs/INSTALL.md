# Install Roadmap — Control Room v2.0.0

Control Room v2 is a **terminal-first browser/PWA multiplexer**: persistent PTYs,
terminal panes, workspaces, reconnect, mobile controls, history/templates, and a
small set of terminal-adjacent helpers.

This document covers the two supported installation modes:

| Mode | Use it when | Entry point |
|---|---|---|
| **Local** | Run Control Room on your own Windows/macOS/Linux machine | [INSTALL-LOCAL.md](./INSTALL-LOCAL.md) |
| **Production VPS** | Run the frontend + privileged PTY agent as systemd services | This document / [ONBOARDING.md](./ONBOARDING.md) |

The repository does **not** ship a `rahman-cr` npm/bunx installer. Local one-line
installers are the tracked `install.sh` / `install.ps1`; production deploys use
`scripts/deploy.sh`.

---

## 1. Runtime requirements

### Production Linux host

- Ubuntu 22.04+; Ubuntu 24.04 LTS is the primary target.
- Node.js **22**.
- Bun **1.3+** for install, tests, and builds.
- Git.
- `sudo` with non-interactive permission for the trusted deploy operator
  (`scripts/deploy.sh` fails closed if `sudo -n true` fails).
- HTTPS reverse proxy.

Recommended starting resources:

| Resource | Minimum | Recommended |
|---|---:|---:|
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 1 GB | 2+ GB |
| Free disk | 5 GB | 10+ GB |

The production frontend is a SvelteKit adapter-node build and runs on **Node 22**.
The privileged agent also runs on **Node 22** because `node-pty` terminal/job-control
semantics are critical. Bun remains the package/test/build toolchain.

### Local Windows/macOS/Linux

Use [INSTALL-LOCAL.md](./INSTALL-LOCAL.md). The same Node 22 + Bun 1.3+
requirements apply.

---

## 2. Network model

The privileged agent defaults to:

```text
127.0.0.1:4001
```

Only the frontend should be routed to users:

```text
browser / PWA
    │ HTTPS
    ▼
reverse proxy
    │
    ▼
frontend :4000
    │ authenticated machine secret
    ▼
agent 127.0.0.1:4001
    │
    ▼
node-pty terminal processes
```

A private network such as Tailscale is **recommended defense in depth**, but it
is not a runtime dependency. If you expose the frontend through a public HTTPS
domain, use strong independent secrets, device approval, the shipped security
headers/rate limiting, and keep port 4001 loopback-only. See
[../SECURITY.md](../SECURITY.md).

### Bundled production proxy path

The current `scripts/deploy.sh` publishes the tracked Traefik template to:

```text
/etc/dokploy/traefik/dynamic/vps-control-room.yml
```

and the template sends traffic to the host frontend at `172.17.0.1:4000`.
Therefore the **bundled production deploy path assumes the existing
Dokploy/Traefik layout**. If your host uses another reverse proxy, keep the same
security boundary but adapt the proxy/deploy step instead of copying the Dokploy
path blindly.

---

## 3. Clone and install dependencies

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/rahmanef63/control-room.git
cd control-room

bun install --cwd frontend
bun install --cwd agent
```

For reproducible CI/release verification, use `--frozen-lockfile` once the
checkout already has its lockfiles:

```bash
bun install --cwd frontend --frozen-lockfile
bun install --cwd agent --frozen-lockfile
```

---

## 4. Configure environment

Create the private root environment file:

```bash
cp .env.example .env.local
$EDITOR .env.local
```

Generate three independent high-entropy values:

```bash
openssl rand -hex 32   # CONTROL_ROOM_SECRET
openssl rand -hex 32   # CONTROL_ROOM_SESSION_SECRET
openssl rand -hex 32   # AGENT_GATEWAY_SECRET
```

Required/recommended values:

```dotenv
CONTROL_ROOM_SECRET=<login-secret>
CONTROL_ROOM_SESSION_SECRET=<different-session-signing-secret>
AGENT_GATEWAY_SECRET=<different-frontend-to-agent-secret>
CONTROL_ROOM_DOMAIN=control.example.com
ORIGIN=https://control.example.com
AGENT_HEALTH_HOST=127.0.0.1
```

`AGENT_GATEWAY_SECRET` technically falls back to `CONTROL_ROOM_SECRET` for
compatibility, but a separate value is the recommended production configuration.

Do not commit `.env.local`.

### Optional terminal defaults

```dotenv
SHELL=/bin/bash
TERMINAL_DEFAULT_CWD=/home/<your-user>
```

The tracked `config/control-room.runtime.json` is deliberately generic. It may be
customized with terminal environments or named CLI profiles, but those entries
must remain terminal launch metadata—not project-specific control-plane logic.
An empty environment `cwd` means “use `TERMINAL_DEFAULT_CWD` / host default.”

---

## 5. Optional private-network setup

Tailscale is useful when you want the frontend reachable only from your tailnet.
It is optional.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4
```

You can then either use your tailnet hostname or point an appropriate private DNS
record at the Tailscale address. Do not change `AGENT_HEALTH_HOST` to expose port
4001; the frontend and agent can communicate over loopback on the same host.

---

## 6. Verify the checkout before production deploy

The repository-level quality gate is:

```bash
bun run verify
```

It covers:

- Svelte diagnostics and ESLint;
- repository engineering/docs/evidence checks;
- agent + frontend coverage gates;
- dependency audits;
- production frontend + agent builds;
- bundle budget;
- Playwright responsive/accessibility/security/terminal lifecycle tests.

A successful build alone is not the release gate.

---

## 7. Deploy to the VPS

From a trusted checkout whose `.env.local` is configured:

```bash
bash scripts/deploy.sh main
```

By default the deploy script may fetch/fast-forward the requested remote branch.
For an explicitly selected **local worktree** without changing GitHub state:

```bash
DEPLOY_FROM_WORKTREE=1 bash scripts/deploy.sh main
```

The deployment pipeline:

1. takes a deployment lock;
2. prepares canonical runtime/state directories;
3. writes the root-owned production environment;
4. verifies frontend tests/coverage/audit/E2E/build/bundle budget;
5. verifies/builds the agent when its source changed or no deployed agent exists;
6. stages immutable frontend and agent releases under `/srv/control-room/`;
7. installs/refreshes canonical systemd units;
8. switches the agent only when required, then verifies it;
9. switches the frontend and verifies local health/login;
10. publishes the frontend-only Traefik route and verifies public HTTPS when a
    domain is configured;
11. restores the previous frontend+agent pair if the switch fails;
12. records the successful release and prunes stale inactive releases.

Do **not** run `scripts/install-systemd.sh` as a fresh-install replacement for
`deploy.sh`: the installer intentionally expects already-staged `current`
release symlinks. `deploy.sh` prepares those and invokes the systemd installer in
the correct order.

---

## 8. Production layout

Canonical paths:

```text
/srv/control-room/frontend/releases/    immutable frontend releases
/srv/control-room/frontend/current      active frontend symlink
/srv/control-room/agent/releases/       immutable agent releases
/srv/control-room/agent/current         active agent symlink
/var/lib/control-room/frontend/         frontend mutable state/device approvals
/var/lib/control-room/agent/            agent JSON state/logs
/etc/control-room/control-room.env      root-owned runtime environment
```

Canonical services/timers:

```text
vps-control-room-frontend.service
vps-control-room-agent.service
vps-control-room-cleanup.timer
vps-control-room-healthcheck.timer
```

The frontend service runs as the unprivileged `control-room-web` user. The agent
runs as the configured host operator because it owns PTYs and bounded host/file
operations required by terminal UX.

---

## 9. First login and device approval

Production login is intentionally two-step for a new browser:

1. enter the correct `CONTROL_ROOM_SECRET`;
2. the new device is placed in `pending`;
3. approve it once from the host;
4. sign in again.

After systemd installation, use the stable helper:

```bash
control-room-device --list
control-room-device <device-id> "my phone"
control-room-device --revoke <device-id>
```

The underlying script is also available from a checkout:

```bash
node scripts/approve-device.js --list
node scripts/approve-device.js <device-id> "my phone"
node scripts/approve-device.js --revoke <device-id>
```

Production approvals live at:

```text
/var/lib/control-room/frontend/auth-devices.json
```

Local installs normally set `CONTROL_ROOM_LOCAL_TRUST=1`, so localhost use does
not require this manual approval step. Never enable local trust on a
network-reachable production deployment.

---

## 10. Post-deploy verification

On the host:

```bash
systemctl is-active vps-control-room-agent
systemctl is-active vps-control-room-frontend
curl -fsS http://127.0.0.1:4001/health
curl -fsS http://127.0.0.1:4000/api/health
```

Confirm the privileged port is not wildcard-bound:

```bash
ss -ltnp | grep ':4001'
```

Then from an approved browser/PWA:

1. sign in;
2. click **+ New shell**;
3. run `whoami`;
4. open a second pane or duplicate the first;
5. resize/switch workspace and confirm the terminal remains usable;
6. close/reopen the browser and confirm live PTYs can be reattached;
7. on mobile, check portrait/landscape, safe areas, fullscreen, and soft keys.

For a deployment touching the terminal bridge/agent, also verify input, resize,
buffer bootstrap, SSE reconnect, and close/process teardown.

---

## 11. Install as a PWA

- iOS Safari: **Share → Add to Home Screen**.
- Android Chrome: **Install app** / **Add to Home screen**.

The product remains a web UI; installation only changes how it is launched.

---

## 12. Local install

Use the dedicated guide rather than mixing local and VPS assumptions:

- [INSTALL-LOCAL.md](./INSTALL-LOCAL.md) — human local guide.
- [AI-ONBOARDING.md](./AI-ONBOARDING.md) — local-install playbook for an AI assistant.
- [NATIVE-WINDOWS.md](./NATIVE-WINDOWS.md) — lightweight Windows launch modes.

Quick local one-liners:

**Windows PowerShell**

```powershell
irm https://raw.githubusercontent.com/rahmanef63/control-room/main/install.ps1 | iex
```

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/rahmanef63/control-room/main/install.sh | bash
```

---

## 13. Troubleshooting

| Symptom | Likely cause | Check/fix |
|---|---|---|
| Correct password still does not enter app | Device pending | `control-room-device --list`, approve it, sign in again |
| Login says invalid | Login secret mismatch | Verify the canonical env and restart/redeploy the frontend |
| Frontend is down | Failed build/unit or port conflict | `journalctl -u vps-control-room-frontend -n 100 --no-pager` |
| Agent is down | Node/PTY/config/start failure | `journalctl -u vps-control-room-agent -n 100 --no-pager` |
| Terminal cannot connect | Agent unavailable or bridge failure | Check `:4001/health`, frontend logs, then terminal SSE/WS bridge |
| Old UI/chunk after deploy | stale browser service worker/cache | reload once; current service worker never caches HTML/API responses |
| Mobile terminal is clipped | viewport/safe-area regression | check real-device portrait/landscape + keyboard/fullscreen |
| Deploy refuses immediately | tracked changes or passworded sudo | use a clean checkout, or explicit `DEPLOY_FROM_WORKTREE=1`; ensure `sudo -n true` works |

More operational detail: [runbook.md](./runbook.md).

---

## 14. Backup and recovery

Create a recovery snapshot without copying the runtime env by default:

```bash
bash scripts/backup-control-room.sh
```

It creates a Git bundle, mutable-state archive, and checksums under
`~/.local/state/control-room-backups/<timestamp>/`. Copy that directory to an
approved encrypted off-host destination.

`--include-env` also includes the root-owned production environment and therefore
requires stronger secret handling:

```bash
bash scripts/backup-control-room.sh --include-env
```

See [runbook.md](./runbook.md) for rollback and incident commands.
