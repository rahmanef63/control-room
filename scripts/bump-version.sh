#!/bin/bash
# Stamp the service-worker cache name with the current version so every
# deploy starts a fresh cache generation. The SW activate handler deletes
# any cache whose name does not match the current names, evicting stale
# chunks for every client.
#
# Build ID itself flows via env (COMMIT_SHA / GITHUB_SHA → next.config.ts
# generateBuildId + NEXT_PUBLIC_BUILD_ID), not via a generated file.
#
# Usage:
#   scripts/bump-version.sh              # uses git short SHA
#   scripts/bump-version.sh <version>    # explicit version

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-$(git -C "$ROOT" rev-parse --short=8 HEAD 2>/dev/null || echo dev)}"

SW_FILE="$ROOT/frontend/public/sw.js"

if [ -f "$SW_FILE" ]; then
  sed -i -E \
    -e "s/vps-control-room-[A-Za-z0-9_-]+/vps-control-room-v$VERSION/g" \
    -e "s/vps-static-[A-Za-z0-9_-]+/vps-static-v$VERSION/g" \
    "$SW_FILE"
fi

echo "Stamped SW cache to v$VERSION"
