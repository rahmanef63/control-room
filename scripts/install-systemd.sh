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
SKIP_AGENT_UNIT="${SKIP_AGENT_UNIT:-0}"
AUTH_DEVICE_STORE_PATH="${AUTH_DEVICE_STORE:-${REPO_DIR}/agent/var/auth-devices.json}"

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
Environment=HOST=0.0.0.0
Environment=NODE_ENV=production
Environment=BODY_SIZE_LIMIT=30M
# adapter-node gracefully drains open requests, then force-closes long-lived SSE
# connections after this bound so deploy/restart cannot hang indefinitely.
Environment=SHUTDOWN_TIMEOUT=5
# This service is only exposed through the trusted reverse proxy. These headers
# let SvelteKit reconstruct the public origin when ORIGIN is not explicitly set.
Environment=PROTOCOL_HEADER=x-forwarded-proto
Environment=HOST_HEADER=x-forwarded-host
Environment=AUTH_DEVICE_STORE=${AUTH_DEVICE_STORE_PATH}
Environment=PATH=${BUN_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# SvelteKit adapter-node output is build/index.js; Bun is the frontend runtime.
ExecStart=${BUN_BIN} build/index.js
Restart=always
RestartSec=1
KillSignal=SIGTERM
TimeoutStopSec=8
# Resource guards — the frontend can spike RAM under many panes / login storms.
# MemoryHigh throttles + reclaims before the hard MemoryMax backstop; CPUWeight
# raises scheduling priority so the UI stays responsive under host contention.
# Sized for the per-pane cost: each open pane holds an SSE stream plus a `ws`
# client in THIS process, and ws queues unsent frames off-heap (see the
# MAX_WS_BUFFER_BYTES note in agent/src/terminal/gateway/socket.ts). 1.5G/2G was
# tight enough that a full grid of panes ran against the ceiling.
MemoryHigh=3G
MemoryMax=4G
CPUWeight=800
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-frontend

[Install]
WantedBy=multi-user.target
EOF

echo "  Created /etc/systemd/system/vps-control-room-frontend.service"

# --- Agent service ---

if [ "${SKIP_AGENT_UNIT}" != "1" ]; then
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
# workloads users run in panes — including a frontend build kicked off inside a
# pane (or by a git pre-push CI hook). A tight cap here does NOT protect the
# box; it strangles the terminals: on 2026-05-28 a 2G MemoryHigh drove the
# cgroup to 84% memory-stall (572k reclaim events) and made typing lag.
# So these limits are GENEROUS — they only backstop a true runaway (won't let
# the agent eat all 31G and OOM the host), not throttle normal interactive use.
# High CPUWeight keeps patrol + health API scheduled when the box is contended.
# Sizing (2026-08-09): a pane running Claude Code / Codex costs ~0.5-1 GB RSS,
# so the OLD 8G effective ceiling throttled at roughly a dozen panes — while the
# SAME command over ssh lands in user.slice, which is MemoryMax=infinity. That
# asymmetry, not the app, was why "opening a few panes" hit a wall. On a 31 GB
# box these numbers put the web terminal in the same league as ssh while still
# refusing to let a runaway take the host down with it.
# Budget arithmetic, not vibes: 31 GB box. Reserve ~9 GB for the host, docker,
# dokploy, n8n, sshd and page cache, and 4 GB for the frontend unit -> the agent
# may hold at most ~18 GB. MemoryHigh is the number that actually bites day to
# day (throttle + reclaim); MemoryMax is the emergency stop. Keeping Max under
# the host's headroom means a runaway is OOM-killed INSIDE this cgroup instead
# of dragging the whole VPS into global reclaim.
MemoryHigh=14G
MemoryMax=18G
# MemorySwapMax is the swap-bomb backstop (2026-06-21 incident): an orphaned pane
# kicked off 6 parallel frontend builds, which exceeded RAM and spilled UNBOUNDED
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
else
  echo "  Preserving existing agent unit (frontend-only deployment)"
fi

# --- Cleanup service/timer ---

cat > /etc/systemd/system/vps-control-room-cleanup.service << EOF
[Unit]
Description=VPS Control Room Cleanup
After=network.target

[Service]
Type=oneshot
User=${APP_USER}
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

# Drop `systemctl set-property` leftovers. Those land in /etc/systemd/system.control
# and OVERRIDE the unit files written above, so a limit tuned live during an
# incident silently outranks this script forever — the repo says one number and
# the box runs another. This script is the source of truth; anything set-property
# left behind is stale by definition.
units=(frontend cleanup)
if [ "${SKIP_AGENT_UNIT}" != "1" ]; then
  units+=(agent)
fi
for unit in "${units[@]}"; do
  ctl="/etc/systemd/system.control/vps-control-room-${unit}.service.d"
  if [ -d "${ctl}" ]; then
    rm -rf "${ctl}"
    echo "  Removed stale set-property overrides: ${ctl}"
  fi
done

systemctl daemon-reload
echo "  Ran systemctl daemon-reload"

systemctl enable vps-control-room-frontend
echo "  Enabled vps-control-room-frontend (starts on boot)"

if [ "${SKIP_AGENT_UNIT}" != "1" ]; then
  systemctl enable vps-control-room-agent
  echo "  Enabled vps-control-room-agent (starts on boot)"
fi

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
