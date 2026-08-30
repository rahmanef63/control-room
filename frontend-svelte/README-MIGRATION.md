# frontend-svelte — migration status

This is the SvelteKit replacement for `frontend/` (Next.js 15 + React 19),
built per the migration plan. It is **not yet feature-complete** — see the
backlog below — but the core vertical slice is real, working code: auth,
proxy routes, and one fully live terminal pane (SSE streaming + input +
resize), not stubs.

## ⚠️ Never actually built — do this first

The sandbox this was written in has no network access to `registry.npmjs.org`
(network egress allowlist), so **none of this has been through
`bun install`, `svelte-check`, or `vite build`**. Every file was written by
hand against the official Svelte 5 / SvelteKit docs and cross-checked against
the original `frontend/` source it replaces, but it has not compiled once.
Before anything else:

```sh
cd frontend-svelte
bun install
bun run check   # svelte-check — expect to fix a handful of type errors
bun run build   # vite build via adapter-node
bun run dev     # manual smoke test against a real or local agent
```

Copy `../.env.example` (or your existing `.env.local`) — the env var names
are unchanged: `CONTROL_ROOM_SECRET`, `CONTROL_ROOM_SESSION_SECRET`,
`AGENT_GATEWAY_SECRET`, `SESSION_EXPIRY_HOURS`, `TERMINAL_GATEWAY_URL`
(defaults to `http://127.0.0.1:4001`, same as before). Two client-exposed
vars rename per SvelteKit's `PUBLIC_` prefix convention (Vite only inlines
vars prefixed `PUBLIC_`, not `NEXT_PUBLIC_`): `NEXT_PUBLIC_APP_URL` →
`PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_HOST` → `PUBLIC_APP_HOST` — neither is
wired into this app yet (no metadataBase/OG usage ported), so add them when
that lands.

Per `CLAUDE.md`, this project runs on **Bun**, not Node, for the frontend
process (`bun --bun next …` today). `bun run build && bun build/index.js`
should work the same way for the adapter-node output here — SvelteKit's
Node adapter output is plain Node-compatible JS — but this has not been
verified either, for the same npm-egress reason as everything else in this
file. The **agent stays on Node** either way (see CLAUDE.md's "Runtime
split" note on why `node-pty` doesn't work under Bun) — this migration
never touches `agent/`.

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
| `app/login/page.tsx` | `src/routes/login/+page.svelte` (simplified visual — see backlog) |
| `app/layout.tsx` (partial) | `src/routes/+layout.svelte` |
| `shared/pwa/register-service-worker.tsx` | `src/lib/pwa/register-service-worker.ts` |
| `app/manifest.ts` | `static/manifest.webmanifest` (icon files still placeholder — see backlog) |
| `public/sw.js`, `offline.html`, `favicon.ico`, `og-card.png`, screenshots | copied byte-for-byte to `static/` |
| `use-terminal-sessions.ts` (736 lines, subset) | `src/lib/state/terminal-sessions.svelte.ts` — list/create/close/rename only |
| `use-pane-terminal.ts` + `terminal-pane.tsx` (subset) | `src/lib/features/terminals/Terminal.svelte` — xterm+webgl, SSE bootstrap/output/status/error, input, resize, reconnect-with-backoff |
| `screen.tsx` + `session-tabs.tsx` (subset) | `src/routes/+page.svelte` — session tabs, new/close shell, single active pane |
| `components/ui/{button,badge}.tsx` | `src/lib/components/ui/{button,badge}/` (hand-written shadcn-svelte style) |
| `shared/runtime/force-fresh-reload.ts` | `src/lib/pwa/force-fresh-reload.ts` (verbatim — plain browser APIs, no framework code) |
| `shared/pwa/version-guard.tsx` | `src/lib/pwa/version-guard.svelte` — polls `/api/version`, prompts hard-refresh on new build; reads `PUBLIC_BUILD_ID` via `$env/dynamic/public` so dev doesn't require it set |
| `features/terminals/hooks/use-devices.ts` + `components/devices-drawer.tsx` | `src/lib/features/terminals/devices.ts` (fetch helpers) + `src/lib/components/devices-drawer.svelte` (runes state + polling while open) — wired into `+page.svelte`'s topbar as a "Devices" button |
| `app/error.tsx` | `src/routes/+error.svelte` (uses `page` from `$app/state`, the runes replacement for `$app/stores`'s `$page`) |

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
- [ ] File upload / drag-drop onto a pane (`lib/upload.ts`, `use-pane-terminal.ts` upload handling)
- [ ] RTT latency measurement + display
- [ ] Activity/idle-state detection (`working` / `asking` / `planning` / `waiting` / `done` labels)
- [ ] Cross-pane broadcast input (`terminals-broadcast.tsx`, `use-terminal-sessions.ts` broadcast slice)
- [ ] In-place pane rename, pinch-zoom font sizing
- [ ] Multi-workspace grid + `workspace-tabs.tsx`, `terminals-main.tsx`, `terminals-topbar.tsx`
- [ ] Pane chrome: `pane-header.tsx`, `pane-actions-menu.tsx`, `pane-menu-cluster.tsx`, `pane-scroll-rail.tsx`, `pane-soft-keyboard.tsx`, `pane-conn-badge.tsx`, `pane-activity-chip.tsx`, `pane-error-boundary.tsx`, `readonly-terminal-view.tsx`, `terminal-profile-icon.tsx`, `session-color-picker.tsx`
- [ ] `launcher-card.tsx`, `launcher-drawer.tsx` — AI agent launch flow (Claude/Codex/Gemini/OpenClaw profiles)
- [ ] `use-alfa-watchers.ts`, `patrol/*` (4 components) — alfa patrol/registry feature, plus `app/api/alfa/watchers/**` and `app/api/patrol/pending/**` routes
- [x] ~~`use-devices.ts`, `devices-drawer.tsx` — device approval UI~~ ported this round, see the table above
- [ ] `use-fullscreen.ts`, `use-media-query.ts`, `use-wake-lock.ts`, `use-app-settings.ts`, `use-terminal-preferences.ts`, `use-session-colors.ts`, `use-workspaces.ts`, `use-pane-agent-overrides.ts`
- [ ] `sessions/storage.ts`, `sessions/types.ts`, `lib/backup.ts`, `lib/local-storage.ts` — cross-browser workspace persistence (the agent-JSON sync described in PRD §5.2)
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
