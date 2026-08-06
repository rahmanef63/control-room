# Install Control Room locally (Windows / macOS / Linux)

Run the whole dashboard on your own laptop — no VPS, SSH, systemd, Tailscale, or
domain. One command sets up secrets, installs deps, and wires up the `vps-cr`
command.

> Local-only by design. This path never touches the production VPS. The VPS
> deploy still uses `scripts/deploy.sh` + systemd, unchanged.

## 🚀 Quick Start

### One-line install

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/rahmanef63/control-room/main/install.ps1 | iex
```

**macOS / Linux** (bash):

```bash
curl -fsSL https://raw.githubusercontent.com/rahmanef63/control-room/main/install.sh | bash
```

The installer is **re-runnable** — it skips anything already done. When it
finishes, open a **new terminal** (so `vps-cr` is loaded) and:

```
vps-cr config     # show / set your login password
vps-cr app        # start + open the dashboard in a light NATIVE window
```

### Pick how you run it (lightest → fullest)

The dashboard is a web app, so viewing it needs a browser engine. To keep your
laptop light, prefer the native paths and reserve a full browser tab for when you
want it:

| You want… | Run | Weight |
| --- | --- | --- |
| Just shells (many terminals) | `vps-cr term 10` | **lightest** — native Windows Terminal, GPU, no browser |
| A shell on the VPS | `vps-cr ssh` | lightest |
| The **full dashboard**, all features | `vps-cr app` | light — native WebView2 app window, own taskbar icon |
| The dashboard in your normal browser | `vps-cr` | heaviest — depends on your browser |

> **First, build once** for the light production servers:
> `vps-cr build` (1–3 min). After that `vps-cr` / `vps-cr app` / `vps-cr start`
> launch the production build automatically (far lighter than the dev server) and
> fall back to dev if you haven't built. Re-run `vps-cr build` after `git pull`.
>
> **Don't open many AI panes** (claude/codex/gemini) in the dashboard — each one
> boots a full CLI agent. For shells, use plain terminal panes or `vps-cr term`.

### Logging in

The installer prints a **login password** (auto-generated; change it any time
with `vps-cr config`). Local installs set `CONTROL_ROOM_LOCAL_TRUST=1`, so a
correct password **auto-approves this machine** — just log in, no device-approval
step.

> On a VPS that flag is off, so login keeps its second factor: the password
> **and** an approved device (`vps-cr acc <device-id>` / `node
> scripts/approve-device.js <id>`). Never set `CONTROL_ROOM_LOCAL_TRUST` on a
> network-reachable deploy.

## 🧰 The `vps-cr` command

Same menu on every OS (flags also accept the `--form`, e.g. `vps-cr --doctor --fix`):

| Command | What it does |
| --- | --- |
| `vps-cr` | start frontend + agent, open the browser |
| `vps-cr app` | start + open the **full dashboard in a native app window** (light) |
| `vps-cr term [n]` | open **n native terminal panes** (Windows Terminal — no browser) |
| `vps-cr ssh [target]` | open a **native SSH pane** to the VPS (default `vpsku`) |
| `vps-cr build` | build the **light production servers** (fixes UI lag with many panes) |
| `vps-cr start` | start services only — **no browser** (saves RAM) |
| `vps-cr stop` | stop both services |
| `vps-cr status` | health of frontend (4000) + agent (4001) |
| `vps-cr install` | onboarding wizard — write `.env.local` |
| `vps-cr config` | re-run config (`--reset` regenerates secrets) |
| `vps-cr doctor` | diagnose the local setup |
| `vps-cr doctor --fix` | repair broken/missing config to working defaults |
| `vps-cr acc <id>` | approve a login device |
| `vps-cr list` | list approved + pending devices |
| `vps-cr revoke <id>` | un-trust a device |
| `vps-cr secret` | print one fresh 32-byte hex secret |
| `vps-cr help` | full menu |

## 🩺 Something broken? Run the doctor

```
vps-cr doctor          # report problems
vps-cr doctor --fix     # auto-repair what it can
```

`doctor` checks Bun + Node, deps, both `.env.local` files (and keeps them in sync),
secret strength, the device store, and live health. `--fix` regenerates a
missing/weak signing secret, recreates `.env.local` from defaults, and re-syncs
— **without** overwriting a password or secret that is already valid.

## 🔧 Manual install

```bash
git clone https://github.com/rahmanef63/control-room.git
cd control-room
node scripts/local/control.mjs config --yes   # writes .env.local + secrets
bun install --cwd frontend
bun install --cwd agent
node scripts/local/control.mjs            # start
```

Needs **Bun 1.3+** (package manager + frontend runtime) and **Node 22** (the
agent daemon runs on Node).

`bun run dev` in `frontend/` binds port **4000** by default. Config lives in
`.env.local` at the repo root **and** `frontend/.env.local` (Next reads the
latter) — `vps-cr` keeps both in sync.

## ⚠️ Cross-platform notes

- `vps-cr app` (native window) works wherever Edge/Chrome is installed. The
  `vps-cr term` / `vps-cr ssh` native helpers are **Windows-only** (they drive
  Windows Terminal); on macOS/Linux use your own terminal/`tmux` + `ssh`.
- The default **interactive terminal** pane works on all three OSes (PowerShell
  on Windows, your `$SHELL` on macOS/Linux).
- The **agent CLI profiles** (Codex / Claude / Gemini / OpenClaw) and the
  generic `/exec` action still assume `/bin/bash` — they run on macOS/Linux but
  not yet natively on Windows.
- **Host telemetry**: CPU / RAM / disk now read real numbers on every OS. Load
  average and network rates still read zero on Windows (the OS doesn't expose
  them the way Linux `/proc` does).
