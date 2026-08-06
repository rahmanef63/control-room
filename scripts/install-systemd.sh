#!/bin/bash
set -e

# VPS Control Room — systemd service installer
# Run with: sudo bash scripts/install-systemd.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: this script must be run as root (use sudo)." >&2
  exit 1
fi

# Detect the invoking user and resolve the repo root from the script's location.
# APP_USER is overridable so deploy.sh can pin it instead of inheriting whatever
# account happened to invoke sudo (a CI runner would otherwise rewrite User=).
APP_USER="${APP_USER:-${SUDO_USER:-$(logname 2>/dev/null || echo "deploy")}}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# systemd runs with a minimal PATH, so bake the ABSOLUTE bun path into the unit.
# Prefer the app user's install (this script runs as root via sudo).
APP_USER_HOME="$(getent passwd "${APP_USER}" | cut -d: -f6)"
BUN_BIN="${BUN_BIN:-}"
if [ -z "${BUN_BIN}" ] && [ -n "${APP_USER_HOME}" ] && [ -x "${APP_USER_HOME}/.bun/bin/bun" ]; then
  BUN_BIN="${APP_USER_HOME}/.bun/bin/bun"
fi
if [ -z "${BUN_BIN}" ]; then
  BUN_BIN="$(command -v bun || true)"
fi
if [ ! -x "${BUN_BIN}" ]; then
  echo "Error: bun not found. Install bun for ${APP_USER} or set BUN_BIN=/path/to/bun." >&2
  exit 1
fi
BUN_DIR="$(dirname "${BUN_BIN}")"

echo "Installing VPS Control Room systemd services..."
echo "  App user : ${APP_USER}"
echo "  Repo dir : ${REPO_DIR}"
echo "  Bun      : ${BUN_BIN}"

# --- Frontend service ---

cat > /etc/systemd/system/vps-control-room-frontend.service << EOF
[Unit]
Description=VPS Control Room Frontend
After=network.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${REPO_DIR}/frontend
EnvironmentFile=${REPO_DIR}/.env.local
Environment=PORT=4000
Environment=HOSTNAME=0.0.0.0
Environment=PATH=${BUN_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Frontend runs ON the bun runtime (--bun). Absolute bun path: systemd's PATH is minimal.
ExecStart=${BUN_BIN} --bun node_modules/.bin/next start --hostname 0.0.0.0 --port 4000
Restart=always
RestartSec=5
# Resource guards — the frontend can spike RAM under many panes / login storms.
# MemoryHigh throttles + reclaims before the hard MemoryMax backstop; CPUWeight
# raises scheduling priority so the UI stays responsive under host contention.
MemoryHigh=1536M
MemoryMax=2G
CPUWeight=800
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-frontend

[Install]
WantedBy=multi-user.target
EOF

echo "  Created /etc/systemd/system/vps-control-room-frontend.service"

# --- Agent service ---

cat > /etc/systemd/system/vps-control-room-agent.service << EOF
[Unit]
Description=VPS Control Room Agent
After=network.target docker.service
Requires=docker.service
# Bound the restart loop: the agent now exits(1) on an uncaught exception /
# unhandled rejection (see agent/src/app/bootstrap.ts). Allow a few quick
# restarts for transient faults, but stop hammering if it can't stay up.
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${REPO_DIR}/agent
EnvironmentFile=${REPO_DIR}/.env.local
# bun on PATH for everything the agent SPAWNS (pty panes, patrol subprocesses,
# cron jobs) — non-interactive children never source .bashrc, so without this a
# `bun run build` from a pane fails with command-not-found.
Environment=PATH=${BUN_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Stays on Node deliberately: under Bun, node-pty spawns but never emits data.
ExecStart=/usr/bin/node ${REPO_DIR}/agent/dist/index.js
Restart=always
RestartSec=5
# Resource guards. CRITICAL: node-pty spawns every terminal session as a CHILD
# of this service, so the agent cgroup also accounts for ALL interactive
# workloads users run in panes — including a `next build` kicked off inside a
# pane (or by a git pre-push CI hook). A tight cap here does NOT protect the
# box; it strangles the terminals: on 2026-05-28 a 2G MemoryHigh drove the
# cgroup to 84% memory-stall (572k reclaim events) and made typing lag.
# So these limits are GENEROUS — they only backstop a true runaway (won't let
# the agent eat all 31G and OOM the host), not throttle normal interactive use.
# High CPUWeight keeps patrol + health API scheduled when the box is contended.
MemoryHigh=10G
MemoryMax=16G
# MemorySwapMax is the swap-bomb backstop (2026-06-21 incident): an orphaned pane
# kicked off 6 parallel `next build`, which exceeded RAM and spilled UNBOUNDED
# into the host's 8G swap (swap=infinity here) — stalling the WHOLE VPS at 99%
# memory-pressure, load 43. A small swap cap OOM-kills the runaway INSIDE this
# cgroup instead of dragging the host into swap thrash. Unlike a tight RAM cap it
# does NOT strangle interactive use (swap only bites past RAM): keep RAM generous,
# swap tight. Pairs with the killSessionTree() process-group kill in manager.ts.
MemorySwapMax=512M
CPUWeight=800
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-agent

[Install]
WantedBy=multi-user.target
EOF

echo "  Created /etc/systemd/system/vps-control-room-agent.service"

# --- Cleanup service/timer ---

cat > /etc/systemd/system/vps-control-room-cleanup.service << EOF
[Unit]
Description=VPS Control Room Cleanup
After=network.target

[Service]
Type=oneshot
WorkingDirectory=${REPO_DIR}
ExecStart=/bin/bash ${REPO_DIR}/scripts/cleanup-terminal-runtime.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-cleanup
EOF

echo "  Created /etc/systemd/system/vps-control-room-cleanup.service"

cat > /etc/systemd/system/vps-control-room-cleanup.timer << EOF
[Unit]
Description=Run VPS Control Room cleanup daily

[Timer]
OnBootSec=15min
OnCalendar=daily
Persistent=true
Unit=vps-control-room-cleanup.service

[Install]
WantedBy=timers.target
EOF

echo "  Created /etc/systemd/system/vps-control-room-cleanup.timer"

# --- Reload and enable ---

systemctl daemon-reload
echo "  Ran systemctl daemon-reload"

systemctl enable vps-control-room-frontend
echo "  Enabled vps-control-room-frontend (starts on boot)"

systemctl enable vps-control-room-agent
echo "  Enabled vps-control-room-agent (starts on boot)"

systemctl enable vps-control-room-cleanup.timer
echo "  Enabled vps-control-room-cleanup.timer (runs daily)"

echo ""
echo "Installation complete."
echo ""
echo "Next steps:"
echo "  1. Ensure ${REPO_DIR}/.env.local is populated."
echo "  2. Build the frontend:  cd frontend && bun install && bun run build"
echo "  3. Build the agent:     cd agent && bun install && bun run build"
echo "  4. Start services:"
echo "       sudo systemctl start vps-control-room-frontend"
echo "       sudo systemctl start vps-control-room-agent"
echo "       sudo systemctl start vps-control-room-cleanup.timer"
echo "  5. Check status:"
echo "       sudo systemctl status vps-control-room-frontend"
echo "       sudo systemctl status vps-control-room-agent"
echo "       sudo systemctl status vps-control-room-cleanup.timer"
