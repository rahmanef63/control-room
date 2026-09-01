---
name: vps-alfa
description: Become an alfa watcher inside the VPS Control Room. Use when the user opens an AI agent terminal (claude / codex / gemini) on https://vps.rahmanef.com and asks you to "watch", "patrol", "babysit", or "be alfa for" one or more other terminal panes. Trigger on /vps-alfa, "/alfa", "watch terminal X", "patrol mode", or "auto-respond to". Skill self-registers via the alfa API. **Agent emits patrol pings server-side** — runs headless without a Control Room browser tab.
---

# VPS Control Room — Alfa watcher (skill)

You are running inside a terminal session of the VPS Control Room webapp.
The user wants you to act as **alfa** for one or more other terminals: detect
when each target sits idle/waiting and nudge it back to work.

## Architecture facts

1. **Patrol pings are emitted by the agent** (server-side scheduler that runs
   inside the same Node process as the terminal manager). It reads
   alfa-watchers state every 3s, checks each watched session's silence age
   against the watcher's `silenceThresholdMs` (default 30s), and enqueues
   `waiting` pings without any browser dependency. `done` events fire on
   short quiet windows after a recent burst. Cooldown 60s per (alfa, target)
   prevents storms. **You — the alfa — just poll the queue and act.**

2. **Profile doesn't matter for patrol.** Server-side detection uses the PTY
   buffer's `updated_at`, not the UI's `activityState`. A `profile: 'shell'`
   pane with `claude` typed manually inside is watched the same as a
   first-class agent pane. (You can still use the pid tree to display "what's
   running" to the human.)

3. **Sending Enter:** the `input` POST writes raw PTY bytes. To submit a
   prompt to a TUI like `claude`, send the text and the Enter key as **two
   separate POSTs** with a small delay, or one POST whose payload ends with a
   real `\r` byte. Verify with a follow-up `{"data":"\r"}` if the target
   shows the text but no submit.

4. **`$ORIGIN` is unset by default.** Fall back to `http://localhost:4000`.

5. **Login is required.** Endpoints under `/api/*` (except `/api/auth/*` and
   `/api/health`) redirect to `/login` unless you have a session cookie. POST
   `/api/auth/login` with `{"secret":"$CONTROL_ROOM_SECRET"}` and save with
   `curl -c /tmp/cookies.txt`; re-use with `-b`.

## Function-calling tools (`alfa-tools`)

You have a verb-based tool layer at `skills/vps-alfa/alfa-tools.sh` (installed
alongside this skill). It wraps every authenticated Control Room endpoint —
login/cookie/jq plumbing handled once — so you operate the box declaratively
instead of hand-rolling curls. **Prefer it over raw curl for all actions.**

```bash
# resolve the tool once (claude reads ~/.claude, openclaw reads ~/.agents)
T=~/.claude/skills/vps-alfa/alfa-tools.sh; [ -x "$T" ] || T=~/.agents/skills/vps-alfa/alfa-tools.sh
$T help                              # full verb list

# terminals — self-CRUD
$T term list
$T term create --profile claude --cwd "$HOME/projects/example"
$T term rename <sid> "build watcher"
$T term send <sid> "bun run test"    # text + Enter, TUI-safe
$T term buffer <sid> 40
$T term close <sid>

# spawn a NEW agent pane and make it a watched child — ONE call.
# This IS the "add-new-terminal button, then make it the child target" flow.
# It: creates the pane (claude → auto --dangerously-skip-permissions),
# waits for boot to settle, auto-accepts the "trust this folder" dialog,
# registers it under THIS alfa's watchedSessionIds, then injects the prompt.
$T term spawn --profile claude --cwd "$HOME/projects/example" \
  --watch --prompt "say hi"
# -> {"ok":true,"sid":"<new-sid>","watched":true,"prompted":true}
# DO NOT hand-roll create→list→buffer→trust→send. Use spawn. It returns the
# real sid, so you never track a typo'd id and never blind-navigate dialogs.

# special keys — CORRECT escape bytes (never hand-roll arrows; a literal "[B"
# without the ESC byte mis-navigates dialogs and can pick "Exit" → kills pane).
$T term key <sid> down        # \x1b[B      $T term key <sid> enter   # \r
$T term key <sid> esc         # \x1b        $T term key <sid> ctrl-c
$T term ready <sid> 20        # wait until output settles; flags a trust dialog

# workspace tabs — self-organize (server-synced → shows in every browser tab)
$T ws create "superspace" "#a78bfa"
$T ws assign <sid> <wsId>
$T ws color <wsId> "#34d399"
$T ws active <wsId>

# author your OWN prompts (writes your watcher entry)
$T watcher prompt <sid> "continue the Svelte canonicalization, ultrathink"
$T watcher default "please continue as ur recommended, ultrathink"
$T watcher mode patrol-senior-fullstack
$T watcher watch <sid>               # add a pane to your watch list

# patrol + crons + raw state
$T patrol pending ; $T patrol ack <pingId>
$T cron list
$T state get workspaces

# (2) policy — data-driven config (no skill edit to tune). Latest write wins.
$T policy init                       # write defaults if absent (run at bootstrap)
$T policy get                        # loadGate, cooldownS, neverIdle, blocklist, poll*, retention caps
$T policy set loadGate 10
$T policy set notifyWebhook "https://n8n.../webhook/alfa"

# (1) memory — per-watcher journal, ring cap + TTL, trimmed every write
$T mem set <sid> "pane on Svelte canonicalization, last step: verified adapter-node build"
$T mem get <sid>                     # recall context after restart instead of re-deriving
$T mem gc                            # drop journals for dead watchers (run at bootstrap)

# (3) decision log — audit every act, ring cap + TTL
$T decision log <sid> skip  "pane idle, no task"
$T decision log <sid> nudge "waiting 45s, sent: continue migration"
$T decision list [sid]               # recent decisions (debug "why did alfa do X")

# (4) escalate to human (n8n/Telegram webhook, or in-pane if unset)
$T notify "sess-1 needs MCP auth — human login required" warn

# (5) load-adaptive cadence — replaces fixed 6s/45s
$T cadence    # -> {load1, nudgeOk, pollMs, reason}  read this EACH cycle
```

**Retention (auto-delete) is automatic:**
- `policy` — single doc, every `set` overwrites the field (new replaces old).
- `mem` / `decision` — ring buffers: each write keeps only the last `memMax` /
  `decMax` entries AND purges anything older than `memTtlDays` / `decTtlH`.
  No cron needed — trimming happens on every write.
- `mem gc` additionally deletes journals for watchers no longer registered.
- All caps/TTLs live in `policy` — tune with `policy set memMax 30` etc.

Every command prints JSON. `color set` persists server-side but the pane
border won't repaint until the color-hydration bridge ships (see SKILL note);
**`ws color` works in the UI today** — prefer tab color for visible grouping.

## Bootstrap (do this once when the skill loads)

1. **Self-identify** — read your own session id from the env:
   ```bash
   echo "$VPS_SESSION_ID"
   ```
   If empty, tell the user to relaunch this terminal.

2. **Resolve `$ORIGIN`** and **log in**:
   ```bash
   ORIGIN="${ORIGIN:-http://localhost:4000}"
   curl -sS -X POST "$ORIGIN/api/auth/login" \
     -H 'Content-Type: application/json' \
     -d "{\"secret\":\"$CONTROL_ROOM_SECRET\"}" \
     -c /tmp/cookies.txt -o /dev/null
   ```
   All subsequent curls MUST include `-b /tmp/cookies.txt`.

2b. **Initialize policy + clean stale state** (idempotent, run every bootstrap):
   ```bash
   T=~/.claude/skills/vps-alfa/alfa-tools.sh; [ -x "$T" ] || T=~/.agents/skills/vps-alfa/alfa-tools.sh
   $T policy init        # writes defaults once; no-op if already set
   $T mem gc             # drop journals for watchers that no longer exist
   $T policy get | jq -c '{loadGate,cooldownS,neverIdle,notifyWebhook}'
   ```
   Read the policy — it is the source of truth for load gate, cooldown,
   never-idle, the destructive-command blocklist, and retention caps. Do NOT
   hardcode those values; honor whatever `policy get` returns.

3. **Discover terminals**:
   ```bash
   curl -sS -b /tmp/cookies.txt "$ORIGIN/api/terminals" \
     | jq '.sessions[] | {id, title, cwd, profile, status}'
   ```

4. **Detect what's running inside each pane** (because `profile: shell` lies
   about whether an agent is in there). Use the pid tree:
   ```bash
   # pty pid is session.pid in /api/terminals output
   pstree -p <pty_pid> | grep -oE 'claude|codex|gemini' | head -1
   ```
   If nothing matches, the pane is a raw shell; nudging it with English text
   will just error. Tell the user.

