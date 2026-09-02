#!/bin/bash
set -euo pipefail

REPO_DIR="${GITHUB_WORKSPACE:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"}"
BRANCH="${1:-main}"
APP_USER="${CONTROL_ROOM_AGENT_USER:-$(id -un)}"
WEB_USER="${CONTROL_ROOM_WEB_USER:-control-room-web}"
RUNTIME_ROOT="${CONTROL_ROOM_RUNTIME_ROOT:-/srv/control-room}"
STATE_ROOT="${CONTROL_ROOM_STATE_ROOT:-/var/lib/control-room}"
RUNTIME_ENV="${CONTROL_ROOM_ENV_FILE:-/etc/control-room/control-room.env}"
FRONTEND_RELEASES="${RUNTIME_ROOT}/frontend/releases"
AGENT_RELEASES="${RUNTIME_ROOT}/agent/releases"
FRONTEND_CURRENT="${RUNTIME_ROOT}/frontend/current"
AGENT_CURRENT="${RUNTIME_ROOT}/agent/current"
FRONTEND_SERVICE="vps-control-room-frontend.service"
AGENT_SERVICE="vps-control-room-agent.service"
STATE_DIR="${HOME}/.local/state/control-room-deploy"
AGENT_STAMP_FILE="${STATE_DIR}/agent.commit"
DEPLOY_LOG="${STATE_DIR}/deploy-events.jsonl"
LOCK_FILE="/tmp/vps-control-room-deploy.lock"
RELEASE_RETENTION="${CONTROL_ROOM_RELEASE_RETENTION:-5}"
TRAEFIK_LIVE="/etc/dokploy/traefik/dynamic/vps-control-room.yml"

exec 9>"${LOCK_FILE}"
flock 9

