#!/usr/bin/env bash
#
# alfa-tools — function-calling tool layer for the VPS Control Room alfa watcher.
#
# One thin, verb-based wrapper over the authenticated Control Room HTTP API so
# the alfa skill can self-operate the box: CRUD terminals, author its own
# prompts, build workspace tabs, recolor panes, manage patrol + crons — without
# re-deriving curl/jq/login plumbing every time.
#
# Usage:   alfa-tools <group> <verb> [args...]
#          alfa-tools help
#
# Every command prints JSON (or a {"ok":...} envelope) to stdout so the LLM can
# parse the result directly. Errors go to stderr with a non-zero exit.
#
# Env:
#   ORIGIN              default http://localhost:4000
#   CONTROL_ROOM_SECRET required for login (already set in alfa panes)
#   VPS_SESSION_ID      this pane's session id (needed for watcher self-verbs)
#   ALFA_COOKIE         cookie jar path (default /tmp/alfa-cookies.txt)
#
set -euo pipefail

ORIGIN="${ORIGIN:-http://localhost:4000}"
COOKIE="${ALFA_COOKIE:-/tmp/alfa-cookies.txt}"

die() { printf 'alfa-tools: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing dependency: $1"; }
need curl; need jq

# ---- auth ------------------------------------------------------------------

_login() {
  [ -n "${CONTROL_ROOM_SECRET:-}" ] || die "CONTROL_ROOM_SECRET unset — cannot log in"
  curl -sS -X POST "$ORIGIN/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"secret\":\"$CONTROL_ROOM_SECRET\"}" \
    -c "$COOKIE" -o /dev/null
}

# req METHOD PATH [json-body]
# Auto-logs-in once on auth failure, then retries. Echoes response body,
# returns the HTTP status via the global $HTTP_CODE.
HTTP_CODE=0
req() {
  local method="$1" path="$2" body="${3:-}" attempt out code
  [ -f "$COOKIE" ] || _login
  for attempt in 1 2; do
    if [ -n "$body" ]; then
      out=$(curl -sS -X "$method" "$ORIGIN$path" -b "$COOKIE" \
        -H 'Content-Type: application/json' -d "$body" \
        -w $'\n%{http_code}')
    else
      out=$(curl -sS -X "$method" "$ORIGIN$path" -b "$COOKIE" \
        -w $'\n%{http_code}')
    fi
    code="${out##*$'\n'}"
    out="${out%$'\n'*}"
    if [ "$code" = "401" ] || [ "$code" = "403" ] || [ "$code" = "307" ]; then
      [ "$attempt" = "1" ] && { _login; continue; }
    fi
    HTTP_CODE="$code"
    printf '%s' "$out"
    return 0
  done
}

# ok-wrap: pretty envelope for commands without a useful body
ok() { jq -n --arg m "$1" '{ok:true, msg:$m}'; }

# ---- state helpers (workspaces / session-colors live under /api/state) -----

_state_get() { req GET "/api/state/$1" | jq '.value // empty'; }
_state_put() { req PUT "/api/state/$1" "$2" >/dev/null; }

_ws_state() {
  local s; s=$(_state_get workspaces)
  [ -n "$s" ] && [ "$s" != "null" ] && { printf '%s' "$s"; return; }
  printf '{"workspaces":[],"sessionMap":{},"activeId":"default"}'
}

_now() { date +%s; }

# ---- policy (data-driven config; latest write replaces previous) -----------

# Built-in defaults — stored policy is merged ON TOP so any field is tunable
# without editing this script. `policy set` overwrites the prior value (the
# "new data deletes previous" retention model for config).
_policy_defaults() {
  cat <<'JSON'
{
  "loadGate": 8,
  "cooldownS": 45,
  "neverIdle": false,
  "pollMinMs": 6000,
  "pollMaxMs": 30000,
  "blocklist": ["rm -rf","git push --force","git push -f","DROP TABLE","git reset --hard","mkfs","dd if=","> /dev/sd",":(){:|:&};:"],
  "heavyCmds": ["git push","bun run build","bun run --cwd frontend build","npm run build","pnpm run build","yarn build","docker build","bun run deploy","npm run deploy"],
  "notifyWebhook": "",
  "memMax": 20,
  "memTtlDays": 7,
  "decMax": 200,
  "decTtlH": 48
}
JSON
}

_policy() {
  local stored; stored=$(_state_get alfa-policy)
  [ -n "$stored" ] && [ "$stored" != "null" ] || stored='{}'
  jq -s '.[0] * .[1]' <(_policy_defaults) <(printf '%s' "$stored")
}

_pget() { _policy | jq -r --arg k "$1" '.[$k]'; }

# ---- watcher helpers -------------------------------------------------------

_my_watcher() {
  [ -n "${VPS_SESSION_ID:-}" ] || die "VPS_SESSION_ID unset — watcher self-verbs need it"
  req GET /api/alfa/watchers \
    | jq --arg id "$VPS_SESSION_ID" '.watchers[] | select(.id==$id)'
}

# Build a watcher upsert body from my current entry merged with a jq patch.
_watcher_patch() {
  local cur patched
  cur=$(_my_watcher)
  [ -n "$cur" ] || cur=$(jq -n --arg id "$VPS_SESSION_ID" \
    '{id:$id, label:"alfa", watchedSessionIds:[], instructions:{}, defaultInstruction:"please continue as ur recommended, ultrathink"}')
  patched=$(printf '%s' "$cur" | jq "$1")
  req POST /api/alfa/watchers "$patched" >/dev/null
  printf '%s' "$patched"
}

# ============================================================================
# command groups
# ============================================================================

cmd_term() {
  local verb="${1:-}"; shift || true
  case "$verb" in
    list)   req GET /api/terminals | jq '.sessions // .' ;;
    get)    req GET "/api/terminals/$1" ;;
    create)
      # flags: --profile X --cwd P --env ID --agent ID --yolo --active-dir
      local body='{}'
      while [ $# -gt 0 ]; do case "$1" in
        --profile)    body=$(jq -c --arg v "$2" '.profile=$v' <<<"$body"); shift 2;;
        --cwd)        body=$(jq -c --arg v "$2" '.cwd=$v' <<<"$body"); shift 2;;
        --env)        body=$(jq -c --arg v "$2" '.environmentId=$v' <<<"$body"); shift 2;;
        --agent)      body=$(jq -c --arg v "$2" '.agentProfileId=$v' <<<"$body"); shift 2;;
        --yolo)       body=$(jq -c '.dangerouslyAllow=true' <<<"$body"); shift;;
        --active-dir) body=$(jq -c '.useActiveDir=true' <<<"$body"); shift;;
        *) die "term create: unknown flag $1";;
      esac; done
      req POST /api/terminals "$body" ;;
    rename) req PATCH "/api/terminals/$1" "$(jq -n --arg t "$2" '{title:$t}')" >/dev/null; ok "renamed $1";;
    close)  req DELETE "/api/terminals/$1" >/dev/null; ok "closed $1";;
    buffer) req GET "/api/terminals/$1/buffer?lines=${2:-40}" ;;
    input)  req POST "/api/terminals/$1/input" "$(jq -n --arg d "$2" '{data:$d}')" >/dev/null; ok "sent text to $1";;
    enter)  req POST "/api/terminals/$1/input" '{"data":"\r"}' >/dev/null; ok "enter to $1";;
    send)   # text + Enter as two posts (TUI-safe)
      req POST "/api/terminals/$1/input" "$(jq -n --arg d "$2" '{data:$d}')" >/dev/null
      sleep 1
      req POST "/api/terminals/$1/input" '{"data":"\r"}' >/dev/null
      ok "sent+enter to $1" ;;
    key)    # term key <sid> <name> — send a named special key with the CORRECT
            # escape bytes. Stops the "literal [B / malformed arrow" class of bug
            # that mis-navigates TUI dialogs (e.g. picking Exit instead of Continue).
            local sid="$1" name="$2" seq
            case "$name" in
              enter|return) seq=$'\r' ;;
              up)    seq=$'\x1b[A' ;;
              down)  seq=$'\x1b[B' ;;
              right) seq=$'\x1b[C' ;;
              left)  seq=$'\x1b[D' ;;
              tab)   seq=$'\t' ;;
              esc|escape) seq=$'\x1b' ;;
              space) seq=' ' ;;
              ctrl-c) seq=$'\x03' ;;
              ctrl-d) seq=$'\x04' ;;
              ctrl-u) seq=$'\x15' ;;
              backspace) seq=$'\x7f' ;;
              *) die "term key: enter|up|down|right|left|tab|esc|space|ctrl-c|ctrl-d|ctrl-u|backspace" ;;
            esac
            req POST "/api/terminals/$sid/input" "$(jq -n --arg d "$seq" '{data:$d}')" >/dev/null
            ok "key $name -> $sid" ;;
    resize) req POST "/api/terminals/$1/resize" "$(jq -n --argjson c "$2" --argjson r "$3" '{cols:$c,rows:$r}')" >/dev/null; ok "resized $1";;
    ready)  # term ready <sid> [maxSecs] — poll buffer until output settles, and
            # auto-detect a claude/codex "trust this folder" first-run dialog.
            # Prints {ready, trustPrompt, sid}. Does NOT send anything.
            local sid="$1" max="${2:-20}" prev="" cur stable=0 i=0 trust=false
            while [ "$i" -lt "$max" ]; do
              cur=$(req GET "/api/terminals/$sid/buffer?lines=40" | jq -r '.lines | join("\n")' 2>/dev/null || echo "")
              printf '%s' "$cur" | grep -qiE 'trust this folder|do you trust the files|trust the files in this folder' && trust=true
              [ "$cur" = "$prev" ] && stable=$((stable+1)) || stable=0
              [ "$stable" -ge 2 ] && break
              prev="$cur"; i=$((i+1)); sleep 1
            done
            jq -n --argjson r "$([ "$stable" -ge 2 ] && echo true || echo false)" \
                  --argjson t "$trust" --arg s "$sid" '{ready:$r, trustPrompt:$t, sid:$s}' ;;
    spawn)  # term spawn [create-flags...] [--watch] [--prompt "text"]
            # Atomic "add-new-terminal then make it a child target" flow:
            #   1) create pane (claude panes default to --dangerously-skip-permissions)
            #   2) wait for boot to settle, auto-accept the trust-folder dialog
            #   3) optionally register it as a watched child of THIS alfa
            #   4) optionally inject an initial prompt (text + Enter)
            # Returns the new sid as JSON {ok,sid,watched,prompted}.
            local cflags=() do_watch=false init_prompt="" is_claude=false
            while [ $# -gt 0 ]; do case "$1" in
              --watch)  do_watch=true; shift ;;
              --prompt) init_prompt="$2"; shift 2 ;;
              --profile) [ "$2" = "claude" ] && is_claude=true; cflags+=(--profile "$2"); shift 2 ;;
              *) cflags+=("$1"); shift ;;
            esac; done
            # claude has no useful no-perms TUI without skip-permissions → force yolo
            # so spawned panes never stall on a permission prompt mid-task.
            if $is_claude; then
              case " ${cflags[*]} " in *" --yolo "*) :;; *) cflags+=(--yolo);; esac
            fi
            local created sid
            created=$(cmd_term create "${cflags[@]}")
            sid=$(printf '%s' "$created" | jq -r '.session.id // .id // empty')
            [ -n "$sid" ] || { printf '%s' "$created"; die "spawn: could not read new sid"; }
            # boot + auto-trust
            local r; r=$(cmd_term ready "$sid" 25)
            if [ "$(printf '%s' "$r" | jq -r '.trustPrompt')" = "true" ]; then
              cmd_term key "$sid" enter >/dev/null   # option 1 = "Yes, I trust" (default)
              sleep 2
              cmd_term ready "$sid" 15 >/dev/null
            fi
            local watched=false prompted=false
            if $do_watch && [ -n "${VPS_SESSION_ID:-}" ]; then
              local ids; ids=$(printf '%s\n' "$sid" | jq -R . | jq -cs .)
              _watcher_set ".watchedSessionIds = ((.watchedSessionIds + (\$a|fromjson)) | unique)" "$ids" >/dev/null
              watched=true
            fi
            if [ -n "$init_prompt" ]; then
              cmd_term send "$sid" "$init_prompt" >/dev/null
              prompted=true
            fi
            jq -n --arg s "$sid" --argjson w "$watched" --argjson p "$prompted" \
              '{ok:true, sid:$s, watched:$w, prompted:$p}' ;;
    *) die "term: list|get|create|spawn|ready|rename|close|buffer|input|enter|send|key|resize";;
  esac
}

