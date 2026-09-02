# Native Windows (lightweight) — running Control Room without a heavy browser

Control Room is a **web dashboard** (SvelteKit + Svelte 5 + xterm.js). It was built to
manage a *remote* VPS through a browser. Running it **locally** is fully
supported, but the trap is rendering all those terminals inside a heavy everyday
browser (an AI browser like Comet can be ~40 processes / 6+ GB). On a strong
laptop that still causes lag/freezes when you open many panes — it's a *software
overhead* problem, not a hardware one.

This doc explains the **native, light** ways to run it on Windows and the plan for
a true packaged app. Nothing here touches the production VPS.

## TL;DR — pick the lightest tool for the job

| You want… | Use | Roughly |
| --- | --- | --- |
| Many shells | `vps-cr term 10` | Windows Terminal, GPU, **no browser** — tens of MB |
| A shell on the VPS | `vps-cr ssh` | native SSH pane |
| The **full dashboard**, all features | `vps-cr app` | native WebView2 app window — **~hundreds of MB** |
| Dashboard in your normal browser | `vps-cr` | heaviest (your browser's overhead) |

Always **`vps-cr build`** once first — it builds the production servers, which are
far lighter than the Vite development server. `vps-cr` /
`app` / `start` then auto-use the prod build (fallback: dev). Re-build after
`git pull`.

> Avoid opening many **AI panes** (claude/codex/gemini/openclaw) in the dashboard —
> each boots a full CLI agent (~300 MB + CPU). For plain shells use terminal panes
> or `vps-cr term`.

## Why "native" = wrap the existing UI (not a rewrite)

The dashboard is centered on multi-pane terminals, workspaces, session history,
templates, file/directory helpers, lightweight host stats, device management,
settings, backup/restore, broadcast input, and mobile soft-key controls. Rebuilding
all of that as a from-scratch native WinUI/WPF app would duplicate the existing Svelte frontend and create a second UI source of truth.

The right move is to **keep the existing frontend and host it in a native window**:

- **Phase 1 — `vps-cr app` (shipped).** Opens the dashboard in a chromeless
  WebView2/Edge **app-mode** window (`--app=`) with a **dedicated profile**
  (`%LOCALAPPDATA%\vps-cr-app`). It's its own small process tree with its own
  taskbar icon — 100% feature parity (it *is* the web UI) at a fraction of a full
  browser's RAM, GPU-accelerated. Requires Edge or Chrome (WebView2 Runtime ships
  with Windows 11). Implemented by `scripts/win-local/app.ps1`; cross-platform
  fallback `appWindow()` in `scripts/local/control.mjs`.

- **Phase 2 — Tauri packaged `.exe` (planned, opt-in).** A real installable app
  that embeds the same WebView2 engine and bundles/serves the SvelteKit adapter-node build, for the
  smallest footprint and a proper app identity (no Edge/Chrome dependency). It
  needs the **Rust toolchain** (`cargo`), so it's only set up on request. Scope
  when we do it: a `src-tauri/` shell that loads the local frontend, spawns the
  agent as a sidecar, and ships a tray icon + start/stop.

## What stays browser-bound (be honest with users)

Even in a native window, the UI is still web tech, so the inherent cost of
rendering many live `xterm.js` panes remains — Phase 1 removes the *browser
bloat*, not the per-pane rendering cost. If you only need shells, the native
`vps-cr term` path skips xterm/Svelte/SSE entirely and is always the lightest.

## Files

- `scripts/win-local/app.ps1` — native app window (Edge/Chrome `--app`).
- `scripts/win-local/term.ps1` — N native Windows Terminal panes.
- `scripts/win-local/ssh.ps1` — native SSH pane to the VPS.
- `scripts/win-local/build-control-room.ps1` — production build.
- `scripts/win-local/start-frontend.ps1` / `start-agent.ps1` — prod-if-built, else dev.
- `scripts/local/control.mjs` — cross-platform brain (`app`, `build`, prod-aware `start`).