5. **Ask the user** which terminals to watch (numbered list). Also ask:
   - Per-target custom instruction (optional)
   - Default instruction (fallback). Suggested:
     `please continue as ur recommended, ultrathink`
   - Label for this alfa instance

   **Empty-pane rule:** before registering, read each candidate's buffer tail.
   If it shows a fresh agent at an idle prompt with NO task running (e.g. bare
   `❯` in a home dir, no work in progress), do NOT arm a live monitor that will
   spin forever on a task-less pane. Register the watcher but tell the user
   "pane idle — armed, paused" and **do not launch the poll Monitor** until the
   pane has real work. Resume the monitor when the user gives it a task. This
   avoids the pointless 3s-patrol / 6s-poll / ack churn on an empty terminal.

6. **Garbage-collect dead watchers**, then register yourself:
   ```bash
   curl -sS -b /tmp/cookies.txt "$ORIGIN/api/alfa/watchers" \
     | jq -r '.watchers[] | select(.id != env.VPS_SESSION_ID) | .id' \
     | while read wid; do
         live=$(curl -sS -b /tmp/cookies.txt "$ORIGIN/api/terminals" \
                | jq -r --arg w "$wid" '.sessions[] | select(.id==$w) | .id')
         [ -z "$live" ] && curl -sS -b /tmp/cookies.txt -X DELETE \
           "$ORIGIN/api/alfa/watchers/$wid" >/dev/null
       done

   curl -sS -b /tmp/cookies.txt -X POST "$ORIGIN/api/alfa/watchers" \
     -H 'Content-Type: application/json' \
     -d '{
       "id": "'"$VPS_SESSION_ID"'",
       "label": "alfa for project X",
       "watchedSessionIds": ["<sid1>"],
       "instructions": {},
       "defaultInstruction": "please continue as ur recommended, ultrathink"
     }'
   ```

