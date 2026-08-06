# VPS Control Room — Runbook

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [systemd Service Installation](#3-systemd-service-installation)
4. [Docker Socket Permissions](#4-docker-socket-permissions)
5. [sudoers Setup](#5-sudoers-setup)
6. [Starting and Verifying Services](#6-starting-and-verifying-services)
7. [Troubleshooting](#7-troubleshooting)
8. [Updating](#8-updating)
9. [Log Viewing](#9-log-viewing)

---

## 1. Prerequisites

The following must be installed and running on the VPS before proceeding.

### Node.js 22

Still required: the agent daemon runs on Node (node-pty needs it), even though
everything else is bun.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v22.x.x
```

### Bun 1.3+

Package manager for both components and the runtime for the frontend.

```bash
curl -fsSL https://bun.sh/install | bash
bun --version    # should print 1.3.x or newer
```

### Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

### fail2ban

```bash
sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban
```

### ufw

```bash
sudo apt-get install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow in on docker0 to any port 4000 proto tcp   # Control Room frontend
sudo ufw allow in on docker0 to any port 4001 proto tcp   # Control Room terminal gateway
sudo ufw enable
```

---

## 2. Installation

### Clone the repository

```bash
git clone <repository-url> <your-repo-path>
cd <your-repo-path>
```

### Set up environment

Copy the example file and fill in every value marked `replace_me`:

```bash
cp .env.example .env.local
nano .env.local
```

Key values to set:

| Variable | Description |
|---|---|
| `CONTROL_ROOM_SECRET` | Random secret used for login |
| `CONTROL_ROOM_SESSION_SECRET` | Separate random secret for signing session cookies |
| `AGENT_GATEWAY_SECRET` | Optional: dedicated frontend→agent gateway secret; falls back to `CONTROL_ROOM_SECRET` if unset |

Generate secure secrets with:

```bash
openssl rand -hex 32
```

### Install dependencies

```bash
bun install --cwd frontend
bun install --cwd agent
```

### Build

```bash
bun run --cwd frontend build
bun run --cwd agent    build
```

---

## 3. systemd Service Installation

Run the provided installer script (requires sudo):

```bash
sudo bash <your-repo-path>/scripts/install-systemd.sh
```

The script will:

- Write unit files to `/etc/systemd/system/`
- Run `systemctl daemon-reload`
- Enable both services so they start on boot

To inspect the installed unit files:

```bash
cat /etc/systemd/system/vps-control-room-frontend.service
cat /etc/systemd/system/vps-control-room-agent.service
```

---

## 4. Docker Socket Permissions

The agent reads from the Docker socket. Add the service user to the `docker` group so it can access `/var/run/docker.sock` without root:

```bash
sudo usermod -aG docker <your-user>
```

The change takes effect on the next login. To apply it immediately to a running shell:

```bash
newgrp docker
```

Confirm membership:

```bash
groups <your-user>
# output should include: <your-user> ... docker ...
```

---

## 5. sudoers Setup

The frontend and agent need to run a small set of privileged commands (systemctl status/restart for managed services, and fail2ban-client for ban/unban actions). Grant these without a full root password prompt by adding a sudoers drop-in.

```bash
sudo visudo -f /etc/sudoers.d/vps-control-room
```

Paste the following, then save and exit:

```
# VPS Control Room — restricted privilege escalation
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl status vps-control-room-frontend
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl status vps-control-room-agent
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart vps-control-room-frontend
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart vps-control-room-agent
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl start vps-control-room-frontend
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl start vps-control-room-agent
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop vps-control-room-frontend
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop vps-control-room-agent
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client status
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client status *
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client set * banip *
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client set * unbanip *
```

Validate the file is syntactically correct:

```bash
sudo visudo -c -f /etc/sudoers.d/vps-control-room
```

---

## 6. Starting and Verifying Services

### Start services

```bash
sudo systemctl start vps-control-room-frontend
sudo systemctl start vps-control-room-agent
```

### Check status

```bash
sudo systemctl status vps-control-room-frontend
sudo systemctl status vps-control-room-agent
```

Both should show `Active: active (running)`.

### Verify the frontend is listening

```bash
curl -s http://127.0.0.1:4000/api/health
```

Expected response: `{"status":"ok"}` (or similar).

### Verify the agent health endpoint

```bash
curl -s http://127.0.0.1:4001/health
```

Expected response: `{"status":"ok"}`.

---

## 7. Troubleshooting

### Frontend not starting

**Symptom:** `systemctl status vps-control-room-frontend` shows `failed` or the service exits immediately.

1. Check the journal for the exact error:
   ```bash
   journalctl -u vps-control-room-frontend -n 50 --no-pager
   ```
2. Confirm the build output exists:
   ```bash
   ls <your-repo-path>/frontend/.next/BUILD_ID
   ```
   If missing, rebuild: `bun run --cwd frontend build`
3. Confirm `.env.local` is present and readable by the app user:
   ```bash
   ls -la <your-repo-path>/.env.local
   ```
4. Check `CONTROL_ROOM_PORT` is not already in use:
   ```bash
   sudo ss -tlnp | grep 4000
   ```

### Agent not starting

**Symptom:** `systemctl status vps-control-room-agent` shows `failed`, or the agent health endpoint does not respond.

1. Inspect agent logs:
   ```bash
   journalctl -u vps-control-room-agent -n 50 --no-pager
   ```
2. Confirm the agent build output exists:
   ```bash
   ls <your-repo-path>/agent/dist/index.js
   ```
   If missing, rebuild: `bun run --cwd agent build`
3. Check `AGENT_HEALTH_PORT` is not already in use:
   ```bash
   sudo ss -tlnp | grep 4001
   ```

### Docker socket permission denied

**Symptom:** Agent logs contain `permission denied` for `/var/run/docker.sock`.

1. Confirm your app user is in the `docker` group:
   ```bash
   groups <your-user>
   ```
2. If not, add the user and restart the service:
   ```bash
   sudo usermod -aG docker <your-user>
   sudo systemctl restart vps-control-room-agent
   ```
3. If the group was just added, you may need to fully restart the service so it picks up the new group membership (a simple `restart` is usually sufficient since systemd re-forks the process):
   ```bash
   sudo systemctl restart vps-control-room-agent
   ```
4. Verify socket permissions:
   ```bash
   ls -la /var/run/docker.sock
   # should show: srw-rw---- ... root docker ...
   ```

---

## 8. Updating

Use the deploy script for all updates:

```bash
bash <your-repo-path>/scripts/deploy.sh
```

The script performs these steps in order:

1. `git pull origin main` — fetch latest code
2. Reinstall frontend dependencies and rebuild
3. Reinstall agent dependencies and rebuild
4. Restart both systemd services

If a step fails the script exits immediately (`set -e`) so no partial state is applied. The agent persists its state to JSON under `~/.openclaw/` on the host — there is no separate database to migrate.

To update only a single component, run the relevant steps manually:

```bash
# Frontend only
cd <your-repo-path>
bun install --cwd frontend && bun run --cwd frontend build
sudo systemctl restart vps-control-room-frontend

# Agent only
cd <your-repo-path>
bun install --cwd agent && bun run --cwd agent build
sudo systemctl restart vps-control-room-agent
```

### GitHub Actions deploy (manual)

Repository ini menyediakan workflow GitHub Actions di `.github/workflows/deploy.yml`. Workflow ini `workflow_dispatch` only — TIDAK auto-deploy saat push ke `main`. Jalankan secara manual lewat tab Actions (atau pakai `scripts/deploy.sh` langsung di host).

Penting:

- Workflow ini didesain untuk `self-hosted runner` yang berjalan langsung di VPS target.
- GitHub-hosted runner biasa tidak cocok untuk setup ini karena panel dan host mengandalkan akses lokal VPS dan environment file yang tersimpan di host.
- Runner harus punya akses ke:
  - `<your-repo-path>`
  - `sudo -n systemctl restart ...`
  - `.env.local`

Saat workflow di-trigger manual lewat tab Actions, runner akan menjalankan:

1. `git fetch` dan `git pull --ff-only origin main`
2. build frontend
3. build agent
4. restart service frontend dan agent
5. verifikasi service aktif

Jika runner belum diinstall, workflow akan muncul di GitHub tetapi tidak akan berjalan.

---

## 9. Log Viewing

### Follow live logs

```bash
# Frontend
journalctl -u vps-control-room-frontend -f

# Agent
journalctl -u vps-control-room-agent -f

# Both simultaneously
journalctl -u vps-control-room-frontend -u vps-control-room-agent -f
```

### View recent logs

```bash
# Last 100 lines, frontend
journalctl -u vps-control-room-frontend -n 100 --no-pager

# Last 100 lines, agent
journalctl -u vps-control-room-agent -n 100 --no-pager
```

### Filter by time

```bash
# Logs since midnight today
journalctl -u vps-control-room-frontend --since today

# Logs in a specific window
journalctl -u vps-control-room-agent --since "2026-03-20 08:00:00" --until "2026-03-20 09:00:00"
```

### View previous boot logs (after a crash or reboot)

```bash
journalctl -u vps-control-room-frontend -b -1 --no-pager
journalctl -u vps-control-room-agent -b -1 --no-pager
```

### Disk usage of journal

```bash
journalctl --disk-usage
```
