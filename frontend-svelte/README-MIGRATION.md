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
- `bun test` — **24/24** upload + broadcast + ordered-input + telemetry + build-id + PWA-asset + pinch-zoom helper tests pass.
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
| `use-terminal-sessions.ts` (736 lines, subset) | `src/lib/state/terminal-sessions.svelte.ts` — list/create/close/rename/duplicate |
| `use-pane-terminal.ts` + `terminal-pane.tsx` (subset) | `src/lib/features/terminals/Terminal.svelte` — xterm+webgl, SSE bootstrap/output/status/error, ordered direct input, input RTT EWMA, agent activity detection, resize, reconnect-with-backoff, parent-delegated broadcast keystrokes, two-finger pinch zoom through persisted font preferences |
| `screen.tsx` + `session-tabs.tsx` (core) | `src/routes/+page.svelte` — workspace-scoped session tabs, create/close shell, single/grid modes, responsive multi-pane grid, scoped broadcast fan-out, pane telemetry snapshots and activity-aware tab dots |
| `pane-header.tsx` + action subset | `src/lib/features/terminals/PaneChrome.svelte` — in-place rename, activity chip, stream/RTT badge, move workspace, font +/- controls, duplicate, grid focus, fullscreen enter/exit, close; advanced AI/skills/color menus remain backlog |
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
| `features/terminals/hooks/use-wake-lock.ts` | `src/lib/features/terminals/use-wake-lock.svelte.ts` — takes `active: () => boolean` instead of a plain prop, since runes have no dependency array; not wired in yet |
| `features/terminals/hooks/use-app-settings.ts` | `src/lib/features/terminals/use-app-settings.svelte.ts` — not wired in yet, no settings drawer exists |

## Backlog — not ported yet

Grouped by area, in a reasonable pickup order. None of this was faked or
guessed at — it's simply not written yet.

**Auth/UI polish**
- [ ] `app/login/page.tsx` full two-column marketing layout (icons, feature cards) — current port is the functional form only
- [x] `shared/pwa/use-pwa-install.ts` — native install prompt handling plus iPhone/iPad manual Add to Home Screen fallback, verified in Chrome browser smoke
- [ ] `shared/platform/*` (detect.ts, platform-provider.tsx, theme.ts, tokens.css) — per-OS skin
- [ ] `shared/runtime/chunk-load-recovery*`, `early-asset-recovery-script` — stale-JS-chunk recovery after a redeploy; no direct SvelteKit equivalent identified yet, see the note in `+error.svelte`. `version-guard.svelte` (now ported) covers the same underlying "tab stuck on an old build" problem from a different angle, so this is lower priority than it looked originally.
- [ ] `shared/components/error-boundary.tsx` → a component-level (not just route-level) Svelte error-boundary pattern, for wrapping individual panes so one crash doesn't blank the whole page — `pane-error-boundary.tsx` is the concrete use site, tracked below under terminal feature depth.
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
- [ ] Full `terminals-main.tsx` / `terminals-topbar.tsx` parity: row-stretch polish, launcher/patrol controls, history overlays, and the remaining compact chrome
- [ ] Advanced pane chrome: `pane-actions-menu.tsx`, `pane-menu-cluster.tsx`, `pane-scroll-rail.tsx`, `pane-soft-keyboard.tsx`, `pane-error-boundary.tsx`, `readonly-terminal-view.tsx`, `terminal-profile-icon.tsx`, `session-color-picker.tsx` plus AI/skills/color integrations. `pane-conn-badge.tsx`, `pane-activity-chip.tsx`, and fullscreen behavior are already absorbed into `PaneChrome.svelte`.
- [ ] `launcher-card.tsx`, `launcher-drawer.tsx` — AI agent launch flow (Claude/Codex/Gemini/OpenClaw profiles)
- [ ] `use-alfa-watchers.ts`, `patrol/*` (4 components) — alfa patrol/registry feature, plus `app/api/alfa/watchers/**` and `app/api/patrol/pending/**` routes
- [x] ~~`use-devices.ts`, `devices-drawer.tsx` — device approval UI~~ ported this round, see the table above
- [x] `use-fullscreen.ts` — ported and wired into pane chrome + grid Focus, with browser fullscreen/resize verification.
- [x] `use-wake-lock.ts`, `use-app-settings.ts` — ported as logic modules but still **not wired into UI**; connect them when the settings drawer lands.
- [x] `use-workspaces.ts` and core `use-terminal-preferences.ts` (font size + view mode + grid columns + broadcast targets)
- [ ] `use-media-query.ts`, `use-session-colors.ts`, `use-pane-agent-overrides.ts`
- [ ] `sessions/storage.ts`, `sessions/types.ts`, `lib/backup.ts` — cross-browser workspace persistence beyond the now-ported basic agent `/api/state/workspaces` sync; `lib/local-storage.ts` itself is ported (see table above), these are the higher-level backup/history pieces built on top of it
- [ ] `history-drawer.tsx`, `overview-drawer.tsx`, `settings-drawer.tsx`
- [ ] `file-explorer-dialog.tsx` + `app/api/fs/list/route.ts`

**Other feature areas — not started**
- [ ] Crons: `features/crons/*` (3 files) + `app/api/crons/**` routes
- [ ] Templates: `features/templates/*` (3 files)
- [ ] Browser CRUD: `app/browser/**`, `app/api/browser/crud/route.ts` (see `docs/browser-crud.md` in the repo root)
- [ ] `app/view/[id]/**` — read-only pane share view
- [ ] `app/api/skills/route.ts`, `app/api/log/route.ts`
- [ ] `components/ui/{separator,tooltip}.tsx` — the other two shadcn components in the original; add via `bunx shadcn-svelte@latest add separator tooltip` once npm access exists

**Styling parity**
- [ ] ~25 stylesheets under `frontend/app/styles/**` (dashboard, drawers, keyboard, pane-menus/*, alfa-*, terminals/*) were not ported. `src/app.css` currently has only a base dark theme derived from the login page's look. Visual parity needs a real pass against `docs/media/*.png` screenshots in the repo root.

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
