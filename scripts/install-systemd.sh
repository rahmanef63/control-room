#!/bin/bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: this script must be run as root (use sudo)." >&2
  exit 1
fi

APP_USER="${APP_USER:-${SUDO_USER:-$(logname 2>/dev/null || echo rahman)}}"
WEB_USER="${CONTROL_ROOM_WEB_USER:-control-room-web}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_ROOT="${CONTROL_ROOM_RUNTIME_ROOT:-/srv/control-room}"
STATE_ROOT="${CONTROL_ROOM_STATE_ROOT:-/var/lib/control-room}"
RUNTIME_ENV="${CONTROL_ROOM_ENV_FILE:-/etc/control-room/control-room.env}"
BUN_BIN="${BUN_BIN:-}"

APP_USER_HOME="$(getent passwd "${APP_USER}" | cut -d: -f6)"
if [ -z "${BUN_BIN}" ] && [ -x "${APP_USER_HOME}/.bun/bin/bun" ]; then
  BUN_BIN="${APP_USER_HOME}/.bun/bin/bun"
fi
if [ -z "${BUN_BIN}" ]; then BUN_BIN="$(command -v bun || true)"; fi

APP_USER="${APP_USER}" BUN_BIN="${BUN_BIN}" \
  CONTROL_ROOM_WEB_USER="${WEB_USER}" \
  CONTROL_ROOM_RUNTIME_ROOT="${RUNTIME_ROOT}" \
  CONTROL_ROOM_STATE_ROOT="${STATE_ROOT}" \
  bash "${REPO_DIR}/scripts/prepare-runtime.sh" >/dev/null

if [ ! -f "${RUNTIME_ENV}" ]; then
  echo "Error: canonical runtime env is missing: ${RUNTIME_ENV}" >&2
  exit 1
fi
if [ ! -L "${RUNTIME_ROOT}/frontend/current" ] || [ ! -d "${RUNTIME_ROOT}/frontend/current/build" ]; then
  echo "Error: frontend/current does not point at a staged release" >&2
  exit 1
fi
if [ ! -L "${RUNTIME_ROOT}/agent/current" ] || [ ! -f "${RUNTIME_ROOT}/agent/current/agent/dist/index.js" ]; then
  echo "Error: agent/current does not point at a staged release" >&2
  exit 1
fi

cat > /etc/systemd/system/vps-control-room-frontend.service <<EOF_UNIT
[Unit]
Description=VPS Control Room Svelte Frontend
After=network.target

[Service]
Type=simple
User=${WEB_USER}
Group=${WEB_USER}
WorkingDirectory=${RUNTIME_ROOT}/frontend/current
EnvironmentFile=${RUNTIME_ENV}
Environment=PORT=4000
Environment=HOST=0.0.0.0
Environment=NODE_ENV=production
Environment=BODY_SIZE_LIMIT=30M
Environment=SHUTDOWN_TIMEOUT=5
Environment=PROTOCOL_HEADER=x-forwarded-proto
Environment=HOST_HEADER=x-forwarded-host
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/node build/index.js
Restart=always
RestartSec=1
KillSignal=SIGTERM
TimeoutStopSec=8
MemoryHigh=3G
MemoryMax=4G
CPUWeight=800
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectClock=true
ProtectControlGroups=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectHostname=true
RestrictSUIDSGID=true
RestrictRealtime=true
LockPersonality=true
CapabilityBoundingSet=
AmbientCapabilities=
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
IPAddressDeny=any
IPAddressAllow=127.0.0.0/8
IPAddressAllow=::1
IPAddressAllow=172.16.0.0/12
ReadWritePaths=${STATE_ROOT}/frontend
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-frontend

[Install]
WantedBy=multi-user.target
EOF_UNIT

cat > /etc/systemd/system/vps-control-room-agent.service <<EOF_UNIT
[Unit]
Description=VPS Control Room Privileged Host Agent
After=network.target docker.service
Requires=docker.service
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${RUNTIME_ROOT}/agent/current/agent
EnvironmentFile=${RUNTIME_ENV}
Environment=PATH=${APP_USER_HOME}/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
MemoryHigh=14G
MemoryMax=18G
MemorySwapMax=512M
CPUWeight=800
UMask=0077
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-agent

[Install]
WantedBy=multi-user.target
EOF_UNIT

install -d -o root -g root -m 0755 /usr/local/lib/control-room
install -o root -g root -m 0755 "${REPO_DIR}/scripts/cleanup-terminal-runtime.sh" /usr/local/lib/control-room/cleanup-terminal-runtime.sh
install -o root -g root -m 0755 "${REPO_DIR}/scripts/healthcheck-control-room.sh" /usr/local/lib/control-room/healthcheck-control-room.sh
install -o root -g root -m 0755 "${REPO_DIR}/scripts/approve-device.js" /usr/local/lib/control-room/approve-device.js
cat > /usr/local/bin/control-room-device <<EOF_HELPER
#!/bin/bash
set -euo pipefail
exec sudo -u ${WEB_USER} env AUTH_DEVICE_STORE=${STATE_ROOT}/frontend/auth-devices.json /usr/bin/node /usr/local/lib/control-room/approve-device.js "\$@"
EOF_HELPER
chmod 0755 /usr/local/bin/control-room-device

cat > /etc/systemd/system/vps-control-room-cleanup.service <<EOF_UNIT
[Unit]
Description=VPS Control Room Runtime Cleanup
After=network.target

[Service]
Type=oneshot
User=${APP_USER}
WorkingDirectory=${RUNTIME_ROOT}
Environment=CONTROL_ROOM_RUNTIME_ROOT=${RUNTIME_ROOT}
ExecStart=/bin/bash /usr/local/lib/control-room/cleanup-terminal-runtime.sh
NoNewPrivileges=true
PrivateTmp=true
UMask=0077
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-cleanup
EOF_UNIT

cat > /etc/systemd/system/vps-control-room-cleanup.timer <<'EOF_UNIT'
[Unit]
Description=Run VPS Control Room cleanup daily

[Timer]
OnBootSec=15min
OnCalendar=daily
Persistent=true
Unit=vps-control-room-cleanup.service

[Install]
WantedBy=timers.target
EOF_UNIT

cat > /etc/systemd/system/vps-control-room-healthcheck.service <<EOF_UNIT
[Unit]
Description=VPS Control Room Security/Health Check
After=vps-control-room-agent.service vps-control-room-frontend.service

[Service]
Type=oneshot
User=${WEB_USER}
Environment=CONTROL_ROOM_DOMAIN=${CONTROL_ROOM_DOMAIN:-}
ExecStart=/bin/bash /usr/local/lib/control-room/healthcheck-control-room.sh
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
UMask=0077
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-healthcheck
EOF_UNIT

cat > /etc/systemd/system/vps-control-room-healthcheck.timer <<'EOF_UNIT'
[Unit]
Description=Check VPS Control Room every five minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=30s
Persistent=true
Unit=vps-control-room-healthcheck.service

[Install]
WantedBy=timers.target
EOF_UNIT

rm -f /etc/systemd/system/vps-control-room-frontend.service.d/10-release.conf \
  /etc/systemd/system/vps-control-room-frontend.service.d/10-svelte.conf \
  /etc/systemd/system/vps-control-room-agent.service.d/10-release.conf

systemctl daemon-reload
systemctl enable vps-control-room-frontend vps-control-room-agent vps-control-room-cleanup.timer vps-control-room-healthcheck.timer >/dev/null

echo "Installed canonical Control Room services: web=${WEB_USER}, agent=${APP_USER}, runtime=${RUNTIME_ROOT}"