cmd_ws() {
  local verb="${1:-}"; shift || true
  local st; st=$(_ws_state)
  case "$verb" in
    list)   printf '%s' "$st" | jq '.' ;;
    create)
      local name="${1:?ws create <name> [hexcolor]}" color="${2:-}"
      local id; id="ws_$(printf '%s' "$name$RANDOM" | md5sum | cut -c1-10)"
      st=$(printf '%s' "$st" | jq \
        --arg id "$id" --arg n "$name" --arg c "$color" \
        '.workspaces += [{id:$id, name:$n, color:(if $c=="" then "#38bdf8" else $c end), createdAt:0}] | .activeId=$id')
      _state_put workspaces "$st"; jq -n --arg id "$id" --arg n "$name" '{ok:true, id:$id, name:$n}';;
    rename) st=$(printf '%s' "$st" | jq --arg id "$1" --arg n "$2" '(.workspaces[]|select(.id==$id)).name=$n'); _state_put workspaces "$st"; ok "renamed tab $1";;
    color)  st=$(printf '%s' "$st" | jq --arg id "$1" --arg c "$2" '(.workspaces[]|select(.id==$id)).color=$c'); _state_put workspaces "$st"; ok "tab $1 color $2";;
    delete) st=$(printf '%s' "$st" | jq --arg id "$1" '
              .workspaces |= map(select(.id!=$id))
              | .sessionMap |= with_entries(select(.value!=$id))
              | if .activeId==$id then .activeId = (.workspaces[0].id // "default") else . end')
            _state_put workspaces "$st"; ok "deleted tab $1";;
    active) st=$(printf '%s' "$st" | jq --arg id "$1" '.activeId=$id'); _state_put workspaces "$st"; ok "active tab $1";;
    assign) st=$(printf '%s' "$st" | jq --arg s "$1" --arg w "$2" '.sessionMap[$s]=$w'); _state_put workspaces "$st"; ok "session $1 -> tab $2";;
    unassign) st=$(printf '%s' "$st" | jq --arg s "$1" 'del(.sessionMap[$s])'); _state_put workspaces "$st"; ok "session $1 unassigned";;
    *) die "ws: list|create|rename|color|delete|active|assign|unassign";;
  esac
}

