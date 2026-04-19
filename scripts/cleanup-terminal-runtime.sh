#!/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEEP_LEGACY_BACKUPS="${KEEP_LEGACY_BACKUPS:-2}"
KEEP_FRONTEND_SNAPSHOTS="${KEEP_FRONTEND_SNAPSHOTS:-3}"

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*"
}

prune_backup_dirs() {
  local parent_dir="$1"
  local pattern="$2"
  local keep_count="$3"
  local matches=()

  if [ ! -d "$parent_dir" ]; then
    return
  fi

  mapfile -t matches < <(find "$parent_dir" -mindepth 1 -maxdepth 1 -type d -name "$pattern" | sort)

  if [ "${#matches[@]}" -le "$keep_count" ]; then
    return
  fi

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

  if [ ! -d "$target_dir" ]; then
    return
  fi

  log "Pruning files older than ${days_old}d inside ${target_dir}"
  find "$target_dir" -mindepth 1 -mtime +"$days_old" -exec rm -rf {} +
}

log "Starting terminal runtime cleanup"

prune_path_contents "${REPO_DIR}/frontend/.next-previous" 2
prune_path_contents "${REPO_DIR}/frontend/.next-staging" 2
prune_path_contents "${REPO_DIR}/convex-data/tmp" 2

prune_backup_dirs "${REPO_DIR}/.deploy-state/frontend-static" "*" "${KEEP_FRONTEND_SNAPSHOTS}"
prune_backup_dirs "${REPO_DIR}" "convex-data.backup-*" "${KEEP_LEGACY_BACKUPS}"

log "Cleanup complete"
