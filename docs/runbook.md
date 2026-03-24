# VPS Control Room — Runbook

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Convex Setup](#3-convex-setup)
4. [systemd Service Installation](#4-systemd-service-installation)
5. [Docker Socket Permissions](#5-docker-socket-permissions)
6. [sudoers Setup](#6-sudoers-setup)
7. [Starting and Verifying Services](#7-starting-and-verifying-services)
8. [Troubleshooting](#8-troubleshooting)
9. [Updating](#9-updating)
10. [Log Viewing](#10-log-viewing)

---

## 1. Prerequisites

The following must be installed and running on the VPS before proceeding.

### Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should print v22.x.x
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

### Convex Self-Hosted

Follow the official Convex self-hosted setup guide to bring up a local Convex backend (typically on ports 3210 and 3211). The deployment must be running before the agent or frontend will function correctly.

---

## 2. Installation

### Clone the repository

```bash
git clone <repository-url> /home/rahman/projects/vps-rahmanef
cd /home/rahman/projects/vps-rahmanef
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
| `CONTROL_ROOM_SECRET` | Random secret used to sign API tokens |
| `CONTROL_ROOM_SESSION_SECRET` | Separate random secret for session cookies |
| `CONVEX_ADMIN_KEY` | Admin key from your Convex self-hosted instance |
| `DOKPLOY_API_KEY` | API key from your Dokploy installation |

Generate secure secrets with:

```bash
openssl rand -hex 32
```

### Install dependencies

```bash
cd frontend && npm install && cd ..
cd agent    && npm install && cd ..
```

### Build

```bash
cd frontend && npm run build && cd ..
cd agent    && npm run build && cd ..
```

---

## 3. Convex Setup

### Deploy schema and functions

With the Convex backend running and `CONVEX_URL` / `CONVEX_ADMIN_KEY` set in `.env.local`:

```bash
cd /home/rahman/projects/vps-rahmanef/convex
npx convex deploy
```

Verify the deployment succeeds with no errors. The command will print the functions it uploaded.

### Confirm the backend is reachable

```bash
curl -s http://127.0.0.1:3210/version
```

A JSON response with a version field confirms the backend is up.

---

## 4. systemd Service Installation

Run the provided installer script (requires sudo):

```bash
sudo bash /home/rahman/projects/vps-rahmanef/scripts/install-systemd.sh
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

## 5. Docker Socket Permissions

The agent reads from the Docker socket. Add the service user to the `docker` group so it can access `/var/run/docker.sock` without root:

```bash
sudo usermod -aG docker rahman
```

The change takes effect on the next login. To apply it immediately to a running shell:

```bash
newgrp docker
```

Confirm membership:

```bash
groups rahman
# output should include: rahman ... docker ...
```

---

## 6. sudoers Setup

The frontend and agent need to run a small set of privileged commands (systemctl status/restart for managed services, and fail2ban-client for ban/unban actions). Grant these without a full root password prompt by adding a sudoers drop-in.

```bash
sudo visudo -f /etc/sudoers.d/vps-control-room
```

Paste the following, then save and exit:

```
# VPS Control Room — restricted privilege escalation
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl status vps-control-room-frontend
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl status vps-control-room-agent
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart vps-control-room-frontend
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart vps-control-room-agent
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl start vps-control-room-frontend
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl start vps-control-room-agent
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop vps-control-room-frontend
rahman ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop vps-control-room-agent
rahman ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client status
rahman ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client status *
rahman ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client set * banip *
rahman ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client set * unbanip *
```

Validate the file is syntactically correct:

```bash
sudo visudo -c -f /etc/sudoers.d/vps-control-room
```

---

## 7. Starting and Verifying Services

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

## 8. Troubleshooting

### Frontend not starting

**Symptom:** `systemctl status vps-control-room-frontend` shows `failed` or the service exits immediately.

1. Check the journal for the exact error:
   ```bash
   journalctl -u vps-control-room-frontend -n 50 --no-pager
   ```
2. Confirm the build output exists:
   ```bash
   ls /home/rahman/projects/vps-rahmanef/frontend/.next/standalone/server.js
   ```
   If missing, rebuild: `cd frontend && npm run build`
3. Confirm `.env.local` is present and readable by the `rahman` user:
   ```bash
   ls -la /home/rahman/projects/vps-rahmanef/.env.local
   ```
4. Check `CONTROL_ROOM_PORT` is not already in use:
   ```bash
   sudo ss -tlnp | grep 4000
   ```

### Agent can't reach Convex

**Symptom:** Agent logs show connection refused or timeout errors against `127.0.0.1:3210`.

1. Confirm Convex backend is running:
   ```bash
   curl -s http://127.0.0.1:3210/version
   ```
2. Check that `CONVEX_URL` and `CONVEX_ADMIN_KEY` in `.env.local` are correct.
3. Re-deploy Convex functions if schema changes were made:
   ```bash
   cd /home/rahman/projects/vps-rahmanef/convex && npx convex deploy
   ```
4. Inspect agent logs:
   ```bash
   journalctl -u vps-control-room-agent -n 50 --no-pager
   ```

### Docker socket permission denied

**Symptom:** Agent logs contain `permission denied` for `/var/run/docker.sock`.

1. Confirm `rahman` is in the `docker` group:
   ```bash
   groups rahman
   ```
2. If not, add the user and restart the service:
   ```bash
   sudo usermod -aG docker rahman
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

## 9. Updating

Use the deploy script for all updates:

```bash
bash /home/rahman/projects/vps-rahmanef/scripts/deploy.sh
```

The script performs these steps in order:

1. `git pull origin main` — fetch latest code
2. Reinstall frontend dependencies and rebuild
3. Reinstall agent dependencies and rebuild
4. Re-deploy Convex schema and functions
5. Restart both systemd services

If a step fails the script exits immediately (`set -e`) so no partial state is applied.

To update only a single component, run the relevant steps manually:

```bash
# Frontend only
cd /home/rahman/projects/vps-rahmanef/frontend
npm install && npm run build
sudo systemctl restart vps-control-room-frontend

# Agent only
cd /home/rahman/projects/vps-rahmanef/agent
npm install && npm run build
sudo systemctl restart vps-control-room-agent
```

### GitHub Actions auto-deploy

Repository ini sekarang menyediakan workflow GitHub Actions di `.github/workflows/deploy.yml` yang akan auto-deploy saat ada push ke `main`.

Penting:

- Workflow ini didesain untuk `self-hosted runner` yang berjalan langsung di VPS target.
- GitHub-hosted runner biasa tidak cocok untuk setup ini karena panel dan host mengandalkan akses lokal VPS dan environment file yang tersimpan di host.
- Runner harus punya akses ke:
  - `/home/rahman/projects/vps-rahmanef`
  - `sudo -n systemctl restart ...`
  - `.env.local`
  - `convex/.env.local`

Setelah self-hosted runner diinstall dan dihubungkan ke repository ini, setiap push ke `main` akan menjalankan:

1. `git fetch` dan `git pull --ff-only origin main`
2. build frontend
3. build agent
4. deploy Convex functions
5. restart service frontend dan agent
6. verifikasi service aktif

Jika runner belum diinstall, workflow akan muncul di GitHub tetapi tidak akan berjalan.

---

## 10. Log Viewing

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
