#!/bin/bash
set -euo pipefail

fail() { printf 'ALERT control-room healthcheck: %s\n' "$*" >&2; exit 1; }

curl -fsS --max-time 5 http://127.0.0.1:4001/health >/dev/null || fail 'agent loopback health failed'
curl -fsS --max-time 5 http://127.0.0.1:4000/api/health >/dev/null || fail 'frontend local health failed'

if ss -ltnH '( sport = :4001 )' | awk '{print $4}' | grep -Eq '(^|\]|:)0\.0\.0\.0:4001$|^\[::\]:4001$|^\*:4001$'; then
  fail 'privileged agent port 4001 is listening on a wildcard address'
fi

if [ -n "${CONTROL_ROOM_DOMAIN:-}" ]; then
  curl -fsS --max-time 8 "https://${CONTROL_ROOM_DOMAIN}/api/health" >/dev/null || fail 'public HTTPS health failed'
fi

printf 'control-room healthcheck ok\n'