log() { printf '[%s] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*"; }
service_pid() { sudo systemctl show "$1" -p MainPID --value 2>/dev/null || printf '0\n'; }
process_cwd() { local p="$1"; [ "${p}" != "0" ] && [ -d "/proc/${p}" ] && readlink -f "/proc/${p}/cwd" 2>/dev/null || true; }

if ! sudo -n true >/dev/null 2>&1; then log "Passwordless sudo is required"; exit 1; fi
BUN="${BUN:-$(command -v bun || true)}"
[ -x "${BUN}" ] || { log "bun not found"; exit 1; }
[ -f "${REPO_DIR}/.env.local" ] || { log "Missing ${REPO_DIR}/.env.local"; exit 1; }

load_env_file() {
  local path="$1"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ""|\#*) continue ;; esac
    local key="${line%%=*}" value="${line#*=}"
    export "${key}=${value}"
  done < "$path"
}
load_env_file "${REPO_DIR}/.env.local"

cd "${REPO_DIR}"
mkdir -p "${STATE_DIR}"

if [ "${DEPLOY_FROM_WORKTREE:-0}" != "1" ]; then
  [ -z "$(git status --porcelain --untracked-files=no)" ] || { log "Tracked changes present; refusing remote deploy"; exit 1; }
  git fetch origin
  git checkout "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
else
  log "Deploying current worktree without touching GitHub state"
fi
CURRENT_COMMIT="$(git rev-parse HEAD)"
BUILD_ID="${CURRENT_COMMIT:0:12}"
[ -z "$(git status --porcelain --untracked-files=no)" ] || BUILD_ID="${BUILD_ID}-dirty"
export COMMIT_SHA="${CURRENT_COMMIT}" PUBLIC_BUILD_ID="${BUILD_ID}"

FRONTEND_PID_BEFORE="$(service_pid "${FRONTEND_SERVICE}")"
AGENT_PID_BEFORE="$(service_pid "${AGENT_SERVICE}")"
LEGACY_FRONTEND_CWD="$(process_cwd "${FRONTEND_PID_BEFORE}")"
LEGACY_AGENT_CWD="$(process_cwd "${AGENT_PID_BEFORE}")"
APP_HOME="$(getent passwd "${APP_USER}" | cut -d: -f6)"

log "Preparing canonical runtime/state layout"
sudo APP_USER="${APP_USER}" CONTROL_ROOM_WEB_USER="${WEB_USER}" BUN_BIN="${BUN}" \
  CONTROL_ROOM_RUNTIME_ROOT="${RUNTIME_ROOT}" CONTROL_ROOM_STATE_ROOT="${STATE_ROOT}" \
  MIGRATE_AUTH_DEVICE_STORE="${AUTH_DEVICE_STORE:-${LEGACY_AGENT_CWD}/var/auth-devices.json}" \
  MIGRATE_AGENT_STATE_DIR="${LEGACY_AGENT_CWD}/var" \
  MIGRATE_CRON_STORE="${APP_HOME}/.config/vps-control-room/crons.json" \
  bash "${REPO_DIR}/scripts/prepare-runtime.sh" >/dev/null

ENV_TMP="$(mktemp "${STATE_DIR}/runtime-env.XXXXXX")"
chmod 0600 "${ENV_TMP}"
awk '
  /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
  $0 ~ /^(CONVEX_|NEXT_PUBLIC_)/ { next }
  $0 ~ /^(AGENT_HEALTH_HOST|STATE_DIR|AUTH_DEVICE_STORE|CONTROL_ROOM_CRONS_PATH|TERMINAL_GATEWAY_URL)=/ { next }
  { print }
' "${REPO_DIR}/.env.local" > "${ENV_TMP}"
printf '%s\n' \
  'AGENT_HEALTH_HOST=127.0.0.1' \
  "STATE_DIR=${STATE_ROOT}/agent" \
  "AUTH_DEVICE_STORE=${STATE_ROOT}/frontend/auth-devices.json" \
  "CONTROL_ROOM_CRONS_PATH=${STATE_ROOT}/agent/crons.json" \
  'TERMINAL_GATEWAY_URL=http://127.0.0.1:4001' >> "${ENV_TMP}"
sudo install -o root -g root -m 0600 "${ENV_TMP}" "${RUNTIME_ENV}"
rm -f "${ENV_TMP}"

LAST_AGENT_COMMIT="$(cat "${AGENT_STAMP_FILE}" 2>/dev/null || true)"
AGENT_RESTART_REQUIRED=0
if [ -z "${LAST_AGENT_COMMIT}" ] || ! git cat-file -e "${LAST_AGENT_COMMIT}^{commit}" 2>/dev/null; then
  AGENT_RESTART_REQUIRED=1
elif ! git diff --quiet "${LAST_AGENT_COMMIT}" "${CURRENT_COMMIT}" -- agent; then
  AGENT_RESTART_REQUIRED=1
fi
[ -z "$(git status --porcelain -- agent)" ] || AGENT_RESTART_REQUIRED=1
if [ ! -L "${AGENT_CURRENT}" ] || [ ! -f "${AGENT_CURRENT}/agent/dist/index.js" ]; then AGENT_RESTART_REQUIRED=1; fi

log "Installing and verifying frontend"
"${BUN}" install --cwd frontend --frozen-lockfile
"${BUN}" run --cwd frontend check
"${BUN}" run --cwd frontend lint
"${BUN}" run --cwd frontend test:coverage
(cd frontend && "${BUN}" audit)
"${BUN}" run --cwd frontend test:e2e
nice -n 15 ionice -c2 -n7 "${BUN}" run --cwd frontend build
"${BUN}" run --cwd frontend check:bundle
git diff --check

STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
FRONTEND_RELEASE="${FRONTEND_RELEASES}/svelte-${STAMP}-${CURRENT_COMMIT:0:7}"
mkdir -p "${FRONTEND_RELEASE}"
# adapter-node externalizes a small runtime dependency set; stage the frozen node_modules tree
# with the build so /srv releases do not depend on the Git checkout's node_modules.
cp -a frontend/build frontend/node_modules frontend/package.json frontend/bun.lock "${FRONTEND_RELEASE}/"

if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  log "Agent tree changed or has no deployment stamp; verifying and staging immutable agent release"
  "${BUN}" install --cwd agent --frozen-lockfile
  "${BUN}" run --cwd agent test:all
  "${BUN}" run --cwd agent test:coverage
  (cd agent && "${BUN}" audit)
  "${BUN}" run --cwd agent build
  AGENT_RELEASE="${AGENT_RELEASES}/agent-${STAMP}-${CURRENT_COMMIT:0:7}"
  mkdir -p "${AGENT_RELEASE}/agent" "${AGENT_RELEASE}/packages"
  cp -a agent/dist agent/node_modules agent/package.json agent/bun.lock "${AGENT_RELEASE}/agent/"
  cp -a packages/contracts packages/runtime-config "${AGENT_RELEASE}/packages/"
else
  AGENT_RELEASE="$(readlink -f "${AGENT_CURRENT}")"
  log "Agent source unchanged; preserving ${AGENT_RELEASE}"
fi

stage_legacy_frontend_rollback() {
  if [ -L "${FRONTEND_CURRENT}" ]; then readlink -f "${FRONTEND_CURRENT}"; return; fi
  local target="${FRONTEND_RELEASES}/svelte-pre-hardening-${STAMP}"
  mkdir -p "${target}"
  if [ -n "${LEGACY_FRONTEND_CWD}" ] && [ -d "${LEGACY_FRONTEND_CWD}/build" ]; then
    cp -a "${LEGACY_FRONTEND_CWD}/build" "${target}/build"
    cp -a frontend/node_modules frontend/package.json frontend/bun.lock "${target}/"
  else
    cp -a frontend/build frontend/node_modules frontend/package.json frontend/bun.lock "${target}/"
  fi
  printf '%s\n' "${target}"
}

stage_legacy_agent_rollback() {
  if [ -L "${AGENT_CURRENT}" ]; then readlink -f "${AGENT_CURRENT}"; return; fi
  local target="${AGENT_RELEASES}/agent-pre-hardening-${STAMP}"
  mkdir -p "${target}/agent" "${target}/packages"
  if [ -n "${LEGACY_AGENT_CWD}" ] && [ -f "${LEGACY_AGENT_CWD}/dist/index.js" ]; then
    cp -a "${LEGACY_AGENT_CWD}/dist" "${LEGACY_AGENT_CWD}/node_modules" \
      "${LEGACY_AGENT_CWD}/package.json" "${LEGACY_AGENT_CWD}/bun.lock" "${target}/agent/"
    local legacy_repo
    legacy_repo="$(cd "${LEGACY_AGENT_CWD}/.." && pwd)"
    if [ -d "${legacy_repo}/packages/contracts" ] && [ -d "${legacy_repo}/packages/runtime-config" ]; then
      cp -a "${legacy_repo}/packages/contracts" "${legacy_repo}/packages/runtime-config" "${target}/packages/"
    else
      cp -a packages/contracts packages/runtime-config "${target}/packages/"
    fi
  else
    cp -a agent/dist agent/node_modules agent/package.json agent/bun.lock "${target}/agent/"
    cp -a packages/contracts packages/runtime-config "${target}/packages/"
  fi
  printf '%s\n' "${target}"
}

PREVIOUS_FRONTEND="$(stage_legacy_frontend_rollback)"
PREVIOUS_AGENT="$(stage_legacy_agent_rollback)"
ln -sfn "${PREVIOUS_FRONTEND}" "${FRONTEND_CURRENT}"
ln -sfn "${PREVIOUS_AGENT}" "${AGENT_CURRENT}"

BACKUP_DIR="${STATE_DIR}/backups/${STAMP}-${CURRENT_COMMIT:0:7}"
mkdir -p "${BACKUP_DIR}"
printf '%s\n' "${PREVIOUS_FRONTEND}" > "${BACKUP_DIR}/previous-frontend.txt"
printf '%s\n' "${PREVIOUS_AGENT}" > "${BACKUP_DIR}/previous-agent.txt"
if sudo test -f "${TRAEFIK_LIVE}"; then sudo cat "${TRAEFIK_LIVE}" > "${BACKUP_DIR}/traefik.yml"; fi

log "Installing stable systemd units"
sudo APP_USER="${APP_USER}" CONTROL_ROOM_WEB_USER="${WEB_USER}" BUN_BIN="${BUN}" \
  CONTROL_ROOM_RUNTIME_ROOT="${RUNTIME_ROOT}" CONTROL_ROOM_STATE_ROOT="${STATE_ROOT}" \
  CONTROL_ROOM_ENV_FILE="${RUNTIME_ENV}" CONTROL_ROOM_DOMAIN="${CONTROL_ROOM_DOMAIN:-}" \
  bash scripts/install-systemd.sh >/dev/null

verify_agent() {
  local i status
  for ((i=1;i<=20;i++)); do
    if sudo systemctl is-active --quiet "${AGENT_SERVICE}" \
      && curl -fsS --max-time 3 http://127.0.0.1:4001/health >/dev/null; then
      status="$(curl -sS --max-time 3 -o /dev/null -w '%{http_code}' \
        -H "x-control-room-secret: ${AGENT_GATEWAY_SECRET:-${CONTROL_ROOM_SECRET:-}}" \
        http://127.0.0.1:4001/terminals || true)"
      [ "${status}" = "200" ] && return 0
    fi
    sleep 1
  done
  return 1
}

verify_frontend() {
  local i
  for ((i=1;i<=20;i++)); do
    if sudo systemctl is-active --quiet "${FRONTEND_SERVICE}" \
      && curl -fsS --max-time 3 http://127.0.0.1:4000/api/health >/dev/null \
      && curl -fsS --max-time 3 http://127.0.0.1:4000/login >/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

rollback_pair() {
  log "Rolling back runtime pair"
  ln -sfn "${PREVIOUS_FRONTEND}" "${FRONTEND_CURRENT}"
  ln -sfn "${PREVIOUS_AGENT}" "${AGENT_CURRENT}"
  sudo systemctl restart "${AGENT_SERVICE}" || true
  sudo systemctl restart "${FRONTEND_SERVICE}" || true
}

if [ "${AGENT_RESTART_REQUIRED}" -eq 1 ]; then
  log "Switching privileged agent to ${AGENT_RELEASE}"
  ln -sfn "${AGENT_RELEASE}" "${AGENT_CURRENT}"
  sudo systemctl restart "${AGENT_SERVICE}"
  if ! verify_agent; then rollback_pair; exit 1; fi
fi

log "Switching frontend to ${FRONTEND_RELEASE}"
ln -sfn "${FRONTEND_RELEASE}" "${FRONTEND_CURRENT}"
sudo systemctl restart "${FRONTEND_SERVICE}"
if ! verify_frontend; then rollback_pair; exit 1; fi

log "Publishing frontend-only Traefik route"
CONTROL_ROOM_DOMAIN="${CONTROL_ROOM_DOMAIN:-}" envsubst '${CONTROL_ROOM_DOMAIN}' \
  < ops/traefik/vps-control-room.yml | sudo tee "${TRAEFIK_LIVE}" >/dev/null
sleep 1
if [ -n "${CONTROL_ROOM_DOMAIN:-}" ]; then
  if ! curl -fsS --max-time 8 "https://${CONTROL_ROOM_DOMAIN}/login" >/dev/null; then
    log "Public verification failed; restoring previous Traefik config and runtime pair"
    [ ! -f "${BACKUP_DIR}/traefik.yml" ] || sudo cp "${BACKUP_DIR}/traefik.yml" "${TRAEFIK_LIVE}"
    rollback_pair
    exit 1
  fi
fi

printf '%s\n' "${CURRENT_COMMIT}" > "${AGENT_STAMP_FILE}"
python3 - "${DEPLOY_LOG}" "${CURRENT_COMMIT}" "${FRONTEND_RELEASE}" "$(readlink -f "${AGENT_CURRENT}")" <<'PY'
import json,sys,datetime
path,commit,frontend,agent=sys.argv[1:]
with open(path,'a',encoding='utf-8') as f:
    f.write(json.dumps({'ts':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':commit,'frontend':frontend,'agent':agent,'status':'success'},separators=(',',':'))+'\n')
PY

sudo systemctl stop vps-control-room-svelte-preview.service >/dev/null 2>&1 || true
CONTROL_ROOM_RUNTIME_ROOT="${RUNTIME_ROOT}" KEEP_FRONTEND_RELEASES="${RELEASE_RETENTION}" KEEP_AGENT_RELEASES="${RELEASE_RETENTION}" \
  bash scripts/cleanup-terminal-runtime.sh >/dev/null

log "Deployment complete: frontend=${FRONTEND_RELEASE} agent=$(readlink -f "${AGENT_CURRENT}") build=${BUILD_ID}"
