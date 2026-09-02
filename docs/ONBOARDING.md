# Self-Host Onboarding — Control Room v2.0.0

This is the guided production path for a fresh operator. Control Room v2 is a
**single-owner terminal multiplexer with a browser/PWA UI**—think persistent tmux-like
PTYs with panes, workspaces, reconnect, mobile controls, history/templates, and
small terminal-adjacent helpers.

For a laptop-only install, use [INSTALL-LOCAL.md](./INSTALL-LOCAL.md).

| Phase | Outcome |
|---|---|
| 1. Decide | Confirm the single-host terminal model fits |
| 2. Prepare | Node 22, Bun, Git, HTTPS/proxy/private-network choice |
| 3. Configure | Clone + independent auth secrets |
| 4. Verify + deploy | Full repository gate + immutable release deploy |
| 5. Approve + smoke | Device approval, terminal lifecycle, PWA/mobile |
| 6. Operate | updates, rollback, backup, secret rotation |

---

## Phase 1 — Decide

### What Control Room is

- single-owner, self-hosted terminal surface;
- persistent PTYs that survive ordinary browser disconnects;
- multiple panes grouped into workspaces;
- browser/PWA access from desktop or mobile;
- terminal history/templates, cwd/file helpers, broadcast input, and soft-key controls;
- optional thin launch/decorations for installed CLI programs;
- lightweight host context while you operate terminals.

The owner can run arbitrary commands **inside authenticated terminals by design**.
There is no command allowlist around the shell itself; the login/device/network
perimeter is the important security boundary.

### What it is not

- not multi-user or multi-tenant;
- not a provider/account credential store;
- not a deployment/orchestration platform for other projects;
- not a browser-automation engine;
- not a scheduler or supervisory AI system;
- not Kubernetes or a multi-host fleet manager.

A CLI running inside a pane owns its own accounts, OAuth, browser work, tools,
deployment logic, and agents.

### Network expectation

Port 4001 (the privileged PTY agent) stays loopback-only. The frontend can be
served over a private network such as Tailscale or a public HTTPS domain. A private
network is recommended defense in depth; public exposure requires the application
security controls in [../SECURITY.md](../SECURITY.md).

---

## Phase 2 — Prepare the host

### 2.1 Install Node 22

```bash
node -v
# expect v22.x.x
```

If needed, install Node 22 using your normal host method (nvm, NodeSource, distro
package policy, etc.). Production frontend **and** agent processes run on Node 22.

### 2.2 Install Bun 1.3+

```bash
curl -fsSL https://bun.sh/install | bash
bun -v
```

Bun is used for dependency install, tests, builds, and repository tooling.

### 2.3 Install Git

```bash
git --version
```

### 2.4 Choose HTTPS/reverse proxy

The tracked deploy path currently publishes a Traefik dynamic config into the
existing Dokploy layout:

```text
/etc/dokploy/traefik/dynamic/vps-control-room.yml
```

That path routes only the frontend. The agent remains at `127.0.0.1:4001`.
If your VPS does not use this Dokploy/Traefik layout, adapt the reverse-proxy step
before using the bundled production deploy script.

### 2.5 Optional: Tailscale

