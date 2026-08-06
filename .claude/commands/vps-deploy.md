# VPS Control Room — Deploy Workflow

Gunakan skill ini saat deploy, redeploy, atau troubleshoot systemd services.

## Deploy Pertama Kali

```bash
# Set REPO_DIR to your actual repo path
REPO_DIR="<your-repo-path>"
cd "$REPO_DIR"

# 1. Install dependencies
bun install --cwd frontend
bun install --cwd agent

# 2. Setup env
cp .env.example .env.local
# Edit .env.local — isi semua secrets

# 3. Build
bun run --cwd frontend build
bun run --cwd agent build

# 4. Deploy Convex schema
bunx convex deploy

# 5. Setup permissions
sudo usermod -aG docker "$USER"
# Buat sudoers file
sudo tee /etc/sudoers.d/vps-control-room << 'SUDOERS'
# Replace <your-user> with your actual username
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart vps-control-room-*
<your-user> ALL=(ALL) NOPASSWD: /usr/bin/fail2ban-client set sshd unbanip *
SUDOERS
sudo chmod 440 /etc/sudoers.d/vps-control-room

# 6. Install systemd units (auto-detects user and repo path)
sudo bash scripts/install-systemd.sh

# 7. Enable dan start
sudo systemctl enable --now vps-control-room-frontend
sudo systemctl enable --now vps-control-room-agent
```

## Redeploy (Update Kode)

```bash
cd <your-repo-path>
git pull origin main

# Build ulang
bun install --cwd frontend && bun run --cwd frontend build
bun install --cwd agent && bun run --cwd agent build

# Deploy Convex (jika schema/functions berubah)
bunx convex deploy

# Restart services
sudo systemctl restart vps-control-room-frontend
sudo systemctl restart vps-control-room-agent
```

Atau jalankan: `bash scripts/deploy.sh`

## Troubleshooting

```bash
# Cek status service
sudo systemctl status vps-control-room-frontend
sudo systemctl status vps-control-room-agent

# Lihat logs
sudo journalctl -u vps-control-room-frontend -f --no-pager
sudo journalctl -u vps-control-room-agent -f --no-pager

# Cek health endpoints
curl http://127.0.0.1:4000/api/health    # frontend
curl http://127.0.0.1:4001/health        # agent

# Restart manual jika perlu
sudo systemctl restart vps-control-room-frontend
sudo systemctl restart vps-control-room-agent

# Cek apakah port sudah listen
ss -tlnp | grep -E "4000|4001"

# Cek env loaded
sudo systemctl show vps-control-room-agent --property=Environment
```

## systemd Unit Files

Frontend: `/etc/systemd/system/vps-control-room-frontend.service`
Agent: `/etc/systemd/system/vps-control-room-agent.service`

Lihat `scripts/install-systemd.sh` untuk isi unit files terbaru.

## Convex Deploy

```bash
# Dari root repo
bunx convex deploy

# Jika perlu reset (HATI-HATI: hapus semua data!)
# bunx convex deploy --reset
```

## Checklist Sebelum Deploy

1. [ ] `.env.local` sudah diisi semua required secrets
2. [ ] `bun run build` sukses di frontend dan agent
3. [ ] `bunx convex deploy` sukses
4. [ ] Docker socket accessible oleh app user
5. [ ] sudoers entry sudah ada
6. [ ] Tailscale connected dan IP benar
