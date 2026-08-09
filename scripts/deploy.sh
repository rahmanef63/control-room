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

# Resolve bun once. systemd/CI invoke this with a minimal PATH that usually
# lacks ~/.bun/bin, so fall back to the default install location.
BUN="${BUN:-$(command -v bun || echo "${HOME:-}/.bun/bin/bun")}"
if [ ! -x "${BUN}" ]; then
  log "bun not found at '${BUN}' (looked in PATH and \$HOME/.bun/bin) — install bun or set BUN=/path/to/bun"
  exit 1
fi

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

  # Type=simple means `systemctl start` returns as soon as systemd forks, so an
  # immediate is-active check races a process that dies milliseconds later
  # (e.g. ExecStart's binary not on the unit's PATH -> exit 127 -> restart loop).
  # It would report success and then delete PREVIOUS_NEXT_DIR, destroying the
  # only rollback material. Let it settle, then require it to still be up.
  if sudo systemctl start vps-control-room-frontend; then
    sleep 8
    if sudo systemctl is-active --quiet vps-control-room-frontend; then
      rm -rf "${PREVIOUS_NEXT_DIR}"
      return
    fi
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

# Put vps-cr on PATH. Only install.sh (the LOCAL installer) ever created this
# symlink, so on a VPS checkout the CLI shipped in bin/ was unreachable — and
# it owns the device-approval commands you need exactly when you are locked out
# of the dashboard. Idempotent; ln -sfn re-points it if the repo moved.
if [ -x "${REPO_DIR}/bin/vps-cr" ] && [ -n "${HOME:-}" ]; then
  mkdir -p "${HOME}/.local/bin"
  ln -sfn "${REPO_DIR}/bin/vps-cr" "${HOME}/.local/bin/vps-cr"
fi

# Stamp SW cache keys + Next.js build id with the SAME 12-char commit slice
# so every layer (SW cache name, NEXT_PUBLIC_BUILD_ID baked into the bundle,
# /api/version response) reports the identical id. Makes "which build is
# this?" debugging trivial.
BUILD_ID_SHORT="${CURRENT_COMMIT:0:12}"
bash "${REPO_DIR}/scripts/bump-version.sh" "${BUILD_ID_SHORT}"
export COMMIT_SHA="${CURRENT_COMMIT}"
export NEXT_PUBLIC_BUILD_ID="${BUILD_ID_SHORT}"
log "Stamped sw.js + build id: v${BUILD_ID_SHORT}"

CHANGED_FILES="$(git diff --name-only "${PREVIOUS_COMMIT}" "${CURRENT_COMMIT}" || true)"
LOCAL_AGENT_CHANGES="$(git status --porcelain -- agent scripts/deploy.sh convex frontend/app/api/terminals frontend/app/\(dashboard\)/terminals frontend/lib/server/terminal-gateway.ts frontend/next.config.ts || true)"
LOCAL_CONVEX_CHANGES="$(git status --porcelain -- convex package.json bun.lock || true)"
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

if printf '%s\n%s\n' "${CHANGED_FILES}" "${LOCAL_CONVEX_CHANGES}" | grep -qE '(^| )convex/|(^| )package\.json|(^| )bun\.lock'; then
  CONVEX_DEPLOY_REQUIRED=1
fi

snapshot_frontend_static
prune_frontend_static_snapshots

log "Installing frontend deps"
cd "${FRONTEND_DIR}"
"${BUN}" install

# Preflight: typecheck + unit tests must pass before we ever touch the live
# build. Failures abort early, leaving the running server untouched.
if [ "${SKIP_FRONTEND_TESTS:-0}" != "1" ]; then
  log "Running frontend tests (typecheck + unit tests)"
  "${BUN}" run test:all
else
  log "Skipping frontend tests (SKIP_FRONTEND_TESTS=1)"
fi

log "Building frontend"
rm -rf "${STAGED_NEXT_DIR}"
# Run the build at low CPU/IO priority so it yields to runtime + monitoring.
# A single on-box `next build` is the control room's share of the build-storm
# that tripped the 2026-05-28 Hostinger CPU throttle; nicing it keeps the box
# responsive (and patrol unblinded) while it builds.
NEXT_DIST_DIR="$(basename "${STAGED_NEXT_DIR}")" nice -n 15 ionice -c2 -n7 "${BUN}" run build
cd "${REPO_DIR}"
restore_frontend_static_snapshots

if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  log "Installing and building agent"
  cd agent
  "${BUN}" install
  "${BUN}" run build
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
  # `bun x` is bunx; called via the resolved binary because PATH may lack ~/.bun/bin.
  NODE_TLS_REJECT_UNAUTHORIZED=0 \
    "${BUN}" x convex deploy --env-file convex/.env.local --typecheck disable -y
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

# Regenerate the units from the repo BEFORE promoting the build. The unit files
# encode the absolute bun path and the unit PATH; a unit written by an older
# revision (e.g. the pre-bun `ExecStart=/usr/bin/npm run start`) would start a
# shell that can't resolve bun and crash-loop, and the .next rollback below
# cannot fix a unit-file problem. install-systemd.sh is idempotent and only
# writes + daemon-reload + enable — it never starts or restarts anything.
log "Regenerating systemd units"
# APP_USER is pinned to whoever owns this deploy, not derived from SUDO_USER —
# a CI runner invoking deploy.sh under a different account must not silently
# rewrite the units' User=.
sudo APP_USER="$(id -un)" BUN_BIN="${BUN}" bash "${REPO_DIR}/scripts/install-systemd.sh" > /dev/null

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