cmd_color() {
  local verb="${1:-}"; shift || true
  local st; st=$(_state_get session-colors); [ -n "$st" ] && [ "$st" != "null" ] || st='{}'
  case "$verb" in
    get)    [ $# -ge 1 ] && printf '%s' "$st" | jq --arg s "$1" '.[$s] // null' || printf '%s' "$st" | jq '.';;
    set)    st=$(printf '%s' "$st" | jq --arg s "$1" --arg c "$2" '.[$s]=$c'); _state_put session-colors "$st"; ok "color $1=$2 (server; UI pickup needs hook bridge)";;
    clear)  st=$(printf '%s' "$st" | jq --arg s "$1" 'del(.[$s])'); _state_put session-colors "$st"; ok "color $1 cleared";;
    *) die "color: get|set|clear";;
  esac
}

# mutate my own watcher entry with a jq program (uses --arg a,b for values)
_watcher_set() {
  local prog="$1" a="${2:-}" b="${3:-}" cur
  [ -n "${VPS_SESSION_ID:-}" ] || die "VPS_SESSION_ID unset — watcher self-verbs need it"
  cur=$(_my_watcher)
  [ -n "$cur" ] || cur=$(jq -n --arg id "$VPS_SESSION_ID" \
    '{id:$id, label:"alfa", watchedSessionIds:[], instructions:{}, defaultInstruction:"please continue as ur recommended, ultrathink", createdAt:0}')
  cur=$(printf '%s' "$cur" | jq --arg a "$a" --arg b "$b" "$prog")
  req POST /api/alfa/watchers "$cur" >/dev/null
}

