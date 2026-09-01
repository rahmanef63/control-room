#!/bin/bash
set -euo pipefail

# VPS Control Room — SvelteKit adapter-node deploy with immutable frontend releases.
# Default mode updates from origin/<branch>. Set DEPLOY_FROM_WORKTREE=1 to deploy
# the current local worktree without fetching, checking out, pulling, or pushing.

REPO_DIR="${GITHUB_WORKSPACE:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"
BRANCH="${1:-main}"
LOCK_FILE="/tmp/vps-control-room-deploy.lock"
STATE_DIR="${HOME:-/home/$(id -un)}/.local/state/control-room-deploy"
AGENT_STAMP_FILE="${STATE_DIR}/agent.commit"
FRONTEND_DIR="${REPO_DIR}/frontend"
RELEASES_DIR="${FRONTEND_DIR}/releases"
RELEASE_RETENTION="${FRONTEND_RELEASE_RETENTION:-5}"
FRONTEND_SERVICE="vps-control-room-frontend.service"
AGENT_SERVICE="vps-control-room-agent.service"
FRONTEND_DROPIN_DIR="/etc/systemd/system/${FRONTEND_SERVICE}.d"
FRONTEND_DROPIN="${FRONTEND_DROPIN_DIR}/10-release.conf"
LEGACY_FRONTEND_DROPIN="${FRONTEND_DROPIN_DIR}/10-svelte.conf"

exec 9>"${LOCK_FILE}"
flock 9

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*"
}

BUN="${BUN:-$(command -v bun || echo "${HOME:-}/.bun/bin/bun")}"
if [ ! -x "${BUN}" ]; then
  log "bun not found at '${BUN}' — install bun or set BUN=/path/to/bun"
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
      ""|\#*) continue ;;
    esac
    local key="${line%%=*}"
    local value="${line#*=}"
    export "${key}=${value}"
  done < "$path"
}

service_pid() {
  sudo systemctl show "$1" -p MainPID --value 2>/dev/null || printf '0\n'
}

process_cwd() {
  local pid="$1"
  if [ -n "$pid" ] && [ "$pid" != "0" ] && [ -d "/proc/${pid}" ]; then
    readlink -f "/proc/${pid}/cwd" 2>/dev/null || true
  fi
}

write_release_dropin() {
  local release_dir="$1"
  local build_id="${2:-}"
  sudo mkdir -p "${FRONTEND_DROPIN_DIR}"
  sudo rm -f "${LEGACY_FRONTEND_DROPIN}"
  {
    printf '[Service]\n'
    printf 'WorkingDirectory=%s\n' "${release_dir}"
    if [ -n "${build_id}" ]; then
      printf 'Environment=PUBLIC_BUILD_ID=%s\n' "${build_id}"
    fi
  } | sudo tee "${FRONTEND_DROPIN}" >/dev/null
  sudo systemctl daemon-reload
}

rollback_frontend() {
  local previous_release="$1"
  if [ -n "${previous_release}" ] && [ -d "${previous_release}/build" ]; then
    log "Rolling frontend back to ${previous_release}"
    write_release_dropin "${previous_release}"
    sudo systemctl restart "${FRONTEND_SERVICE}" || true
  else
    log "No valid previous frontend release was available for automatic rollback"
  fi
}

verify_local_frontend() {
  local attempts=20
  local i
  for ((i=1; i<=attempts; i++)); do
    if sudo systemctl is-active --quiet "${FRONTEND_SERVICE}" \
      && curl -fsS --max-time 3 http://127.0.0.1:4000/api/health >/dev/null \
      && curl -fsS --max-time 3 http://127.0.0.1:4000/login >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

prune_releases() {
  [ -d "${RELEASES_DIR}" ] || return 0
  local releases=()
  mapfile -t releases < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -name 'svelte-*' | sort)
  local count="${#releases[@]}"
  [ "$count" -le "${RELEASE_RETENTION}" ] && return 0

  local active_pid active_release remove_needed release
  active_pid="$(service_pid "${FRONTEND_SERVICE}")"
  active_release="$(process_cwd "${active_pid}")"
  remove_needed=$((count - RELEASE_RETENTION))

  for release in "${releases[@]}"; do
    [ "$remove_needed" -le 0 ] && break
    if [ "${release}" = "${active_release}" ]; then
      continue
    fi
    log "Pruning old frontend release: ${release}"
    rm -rf "${release}"
    remove_needed=$((remove_needed - 1))
  done
}

