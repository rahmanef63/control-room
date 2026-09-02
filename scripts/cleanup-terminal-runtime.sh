#!/bin/bash
set -euo pipefail

RUNTIME_ROOT="${CONTROL_ROOM_RUNTIME_ROOT:-/srv/control-room}"
KEEP_FRONTEND_RELEASES="${KEEP_FRONTEND_RELEASES:-5}"
KEEP_AGENT_RELEASES="${KEEP_AGENT_RELEASES:-5}"

log() { printf '[%s] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*"; }

prune_releases() {
  local kind="$1" pattern="$2" keep="$3"
  local dir="${RUNTIME_ROOT}/${kind}/releases"
  [ -d "${dir}" ] || return 0
  local active releases=() remove_count release
  active="$(readlink -f "${RUNTIME_ROOT}/${kind}/current" 2>/dev/null || true)"
  mapfile -t releases < <(find "${dir}" -mindepth 1 -maxdepth 1 -type d -name "${pattern}" | sort)
  remove_count=$(( ${#releases[@]} - keep ))
  [ "${remove_count}" -gt 0 ] || return 0
  for release in "${releases[@]}"; do
    [ "${remove_count}" -gt 0 ] || break
    [ "${release}" = "${active}" ] && continue
    log "Removing stale ${kind} release: ${release}"
    rm -rf "${release}"
    remove_count=$((remove_count - 1))
  done
}

prune_path_contents() {
  local target="$1" days="$2"
  [ -d "${target}" ] || return 0
  find "${target}" -mindepth 1 -mtime +"${days}" -exec rm -rf {} +
}

log "Starting Control Room runtime cleanup"
prune_releases frontend 'svelte-*' "${KEEP_FRONTEND_RELEASES}"
prune_releases agent 'agent-*' "${KEEP_AGENT_RELEASES}"
UPLOADS_DIR="${HOME}/.os/uploads"
prune_path_contents "${UPLOADS_DIR}" 7
[ ! -d "${UPLOADS_DIR}" ] || find "${UPLOADS_DIR}" -mindepth 1 -type d -empty -delete
log "Cleanup complete"
