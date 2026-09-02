# Native-style Windows launch modes — Control Room v2.0.0

Control Room's full UI is SvelteKit + xterm.js. On Windows you can either open
that UI in a normal browser, open it in a dedicated Edge/Chrome **app-mode**
window, or skip the web UI entirely when you only need native terminal panes.

Nothing in this guide deploys or modifies the production VPS.

## Choose the lightest surface that fits

| Need | Command | Surface |
|---|---|---|
| Several plain shells | `vps-cr term 10` | Windows Terminal, no Control Room web UI |
| Native SSH pane | `vps-cr ssh <target>` | Windows Terminal |
| Full Control Room terminal dashboard | `vps-cr app` | dedicated Edge/Chrome `--app` window |
| Full dashboard in daily browser | `vps-cr` | default browser |

`term` and `ssh` are Windows-wrapper features. macOS/Linux users should use their
normal terminal/tmux/ssh tools when they do not need the web UI.

## Build once before regular local use

```powershell
vps-cr build
```

This builds the adapter-node frontend and TypeScript agent. After a successful
build, `vps-cr`, `vps-cr app`, and `vps-cr start` use package production start
scripts instead of Vite/tsx development servers. Rebuild after pulling source
changes.

## `vps-cr app`: same UI, dedicated window

```powershell
vps-cr app
```

The current implementation does **not** maintain a separate native UI. It starts
Control Room locally and launches Edge or Chrome with:

```text
--app=http://localhost:4000
--user-data-dir=<dedicated Control Room profile>
```

This keeps one terminal UI source of truth while avoiding another normal browser
tab/profile. The terminal renderer is still xterm.js, so opening many live panes
or heavyweight CLI programs still consumes resources proportional to those
processes/renderers.

Implementation:

```text
scripts/win-local/app.ps1
scripts/local/control.mjs   # cross-platform app-mode fallback
```

## `vps-cr term`: native Windows Terminal panes

```powershell
vps-cr term 4
```

Use this when the goal is simply multiple native shells and you do not need
Control Room workspaces, reconnect/history, mobile access, or xterm UI.

Implementation:

```text
scripts/win-local/term.ps1
```

## `vps-cr ssh`: native SSH pane

```powershell
vps-cr ssh <target>
```

This launches the SSH client in Windows Terminal. Authentication remains the SSH
client's responsibility; Control Room does not store SSH credentials.

Implementation:

```text
scripts/win-local/ssh.ps1
```

## AI CLI panes

Codex, Claude, Gemini, and OpenClaw profiles in the web UI are thin command
launchers. Each installed CLI is a separate process tree and owns its own login,
credentials, tools, and resource use. When you only need a shell, prefer a shell
pane rather than launching an AI CLI unnecessarily.

## Current Windows helper files

```text
scripts/win-local/vps-cr.ps1
scripts/win-local/app.ps1
scripts/win-local/term.ps1
scripts/win-local/ssh.ps1
scripts/win-local/build-control-room.ps1
scripts/win-local/start-control-room.ps1
scripts/win-local/start-frontend.ps1
scripts/win-local/start-agent.ps1
scripts/win-local/stop-control-room.ps1
scripts/local/control.mjs
```

## Packaged `.exe` status

A Tauri-style packaged `.exe` has been discussed as a possible future option,
but **there is no `src-tauri/` packaged application in the current v2.0.0
repository**. The supported full-UI Windows path today is the tracked
Edge/Chrome app-mode launcher above.
