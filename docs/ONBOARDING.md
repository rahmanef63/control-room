# Self-Host Onboarding — VPS Control Room

This guide walks a fresh sysadmin through deploying VPS Control Room
on their own VPS, end-to-end. Five phases, ~30 minutes total.

| Phase | Time | Outcome |
|-------|------|---------|
| 1. Decide | 1 min | Confirm this tool fits your use case |
| 2. Prep | 10 min | VPS, Node 22, Tailscale, domain ready |
| 3. Install | 10 min | Clone, env, npm install, systemd up |
| 4. Verify | 5 min | Health checks pass, login works, terminal spawns |
| 5. Operate | ongoing | Deploy updates, rotate secrets, backup |

---

## Phase 1 — Decide

### What this is

A **single-user**, **mobile-first**, **PWA** web dashboard that turns
your phone into a VPS control panel. Multi-pane terminals (up to 16
concurrent ptys, LRU-evicted), AI-agent launchers, host telemetry, and
raw shell actions — all behind one shared secret on a Tailscale-only
domain. The single owner runs arbitrary commands by design; there is no
command allowlist (the security model is perimeter, not per-command).

### What this is NOT

- ❌ Not multi-user. One secret = one operator. Sharing the secret =
  sharing the host. There's no per-user permissions.
- ❌ Not public-internet-safe. The default Traefik config binds to a
  Tailscale-only domain. Exposing it to the public web defeats the
  threat model.
- ❌ Not a SaaS. You host it. You own the data. You patch it.
- ❌ Not a Kubernetes / multi-host orchestrator. One VPS, one agent.

### Who this is for

- Solo dev / sysadmin running 1–3 VPS for personal projects
- People who SSH from their phone and hate raw mobile terminals
- Folks already on Tailscale and comfortable with systemd

### Hardware checklist

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Ubuntu 22.04 | Ubuntu 24.04 LTS |
| RAM | 1 GB | 2 GB+ |
| Disk | 5 GB free | 10 GB+ |
| CPU | 1 vCPU | 2 vCPU+ |
| Node | v22.0 | v22 LTS latest |

Good? Move to Phase 2. Not sure? Open an issue and describe your
setup.

---

## Phase 2 — Prep

### 2.1 Install Node 22

```bash
# Via nvm (recommended — easier upgrades)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
. "$HOME/.nvm/nvm.sh"
nvm install 22
nvm use 22
node -v   # → v22.x.x
```

### 2.2 (Optional) Install Docker

Only needed if you want the Docker collector — shows container list
in the dashboard. Skip if you don't run Docker on this VPS.

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout + login again so group takes effect
```

### 2.3 Install Tailscale

The dashboard is designed for **Tailscale-only access**. The frontend
listens on `4000`; the agent health/control API binds `127.0.0.1:4001`
(loopback only) by default, so the privileged host API is never
network-exposed. Traefik in front locks the frontend to a Tailnet domain.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
# Note your tailnet domain, e.g. yourname.ts.net
```

### 2.4 Pick a domain

Two options:

**a) Tailscale Funnel + MagicDNS** (simplest, no external DNS)

```bash
sudo tailscale serve --bg --https=443 127.0.0.1:4000
# domain is now <hostname>.<tailnet>.ts.net
```

**b) Public DNS + Tailnet-only Traefik rule** (custom subdomain)

Set an A record for `control.yourdomain.com` → your Tailscale 100.x IP.
Configure your Traefik to bind to the Tailscale interface only.

### 2.5 Generate strong secrets

You need **two** independent 32+ char random strings:

```bash
openssl rand -hex 32   # → CONTROL_ROOM_SECRET
openssl rand -hex 32   # → CONTROL_ROOM_SESSION_SECRET (different!)
```

**Save them in a password manager now.** Losing them locks you out.

---

## Phase 3 — Install

### 3.1 Clone the repo

```bash
mkdir -p ~/projects && cd ~/projects
git clone git@github.com:<your-fork>/control-room.git
cd control-room
```

If you don't have GitHub SSH set up, use HTTPS:
`git clone https://github.com/<fork>/control-room.git`.

### 3.2 Configure environment

```bash
cp .env.example .env.local
$EDITOR .env.local
```

**Required to edit:**
- `CONTROL_ROOM_SECRET` — paste from 2.5
- `CONTROL_ROOM_SESSION_SECRET` — paste from 2.5 (different value!)
- `NEXT_PUBLIC_APP_HOST` — your domain from 2.4
- `NEXT_PUBLIC_APP_URL` — full URL including `https://`

**Leave as default** unless you know what you're doing:
- All `*_PORT`, `*_INTERVAL_MS`, `*_PERCENT` — sensible defaults

Everything else has a sensible default.

> ⚠️ **DO NOT** commit `.env.local`. It's gitignored. Verify with
> `git status` after editing.

### 3.3 Install dependencies

```bash
npm --prefix frontend install
npm --prefix agent    install
```

Per-component install is intentional — each has its own
`package-lock.json`. There's no monorepo tool.

### 3.4 Install systemd services

```bash
sudo bash scripts/install-systemd.sh
```