cmd_watcher() {
  local verb="${1:-}"; shift || true
  case "$verb" in
    list)    req GET /api/alfa/watchers | jq '.watchers // .';;
    me)      _my_watcher ;;
    watch)   local ids; ids=$(printf '%s\n' "$@" | jq -R . | jq -cs .)
             _watcher_set ".watchedSessionIds = ((.watchedSessionIds + (\$a|fromjson)) | unique)" "$ids"
             ok "watching $*";;
    unwatch) _watcher_set '.watchedSessionIds |= map(select(. != $a))' "$1"; ok "unwatch $1";;
    prompt)  _watcher_set '.instructions[$a]=$b' "$1" "$2"; ok "prompt for $1 set";;
    default) _watcher_set '.defaultInstruction=$a' "$1"; ok "default prompt set";;
    mode)    _watcher_set '.mode=$a' "$1"; ok "mode $1";;
    delete)  req DELETE "/api/alfa/watchers/${1:-$VPS_SESSION_ID}" >/dev/null; ok "watcher deleted";;
    *) die "watcher: list|me|watch|unwatch|prompt|default|mode|delete";;
  esac
}

cmd_patrol() {
  local verb="${1:-}"; shift || true
  case "$verb" in
    pending) req GET "/api/patrol/pending?alfaId=${1:-${VPS_SESSION_ID:-}}" | jq '.pings // .';;
    ack)     req POST "/api/patrol/pending/$1/ack" >/dev/null; ok "acked $1";;
    *) die "patrol: pending|ack";;
  esac
}

