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
- `bun test` — **11/11** terminal-upload + ordered-broadcast helper tests pass.
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
  grid-to-single focus, and close from pane chrome. A dedicated real-agent
  broadcast smoke also verifies that typing in one pane reaches two selected
  PTYs while armed and returns to source-only input after disarming. The test
  intercepts `/api/state/workspaces`, so it does not mutate the operator's
  durable workspace state. During this E2E pass, per-character parallel POSTs
  exposed a target-side ordering race; the Svelte port now serializes input per
  target without serializing unrelated panes together.

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

Client-exposed variables use SvelteKit's `PUBLIC_` prefix. Build-id stamping
and the final `PUBLIC_BUILD_ID`/cache-header deployment wiring are still in the
backlog below; do not switch the systemd/deploy default until those gates and
the remaining UI parity work are complete.

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
| `shared/pwa/register-service-worker.tsx` | `src/lib/pwa/register-service-worker.ts` |
| `app/manifest.ts` | `static/manifest.webmanifest` (icon files still placeholder — see backlog) |
| `public/sw.js`, `offline.html`, `favicon.ico`, `og-card.png`, screenshots | copied byte-for-byte to `static/` |
| `use-terminal-sessions.ts` (736 lines, subset) | `src/lib/state/terminal-sessions.svelte.ts` — list/create/close/rename/duplicate |
| `use-pane-terminal.ts` + `terminal-pane.tsx` (subset) | `src/lib/features/terminals/Terminal.svelte` — xterm+webgl, SSE bootstrap/output/status/error, input, resize, reconnect-with-backoff, parent-delegated broadcast keystrokes |
| `screen.tsx` + `session-tabs.tsx` (core) | `src/routes/+page.svelte` — workspace-scoped session tabs, create/close shell, single/grid modes, responsive multi-pane grid, scoped broadcast fan-out |
| `pane-header.tsx` + action subset | `src/lib/features/terminals/PaneChrome.svelte` — in-place rename, move workspace, font +/- controls, duplicate, grid focus, close; advanced AI/skills/color/activity/latency menus remain backlog |
| `use-workspaces.ts` + `workspace-tabs.tsx` | `src/lib/features/terminals/use-workspaces.svelte.ts` + `WorkspaceTabs.svelte` — local-first + remote agent-state sync, create/rename/delete/select workspace, session assignment |
| `use-terminal-preferences.ts` (core) | `src/lib/features/terminals/use-terminal-preferences.svelte.ts` — font-size map, single/grid mode, grid columns, reactive `SvelteSet` broadcast targets |
| `terminals-broadcast.tsx` + broadcast input slice | `src/lib/features/terminals/BroadcastMenu.svelte` + `broadcast.ts` — current-workspace running-target selection, All/None, source-inclusive fan-out, per-target ordered input queue |
| `components/ui/{button,badge}.tsx` | `src/lib/components/ui/{button,badge}/` (hand-written shadcn-svelte style) |
| `shared/runtime/force-fresh-reload.ts` | `src/lib/pwa/force-fresh-reload.ts` (verbatim — plain browser APIs, no framework code) |
| `shared/pwa/version-guard.tsx` | `src/lib/pwa/version-guard.svelte` — polls `/api/version`, prompts hard-refresh on new build; reads `PUBLIC_BUILD_ID` via `$env/dynamic/public` so dev doesn't require it set |
| `features/terminals/hooks/use-devices.ts` + `components/devices-drawer.tsx` | `src/lib/features/terminals/devices.ts` (fetch helpers) + `src/lib/components/devices-drawer.svelte` (runes state + polling while open) — wired into `+page.svelte`'s topbar as a "Devices" button |
| `app/error.tsx` | `src/routes/+error.svelte` (uses `page` from `$app/state`, the runes replacement for `$app/stores`'s `$page`) |
| `features/terminals/lib/local-storage.ts` | `src/lib/local-storage.ts` (verbatim) |
| `features/terminals/hooks/use-fullscreen.ts` | `src/lib/features/terminals/use-fullscreen.svelte.ts` — not wired into any component yet, no fullscreen button exists in `+page.svelte` |
| `features/terminals/hooks/use-wake-lock.ts` | `src/lib/features/terminals/use-wake-lock.svelte.ts` — takes `active: () => boolean` instead of a plain prop, since runes have no dependency array; not wired in yet |
| `features/terminals/hooks/use-app-settings.ts` | `src/lib/features/terminals/use-app-settings.svelte.ts` — not wired in yet, no settings drawer exists |

## Backlog — not ported yet

Grouped by area, in a reasonable pickup order. None of this was faked or
guessed at — it's simply not written yet.

**Auth/UI polish**
- [ ] `app/login/page.tsx` full two-column marketing layout (icons, feature cards) — current port is the functional form only
- [ ] `shared/pwa/use-pwa-install.ts` — install prompt handling
- [ ] `shared/platform/*` (detect.ts, platform-provider.tsx, theme.ts, tokens.css) — per-OS skin
- [ ] `shared/runtime/chunk-load-recovery*`, `early-asset-recovery-script` — stale-JS-chunk recovery after a redeploy; no direct SvelteKit equivalent identified yet, see the note in `+error.svelte`. `version-guard.svelte` (now ported) covers the same underlying "tab stuck on an old build" problem from a different angle, so this is lower priority than it looked originally.
- [ ] `shared/components/error-boundary.tsx` → a component-level (not just route-level) Svelte error-boundary pattern, for wrapping individual panes so one crash doesn't blank the whole page — `pane-error-boundary.tsx` is the concrete use site, tracked below under terminal feature depth.
- [ ] `app/global-error.tsx`, `app/not-found.tsx` → `+error.svelte` (added this round) covers the general case; a dedicated 404 look and the full-`<html>`-replace critical-error path from `global-error.tsx` are not differentiated yet.
- [ ] Build-id stamping for `PUBLIC_BUILD_ID` at deploy time (equivalent of `next.config.ts`'s `generateBuildId`/`env` stamping) and the `Cache-Control` header rules from the same file (`no-cache` for HTML/`sw.js`, `immutable` for hashed static assets) — `version-guard.svelte` and `api/version/+server.ts` both assume `PUBLIC_BUILD_ID` is set, but nothing in `frontend-svelte/` sets it yet or replicates the header rules; needs a `hooks.server.ts` addition or adapter-node config, not done in this pass.
- [ ] Real PWA icons: `app/icon.tsx` / `apple-icon.tsx` generate PNGs dynamically — export static files from a built Next app (or regenerate) into `static/icons/`; `manifest.webmanifest` already points at the expected paths

**Terminal feature depth** (the big one — `use-pane-terminal.ts` alone is 662 lines)
- [x] File upload / drag-drop/pasted-image upload onto a pane, including 25 MiB client guard, safe shell-path insertion, unit tests, and real-agent E2E verification
- [ ] RTT latency measurement + display
- [ ] Activity/idle-state detection (`working` / `asking` / `planning` / `waiting` / `done` labels)
- [x] Cross-pane broadcast input (`BroadcastMenu.svelte` + `broadcast.ts`) with current-workspace target SSOT, source-inclusive fan-out, ordered per-target delivery, unit tests, and real-agent browser E2E
- [x] In-place pane rename and persisted button-based font sizing
- [ ] Pinch-zoom font sizing
- [x] Core multi-workspace state + workspace tabs + session assignment + single/grid rendering + configurable 1–4/auto columns
- [x] Core pane chrome actions: move workspace, duplicate, grid focus, and close
- [ ] Full `terminals-main.tsx` / `terminals-topbar.tsx` parity: row-stretch polish, launcher/patrol controls, history overlays, and the remaining compact chrome
- [ ] Advanced pane chrome: `pane-actions-menu.tsx`, `pane-menu-cluster.tsx`, `pane-scroll-rail.tsx`, `pane-soft-keyboard.tsx`, `pane-conn-badge.tsx`, `pane-activity-chip.tsx`, `pane-error-boundary.tsx`, `readonly-terminal-view.tsx`, `terminal-profile-icon.tsx`, `session-color-picker.tsx` plus AI/skills/color/fullscreen integrations
- [ ] `launcher-card.tsx`, `launcher-drawer.tsx` — AI agent launch flow (Claude/Codex/Gemini/OpenClaw profiles)
- [ ] `use-alfa-watchers.ts`, `patrol/*` (4 components) — alfa patrol/registry feature, plus `app/api/alfa/watchers/**` and `app/api/patrol/pending/**` routes
- [x] ~~`use-devices.ts`, `devices-drawer.tsx` — device approval UI~~ ported this round, see the table above
- [x] ~~`use-fullscreen.ts`, `use-wake-lock.ts`, `use-app-settings.ts`~~ ported this round as logic-only modules, see the table above — **not wired into any UI yet**: there's no fullscreen button, wake-lock toggle, or settings drawer in `+page.svelte`, so these three currently have zero consumers. Wire them up when the advanced pane chrome / settings drawer lands.
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
