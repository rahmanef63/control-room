#!/bin/bash
set -euo pipefail

# Resolve repo root from GITHUB_WORKSPACE (CI) or the script's own location.
REPO_DIR="${GITHUB_WORKSPACE:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"
BRANCH="${1:-main}"
LOCK_FILE="/tmp/vps-control-room-deploy.lock"
DEPLOY_STATE_DIR="${REPO_DIR}/.deploy-state"
AGENT_STAMP_FILE="${DEPLOY_STATE_DIR}/agent.commit"
FRONTEND_DIR="${REPO_DIR}/frontend"
LIVE_NEXT_DIR="${FRONTEND_DIR}/.next"
STAGED_NEXT_DIR="${FRONTEND_DIR}/.next-staging"
PREVIOUS_NEXT_DIR="${FRONTEND_DIR}/.next-previous"
FRONTEND_STATIC_SNAPSHOT_DIR="${DEPLOY_STATE_DIR}/frontend-static"
FRONTEND_STATIC_SNAPSHOT_RETENTION=3

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

snapshot_frontend_static() {
  if [ ! -d "${LIVE_NEXT_DIR}/static" ]; then
    return
  fi

  mkdir -p "${FRONTEND_STATIC_SNAPSHOT_DIR}"

  local snapshot_dir="${FRONTEND_STATIC_SNAPSHOT_DIR}/$(date -u '+%Y%m%d%H%M%S')-${PREVIOUS_COMMIT:0:12}"
  mkdir -p "${snapshot_dir}"
  cp -a "${LIVE_NEXT_DIR}/static/." "${snapshot_dir}/"
}

prune_frontend_static_snapshots() {
  if [ ! -d "${FRONTEND_STATIC_SNAPSHOT_DIR}" ]; then
    return
  fi

  local snapshots=()
  mapfile -t snapshots < <(find "${FRONTEND_STATIC_SNAPSHOT_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)

  if [ "${#snapshots[@]}" -le "${FRONTEND_STATIC_SNAPSHOT_RETENTION}" ]; then
    return
  fi

  local remove_count=$(( ${#snapshots[@]} - FRONTEND_STATIC_SNAPSHOT_RETENTION ))
  local index=0
  while [ "${index}" -lt "${remove_count}" ]; do
    rm -rf "${snapshots[${index}]}"
    index=$((index + 1))
  done
}

restore_frontend_static_snapshots() {
  if [ ! -d "${STAGED_NEXT_DIR}/static" ] || [ ! -d "${FRONTEND_STATIC_SNAPSHOT_DIR}" ]; then
    return
  fi

  local snapshots=()
  mapfile -t snapshots < <(find "${FRONTEND_STATIC_SNAPSHOT_DIR}" -mindepth 1 -maxdepth 1 -type d | sort)

  local snapshot
  for snapshot in "${snapshots[@]}"; do
    cp -a "${snapshot}/." "${STAGED_NEXT_DIR}/static/"
  done
}

activate_frontend_build() {
  if [ ! -d "${STAGED_NEXT_DIR}" ]; then
    log "Missing staged frontend build: ${STAGED_NEXT_DIR}"
    exit 1
  fi

  log "Promoting staged frontend build"
  sudo systemctl stop vps-control-room-frontend

  rm -rf "${PREVIOUS_NEXT_DIR}"
  if [ -d "${LIVE_NEXT_DIR}" ]; then
    mv "${LIVE_NEXT_DIR}" "${PREVIOUS_NEXT_DIR}"
  fi
  mv "${STAGED_NEXT_DIR}" "${LIVE_NEXT_DIR}"

  if sudo systemctl start vps-control-room-frontend && sudo systemctl is-active --quiet vps-control-room-frontend; then
    rm -rf "${PREVIOUS_NEXT_DIR}"
    return
  fi

  log "Frontend failed to start after promotion, rolling back"
  sudo systemctl stop vps-control-room-frontend || true
  rm -rf "${LIVE_NEXT_DIR}"

  if [ -d "${PREVIOUS_NEXT_DIR}" ]; then
    mv "${PREVIOUS_NEXT_DIR}" "${LIVE_NEXT_DIR}"
    sudo systemctl start vps-control-room-frontend || true
  fi

  exit 1
}

log "Starting deploy for branch: ${BRANCH}"

if ! sudo -n true >/dev/null 2>&1; then
  log "Passwordless sudo is required for restarting services"
  exit 1
fi

require_file "${REPO_DIR}/.env.local"
require_file "${REPO_DIR}/ops/traefik/vps-control-room.yml"

load_env_file "${REPO_DIR}/.env.local"

TERMINAL_ONLY_MODE="${TERMINAL_ONLY_MODE:-true}"
if [ "${TERMINAL_ONLY_MODE}" = "true" ] || [ "${TERMINAL_ONLY_MODE}" = "1" ]; then
  TERMINAL_ONLY_ENABLED=1
else
  TERMINAL_ONLY_ENABLED=0
fi

if [ -f "${REPO_DIR}/convex/.env.local" ]; then
  load_env_file "${REPO_DIR}/convex/.env.local"
elif [ "${TERMINAL_ONLY_ENABLED}" -eq 0 ]; then
  log "Missing required file: ${REPO_DIR}/convex/.env.local"
  exit 1
fi

cd "${REPO_DIR}"
mkdir -p "${DEPLOY_STATE_DIR}"

log "Updating repository"
PREVIOUS_COMMIT="$(git rev-parse HEAD)"
git fetch origin
git checkout "${BRANCH}"
# Reset any file patched during a previous deploy so ff-only pull remains clean.
git restore frontend/public/sw.js 2>/dev/null || git checkout -- frontend/public/sw.js 2>/dev/null || true
git pull --ff-only origin "${BRANCH}"
CURRENT_COMMIT="$(git rev-parse HEAD)"

# Stamp service-worker cache keys with the current commit hash so browsers
# evict stale chunk caches after each deploy.
SW_VERSION="${CURRENT_COMMIT:0:8}"
sed -i \
  -e "s/vps-control-room-v[^']*/vps-control-room-${SW_VERSION}/g" \
  -e "s/vps-static-v[^']*/vps-static-${SW_VERSION}/g" \
  "${REPO_DIR}/frontend/public/sw.js"
log "Stamped sw.js cache version: ${SW_VERSION}"

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

snapshot_frontend_static
prune_frontend_static_snapshots

log "Installing and building frontend"
cd "${FRONTEND_DIR}"
npm install
rm -rf "${STAGED_NEXT_DIR}"
NEXT_DIST_DIR="$(basename "${STAGED_NEXT_DIR}")" npm run build
cd "${REPO_DIR}"
restore_frontend_static_snapshots

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

if [ "${TERMINAL_ONLY_ENABLED}" -eq 1 ]; then
  log "Skipping Convex deploy (terminal-only mode enabled)"
elif [ "${CONVEX_DEPLOY_REQUIRED}" -eq 1 ]; then
  log "Deploying Convex functions"
  # The local self-hosted Convex endpoint uses a self-signed certificate.
  # Disable TLS verification for this deploy call so schema pushes remain
  # non-interactive during VPS rollouts.
  NODE_TLS_REJECT_UNAUTHORIZED=0 \
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
activate_frontend_build
if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  sudo systemctl restart vps-control-room-agent
fi

log "Verifying services are active"
if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  sudo systemctl is-active --quiet vps-control-room-agent
fi

log "Deployment complete"
