# Progress log — 2026-06 work cycle

Running record of the audit → fix → native-shell → perf work. Companion to
[AUDIT-2026-06.md](./AUDIT-2026-06.md) (findings) and
[NATIVE-SHELL.md](./NATIVE-SHELL.md) (multi-OS shell design).

---

## ⚠️ Deploy state — read this first

| Where | Commit | Notes |
|-------|--------|-------|
| **Production VPS** (`vps.rahmanef.com`) | `552bf93` | Last redeploy 2026-06-11. **Behind `main`** — see below. |
| **`origin/main`** | `e549143` | All work below is here. |

**`main` is ahead of the VPS by 5 commits.** Everything after `552bf93`
(Appearance, the perf pass, the Next.js security bump) is **NOT live on the
VPS** yet — it ships on the *next* deploy, which is **user-initiated only**.

> **Working rule:** all work is done **local-first**. Do **not** redeploy /
> restart / touch the VPS runtime without an explicit, specific go each time.
> Pushing to `main` is fine (it does not auto-deploy). To ship to the VPS when
> ready: `ssh vpsku` → `bash scripts/deploy.sh main`.

---

## What shipped this cycle

### Docs
- **AUDIT-2026-06.md** — full cross-cutting audit (user / UI-UX / dev / security
  / ops / cross-platform / docs), ~38 findings with `file:line`, severity, fix,
  and a "✅ resolved this pass" banner kept in sync.
- **NATIVE-SHELL.md** — one-web-core / many-OS-native-skins strategy: platform
  layer, per-OS tokens, packaging matrix (PWA/TWA/MSIX/Tauri/Capacitor),
  bridges, "clone a shell" model, phased roadmap.
- Truth fixes: pty cap **24 → 16** (it LRU-evicts, not errors) across README +
  CLAUDE.md; **Next.js 16 → 15**; Convex-era banners on AGENTS/GEMINI/PRD.

### Security / robustness (LIVE on VPS as of `552bf93`)
- Agent **`exit(1)` on uncaught exception** (+ systemd `StartLimit`) so a
  corrupt process is replaced, not kept serving. Unhandled *rejection* stays
  log-only (safer for a long-running service that owns live terminals).
- **pty env secret-scrub** — `CONTROL_ROOM_SECRET` / `SESSION_SECRET` /
  `AGENT_GATEWAY_SECRET` / etc. no longer inherited by spawned shells.
- Windows launchers: honor `CONTROL_ROOM_HOST/PORT`; strip quotes from `.env.local`.

### Native shell
- **Phase 0** (`frontend/src/shared/platform/`): `detect`, `PlatformProvider`
  (stamps `data-os`/`data-display-mode`), `useShell`, per-OS `tokens.css`
  (`--os-*`), light/dark/**system** theme switch (no-flash early script,
  default dark), native `bridges` (haptics/share/statusBar/back), `shellConfig`.
- **Appearance UI** (Settings → Appearance): Theme switch + opt-in
  "Match this OS style" (adopts platform font + radius). Default off → identical
  look until toggled.
- PWA: real per-form-factor screenshots, `launch_handler`, `mobile-web-app-capable`.

### Performance (the multi-pane "freeze" pass — LOCAL-only, not yet on VPS)
- **`TerminalPane` memoized** + every handler reaching it stabilized
  (`useFullscreen` inner refs, inline arrows → `useCallback`). An activity tick
  no longer re-renders untouched panes.
- **`TerminalsTopbar` + `WorkspaceTabs` memoized** + their screen-level handlers
  stabilized → chrome skips per-activity-tick re-renders.
- **Row-measure `useLayoutEffect` keyed to layout inputs** (was running every
  render → ResizeObserver churn + forced `offsetTop` reflow on every tick).
- Wired the existing-but-never-called **session-color `pruneTo`** (localStorage
  colors stopped growing forever; history-restorable sessions keep their color).
- Early **asset-recovery script is production-only** (dev HMR 404s no longer
  trigger a false purge+reload).
- WebGL xterm renderer with DOM fallback (earlier in the cycle; helps all clients).

### Dependencies
- **Next.js `15.5.14 → 15.5.19`** — patches a long high-severity advisory list
  (DoS via Server Components, middleware/proxy bypass, RSC cache poisoning,
  CSP-nonce XSS, image-API DoS, SSRF via WS upgrades). Accepted residual: a
  nested `postcss <8.5.10` vendored inside Next (moderate, first-party CSS only).
  *VPS picks this up automatically on next deploy (`package-lock.json` is gitignored).*

---

## Commit ledger (this cycle, newest first)

| Commit | Summary | On VPS? |
|--------|---------|---------|
| `e549143` | fix(deps): Next 15.5.14 → 15.5.19 | ❌ next deploy |
| `867ef4f` | perf: memoize chrome, color prune, dev-guard | ❌ next deploy |
| `fe294e5` | perf: key row-measure effect to layout inputs | ❌ next deploy |
| `dc2553f` | perf: memoize TerminalPane | ❌ next deploy |
| `488bb72` | feat: Settings → Appearance | ❌ next deploy |
| `552bf93` | fix(agent): unhandled rejection log-only | ✅ live |
| `3036091` | feat(ux): pane error boundary + PWA fixes | ✅ live |
| `0988003` | fix(audit): verified fixes + native shell Phase 0 | ✅ live |

---

## How to test locally (no VPS)
```
vps-cr build && vps-cr app      # prod build in a native window
```
- **Perf:** open many panes + run AI agents → React DevTools "Highlight updates":
  only the active pane should flash on an activity transition, not all panes /
  topbar / tabs.
- **Appearance:** Settings (gear) → Appearance → Theme + "Match this OS style".
- **One visual sanity check** from `fe294e5`: in grid view, a single pane should
  still stretch to fill the grid area.

---

## Pending / deferred (needs a human or external accounts — none started)
- **Native shell Phase 1** — per-OS nav/modal chrome swap; needs visual QA on
  the target devices. Do it together (`vps-cr app` + live feedback).
- **Store packaging** — TWA (Play), MSIX/Tauri (Windows, needs Rust), Capacitor
  (iOS, needs Xcode + Apple Developer).
- **🔎 audit leads still open** — crons/templates loading+error states,
  create-session error surfacing, device-approval expiry, deploy ops nits
  (frontend ~90s stop-drain during deploy → `TimeoutStopSec`). See AUDIT §1–§5.
- **postcss moderate** — resolves when upstream Next rolls its vendored copy.