cmd_cron() {
  local verb="${1:-}"; shift || true
  case "$verb" in
    list)   req GET /api/crons | jq '.crons // .';;
    create) req POST /api/crons "$1" ;;
    update) req PATCH "/api/crons/$1" "$2" ;;
    delete) req DELETE "/api/crons/$1" >/dev/null; ok "cron $1 deleted";;
    run)    req POST "/api/crons/$1/run" ;;
    *) die "cron: list|create <json>|update <id> <json>|delete <id>|run <id>";;
  esac
}

cmd_state() {
  local verb="${1:-}"; shift || true
  case "$verb" in
    get) _state_get "$1";;
    set) _state_put "$1" "$2"; ok "state $1 set";;
    *) die "state: get <key>|set <key> <json>";;
  esac
}

# ---- (2) policy -------------------------------------------------------------
cmd_policy() {
  local verb="${1:-}"; shift || true
  case "$verb" in
    get)    [ $# -ge 1 ] && _policy | jq --arg k "$1" '.[$k]' || _policy ;;
    init)   _state_get alfa-policy >/dev/null 2>&1
            local cur; cur=$(_state_get alfa-policy)
            [ -n "$cur" ] && [ "$cur" != "null" ] && { ok "policy already set"; return; }
            _state_put alfa-policy '{}'; ok "policy initialized (defaults active)";;
    set)    # set one field; value parsed as JSON if valid, else string
            local key="$1" raw="$2" val cur
            val=$(printf '%s' "$raw" | jq -c . 2>/dev/null) || val=$(jq -n --arg v "$raw" '$v')
            cur=$(_state_get alfa-policy); [ -n "$cur" ] && [ "$cur" != "null" ] || cur='{}'
            cur=$(printf '%s' "$cur" | jq --arg k "$key" --argjson v "$val" '.[$k]=$v')
            _state_put alfa-policy "$cur"; ok "policy.$key = $val";;
    *) die "policy: get [key] | init | set <key> <value>";;
  esac
}

