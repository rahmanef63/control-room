#!/bin/bash
set -euo pipefail

# Resolve repo root from GITHUB_WORKSPACE (CI) or the script's own location.
REPO_DIR="${GITHUB_WORKSPACE:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"
BRANCH="${1:-main}"
LOCK_FILE="/tmp/vps-control-room-deploy.lock"
DEPLOY_STATE_DIR="${REPO_DIR}/.deploy-state"
AGENT_STAMP_FILE="${DEPLOY_STATE_DIR}/agent.commit"

exec 9>"${LOCK_FILE}"
flock 9

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
require_file "${REPO_DIR}/ops/traefik/vps-control-room.yml"

load_env_file "${REPO_DIR}/.env.local"
load_env_file "${REPO_DIR}/convex/.env.local"

cd "${REPO_DIR}"
mkdir -p "${DEPLOY_STATE_DIR}"

log "Updating repository"
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"
CURRENT_COMMIT="$(git rev-parse HEAD)"

CHANGED_FILES="$(git diff --name-only "${PREVIOUS_COMMIT}" "${CURRENT_COMMIT}" || true)"
LOCAL_AGENT_CHANGES="$(git status --porcelain -- agent scripts/deploy.sh convex frontend/app/api/terminals frontend/app/\(dashboard\)/terminals frontend/lib/server/terminal-gateway.ts frontend/next.config.ts || true)"
LOCAL_CONVEX_CHANGES="$(git status --porcelain -- convex package.json package-lock.json || true)"
AGENT_RESTART_REQUIRED=0
CONVEX_DEPLOY_REQUIRED=0
LAST_AGENT_DEPLOYED_COMMIT="$(cat "${AGENT_STAMP_FILE}" 2>/dev/null || true)"
AGENT_CHANGES_SINCE_LAST_DEPLOY=""

if [ -n "${LAST_AGENT_DEPLOYED_COMMIT}" ] && git cat-file -e "${LAST_AGENT_DEPLOYED_COMMIT}^{commit}" 2>/dev/null; then
  AGENT_CHANGES_SINCE_LAST_DEPLOY="$(git diff --name-only "${LAST_AGENT_DEPLOYED_COMMIT}" "${CURRENT_COMMIT}" || true)"
else
  AGENT_RESTART_REQUIRED=1
fi

if printf '%s\n%s\n%s\n' "${CHANGED_FILES}" "${LOCAL_AGENT_CHANGES}" "${AGENT_CHANGES_SINCE_LAST_DEPLOY}" | grep -qE '(^| )agent/|(^| )convex/|scripts/deploy\.sh|frontend/app/api/terminals|frontend/app/\(dashboard\)/terminals|frontend/lib/server/terminal-gateway\.ts'; then
  AGENT_RESTART_REQUIRED=1
fi

if printf '%s\n%s\n' "${CHANGED_FILES}" "${LOCAL_CONVEX_CHANGES}" | grep -qE '(^| )convex/|(^| )package\.json|(^| )package-lock\.json'; then
  CONVEX_DEPLOY_REQUIRED=1
fi

log "Installing and building frontend"
cd frontend
npm install
rm -rf .next
npm run build
cd ..

if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  log "Installing and building agent"
  cd agent
  npm install
  npm run build
  cd ..
  printf '%s\n' "${CURRENT_COMMIT}" > "${AGENT_STAMP_FILE}"
else
  log "Skipping agent rebuild (no relevant changes)"
fi

if [ "${CONVEX_DEPLOY_REQUIRED}" -eq 1 ]; then
  log "Deploying Convex functions"
  npx convex deploy --env-file convex/.env.local --typecheck disable -y
else
  log "Skipping Convex deploy (no relevant changes)"
fi

log "Syncing Traefik dynamic config"
# envsubst substitutes CONTROL_ROOM_DOMAIN (and any other vars) from the
# loaded .env.local so the template placeholder never reaches the live config.
CONTROL_ROOM_DOMAIN="${CONTROL_ROOM_DOMAIN:-}" \
  envsubst '${CONTROL_ROOM_DOMAIN}' \
  < "${REPO_DIR}/ops/traefik/vps-control-room.yml" \
  | sudo tee /etc/dokploy/traefik/dynamic/vps-control-room.yml > /dev/null

log "Restarting systemd services"
sudo systemctl restart vps-control-room-frontend
if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  sudo systemctl restart vps-control-room-agent
fi

log "Verifying services are active"
sudo systemctl is-active --quiet vps-control-room-frontend
if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  sudo systemctl is-active --quiet vps-control-room-agent
fi

log "Deployment complete"
