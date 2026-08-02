#!/bin/bash
# install-skills.sh — Copy project skills into both ~/.agents/skills/ (OpenClaw
# discovery) and ~/.claude/skills/ (Claude Code skill auto-load). Run after
# pulling new commits so the latest /vps-alfa etc. show up in every agent CLI.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_SRC="${REPO_DIR}/skills"

DESTS=(
  "${HOME}/.agents/skills"
  "${HOME}/.claude/skills"
)

if [ ! -d "${SKILLS_SRC}" ]; then
  echo "No skills/ directory found in repo. Nothing to install."
  exit 0
fi

for dest_root in "${DESTS[@]}"; do
  mkdir -p "${dest_root}"
  for skill_dir in "${SKILLS_SRC}"/*/; do
    skill_name="$(basename "${skill_dir}")"
    dest="${dest_root}/${skill_name}"
    echo "Installing skill: ${skill_name} → ${dest}"
    rm -rf "${dest}"
    cp -r "${skill_dir}" "${dest}"
  done
done

echo ""
echo "Skills synced to:"
for dest_root in "${DESTS[@]}"; do
  echo "  - ${dest_root}"
done
echo "Claude Code reads ~/.claude/skills/; OpenClaw reads ~/.agents/skills/."
