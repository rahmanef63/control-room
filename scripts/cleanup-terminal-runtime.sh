#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEEP_LEGACY_BACKUPS="${KEEP_LEGACY_BACKUPS:-2}"
KEEP_FRONTEND_RELEASES="${KEEP_FRONTEND_RELEASES:-5}"

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*"
}

prune_backup_dirs() {
  local parent_dir="$1"
  local pattern="$2"
  local keep_count="$3"
  local matches=()

  [ -d "$parent_dir" ] || return
  mapfile -t matches < <(find "$parent_dir" -mindepth 1 -maxdepth 1 -type d -name "$pattern" | sort)
  [ "${#matches[@]}" -le "$keep_count" ] && return

  local remove_count=$(( ${#matches[@]} - keep_count ))
  local index=0
  while [ "$index" -lt "$remove_count" ]; do
    log "Removing stale backup: ${matches[$index]}"
    rm -rf "${matches[$index]}"
    index=$((index + 1))
  done
}

prune_path_contents() {
  local target_dir="$1"
  local days_old="$2"
  [ -d "$target_dir" ] || return
  log "Pruning files older than ${days_old}d inside ${target_dir}"
  find "$target_dir" -mindepth 1 -mtime +"$days_old" -exec rm -rf {} +
}

prune_frontend_releases() {
  local releases_dir="${REPO_DIR}/frontend/releases"
  [ -d "$releases_dir" ] || return

  local active_pid active_release releases=()
  active_pid="$(systemctl show vps-control-room-frontend.service -p MainPID --value 2>/dev/null || printf '0\n')"
  active_release=""
  if [ "$active_pid" != "0" ] && [ -d "/proc/${active_pid}" ]; then
    active_release="$(readlink -f "/proc/${active_pid}/cwd" 2>/dev/null || true)"
  fi

  mapfile -t releases < <(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -name 'svelte-*' | sort)
  local remove_count=$(( ${#releases[@]} - KEEP_FRONTEND_RELEASES ))
  [ "$remove_count" -gt 0 ] || return

  local release
  for release in "${releases[@]}"; do
    [ "$remove_count" -gt 0 ] || break
    [ "$release" = "$active_release" ] && continue
    log "Removing stale frontend release: ${release}"
    rm -rf "$release"
    remove_count=$((remove_count - 1))
  done
}

log "Starting terminal runtime cleanup"

prune_frontend_releases
prune_path_contents "${REPO_DIR}/convex-data/tmp" 2

# Drag-and-drop / paste uploads land in ~/.os/uploads/<session>/.
UPLOADS_DIR="${HOME}/.os/uploads"
prune_path_contents "${UPLOADS_DIR}" 7
if [ -d "${UPLOADS_DIR}" ]; then
  find "${UPLOADS_DIR}" -mindepth 1 -type d -empty -delete
fi

prune_backup_dirs "${REPO_DIR}" "convex-data.backup-*" "${KEEP_LEGACY_BACKUPS}"

log "Cleanup complete"
