#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_ROOT="${CONTROL_ROOM_STATE_ROOT:-/var/lib/control-room}"
BACKUP_ROOT="${CONTROL_ROOM_BACKUP_DIR:-${HOME}/.local/state/control-room-backups}"
STAMP="$(date -u '+%Y%m%dT%H%M%SZ')"
OUT="${BACKUP_ROOT}/${STAMP}"
INCLUDE_ENV=0
[ "${1:-}" != "--include-env" ] || INCLUDE_ENV=1

install -d -m 0700 "${BACKUP_ROOT}" "${OUT}"

cd "${REPO_DIR}"
git bundle create "${OUT}/repository.bundle" --all
git bundle verify "${OUT}/repository.bundle" >/dev/null
chmod 0600 "${OUT}/repository.bundle"

if [ -d "${STATE_ROOT}" ]; then
  sudo tar -C "$(dirname "${STATE_ROOT}")" -czf "${OUT}/state.tar.gz" "$(basename "${STATE_ROOT}")"
  sudo chown "$(id -u):$(id -g)" "${OUT}/state.tar.gz"
  chmod 0600 "${OUT}/state.tar.gz"
fi

if [ "${INCLUDE_ENV}" -eq 1 ] && sudo test -f /etc/control-room/control-room.env; then
  sudo cp /etc/control-room/control-room.env "${OUT}/runtime.env"
  sudo chown "$(id -u):$(id -g)" "${OUT}/runtime.env"
  chmod 0600 "${OUT}/runtime.env"
fi

(
  cd "${OUT}"
  sha256sum repository.bundle state.tar.gz runtime.env 2>/dev/null || true
) > "${OUT}/SHA256SUMS"
chmod 0600 "${OUT}/SHA256SUMS"

printf 'backup=%s\n' "${OUT}"
printf 'contains_env=%s\n' "${INCLUDE_ENV}"
printf 'next=copy this directory to your approved off-host encrypted destination\n'
