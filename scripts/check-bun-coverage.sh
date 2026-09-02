#!/bin/bash
set -euo pipefail

PACKAGE_DIR="${1:?package directory required}"
MIN_LINES="${2:?minimum line coverage percent required}"
MIN_FUNCS="${3:?minimum function coverage percent required}"
BUN_BIN="${BUN:-$(command -v bun)}"
TMP="$(mktemp)"
trap 'rm -f "${TMP}"' EXIT

(
  cd "${PACKAGE_DIR}"
  "${BUN_BIN}" test src --coverage
) 2>&1 | tee "${TMP}"

summary="$(grep -E '^All files[[:space:]]*\|' "${TMP}" | tail -1 || true)"
if [ -z "${summary}" ]; then
  echo "Coverage summary was not produced" >&2
  exit 1
fi

funcs="$(printf '%s\n' "${summary}" | awk -F'|' '{gsub(/[[:space:]]/,"",$2); print $2}')"
lines="$(printf '%s\n' "${summary}" | awk -F'|' '{gsub(/[[:space:]]/,"",$3); print $3}')"

python3 - "${lines}" "${funcs}" "${MIN_LINES}" "${MIN_FUNCS}" <<'PY'
import sys
lines, funcs, min_lines, min_funcs = map(float, sys.argv[1:])
print(f"coverage overall: lines={lines:.2f}% funcs={funcs:.2f}% (minimum lines={min_lines:.2f}% funcs={min_funcs:.2f}%)")
if lines + 1e-9 < min_lines or funcs + 1e-9 < min_funcs:
    raise SystemExit(1)
PY
