# Control Room v2.0.0 — Production Runbook

This runbook describes the **current terminal-first runtime**. It intentionally
does not include the removed Docker collector, fail2ban dashboard actions,
managed-app controls, scheduler UI, or other old control-plane features.

## Table of contents

1. [Runtime inventory](#1-runtime-inventory)
2. [Canonical paths and services](#2-canonical-paths-and-services)
3. [Security invariants](#3-security-invariants)
4. [Deploy and update](#4-deploy-and-update)
5. [Routine verification](#5-routine-verification)
6. [Terminal incident triage](#6-terminal-incident-triage)
7. [Frontend incident triage](#7-frontend-incident-triage)
8. [Agent incident triage](#8-agent-incident-triage)
9. [Device approval](#9-device-approval)
10. [Rollback](#10-rollback)
11. [Timers and cleanup](#11-timers-and-cleanup)
12. [Logs](#12-logs)
13. [Backup and disaster recovery](#13-backup-and-disaster-recovery)

---

## 1. Runtime inventory

Control Room has two application trust tiers:

```text
browser / PWA
    │ HTTPS
    ▼
reverse proxy
    │
    ▼
SvelteKit adapter-node frontend :4000
    │ authenticated local HTTP + server-side WS
    ▼
Node 22 PTY agent 127.0.0.1:4001
    │
    ▼
node-pty → shell / SSH / CLI
```

### Toolchain/runtime

- **Node.js 22**: production frontend and privileged PTY agent.
- **Bun 1.3+**: dependency install, tests, builds, repository tooling.
- **SvelteKit 2 + Svelte 5**: frontend.
- **node-pty**: persistent interactive terminal processes.

The agent itself has **no Docker runtime dependency**. The currently tracked
production deployment proxy path is Dokploy/Traefik-specific, but that is a
proxy/deployment concern rather than an agent feature dependency.

---

## 2. Canonical paths and services

### Runtime/state

```text
/srv/control-room/frontend/releases/    immutable frontend releases
/srv/control-room/frontend/current      active frontend symlink
/srv/control-room/agent/releases/       immutable agent releases
/srv/control-room/agent/current         active agent symlink
/var/lib/control-room/frontend/         device/auth mutable state
/var/lib/control-room/agent/            agent JSON state and log data
/etc/control-room/control-room.env      root-owned runtime environment
```

### Services/timers

```text
vps-control-room-frontend.service
vps-control-room-agent.service
vps-control-room-cleanup.service
vps-control-room-cleanup.timer
vps-control-room-healthcheck.service
vps-control-room-healthcheck.timer
```

The systemd installer writes these units from the repository. The frontend runs
as `control-room-web` with a restricted filesystem/network sandbox. The agent
runs as the configured host operator because it owns PTYs and bounded host/file
operations required by terminal UX.

### Deployment state

```text
~/.local/state/control-room-deploy/
├── agent.commit
├── deploy-events.jsonl
└── backups/
```

---

## 3. Security invariants

These are operational invariants, not optional style choices:

- only the frontend is publicly/proxy reachable;
- agent port 4001 binds `127.0.0.1` by default;
- frontend→agent requests use the machine gateway secret;
- frontend service user has no sudo/Docker privileges;
- `/etc/control-room/control-room.env` is root-owned mode `0600`;
- interactive PTYs do not inherit Control Room's master auth secrets;
- a new production browser must be device-approved after presenting the login
  secret;
- a private network such as Tailscale is recommended defense in depth, not a
  required runtime component.

Quick checks:

```bash
sudo stat -c '%U %G %a %n' /etc/control-room/control-room.env
ss -ltnp | grep ':4001'
id control-room-web
```

Expected for port 4001: loopback address only, never `0.0.0.0` / `[::]`.

The scheduled healthcheck also fails if 4001 becomes wildcard-bound.

---

## 4. Deploy and update

### Standard remote-branch deploy

```bash
cd <repo>
git status --short --branch
bash scripts/deploy.sh main
```

The script refuses a normal remote deploy when tracked changes are present. It
then fetches and fast-forwards the requested branch before building.

### Explicit local-worktree deploy

Use this only when the user intentionally wants the current local tree deployed
without touching GitHub state:

```bash
DEPLOY_FROM_WORKTREE=1 bash scripts/deploy.sh main
```

### Preconditions

```bash
node -v      # v22.x
bun -v       # 1.3+
sudo -n true
 test -f .env.local
```

The tracked deploy path also expects the Dokploy/Traefik dynamic directory used
by `scripts/deploy.sh` and `ops/traefik/vps-control-room.yml`.

### What `scripts/deploy.sh` actually does

1. serializes deploys with `/tmp/vps-control-room-deploy.lock`;
2. selects/locks the intended Git snapshot;
3. stages canonical state/runtime env locations;
4. verifies frontend check/lint/coverage/audit/Playwright/build/bundle budget;
5. builds/tests/audits the agent only when agent source changed or no valid
   deployed agent exists;
6. stages immutable releases;
7. records the previous release pair;
8. refreshes the canonical systemd units;
9. switches/verifies the agent when necessary;
10. switches/verifies the frontend;
11. publishes/verifies the frontend-only Traefik route;
12. automatically restores the previous runtime pair on verification failure;
13. records success and prunes stale inactive releases.

Do not replace this with a sequence of manual `git pull + build + restart`
commands for routine deploys; that bypasses pair rollback and verification.

### Fresh host note

`scripts/install-systemd.sh` is **not** the first command on a blank host. It
requires staged `frontend/current` and `agent/current` release symlinks.
`scripts/deploy.sh` prepares them and invokes the installer in the correct order.

---

## 5. Routine verification

### Application services

```bash
systemctl is-active vps-control-room-agent
systemctl is-active vps-control-room-frontend
```

### Local liveness

```bash
curl -fsS http://127.0.0.1:4001/health
curl -fsS http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:4000/login
curl -I http://127.0.0.1:4000/landing
```

The unauthenticated agent health response is intentionally minimal. Detailed
agent/terminal information is available only to an authenticated gateway caller.

### Health timer

```bash
systemctl status vps-control-room-healthcheck.timer --no-pager
journalctl -u vps-control-room-healthcheck.service -n 30 --no-pager
```

The tracked healthcheck verifies:

- agent loopback health;
- frontend local health;
- port 4001 is not wildcard-bound;
- public HTTPS health when `CONTROL_ROOM_DOMAIN` is available to the timer.

### Browser terminal smoke

After an approved login:

1. **+ New shell**;
2. `whoami` / `pwd`;
3. duplicate or create another pane;
4. input and resize;
5. switch workspace/view mode;
6. reload/reopen browser and confirm the PTY reattaches;
7. close a terminal and confirm the process tree is not orphaned.

For mobile changes, test a real iOS and Android browser/PWA when practical.

---

## 6. Terminal incident triage

### Symptom: pane stays “connecting” / reconnecting

Trace the actual stream path in order:

```text
browser EventSource (SSE)
→ SvelteKit /api/terminals/<id>/stream
→ server-side WebSocket client
→ agent WebSocket
→ TerminalManager
→ node-pty
```

Checks:

```bash
curl -fsS http://127.0.0.1:4001/health
journalctl -u vps-control-room-frontend -n 100 --no-pager
journalctl -u vps-control-room-agent -n 100 --no-pager
```

Do not expose the agent WebSocket directly to the browser to “fix” a bridge
problem; that would cross the security boundary and expose machine credentials.

### Symptom: terminal opens then exits

Check the selected profile/cwd and whether the requested CLI exists:

```bash
command -v bash
command -v claude || true
command -v codex || true
command -v gemini || true
command -v openclaw || true
```

Built-in AI CLI profiles intentionally fall back to a shell when an expected
binary is missing where supported. Named runtime profiles are just launch
metadata; they are not managed applications.

### Symptom: terminal session limit reached

The agent caps live terminal records at **16**. When creating another session it
prefers evicting an already-exited record; otherwise it evicts the most idle
session. Close unused terminals rather than increasing this limit casually—the
cap bounds host/browser resource use.

### Symptom: input ordering issue

The frontend has an ordered per-terminal input queue. Reproduce with one terminal
first; do not globally serialize unrelated terminal sessions.

### Symptom: first row / xterm fit issue

Check resize triggers (initial mount, active pane, font, fullscreen, keyboard,
ResizeObserver, `visualViewport`, orientation, fonts ready). Avoid remounting the
terminal as a generic layout fix because that can destroy live terminal state.

---

## 7. Frontend incident triage

### Service failed

```bash
systemctl status vps-control-room-frontend --no-pager
journalctl -u vps-control-room-frontend -n 100 --no-pager
readlink -f /srv/control-room/frontend/current
ls -l /srv/control-room/frontend/current/build/index.js
```

Production entrypoint:

```text
node build/index.js
```

### White/old UI after deploy

Confirm the active release and current `/_app/immutable/` asset URLs. The service
worker does not cache HTML or `/api/*`; content-hashed build assets are safe to
cache. If a browser retained an old worker state, reload/update once rather than
adding compatibility copies of old chunks.

### Authentication/device issue

```bash
control-room-device --list
```

If a correct login secret produced a pending device, approve only the intended
browser and sign in again.

---

## 8. Agent incident triage

### Service failed

```bash
systemctl status vps-control-room-agent --no-pager
journalctl -u vps-control-room-agent -n 100 --no-pager
readlink -f /srv/control-room/agent/current
ls -l /srv/control-room/agent/current/agent/dist/index.js
```

Check port/binding:

```bash
ss -ltnp | grep ':4001'
```

### Secret/config failure

The agent refuses to start when its machine gateway secret is missing or shorter
than the minimum. Review the canonical root-owned env without printing secrets to
chat/logs:

```bash
sudo stat /etc/control-room/control-room.env
```

Use a safe local command to check key presence/length if needed; never dump the
whole environment.

### Host telemetry failure

Telemetry readers fail independently. A missing platform-specific source should
produce neutral/partial values, not terminate the agent. Inspect the agent log for
`Host telemetry sample failed` or the relevant collector failure before changing
the terminal runtime.

---

## 9. Device approval

Canonical helper after systemd installation:

```bash
control-room-device --list
control-room-device <device-id> "label"
control-room-device --revoke <device-id>
```

Checkout-level fallback:

```bash
node scripts/approve-device.js --list
node scripts/approve-device.js <device-id> "label"
node scripts/approve-device.js --revoke <device-id>
```

Production store:

```text
/var/lib/control-room/frontend/auth-devices.json
```

Do not manually edit the JSON while the frontend is handling authentication
unless recovery requires it and you have a backup.

---

## 10. Rollback

Automatic rollback is part of `scripts/deploy.sh` when the candidate fails agent,
frontend, or public-route verification.

Deployment backup records live under:

```text
~/.local/state/control-room-deploy/backups/<timestamp>-<sha>/
```

Typical files include:

```text
previous-frontend.txt
previous-agent.txt
traefik.yml        # when a prior live proxy config existed
```

For manual recovery:

1. read the recorded previous release targets;
2. repoint `/srv/control-room/frontend/current` and/or
   `/srv/control-room/agent/current` with `ln -sfn`;
3. restore prior Traefik config when the route itself was the failing change;
4. restart only the tier(s) you changed;
5. rerun local health and browser terminal smoke.

Keep at least one known-good inactive release until the candidate is proven.

---

## 11. Timers and cleanup

### Runtime cleanup

```bash
systemctl status vps-control-room-cleanup.timer --no-pager
journalctl -u vps-control-room-cleanup.service -n 50 --no-pager
```

`cleanup-terminal-runtime.sh` currently:

- retains a bounded number of inactive frontend releases;
- retains a bounded number of inactive agent releases;
- removes stale terminal upload artifacts under `~/.os/uploads`.

It is **runtime housekeeping**, not a product scheduler.

### Healthcheck

```bash
systemctl status vps-control-room-healthcheck.timer --no-pager
```

Runs every five minutes after boot and records failures in journald.

---

## 12. Logs

### Follow

```bash
journalctl -u vps-control-room-frontend -f
journalctl -u vps-control-room-agent -f
journalctl -u vps-control-room-frontend -u vps-control-room-agent -f
```

### Recent

```bash
journalctl -u vps-control-room-frontend -n 100 --no-pager
journalctl -u vps-control-room-agent -n 100 --no-pager
journalctl -u vps-control-room-healthcheck.service -n 50 --no-pager
journalctl -u vps-control-room-cleanup.service -n 50 --no-pager
```

### Time window

```bash
journalctl -u vps-control-room-agent --since "30 minutes ago"
journalctl -u vps-control-room-frontend --since today
```

### Previous boot

```bash
journalctl -u vps-control-room-frontend -b -1 --no-pager
journalctl -u vps-control-room-agent -b -1 --no-pager
```

### Journal disk usage

```bash
journalctl --disk-usage
```

Never paste unreviewed environment dumps, auth headers, cookies, or secrets into
an issue/chat when sharing logs.

---

## 13. Backup and disaster recovery

Create a recovery package:

```bash
bash scripts/backup-control-room.sh
```

Default output:

```text
~/.local/state/control-room-backups/<timestamp>/
├── repository.bundle
├── state.tar.gz      # when state exists
└── SHA256SUMS
```

The Git bundle includes unpublished local commits. The state archive captures
`/var/lib/control-room` when present. The runtime environment is **not** copied by
default.

If you explicitly need a secret-bearing disaster-recovery package:

```bash
bash scripts/backup-control-room.sh --include-env
```

That additionally copies `/etc/control-room/control-room.env`; handle the output
as a secret and move it only to an approved encrypted off-host destination.

Verify a repository bundle before recovery:

```bash
git bundle verify repository.bundle
```

For installation context see [INSTALL.md](./INSTALL.md) and
[ONBOARDING.md](./ONBOARDING.md). Security policy lives in
[../SECURITY.md](../SECURITY.md).
