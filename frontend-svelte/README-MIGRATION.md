# frontend-svelte — migration status

This is the SvelteKit replacement for `frontend/` (Next.js 15 + React 19).
The original vertical slice from PR #7 has already been merged to `main`; the
current continuation work lives on `migrate/svelte-continue`. The old Next
frontend remains the production/default deployment until feature parity is
high enough for an explicit cutover.

The migration is still **frontend-only**. `agent/` remains Node 22 + node-pty
and its HTTP/WebSocket contracts are unchanged.

## Verified on the real VPS — 2026-08-31

The earlier warning that this app had never compiled is obsolete. The Svelte
frontend is now installed, checked, built, and exercised against the real
agent on a parallel loopback port without touching the live Next service.

Verified gates:

- `bun install` succeeds with Svelte 5 / SvelteKit 2 / adapter-node.
- `bun test` — **42/42** upload + broadcast + ordered-input + telemetry + build-id + PWA-asset + pinch-zoom + soft-keyboard + session-color + history + pane-agent-override + launcher helper tests pass.
- `bun run check` — **0 errors, 0 warnings**.
- `bun run build` — production adapter-node build succeeds.
- Official Svelte MCP `svelte-autofixer` reports no issues on the changed
  Svelte files. Remaining suggestions are only intentional external side
  effects such as localStorage/network synchronization and xterm DOM binding.
- Real-agent core smoke passes: login/401 guard, list/create/delete terminal,
  resize, SSE output, input, and rename.
- Real-agent binary-upload smoke passes end to end: browser-facing Svelte route
  -> agent file write -> PTY `cat` -> output observed again over SSE.
- Chrome-headless browser smoke passes the client layer that HTTP-only tests
  cannot cover: terminal creation through the rune state object, workspace
  creation, two panes in one workspace, grid mode, two live xterm mounts,
  in-place rename, persisted font-size change, duplicate, move to workspace,
  grid-to-single focus, and close from pane chrome. Dedicated real-agent
  smokes also verify live input RTT in the pane header, Codex activity state
  (`working`/`waiting`) without sending an AI prompt, and broadcast typing to
  two selected PTYs with source-only input after disarming. The test
  intercepts `/api/state/workspaces`, so it does not mutate the operator's
  durable workspace state. E2E exposed per-character ordering races in both
  broadcast and ordinary typing; both now share an ordered per-terminal input
  queue without serializing unrelated panes together.
- PWA/deploy smoke verifies one deterministic SvelteKit build id across
  `/_app/version.json`, public `/api/version`, and the native service-worker
  cache namespace. Chrome registers `/service-worker.js` as the active
  controller; public HTML returns `Cache-Control: no-cache`, while adapter-node
  serves `/_app/immutable/*` with one-year immutable caching.
- PWA install smoke verifies the real Next icon artwork at 180/192/512 sizes,
  a valid maskable declaration, Chrome `beforeinstallprompt` handling, and the
  iPhone/iPad Share → Add to Home Screen fallback. The install smoke isolates
  terminal/workspace reads and does not create a PTY or mutate durable state.
- Mobile pinch smoke sends real two-touch events to a live PTY pane: sub-threshold
  jitter is ignored, a 26% pinch changes font 13→15, native pinch is prevented,
  and the same persisted per-session value survives reload.
- Fullscreen smoke verifies pane enter/exit, CSS chrome suppression/restoration,
  xterm refit/resize without remount, and React-parity Focus behavior from grid
  (`single` + fullscreen) against a live PTY.
- Settings/wake-lock smoke verifies heartbeat preference persistence/reset,
  Settings → Trusted devices drawer handoff, and one Screen Wake Lock acquire
  while a real PTY is running followed by one release when that PTY closes.
- Mobile soft-keyboard smoke verifies the two-row pane controls against a real
  PTY: the Up button recalls and re-runs shell history, per-key visibility and
  the master hide setting persist across reloads, Reset defaults restores them,
  and the stale React-only `enter`/`ctrlHold` preference flags are deliberately
  not exposed as fake controls.
- Mobile scroll-rail smoke fills a real PTY with 180 numbered output rows and
  verifies all four controls (up/down one and ten lines) shift the visible xterm
  window while preserving the authoritative scrollback and session count.