log "Starting deploy${DEPLOY_FROM_WORKTREE:+ (worktree mode)}"

if ! sudo -n true >/dev/null 2>&1; then
  log "Passwordless sudo is required for service deployment"
  exit 1
fi

require_file "${REPO_DIR}/.env.local"
require_file "${REPO_DIR}/ops/traefik/vps-control-room.yml"
require_file "${FRONTEND_DIR}/package.json"
load_env_file "${REPO_DIR}/.env.local"

cd "${REPO_DIR}"
mkdir -p "${STATE_DIR}" "${RELEASES_DIR}"

PREVIOUS_COMMIT="$(git rev-parse HEAD)"
if [ "${DEPLOY_FROM_WORKTREE:-0}" != "1" ]; then
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    log "Tracked worktree changes detected; refusing remote-mode deploy. Commit/stash them or use DEPLOY_FROM_WORKTREE=1."
    exit 1
  fi
  log "Updating repository from origin/${BRANCH}"
  git fetch origin
  git checkout "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
else
  log "Deploying current worktree without touching GitHub state"
fi
CURRENT_COMMIT="$(git rev-parse HEAD)"
BUILD_ID_SHORT="${CURRENT_COMMIT:0:12}"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  BUILD_ID_SHORT="${BUILD_ID_SHORT}-dirty"
fi
export COMMIT_SHA="${CURRENT_COMMIT}"
export PUBLIC_BUILD_ID="${BUILD_ID_SHORT}"

PREVIOUS_FRONTEND_PID="$(service_pid "${FRONTEND_SERVICE}")"
PREVIOUS_RELEASE="$(process_cwd "${PREVIOUS_FRONTEND_PID}")"
AGENT_PID_BEFORE="$(service_pid "${AGENT_SERVICE}")"

AGENT_RESTART_REQUIRED=0
LOCAL_AGENT_CHANGES="$(git status --porcelain -- agent || true)"
if [ -n "${LOCAL_AGENT_CHANGES}" ]; then
  AGENT_RESTART_REQUIRED=1
fi
if [ "${PREVIOUS_COMMIT}" != "${CURRENT_COMMIT}" ] && ! git diff --quiet "${PREVIOUS_COMMIT}" "${CURRENT_COMMIT}" -- agent; then
  AGENT_RESTART_REQUIRED=1
fi
LAST_AGENT_DEPLOYED_COMMIT="$(cat "${AGENT_STAMP_FILE}" 2>/dev/null || true)"
if [ -n "${LAST_AGENT_DEPLOYED_COMMIT}" ] && git cat-file -e "${LAST_AGENT_DEPLOYED_COMMIT}^{commit}" 2>/dev/null; then
  if ! git diff --quiet "${LAST_AGENT_DEPLOYED_COMMIT}" "${CURRENT_COMMIT}" -- agent; then
    AGENT_RESTART_REQUIRED=1
  fi
elif [ "${DEPLOY_FROM_WORKTREE:-0}" != "1" ]; then
  AGENT_RESTART_REQUIRED=1
fi

log "Installing canonical Svelte frontend dependencies"
"${BUN}" install --cwd "${FRONTEND_DIR}" --frozen-lockfile

log "Running frontend check, tests, and production build"
"${BUN}" run --cwd "${FRONTEND_DIR}" check
"${BUN}" run --cwd "${FRONTEND_DIR}" test
nice -n 15 ionice -c2 -n7 "${BUN}" run --cwd "${FRONTEND_DIR}" build
git diff --check

STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
RELEASE_DIR="${RELEASES_DIR}/svelte-${STAMP}-${CURRENT_COMMIT:0:7}"
mkdir -p "${RELEASE_DIR}"
cp -a "${FRONTEND_DIR}/build" "${RELEASE_DIR}/build"
log "Prepared immutable frontend release: ${RELEASE_DIR}"

if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  log "Agent changes detected; installing, testing, and building agent"
  "${BUN}" install --cwd "${REPO_DIR}/agent" --frozen-lockfile
  "${BUN}" run --cwd "${REPO_DIR}/agent" test:all
  "${BUN}" run --cwd "${REPO_DIR}/agent" build
else
  log "Agent unchanged; preserving the running agent process"
fi

log "Syncing Traefik dynamic config"
CONTROL_ROOM_DOMAIN="${CONTROL_ROOM_DOMAIN:-}" \
  envsubst '${CONTROL_ROOM_DOMAIN}' \
  < "${REPO_DIR}/ops/traefik/vps-control-room.yml" \
  | sudo tee /etc/dokploy/traefik/dynamic/vps-control-room.yml >/dev/null

log "Regenerating Svelte-native systemd units"
SKIP_AGENT_UNIT=0
if [ "${AGENT_RESTART_REQUIRED}" -eq 0 ]; then
  SKIP_AGENT_UNIT=1
fi
sudo APP_USER="$(id -un)" \
  BUN_BIN="${BUN}" \
  SKIP_AGENT_UNIT="${SKIP_AGENT_UNIT}" \
  AUTH_DEVICE_STORE="${AUTH_DEVICE_STORE:-${REPO_DIR}/agent/var/auth-devices.json}" \
  bash "${REPO_DIR}/scripts/install-systemd.sh" >/dev/null

BACKUP_DIR="${STATE_DIR}/backups/${STAMP}-${CURRENT_COMMIT:0:7}"
mkdir -p "${BACKUP_DIR}"
printf '%s\n' "${PREVIOUS_RELEASE}" > "${BACKUP_DIR}/previous-release.txt"
if sudo test -f "${FRONTEND_DROPIN}"; then
  sudo cat "${FRONTEND_DROPIN}" > "${BACKUP_DIR}/10-release.conf"
fi
if sudo test -f "${LEGACY_FRONTEND_DROPIN}"; then
  sudo cat "${LEGACY_FRONTEND_DROPIN}" > "${BACKUP_DIR}/10-svelte.conf"
fi

log "Switching frontend service to new release"
write_release_dropin "${RELEASE_DIR}" "${BUILD_ID_SHORT}"
if ! sudo systemctl restart "${FRONTEND_SERVICE}" || ! verify_local_frontend; then
  rollback_frontend "${PREVIOUS_RELEASE}"
  exit 1
fi

if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  sudo systemctl restart "${AGENT_SERVICE}"
  sudo systemctl is-active --quiet "${AGENT_SERVICE}"
  printf '%s\n' "${CURRENT_COMMIT}" > "${AGENT_STAMP_FILE}"
else
  AGENT_PID_AFTER="$(service_pid "${AGENT_SERVICE}")"
  if [ "${AGENT_PID_BEFORE}" != "${AGENT_PID_AFTER}" ]; then
    log "Warning: agent PID changed externally (${AGENT_PID_BEFORE} -> ${AGENT_PID_AFTER}) even though deploy did not restart it"
  else
    log "Verified agent PID unchanged: ${AGENT_PID_AFTER}"
  fi
fi

# Old migration previews are transient and must never survive a verified deploy.
sudo systemctl stop vps-control-room-svelte-preview.service >/dev/null 2>&1 || true
prune_releases

log "Deployment complete: frontend=${RELEASE_DIR} build=${BUILD_ID_SHORT}"