## Watch loop — queue poll only

Server-side scheduler emits pings into the queue. Your job is to drain it,
read context, decide, act, ack. Run as a Monitor so each ping becomes a
notification:

```bash
ORIGIN=http://localhost:4000
while true; do
  pings=$(curl -sS -b /tmp/cookies.txt \
    "$ORIGIN/api/patrol/pending?alfaId=$VPS_SESSION_ID" 2>/dev/null \
    || echo '{"pings":[]}')
  echo "$pings" | jq -c '.pings[] | {pid:.id, sid:.sessionId, state:.activityState, prompt:.prompt}'
  sleep 6
done
```

**For each ping the monitor emits, you (the AI) decide:**

0. **Check cadence FIRST** (`$T cadence`). If `nudgeOk:false` (load ≥ gate),
   ack the ping, `$T decision log <sid> skip "load high $(load1)"`, and do NOT
   nudge. Use the returned `pollMs` to pace your next poll — tight when the box
   is quiet, slack when it's loaded. This replaces the old fixed 6s/45s.
1. Read the target's recent output: `GET /api/terminals/<sid>/buffer?lines=30`
   (or `$T term buffer <sid> 30`).
2. Look for confirmation prompts in the tail: `Type 'yes' to continue`,
   `[y/N]`, `(Y/n)`, `Proceed?`, any line containing `WARNING`/`DESTRUCTIVE`,
   or anything matching `policy.blocklist`. Also catch "needs auth", "login
   required", build failures. If present → **ack, do NOT auto-send**, then
   `$T notify "<sid>: <what needs a human>"` and
   `$T decision log <sid> escalate "<reason>"`. Surface to the human alfa.
3. Branch on watcher `mode` (fetch via `GET /api/alfa/watchers`, find your
   own entry by `$VPS_SESSION_ID`):
   - `mode === 'static'` (default, or missing): send the configured
     per-target prompt (`watcher.instructions[sid]`) or fall back to
     `watcher.defaultInstruction`, verbatim.
   - `mode === 'patrol-senior-fullstack'`: act as a senior fullstack
     engineer. Use the buffer tail + target session metadata (cwd, title,
     inner_agent) to infer project context (SvelteKit / Node agent / design system /
     deploy pipeline / etc.). Pick the
     next concrete step and invoke the most relevant skill if one fits
     (`/audit-bp`, `/rr-prep`, `/rr-send`, `/sc-git`,
     `/sc-dokploy`, `/verify`, ...). Send that tailored prompt — not the
     meta-template itself. Treat `watcher.defaultInstruction` as guidance
     for your own behaviour, not literal payload.
4. Send the chosen prompt + Enter (`$T term send <sid> "<prompt>"`).
5. **Journal + audit:** `$T mem set <sid> "<one-line what this pane is doing /
   last step>"` so you keep context across restarts, and
   `$T decision log <sid> nudge "<the prompt you sent>"`. Both auto-trim.
6. Ack the ping.

**On bootstrap / re-attach:** read `$T mem get <sid>` for each watched pane to
recover what it was working on instead of re-deriving from scratch. Your own
session id changes on restart, but the journal is keyed by the *watched* sid,
so context survives.

**Sending a nudge** (always two POSTs, never trust concatenated `\r`):
```bash
payload=$(jq -n --arg d "$PROMPT" '{data:$d}')
curl -sS -b /tmp/cookies.txt -X POST "$ORIGIN/api/terminals/$sid/input" \
  -H 'Content-Type: application/json' -d "$payload" >/dev/null
sleep 1
curl -sS -b /tmp/cookies.txt -X POST "$ORIGIN/api/terminals/$sid/input" \
  -H 'Content-Type: application/json' -d '{"data":"\r"}' >/dev/null
LAST_NUDGE_AT[$sid]=$(date +%s)
```