- Pane-boundary smoke injects one mount/effect failure into the second of two
  real PTYs: only that slot falls back, the healthy pane/dashboard stay live,
  the failed PTY keeps accepting input, and `Reload pane` reconnects the same
  session and replays its agent buffer.
- Session-color smoke verifies deterministic defaults, live picker updates on pane/tab/profile chrome, reload persistence, cross-tab storage sync, reset-to-default, and profile icon rendering against a real PTY.
- History smoke verifies a real PTY close is retained as a closed entry, survives reload, restores to a new PTY with the same title/workspace, keeps its color while restorable, and prunes the old color only after successful restoration.
- Runtime-catalog/agent-binding smoke verifies the real 5 profile / 3 environment / 4 resolved-agent catalog reaches Svelte, `Codex Ops` can be bound as tracking metadata, the backend PTY stays a plain shell with no `agent_profile_id`/`inner_agent`, activity tracking follows the binding, reload persists it, and unbind/close pruning clears it without launching or prompting AI.
- Launcher smoke verifies the same real 5 profile / 3 environment / 4 resolved-agent catalog through the lazy-loaded Svelte drawer: Base shell, `host-default` environment, and `codex-ops` Regular agent launch all create real PTYs through the UI, preserve exact request semantics, land in the active workspace/history, and send no AI prompt. A 390×844 mobile pass verifies Base/Agents/Envs remain reachable with no horizontal overflow; the Saved tab stays hidden until Templates is actually ported.

No production cutover has happened. The existing Next frontend stays on its
current service/port, and the agent source is not modified by this migration.

### Running the adapter-node build in parallel

```sh
cd frontend-svelte
bun install
bun test
bun run check
bun run build

# Example parallel preview. BODY_SIZE_LIMIT must exceed the agent's 25 MiB
# upload cap; adapter-node's default is too small for terminal uploads.
PORT=4002 \
HOST=127.0.0.1 \
ORIGIN=http://127.0.0.1:4002 \
BODY_SIZE_LIMIT=30M \
bun --env-file=../.env.local build/index.js
```

When a parallel worktree is used, point `AUTH_DEVICE_STORE` at the same
`agent/var/auth-devices.json` as the live checkout so both frontends use the
same trusted-device registry. A normal in-repo cutover does not need that
override.

Deployment identity now uses SvelteKit's native `kit.version.name` as one
SSOT. `build-id.mjs` accepts an optional `PUBLIC_BUILD_ID`, then the common
Git/Dokploy commit variables, then the checked-out Git SHA. The same value is
baked into `$app/environment.version`, `/_app/version.json`, `/api/version`, and
`$service-worker.version`. Keep the systemd/deploy default on Next until the
remaining feature/visual parity and explicit cutover/rollback gates are complete.

## What changed vs. the plan: no custom WebSocket server needed

The original migration plan flagged a custom `server.js` (adapter-node +
`ws.handleUpgrade`) as the highest-risk piece. Reading the actual code
(`frontend/app/api/terminals/[id]/stream/route.ts`) showed that was based on
an incomplete read of the PRD: **the browser never opens a WebSocket.** It
opens a plain `EventSource` (SSE). The Next.js server was the only
WebSocket *client* in the picture, dialing out to the agent's
`/ws/terminals` endpoint and re-emitting messages as SSE frames. That ported
straight into a normal `+server.ts` returning a `ReadableStream` — see
`src/routes/api/terminals/[id]/stream/+server.ts`. No custom server, no
`adapter-node-ws`, no WS upgrade handling anywhere in this app.

## Ported (real, working)