Tailscale is not required by the runtime, but is a useful additional access layer:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4
```

You may use a tailnet hostname or your own HTTPS domain. Do not expose port 4001.

---

## Phase 3 — Clone and configure

### 3.1 Clone

```bash
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/rahmanef63/control-room.git
cd control-room
```

### 3.2 Install dependencies

```bash
bun install --cwd frontend
bun install --cwd agent
```

Frontend and agent intentionally keep separate Bun lockfiles.

### 3.3 Generate independent secrets

```bash
openssl rand -hex 32   # CONTROL_ROOM_SECRET
openssl rand -hex 32   # CONTROL_ROOM_SESSION_SECRET
openssl rand -hex 32   # AGENT_GATEWAY_SECRET
```

Store them in a password manager. Use different values for each role.

### 3.4 Configure `.env.local`

```bash
cp .env.example .env.local
$EDITOR .env.local
```

At minimum set:

```dotenv
CONTROL_ROOM_SECRET=<login-secret>
CONTROL_ROOM_SESSION_SECRET=<session-signing-secret>
AGENT_GATEWAY_SECRET=<machine-to-machine-secret>
CONTROL_ROOM_DOMAIN=<your-hostname>
ORIGIN=https://<your-hostname>
AGENT_HEALTH_HOST=127.0.0.1
```

Do not commit `.env.local`.

`config/control-room.runtime.json` contains optional terminal environment/profile
metadata. The tracked default is generic. Leave it alone unless you specifically
want named cwd/environment/CLI launch presets.

---

## Phase 4 — Verify and deploy

### 4.1 Repository gate

```bash
bun run verify
```

This is the quality SSOT. It checks Svelte/lint, engineering/docs/evidence tooling,
coverage, dependency audits, builds, bundle budget, and isolated Playwright
responsive/accessibility/security/terminal lifecycle scenarios.

### 4.2 Deploy

```bash
bash scripts/deploy.sh main
```

The script expects non-interactive sudo:

```bash
sudo -n true
```

If you explicitly want to deploy the **current local worktree** without fetching,
pulling, pushing, or otherwise changing GitHub state:

```bash
DEPLOY_FROM_WORKTREE=1 bash scripts/deploy.sh main
```

The deploy script stages immutable releases, installs the canonical systemd units,
conditionally switches the agent, switches the frontend, verifies both tiers,
publishes the frontend-only proxy route, and rolls back the previous pair if a
production verification fails.

Do not run `scripts/install-systemd.sh` first on a blank host: it intentionally
requires staged `current` release symlinks. `scripts/deploy.sh` creates the correct
state and invokes it in order.

### 4.3 Canonical services

```text
vps-control-room-agent.service
vps-control-room-frontend.service
vps-control-room-cleanup.timer
vps-control-room-healthcheck.timer
```

The frontend runs as unprivileged `control-room-web`. The PTY agent runs as the
configured host operator.

---

## Phase 5 — Approve and smoke-test

### 5.1 Check local service health

```bash
systemctl is-active vps-control-room-agent
systemctl is-active vps-control-room-frontend
curl -fsS http://127.0.0.1:4001/health
curl -fsS http://127.0.0.1:4000/api/health
```

Check the privileged port:

```bash
ss -ltnp | grep ':4001'
```

It must not listen on `0.0.0.0:4001` or `[::]:4001`.

### 5.2 First browser login

A correct password on a **new production browser** does not immediately grant
access. The browser becomes pending first.

1. Open your HTTPS Control Room URL.
2. Enter `CONTROL_ROOM_SECRET`.
3. If the UI reports the device is pending, return to the host.
4. List pending devices:

```bash
control-room-device --list
```

5. Approve the intended id:

```bash
control-room-device <device-id> "my laptop"
```

6. Sign in again.

Revoke later with:

```bash
control-room-device --revoke <device-id>
```

### 5.3 Terminal smoke

In the UI:

1. click **+ New shell**;
2. run `whoami` and `pwd`;
3. create a second terminal or use **Duplicate terminal**;
4. switch workspace/view mode and confirm both sessions remain live;
5. resize a pane and confirm xterm refits;
6. close the browser, reopen it, and confirm live sessions can reattach;
7. close a terminal intentionally and confirm its PTY/process tree terminates.

### 5.4 Settings/activity smoke

The heartbeat glow is only visual feedback for a recognized CLI that is detected
as working. It is **not** an orchestration/watch system.

- Settings → **Heartbeat glow** controls this decoration.
- **Test heartbeat** triggers the visual test for a few seconds.

### 5.5 Mobile/PWA smoke

Before a significant mobile release, test at least one real iOS Safari/PWA and one
real Android Chrome/PWA:

- portrait and landscape;
- notch/safe-area spacing;
- fullscreen;
- on-screen keyboard open/close;
- soft terminal keys;
- reconnect after backgrounding.

Desktop viewport emulation is useful but does not fully reproduce mobile browser
keyboard/safe-area behavior.

---

## Phase 6 — Operate

### 6.1 Update

```bash
cd ~/projects/control-room
git pull --ff-only origin main
bash scripts/deploy.sh main
```

The deploy script keeps a bounded set of inactive immutable releases and retains
rollback metadata under:

```text
~/.local/state/control-room-deploy/backups/
```

### 6.2 Rollback

Automatic pair rollback runs when deployment verification fails. For manual
recovery, use the recorded previous frontend/agent targets to repoint:

```text
/srv/control-room/frontend/current
/srv/control-room/agent/current
```

Restart only the affected tier unless you intentionally restore both.

See [runbook.md](./runbook.md) for incident commands.

### 6.3 Rotate secrets

Rotate immediately after suspected exposure and periodically according to your
own policy. Generate fresh independent values, update the canonical deployment
environment, redeploy/restart, revoke unfamiliar devices, and review logs.

Changing `CONTROL_ROOM_SESSION_SECRET` invalidates existing browser sessions.

### 6.4 Backup

```bash
bash scripts/backup-control-room.sh
```

This captures a verified Git bundle plus mutable state under
`~/.local/state/control-room-backups/<timestamp>/` without including the runtime
environment by default.

Only use this when you intentionally want the secret-bearing env in the recovery
package:

```bash
bash scripts/backup-control-room.sh --include-env
```

Move recovery packages to an approved encrypted off-host location.

---

## Troubleshooting quick table

| Symptom | First check |
|---|---|
| Password is correct but app still does not open | `control-room-device --list` for pending device |
| Frontend down | `journalctl -u vps-control-room-frontend -n 100 --no-pager` |
| Agent/terminal bridge down | `journalctl -u vps-control-room-agent -n 100 --no-pager` and `curl :4001/health` |
| Terminal pane reconnect loop | trace browser SSE → SvelteKit WS client → agent WS → node-pty |
| Mobile content clipped | real-device safe-area/keyboard/fullscreen test |
| Deploy exits before build | clean tracked tree / `DEPLOY_FROM_WORKTREE=1` intent / `sudo -n true` |
| Public URL fails but local frontend is healthy | Traefik/DNS/TLS route, then restore previous proxy config if needed |

For detailed operations, read [runbook.md](./runbook.md).