# ---- (1) memory / journal (ring cap + TTL, trimmed on every write) ---------
cmd_mem() {
  local verb="${1:-}"; shift || true
  local doc; doc=$(_state_get alfa-memory); [ -n "$doc" ] && [ "$doc" != "null" ] || doc='{}'
  local now; now=$(_now)
  local cap ttl; cap=$(_pget memMax); ttl=$(_pget memTtlDays)
  local cutoff=$(( now - ttl * 86400 ))
  case "$verb" in
    set)
      local id="${1:?mem set <watcherId|sid> <note>}" note="$2"
      doc=$(printf '%s' "$doc" | jq \
        --arg id "$id" --arg t "$note" --argjson now "$now" \
        --argjson cap "$cap" --argjson cut "$cutoff" '
        .[$id].notes = ((.[$id].notes // []) + [{ts:$now, text:$t}] | .[-$cap:])
        | .[$id].updatedAt = $now
        # TTL purge across ALL watchers, then drop emptied entries
        | with_entries(.value.notes |= map(select(.ts >= $cut)))
        | with_entries(select((.value.notes | length) > 0))')
      _state_put alfa-memory "$doc"; ok "mem[$id] += note (cap $cap, ttl ${ttl}d)";;
    get)    printf '%s' "$doc" | jq --arg id "${1:?mem get <id>}" '.[$id] // null';;
    list)   printf '%s' "$doc" | jq 'keys';;
    clear)  doc=$(printf '%s' "$doc" | jq --arg id "${1:?mem clear <id>}" 'del(.[$id])'); _state_put alfa-memory "$doc"; ok "mem[$1] cleared";;
    gc)     # drop memory for watchers no longer registered + TTL purge
      local live; live=$(req GET /api/alfa/watchers | jq -c '[.watchers[].id]')
      doc=$(printf '%s' "$doc" | jq --argjson live "$live" --argjson cut "$cutoff" '
        with_entries(select(.key as $k | $live | index($k)))
        | with_entries(.value.notes |= map(select(.ts >= $cut)))
        | with_entries(select((.value.notes | length) > 0))')
      _state_put alfa-memory "$doc"; ok "mem gc done (kept live watchers, purged >${ttl}d)";;
    *) die "mem: set <id> <note> | get <id> | list | clear <id> | gc";;
  esac
}

# ---- (3) decision log (ring cap + TTL, trimmed on every write) -------------
cmd_decision() {
  local verb="${1:-}"; shift || true
  local doc; doc=$(_state_get alfa-decisions); [ -n "$doc" ] && [ "$doc" != "null" ] || doc='{"entries":[]}'
  local now; now=$(_now)
  local cap ttl; cap=$(_pget decMax); ttl=$(_pget decTtlH)
  local cutoff=$(( now - ttl * 3600 ))
  case "$verb" in
    log)  # decision log <sid> <state> <reason>
      doc=$(printf '%s' "$doc" | jq \
        --arg s "${1:-}" --arg st "${2:-}" --arg r "${3:-}" \
        --argjson now "$now" --argjson cap "$cap" --argjson cut "$cutoff" '
        .entries = ((.entries // []) + [{ts:$now, sid:$s, state:$st, reason:$r}]
          | map(select(.ts >= $cut)) | .[-$cap:])')
      _state_put alfa-decisions "$doc"; ok "logged: ${2:-} ${1:-} — ${3:-}";;
    list) printf '%s' "$doc" | jq --arg s "${1:-}" 'if $s=="" then .entries else (.entries|map(select(.sid==$s))) end | .[-30:]';;
    clear) _state_put alfa-decisions '{"entries":[]}'; ok "decisions cleared";;
    *) die "decision: log <sid> <state> <reason> | list [sid] | clear";;
  esac
}

# ---- (4) notify / escalate to human ----------------------------------------
cmd_notify() {
  local msg="${1:?notify <message> [level]}" level="${2:-warn}"
  local hook; hook=$(_pget notifyWebhook); [ -n "$hook" ] && [ "$hook" != "null" ] || hook="${ALFA_NOTIFY_WEBHOOK:-}"
  # always record the escalation in the decision log
  cmd_decision log "-" "escalate" "$msg" >/dev/null 2>&1 || true
  if [ -n "$hook" ]; then
    curl -sS -X POST "$hook" -H 'Content-Type: application/json' \
      -d "$(jq -n --arg m "$msg" --arg l "$level" --arg h "$(hostname)" \
            '{text:$m, level:$l, source:"vps-alfa", host:$h}')" \
      -o /dev/null -w '%{http_code}' >/dev/null 2>&1 \
      && { ok "escalated via webhook: $msg"; return; }
    jq -n --arg m "$msg" '{ok:false, msg:("webhook POST failed — surface in-pane: " + $m)}'
    return
  fi
  # no webhook configured → caller must surface to human in-pane
  jq -n --arg m "$msg" '{ok:true, escalate:"NO_WEBHOOK", msg:("surface to human in this pane: " + $m)}'
}