This installs:
- `vps-control-room-agent` — Node 22 host agent
- `vps-control-room-frontend` — Next.js production server
- `vps-control-room-cleanup` service + timer — daily terminal-runtime sweep

The script reads the current directory and writes
`WorkingDirectory=` into the unit files. Run from the repo root.

### 3.5 Build + start

```bash
bash scripts/deploy.sh main
```

This will:
1. Typecheck frontend (`npm test`)
2. Build agent (`tsc`)
3. Build frontend (`next build`)
4. Restart both systemd services
5. Sync Traefik dynamic config

First build takes 3–5 minutes. Subsequent deploys are faster.

---

## Phase 4 — Verify

### 4.1 Service status

```bash
systemctl is-active vps-control-room-agent
systemctl is-active vps-control-room-frontend
# both should print: active
```

If either says `failed`, check logs:

```bash
journalctl -u vps-control-room-agent     --since "5 minutes ago"
journalctl -u vps-control-room-frontend  --since "5 minutes ago"
```

### 4.2 Health endpoints (from the VPS itself)

```bash
curl http://127.0.0.1:4001/health
# → {"ok":true,...}

curl http://127.0.0.1:4000/api/version
# → {"buildId":"abc123def456",...}
```

### 4.3 Login (from your phone / laptop on Tailscale)

1. Open your domain in a browser.
2. Paste `CONTROL_ROOM_SECRET` into the login screen.
3. You should land on the dashboard.

If login fails: secret mismatch. Re-check `.env.local` vs what you
pasted. Note: the secret is checked server-side; no other clue is given.

### 4.4 Smoke test the terminal

1. Click **+ Terminal** (top right).
2. Pick the `bash` profile.
3. Type `whoami` → expect your VPS user.
4. Type `ls` → expect home dir contents.
5. Open settings drawer (kebab → Settings).
6. Toggle heartbeat-glow off, click **Test heartbeat** → no animation.
7. Toggle it back on, click **Test heartbeat** → see outer glow on all
   panes for 4 seconds.

If all four pass, you're done.

### 4.5 Install as a PWA (mobile)

1. Open the dashboard in iOS Safari or Android Chrome.
2. **Share → Add to Home Screen** (iOS) or **⋮ → Install app** (Android).
3. Launch from your home screen — full-screen, no browser chrome.

---

## Phase 5 — Operate

### 5.1 Deploy updates

```bash
cd ~/projects/control-room
git pull origin main
bash scripts/deploy.sh main
```

`scripts/deploy.sh` is **idempotent** and **atomic**:
- Acquires a lockfile so two deploys don't race.
- Builds into `.next-staging`, promotes to `.next` only on success.
- Keeps `.next-previous` for one-shot rollback.

### 5.2 Rollback

If a deploy goes bad:

```bash
cd frontend
mv .next .next-broken
mv .next-previous .next
sudo systemctl restart vps-control-room-frontend
```

Then investigate `.next-broken` at leisure.

### 5.3 Rotate secrets

Annually, or immediately if you suspect compromise:

```bash
# 1. Generate new values
openssl rand -hex 32 > /tmp/new-secret
openssl rand -hex 32 > /tmp/new-session

# 2. Update .env.local
# 3. Restart services
sudo systemctl restart vps-control-room-agent vps-control-room-frontend

# 4. Log in again with the new CONTROL_ROOM_SECRET
# 5. Shred the temp files
shred -u /tmp/new-secret /tmp/new-session
```

All active sessions are invalidated on session-secret rotation.

### 5.4 Backup

What to back up:
- `.env.local` (secrets — store in password manager, NOT git)
- `agent/var/*.json` (workspace state, settings, log.json)

What NOT to back up:
- `node_modules/`, `.next/`, `dist/`, `.deploy-state/` — all rebuildable
- `*.log` — they rotate

### 5.5 Update Node

```bash
nvm install 22 --reinstall-packages-from=current
nvm use 22
nvm alias default 22
# rebuild native deps
npm --prefix agent rebuild
sudo systemctl restart vps-control-room-agent vps-control-room-frontend
```

The `node-pty` native module recompiles against the new Node ABI.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Login screen says "invalid" | Secret mismatch | Re-check `.env.local`, restart frontend |
| White screen after deploy | Build failed silently | `journalctl -u vps-control-room-frontend`, check for tsc errors |
| Terminal won't open | Agent down or WS blocked | `curl :4001/health`, check Traefik allows WS upgrade |
| Heartbeat glow doesn't fire | Activity state never `working` | Only AI-agent sessions trigger it; shell sessions don't |
| Service won't start | systemd unit path wrong | Re-run `scripts/install-systemd.sh` from repo root |

For more, see [docs/runbook.md](./runbook.md).

---

## Next steps

- Read [../CONTRIBUTING.md](../CONTRIBUTING.md) if you want to send PRs.
- Read [../SECURITY.md](../SECURITY.md) for the threat model and
  how to report vulnerabilities.
- Add agents to `~/.agents/skills/` so per-terminal skill discovery
  works. See `agent/src/fs/skills.ts` for the lookup order.
