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

load_env_file() {
  local path="$1"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ""|\#*)
        continue
        ;;
    esac

    local key="${line%%=*}"
    local value="${line#*=}"
    export "${key}=${value}"
  done < "$path"
}

log "Starting deploy for branch: ${BRANCH}"

if ! sudo -n true >/dev/null 2>&1; then
  log "Passwordless sudo is required for restarting services"
  exit 1
fi

require_file "${REPO_DIR}/.env.local"
require_file "${REPO_DIR}/convex/.env.local"

load_env_file "${REPO_DIR}/.env.local"
load_env_file "${REPO_DIR}/convex/.env.local"

cd "${REPO_DIR}"

log "Updating repository"
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

log "Installing and building frontend"
cd frontend
npm install
npm run build

log "Preparing standalone frontend assets"
mkdir -p .next/standalone/frontend/.next
rm -rf .next/standalone/frontend/.next/static
cp -R .next/static .next/standalone/frontend/.next/static
rm -rf .next/standalone/frontend/.next/server
cp -R .next/server .next/standalone/frontend/.next/server

for manifest in \
  BUILD_ID \
  app-build-manifest.json \
  app-path-routes-manifest.json \
  app-paths-manifest.json \
  build-manifest.json \
  export-marker.json \
  images-manifest.json \
  next-minimal-server.js.nft.json \
  next-server.js.nft.json \
  package.json \
  prerender-manifest.json \
  react-loadable-manifest.json \
  required-server-files.json \
  routes-manifest.json
do
  if [ -f ".next/${manifest}" ]; then
    cp ".next/${manifest}" ".next/standalone/frontend/.next/${manifest}"
  fi
done

if [ -d public ]; then
  rm -rf .next/standalone/frontend/public
  cp -R public .next/standalone/frontend/public
fi

if [ -d node_modules/node-pty ]; then
  mkdir -p .next/standalone/frontend/node_modules/node-pty

  for native_dir in build prebuilds; do
    if [ -d "node_modules/node-pty/${native_dir}" ]; then
      rm -rf ".next/standalone/frontend/node_modules/node-pty/${native_dir}"
      cp -R "node_modules/node-pty/${native_dir}" ".next/standalone/frontend/node_modules/node-pty/${native_dir}"
    fi
  done
fi

cd ..

log "Installing and building agent"
cd agent
npm install
npm run build
cd ..

log "Deploying Convex functions"
npx convex deploy --env-file convex/.env.local --typecheck disable -y

log "Restarting systemd services"
sudo systemctl restart vps-control-room-frontend
sudo systemctl restart vps-control-room-agent

log "Verifying services are active"
sudo systemctl is-active --quiet vps-control-room-frontend
sudo systemctl is-active --quiet vps-control-room-agent

log "Deployment complete"
