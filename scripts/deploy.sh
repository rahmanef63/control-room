#!/bin/bash
set -euo pipefail

REPO_DIR="/home/rahman/projects/vps-rahmanef"
BRANCH="${1:-main}"

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*"
}

require_file() {
  local path="$1"
  if [ ! -f "$path" ]; then
    log "Missing required file: $path"
    exit 1
  fi
}

log "Starting deploy for branch: ${BRANCH}"

if ! sudo -n true >/dev/null 2>&1; then
  log "Passwordless sudo is required for restarting services"
  exit 1
fi

require_file "${REPO_DIR}/.env.local"
require_file "${REPO_DIR}/convex/.env.local"

cd "${REPO_DIR}"

log "Updating repository"
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

log "Installing and building frontend"
cd frontend
npm install
npm run build
cd ..

log "Installing and building agent"
cd agent
npm install
npm run build
cd ..

log "Deploying Convex functions"
cd convex
npm install
npm run deploy
cd ..

log "Restarting systemd services"
sudo systemctl restart vps-control-room-frontend
sudo systemctl restart vps-control-room-agent

log "Verifying services are active"
sudo systemctl is-active --quiet vps-control-room-frontend
sudo systemctl is-active --quiet vps-control-room-agent

log "Deployment complete"
