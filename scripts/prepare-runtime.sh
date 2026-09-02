#!/bin/bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: prepare-runtime.sh must run as root." >&2
  exit 1
fi

APP_USER="${APP_USER:-${SUDO_USER:-rahman}}"
WEB_USER="${CONTROL_ROOM_WEB_USER:-control-room-web}"
RUNTIME_ROOT="${CONTROL_ROOM_RUNTIME_ROOT:-/srv/control-room}"
STATE_ROOT="${CONTROL_ROOM_STATE_ROOT:-/var/lib/control-room}"
CONFIG_ROOT="${CONTROL_ROOM_CONFIG_ROOT:-/etc/control-room}"
BUN_SOURCE="${BUN_BIN:-}"
RUNTIME_BUN="${CONTROL_ROOM_BUN_BIN:-/usr/local/bin/control-room-bun}"

if ! id "${APP_USER}" >/dev/null 2>&1; then
  echo "Error: app user does not exist: ${APP_USER}" >&2
  exit 1
fi

if ! getent group "${WEB_USER}" >/dev/null 2>&1; then
  groupadd --system "${WEB_USER}"
fi
if ! id "${WEB_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${WEB_USER}" --home-dir "${STATE_ROOT}/frontend" --no-create-home --shell /usr/sbin/nologin "${WEB_USER}"
fi

install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${RUNTIME_ROOT}" \
  "${RUNTIME_ROOT}/frontend" "${RUNTIME_ROOT}/frontend/releases" \
  "${RUNTIME_ROOT}/agent" "${RUNTIME_ROOT}/agent/releases"
install -d -o "${WEB_USER}" -g "${WEB_USER}" -m 0700 "${STATE_ROOT}/frontend"
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0700 "${STATE_ROOT}/agent"
install -d -o root -g root -m 0755 "${CONFIG_ROOT}"

if [ -n "${BUN_SOURCE}" ] && [ -x "${BUN_SOURCE}" ]; then
  if [ ! -x "${RUNTIME_BUN}" ] || ! cmp -s "${BUN_SOURCE}" "${RUNTIME_BUN}"; then
    install -o root -g root -m 0755 "${BUN_SOURCE}" "${RUNTIME_BUN}"
  fi
fi
if [ ! -x "${RUNTIME_BUN}" ]; then
  echo "Error: runtime Bun missing at ${RUNTIME_BUN}; pass BUN_BIN=/path/to/bun" >&2
  exit 1
fi

AUTH_STORE="${STATE_ROOT}/frontend/auth-devices.json"
if [ ! -f "${AUTH_STORE}" ]; then
  source_store="${MIGRATE_AUTH_DEVICE_STORE:-}"
  if [ -n "${source_store}" ] && [ -f "${source_store}" ]; then
    install -o "${WEB_USER}" -g "${WEB_USER}" -m 0600 "${source_store}" "${AUTH_STORE}"
  else
    printf '{"approved":{},"pending":{}}\n' > "${AUTH_STORE}"
    chown "${WEB_USER}:${WEB_USER}" "${AUTH_STORE}"
    chmod 0600 "${AUTH_STORE}"
  fi
fi

if [ -n "${MIGRATE_AGENT_STATE_DIR:-}" ] && [ -d "${MIGRATE_AGENT_STATE_DIR}" ]; then
  if ! find "${STATE_ROOT}/agent" -mindepth 1 -maxdepth 1 -print -quit | grep -q .; then
    cp -a "${MIGRATE_AGENT_STATE_DIR}/." "${STATE_ROOT}/agent/"
    rm -f "${STATE_ROOT}/agent/auth-devices.json"
    chown -R "${APP_USER}:${APP_USER}" "${STATE_ROOT}/agent"
    chmod 0700 "${STATE_ROOT}/agent"
  fi
fi

if [ ! -f "${STATE_ROOT}/agent/crons.json" ] && [ -n "${MIGRATE_CRON_STORE:-}" ] && [ -f "${MIGRATE_CRON_STORE}" ]; then
  install -o "${APP_USER}" -g "${APP_USER}" -m 0600 "${MIGRATE_CRON_STORE}" "${STATE_ROOT}/agent/crons.json"
fi

printf 'runtime_root=%s\nstate_root=%s\nweb_user=%s\n' "${RUNTIME_ROOT}" "${STATE_ROOT}" "${WEB_USER}"