# ---- (5) health-aware adaptive cadence -------------------------------------
cmd_cadence() {
  local load1 gate pmin pmax
  load1=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo 0)
  gate=$(_pget loadGate); pmin=$(_pget pollMinMs); pmax=$(_pget pollMaxMs)
  jq -n --argjson l "$load1" --argjson g "$gate" \
        --argjson lo "$pmin" --argjson hi "$pmax" '
    ($l / $g) as $ratio
    | (if $ratio >= 1 then false else true end) as $ok
    | (if $ratio >= 1 then $hi
       else ($lo + ($hi - $lo) * (if $ratio < 0 then 0 else $ratio end)) | floor end) as $poll
    | {load1:$l, gate:$g, nudgeOk:$ok, pollMs:$poll,
       reason:(if $ok then "load ok — cadence scaled to load" else "load >= gate — back off, do not nudge" end)}'
}

cmd_help() {
cat <<'EOF'
alfa-tools — Control Room function-calling tools

  term   list | get <sid> | create [--profile claude --cwd P --env ID --agent ID --yolo --active-dir]
         | spawn [create-flags] [--watch] [--prompt "text"]   # atomic create+trust+watch+inject
         | ready <sid> [maxSecs]                               # wait boot settle, detect trust dialog
         | rename <sid> <title> | close <sid> | buffer <sid> [lines]
         | input <sid> <text> | enter <sid> | send <sid> <text>
         | key <sid> <enter|up|down|left|right|tab|esc|space|ctrl-c|ctrl-d|backspace>
         | resize <sid> <cols> <rows>
  ws     list | create <name> [hex] | rename <id> <name> | color <id> <hex>
         | delete <id> | active <id> | assign <sid> <wsId> | unassign <sid>
  color  get [sid] | set <sid> <hex> | clear <sid>
  watcher list | me | watch <sid...> | unwatch <sid> | prompt <sid> <text>
         | default <text> | mode <static|patrol-senior-fullstack> | delete [id]
  patrol pending [alfaId] | ack <pingId>
  cron   list | create <json> | update <id> <json> | delete <id> | run <id>
  state  get <key> | set <key> <json>

  policy   get [key] | init | set <key> <value>      # (2) data-driven config, overwrite
  mem      set <id> <note> | get <id> | list | clear <id> | gc   # (1) journal, ring+TTL
  decision log <sid> <state> <reason> | list [sid] | clear       # (3) audit, ring+TTL
  notify   <message> [level]                          # (4) escalate to human/webhook
  cadence                                             # (5) load-adaptive poll + nudge gate

  All output is JSON. ORIGIN defaults http://localhost:4000. Auth auto-logs-in.
  Retention: policy=overwrite, mem/decision=ring(cap)+TTL trimmed on every write,
  `mem gc` drops orphaned watchers. Tune caps/TTL via `policy set`.
EOF
}

# ---- dispatch --------------------------------------------------------------
group="${1:-help}"; shift || true
case "$group" in
  term)    cmd_term "$@";;
  ws)      cmd_ws "$@";;
  color)   cmd_color "$@";;
  watcher) cmd_watcher "$@";;
  patrol)  cmd_patrol "$@";;
  cron)    cmd_cron "$@";;
  state)   cmd_state "$@";;
  policy)  cmd_policy "$@";;
  mem)     cmd_mem "$@";;
  decision) cmd_decision "$@";;
  notify)  cmd_notify "$@";;
  cadence) cmd_cadence "$@";;
  help|-h|--help) cmd_help;;
  *) die "unknown group '$group' — run: alfa-tools help";;
esac