| Original | Here |
|---|---|
| `middleware.ts` | `src/hooks.server.ts` |
| `shared/auth/session.ts` | `src/lib/server/session.ts` (byte-identical HMAC logic) |
| `shared/auth/device-store.ts` | `src/lib/server/device-store.ts` (verbatim) |
| `shared/auth/require-session.ts` | `src/lib/server/require-session.ts` |
| `features/terminals/server/terminal-gateway.ts` | `src/lib/server/gateway.ts` |
| `features/terminals/server/gateway-proxy.ts` | `src/lib/server/proxy.ts` |
| `app/api/auth/{login,logout,devices}/route.ts` | `src/routes/api/auth/**/+server.ts` |
| `app/api/{health,version,overview}/route.ts` | `src/routes/api/**/+server.ts` |
| `app/api/state/[key]/route.ts` | `src/routes/api/state/[key]/+server.ts` |
| `app/api/terminals/**/route.ts` (list/create/get/delete/patch/input/resize/stream/buffer) | `src/routes/api/terminals/**/+server.ts` |
| `app/api/terminals/[id]/upload/route.ts` + `features/terminals/lib/upload.ts` | `src/routes/api/terminals/[id]/upload/+server.ts` + `src/lib/features/terminals/upload.ts` — raw binary proxy, 25 MiB guard, safe shell-path quoting, drag/drop and pasted-image upload |
| `app/login/page.tsx` | `src/routes/login/+page.svelte` (simplified visual — see backlog) |
| `app/layout.tsx` (partial) | `src/routes/+layout.svelte` |
| `shared/pwa/register-service-worker.tsx` + `public/sw.js` | `src/service-worker.ts` + SvelteKit native auto-registration — versioned build/static caches, network-first HTML, API bypass, offline fallback; no manual registration module |
| `app/manifest.ts` + `app/{icon,apple-icon}.tsx` | `static/manifest.webmanifest` + `static/icons/*` — exact live Next 512/180 icon pixels, derived 192 size, maskable declaration, screenshots and New terminal shortcut |
| `offline.html`, `favicon.ico`, `og-card.png`, screenshots | retained under `static/`; stale Next-specific `static/sw.js` removed because SvelteKit now builds `/service-worker.js` from `src/service-worker.ts` |
| `use-terminal-sessions.ts` (736 lines, subset) | `src/lib/state/terminal-sessions.svelte.ts` — list/create/close/rename/duplicate plus the real terminal profile/environment/resolved-agent runtime catalog; page-level history SSOT records lifecycle snapshots and restore specs |
| `use-pane-terminal.ts` + `terminal-pane.tsx` (subset) | `src/lib/features/terminals/Terminal.svelte` — xterm+webgl, SSE bootstrap/output/status/error, ordered direct input, input RTT EWMA, agent activity detection, resize, reconnect-with-backoff, parent-delegated broadcast keystrokes, two-finger pinch zoom, clipboard/soft-key actions, and the shared xterm scroll rail |
| `screen.tsx` + `session-tabs.tsx` (core) | `src/routes/+page.svelte` — workspace-scoped session tabs, create/close shell, single/grid modes, responsive multi-pane grid, scoped broadcast fan-out, pane telemetry snapshots and activity-aware tab dots |
| `pane-soft-keyboard.tsx` + `keyboard.css` | `src/lib/features/terminals/PaneSoftKeyboard.svelte` + `soft-keyboard.ts` — compact two-row touch controls, Ctrl+C/Ctrl+L, navigation sequences, clipboard actions and file attach; per-key/master visibility comes from app-settings SSOT |
| `pane-scroll-rail.tsx` + `pane-rail.css` | `src/lib/features/terminals/PaneScrollRail.svelte` — mobile-only right rail with one/ten-line xterm scroll controls, safe-area spacing, and no duplicate scroll state |
| `pane-error-boundary.tsx` + shared React error boundary | `src/lib/features/terminals/PaneErrorBoundary.svelte` — native `<svelte:boundary>` isolates render/effect failures per pane and retries the same live agent session without exposing error details |
| `features/terminals/hooks/use-session-colors.ts` | `src/lib/features/terminals/session-colors.svelte.ts` + `session-colors.ts` — app-wide rune singleton using the original `control-room:session-colors` key, deterministic palette fallback, cross-tab sync, set/clear and tested pruning helper |
| `session-color-picker.tsx` | `src/lib/features/terminals/SessionColorPicker.svelte` — accessible swatch/palette/reset control wired to the shared session-color store; pane border, heartbeat and active tab consume the same custom property |
| `terminal-profile-icon.tsx` | `src/lib/features/terminals/TerminalProfileIcon.svelte` — shell/OpenClaw/Codex/Claude/Gemini profile icon parity used in session tabs and pane chrome |
| `hooks/sessions/storage.ts` + history portion of `hooks/sessions/types.ts` | `src/lib/features/terminals/history.ts` + `terminal-history.svelte.ts` — original `vps-control-room.terminal-history` key, 40-entry recency cap, workspace/cwd/agent/env metadata, closed retention and restoration-safe rune SSOT |
| `history-drawer.tsx` | `src/lib/features/terminals/HistoryDrawer.svelte` — global open/closed history, focus live panes, restore closed panes, remove/clear actions, plus workspace-scoped “Restore where I left off” empty state |
| `use-pane-agent-overrides.ts` | `src/lib/features/terminals/pane-agent-overrides.svelte.ts` + `pane-agent-overrides.ts` — original `control-room:pane-agent-overrides` key, app-wide rune SSOT, bind/unbind metadata and React-parity live-session pruning |
| tracking-only subset of `pane-ai-launch.tsx` | `src/lib/features/terminals/PaneAgentBinding.svelte` — catalog-backed bind/unbind control that marks shell panes for agent telemetry without injecting a command, launching an agent, or sending a prompt |
| `launcher-card.tsx` + executable subset of `launcher-drawer.tsx` | `src/lib/features/terminals/LauncherDrawer.svelte` + `launcher.ts` — lazy-loaded Base/Agents/Envs launcher using the `terminalSessions` runtime catalog and shared create/workspace/history path; Regular/YOLO + active-dir request semantics are tested, while Saved stays deferred until Templates exists |
| `pane-header.tsx` + action subset | `src/lib/features/terminals/PaneChrome.svelte` — profile icon, session-color picker, tracking-only agent binding, in-place rename, activity chip, stream/RTT badge, move workspace, font +/- controls, duplicate, grid focus, fullscreen enter/exit, close; AI launch/injection, skills and advanced actions remain backlog |
| `use-workspaces.ts` + `workspace-tabs.tsx` | `src/lib/features/terminals/use-workspaces.svelte.ts` + `WorkspaceTabs.svelte` — local-first + remote agent-state sync, create/rename/delete/select workspace, session assignment |
| `use-terminal-preferences.ts` (core) | `src/lib/features/terminals/use-terminal-preferences.svelte.ts` — font-size map, single/grid mode, grid columns, reactive `SvelteSet` broadcast targets |
| `terminals-broadcast.tsx` + broadcast input slice | `src/lib/features/terminals/BroadcastMenu.svelte` + `broadcast.ts` + `input-queue.ts` — current-workspace running-target selection, All/None, source-inclusive fan-out, shared per-terminal ordered input queue |
| `components/ui/{button,badge}.tsx` | `src/lib/components/ui/{button,badge}/` (hand-written shadcn-svelte style) |
| `shared/runtime/force-fresh-reload.ts` | `src/lib/pwa/force-fresh-reload.ts` (verbatim — plain browser APIs, no framework code) |
| `shared/pwa/version-guard.tsx` | `src/lib/pwa/version-guard.svelte` — uses `$app/environment.version` + `$app/state.updated`; SvelteKit polls its version manifest and `/api/version` supplies the newer build label for the reload prompt |
| `shared/pwa/use-pwa-install.ts` | `src/lib/pwa/use-pwa-install.svelte.ts` + `InstallAppControl.svelte` — native Chromium install prompt plus iPhone/iPad Add to Home Screen instructions; hidden in installed/standalone mode |
| `features/terminals/hooks/use-devices.ts` + `components/devices-drawer.tsx` | `src/lib/features/terminals/devices.ts` (fetch helpers) + `src/lib/components/devices-drawer.svelte` (runes state + polling while open) — wired into `+page.svelte`'s topbar as a "Devices" button |
| `app/error.tsx` | `src/routes/+error.svelte` (uses `page` from `$app/state`, the runes replacement for `$app/stores`'s `$page`) |
| `features/terminals/lib/local-storage.ts` | `src/lib/local-storage.ts` (verbatim) |
| `features/terminals/hooks/use-fullscreen.ts` | `src/lib/features/terminals/use-fullscreen.svelte.ts` — wired into pane chrome and grid Focus; native Fullscreen API with CSS fallback, shell-chrome suppression, and xterm refit |
| `features/terminals/hooks/use-wake-lock.ts` | `src/lib/features/terminals/use-wake-lock.svelte.ts` — wired to `terminalSessions.runningCount`; acquires while any PTY runs, releases at zero, and reacquires on visibility return |
| `features/terminals/hooks/use-app-settings.ts` + settings drawer core | `src/lib/features/terminals/use-app-settings.svelte.ts` + `src/lib/components/settings-drawer.svelte` — heartbeat, soft-keyboard master/per-key visibility, automatic wake-lock explanation, Devices handoff and reset are live; appearance/data/automation sections remain with their unported features |

## Backlog — not ported yet

Grouped by area, in a reasonable pickup order. None of this was faked or
guessed at — it's simply not written yet.

**Auth/UI polish**
- [ ] `app/login/page.tsx` full two-column marketing layout (icons, feature cards) — current port is the functional form only
- [x] `shared/pwa/use-pwa-install.ts` — native install prompt handling plus iPhone/iPad manual Add to Home Screen fallback, verified in Chrome browser smoke
- [ ] `shared/platform/*` (detect.ts, platform-provider.tsx, theme.ts, tokens.css) — per-OS skin
- [ ] `shared/runtime/chunk-load-recovery*`, `early-asset-recovery-script` — stale-JS-chunk recovery after a redeploy; no direct SvelteKit equivalent identified yet, see the note in `+error.svelte`. `version-guard.svelte` (now ported) covers the same underlying "tab stuck on an old build" problem from a different angle, so this is lower priority than it looked originally.
- [x] Component-level pane error isolation — `PaneErrorBoundary.svelte` uses native `<svelte:boundary>` with recoverable retry UI; browser fault-injection verifies one pane can crash/reconnect without blanking siblings. The route-level `+error.svelte` remains the separate page fallback.
- [ ] `app/global-error.tsx`, `app/not-found.tsx` → `+error.svelte` (added this round) covers the general case; a dedicated 404 look and the full-`<html>`-replace critical-error path from `global-error.tsx` are not differentiated yet.
- [x] Build-id/cache-policy deployment wiring — deterministic `kit.version.name`, public no-store `/api/version`, HTML `no-cache`, adapter-node immutable hashed assets, native versioned service worker, build-id tests, curl header verification, and Chrome PWA registration/cache smoke all pass.
- [x] Real PWA icons/install metadata — live Next `/icon` and `/apple-icon` outputs copied as the source of truth, 192px derived from the same 512px art, manifest dimensions verified against PNG headers, Apple touch metadata wired, and browser install flows pass

**Terminal feature depth** (the big one — `use-pane-terminal.ts` alone is 662 lines)
- [x] File upload / drag-drop/pasted-image upload onto a pane, including 25 MiB client guard, safe shell-path insertion, unit tests, and real-agent E2E verification
- [x] RTT latency measurement + pane-header display using throttled EWMA of real input POST round-trips; real-agent browser smoke verified
- [x] Activity/idle-state detection (`working` / `asking` / `planning` / `waiting` / `done`) for agent profiles and detected `inner_agent`, with pane chip + activity-aware tab dots and Codex real-agent smoke
- [x] Cross-pane broadcast input (`BroadcastMenu.svelte` + `broadcast.ts`) with current-workspace target SSOT, source-inclusive fan-out, ordered per-target delivery, unit tests, and real-agent browser E2E
- [x] In-place pane rename and persisted button-based font sizing
- [x] Pinch-zoom font sizing — non-passive two-touch attachment with 12% step threshold, shared persisted font SSOT, xterm refit/resize, unit tests and real mobile browser/PTY persistence smoke
- [x] Core multi-workspace state + workspace tabs + session assignment + single/grid rendering + configurable 1–4/auto columns
- [x] Core pane chrome actions: move workspace, duplicate, grid focus, and close
- [x] Session-color SSOT + profile icons + picker — original storage key/palette preserved, deterministic fallback, cross-tab sync, pane/tab/heartbeat custom-property wiring, and real-browser persistence/reset verification. Auto-prune now matches React by retaining the union of live + history-restorable ids.
- [x] Terminal history SSOT + History drawer — exact storage key/40-entry cap, live snapshot updates, closed retention, workspace-aware single/bulk restore, reload persistence, and real-agent restore E2E.
- [x] Runtime catalog + pane-agent override SSOT — `GET /api/terminals` profiles/environments/agentProfiles are retained in `terminalSessions`; original override key/shape and live-only pruning are preserved; tracking-only bind/unbind is real-browser verified without AI launch/prompt.
- [ ] Full `terminals-main.tsx` / `terminals-topbar.tsx` parity: row-stretch polish, patrol controls, and the remaining compact chrome; the core launcher is now ported
- [ ] Advanced pane chrome: `pane-actions-menu.tsx`, `pane-menu-cluster.tsx`, `readonly-terminal-view.tsx` plus AI launch/injection, skills and actions integrations. `terminal-profile-icon.tsx`, `session-color-picker.tsx`, `pane-soft-keyboard.tsx`, `pane-scroll-rail.tsx`, `pane-error-boundary.tsx`, `pane-conn-badge.tsx`, `pane-activity-chip.tsx`, and fullscreen behavior are already absorbed by the current Svelte pane components.
- [x] `launcher-card.tsx` + `launcher-drawer.tsx` core — Base/Agents/Envs are lazy-loaded and real-agent verified, including Regular agent launch; Saved is intentionally deferred with the Templates feature rather than exposed as a non-functional tab
- [ ] `use-alfa-watchers.ts`, `patrol/*` (4 components) — alfa patrol/registry feature, plus `app/api/alfa/watchers/**` and `app/api/patrol/pending/**` routes
- [x] ~~`use-devices.ts`, `devices-drawer.tsx` — device approval UI~~ ported this round, see the table above
- [x] `use-fullscreen.ts` — ported and wired into pane chrome + grid Focus, with browser fullscreen/resize verification.
- [x] `use-wake-lock.ts` — wired automatically to live terminal count and browser-verified acquire/release.
- [x] `use-app-settings.ts` + settings drawer core — heartbeat glow, soft-keyboard master/per-key persistence, reset and Trusted Devices handoff are wired. Legacy `enter`/`ctrlHold` flags remain storage-compatible but hidden because the React keyboard never implemented them.
- [x] `use-workspaces.ts` and core `use-terminal-preferences.ts` (font size + view mode + grid columns + broadcast targets)
- [ ] `use-media-query.ts`
- [ ] `lib/backup.ts` — export/import of workspaces, templates, settings and history as one backup payload. History storage/types are now ported; session order/active-id persistence from the large React session hook remains part of topbar/session-order parity.
- [ ] `overview-drawer.tsx`; History drawer and Settings drawer core are now ported, while Settings appearance/data/automation sections stay scoped to the corresponding remaining features
- [ ] `file-explorer-dialog.tsx` + `app/api/fs/list/route.ts`

**Other feature areas — not started**
- [ ] Crons: `features/crons/*` (3 files) + `app/api/crons/**` routes
- [ ] Templates: `features/templates/*` (3 files)
- [ ] Browser CRUD: `app/browser/**`, `app/api/browser/crud/route.ts` (see `docs/browser-crud.md` in the repo root)
- [ ] `app/view/[id]/**` — read-only pane share view
- [ ] `app/api/skills/route.ts`, `app/api/log/route.ts`
- [ ] `components/ui/{separator,tooltip}.tsx` — the other two shadcn components in the original; add via `bunx shadcn-svelte@latest add separator tooltip` once npm access exists

**Styling parity**
- [ ] Most legacy stylesheets under `frontend/app/styles/**` (dashboard, drawers, pane-menus/*, alfa-*, terminals/*) still need a visual-parity pass. `keyboard.css` and `pane-rail.css` behavior are now absorbed into the Svelte pane components; the broader shell still needs comparison against `docs/media/*.png` screenshots in the repo root.

## What was deliberately kept identical, not reinterpreted

- `session.ts`'s HMAC-SHA256 signing/verification — byte-for-byte, so existing
  session cookies keep working through the cutover.
- `device-store.ts`'s on-disk JSON format and file path — reads the same
  `agent/var/auth-devices.json` an already-running Next.js instance writes.
- The stream route's cookie-forwarding for the WS handshake (not the
  `x-control-room-secret` the other proxy routes use) — matches
  `agent/src/terminal/auth.ts`'s `isAuthorizedTerminalSocket`, which checks
  the session cookie specifically, not the gateway secret.
- Every HTTP status code in the login flow (400/401/403/429/500) — the login
  page's UI branches on these exactly.
