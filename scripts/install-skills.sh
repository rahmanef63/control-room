#!/bin/bash
# install-skills.sh — Copy project skills into ~/.agents/skills/ for OpenClaw / agent discovery.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_SRC="${REPO_DIR}/skills"
SKILLS_DST="${HOME}/.agents/skills"

if [ ! -d "${SKILLS_SRC}" ]; then
  echo "No skills/ directory found in repo. Nothing to install."
  exit 0
fi

mkdir -p "${SKILLS_DST}"

for skill_dir in "${SKILLS_SRC}"/*/; do
  skill_name="$(basename "${skill_dir}")"
  dest="${SKILLS_DST}/${skill_name}"

  echo "Installing skill: ${skill_name} → ${dest}"
  rm -rf "${dest}"
  cp -r "${skill_dir}" "${dest}"
  echo "  ✓ ${skill_name}"
done

echo ""
echo "Skills installed to ${SKILLS_DST}"
echo "Run 'openclaw' to verify the skills are detected."
