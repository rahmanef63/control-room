#!/bin/bash
set -e

# VPS Control Room — systemd service installer
# Run with: sudo bash scripts/install-systemd.sh

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: this script must be run as root (use sudo)." >&2
  exit 1
fi

echo "Installing VPS Control Room systemd services..."

# --- Frontend service ---

cat > /etc/systemd/system/vps-control-room-frontend.service << 'EOF'
[Unit]
Description=VPS Control Room Frontend
After=network.target

[Service]
Type=simple
User=rahman
WorkingDirectory=/home/rahman/projects/vps-rahmanef/frontend
EnvironmentFile=/home/rahman/projects/vps-rahmanef/.env.local
Environment=PORT=4000
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/node /home/rahman/projects/vps-rahmanef/frontend/.next/standalone/frontend/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-frontend

[Install]
WantedBy=multi-user.target
EOF

echo "  Created /etc/systemd/system/vps-control-room-frontend.service"

# --- Agent service ---

cat > /etc/systemd/system/vps-control-room-agent.service << 'EOF'
[Unit]
Description=VPS Control Room Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=rahman
WorkingDirectory=/home/rahman/projects/vps-rahmanef/agent
EnvironmentFile=/home/rahman/projects/vps-rahmanef/.env.local
ExecStart=/usr/bin/node /home/rahman/projects/vps-rahmanef/agent/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=vps-cr-agent

[Install]
WantedBy=multi-user.target
EOF

echo "  Created /etc/systemd/system/vps-control-room-agent.service"

# --- Reload and enable ---

systemctl daemon-reload
echo "  Ran systemctl daemon-reload"

systemctl enable vps-control-room-frontend
echo "  Enabled vps-control-room-frontend (starts on boot)"

systemctl enable vps-control-room-agent
echo "  Enabled vps-control-room-agent (starts on boot)"

echo ""
echo "Installation complete."
echo ""
echo "Next steps:"
echo "  1. Ensure /home/rahman/projects/vps-rahmanef/.env.local is populated."
echo "  2. Build the frontend:  cd frontend && npm run build"
echo "  3. Build the agent:     cd agent && npm run build"
echo "  4. Start services:"
echo "       sudo systemctl start vps-control-room-frontend"
echo "       sudo systemctl start vps-control-room-agent"
echo "  5. Check status:"
echo "       sudo systemctl status vps-control-room-frontend"
echo "       sudo systemctl status vps-control-room-agent"