Then ack any queue ping that referred to this sid:
```bash
curl -sS -b /tmp/cookies.txt -X POST \
  "$ORIGIN/api/patrol/pending/$pid/ack" >/dev/null
```

## Tools the user can ask you for

- **"How is terminal X doing?"** —
  `curl -b /tmp/cookies.txt $ORIGIN/api/terminals/<sid>/buffer?lines=200`
  (warn if it 500s — known gateway bug).
- **"What's running inside X?"** — `pstree -p <pty_pid> | head -5`
- **"Watch Y too"** — re-POST `/api/alfa/watchers` with updated
  `watchedSessionIds` (POST is upsert by id). Also update `$WATCHED` in your
  running monitor — easiest is TaskStop + relaunch with new list.
- **"Stop watching Y"** — same, with Y removed.
- **"Pause patrol"** — `TaskStop` the monitor. Keep the watcher registration.
- **"Resume"** — relaunch the monitor.
- **"Send X to Y"** — two-POST pattern above, never one POST with `\r` glued.

## Shutdown

```bash
curl -sS -b /tmp/cookies.txt -X DELETE \
  "$ORIGIN/api/alfa/watchers/$VPS_SESSION_ID"
```
Also `TaskStop` the Monitor.

## Guardrails

- **This is the production VPS. Never-idle is OFF here.** Do NOT manufacture
  work to keep panes busy. Only act on a real `waiting`/`done` ping for a pane
  with a genuine next step. An idle pane is fine — leave it idle. Reason: on
  2026-05-28, never-idle drove parallel frontend builds → sustained 100% CPU →
  Hostinger CPU-throttle (95% steal) → dokploy 502. Don't recreate it.
- **Load-aware backoff (data-driven).** Always gate on `$T cadence` before
  nudging — it reads live loadavg vs `policy.loadGate` and returns `nudgeOk` +
  the `pollMs` you should pace at. If `nudgeOk:false`, skip + `decision log`.
  The agent's patrol scheduler also gates at `PATROL_LOAD_GATE`, but you must
  respect cadence for direct actions. Never nudge while a build is running.
- **Never auto-fire `policy.heavyCmds`** (`git push`, frontend/package builds,
  `docker build`, deploy commands, …). A `git push` may trigger an on-box
  verification build, and because
  pty panes live in the agent's cgroup, that build is charged to the agent and
  stalls EVERY terminal (2026-05-28: 84% memory-stall, typing froze). If a
  watched pane's task genuinely needs a build/push, do NOT send it yourself —
  `$T notify` the human and let them run it. Builds are niced in the hook now,
  but two at once still thrash. **One heavy command at a time, human-initiated.**
- **Destructive blocklist is data.** Never send anything matching
  `policy.blocklist` (rm -rf, force-push, DROP TABLE, reset --hard, mkfs, …)
  without the human typing the confirmation in this alfa pane. Tune the list
  with `policy set blocklist '[...]'` — do not hardcode it here.
- Never auto-answer real confirmation prompts (`[y/N]`, `Type 'yes'`, etc.).
  Escalate with `$T notify`.
- One ack per ping. Queue throttles to one ping per (alfa, session) every
  12s, so missed pings resurface.
- Respect `policy.cooldownS` — never nudge the same sid more than once per that
  window, even if the buffer still looks idle. Spamming derails the target.
- If a watched terminal returns 404 on input, it was closed — drop it from
  `watchedSessionIds`, re-POST, and update `$WATCHED`.

## Known bugs / open issues

- **Spawning a claude pane that stalls on a Settings Error dialog** — if
  `~/.claude/settings.json` has an invalid `permissions.defaultMode` (e.g.
  the literal `"auto"`, which is NOT a valid value), EVERY fresh claude pane
  crash-stops on a "Settings Error" dialog before reaching the prompt. Valid
  values: `default | acceptEdits | bypassPermissions | plan`. This is a global
  config bug, not a Control Room bug — fix it once and all panes launch clean.
- **agent/src/terminal/gateway/http.ts** — the `buffer` route is fixed (regex
  already includes `input|resize|buffer`). No action needed.
- **Server-side activity detection** ships via the patrol scheduler
  (agent/src/patrol/scheduler.ts). Headless alfa drains the queue
  (`$T patrol pending`); buffer polling is only for reading context to decide.

## Recovery if the alfa terminal restarts

Your session id changes on relaunch. The OLD watcher entry still exists in
the registry. On bootstrap, garbage-collect (see step 6 above), then
register fresh under the new `$VPS_SESSION_ID`.
