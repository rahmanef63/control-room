# Install Control Room v2 locally (Windows / macOS / Linux)

Run the terminal-first Control Room on your own computer—no VPS, systemd,
Tailscale, or domain required. Local mode starts the SvelteKit frontend and the
Node PTY agent on loopback and gives you the same browser/PWA terminal UI used in
production.

> Local mode never deploys to the production VPS. Production uses
> [INSTALL.md](./INSTALL.md) + `scripts/deploy.sh`.

## Requirements

```text
Node.js 22+
Bun 1.3+
Git
```

Node 22 is the supported runtime for the production adapter-node frontend and the
PTY agent. Bun installs dependencies and runs tests/build tooling; local wrappers
also use Bun to invoke the package scripts.

---

## One-line install

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/rahmanef63/control-room/main/install.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/rahmanef63/control-room/main/install.sh | bash
```

The installers are re-runnable. They:

1. verify Node 22 + Git and install/check Bun;
2. clone/update the repository;
3. create/sync local `.env.local` files with strong signing/gateway secrets;
4. install frontend + agent dependencies;
5. install the `vps-cr` local command.

Open a new terminal after installation so the command wrapper is available.

---

## First local configuration

```bash
vps-cr config
```

The local config SSOT is the root `.env.local`; `vps-cr` mirrors it to
`frontend/.env.local` because SvelteKit/Vite local development loads frontend
environment values from the frontend workspace.

Local installs set:

```dotenv
CONTROL_ROOM_LOCAL_TRUST=1
CONTROL_ROOM_HOST=127.0.0.1
AGENT_HEALTH_HOST=127.0.0.1
```

A correct password therefore auto-approves the local browser. Do **not** enable
`CONTROL_ROOM_LOCAL_TRUST` on a network-reachable production deployment.

---

## Pick how to run it

### Full terminal UI in the normal browser

```bash
vps-cr
```

Starts frontend + agent and opens the default browser.

### Full terminal UI in a dedicated app-mode window

```bash
vps-cr build   # recommended once after install / after source updates
vps-cr app
```

`app` uses an installed Edge/Chrome app-mode window with its own profile instead
of adding another tab to a heavy daily browser. It is still the same Svelte/xterm
web UI, so terminal behavior has one frontend source of truth.

### Start without opening a browser

```bash
vps-cr start
```

### Stop

```bash
vps-cr stop
```

### Windows-only native helpers

```powershell
vps-cr term 10       # Windows Terminal panes, no web UI
vps-cr ssh <target>  # Windows Terminal SSH pane
```

The macOS/Linux `vps-cr` wrapper delegates to the cross-platform Node control
script; `term`/`ssh` are not implemented there. Use your normal terminal/tmux/ssh
on those platforms when you do not need the web UI.

---

## `vps-cr` command reference

| Command | Behavior |
|---|---|
| `vps-cr` / `vps-cr open` | start frontend + agent, open browser |
| `vps-cr app` | start and open dedicated Edge/Chrome app-mode window |
| `vps-cr build` | build production frontend + agent outputs for lighter local startup |
| `vps-cr start` | start without opening a browser |
| `vps-cr stop` | stop the locally tracked frontend + agent processes |
| `vps-cr status` | check frontend `:4000` and agent `:4001` health |
| `vps-cr install` | local onboarding/config command |
| `vps-cr config` | edit/recreate local configuration |
| `vps-cr config --reset` | regenerate secrets and reset local defaults |
| `vps-cr doctor` | diagnose Node/Bun/deps/env/device store/health |
| `vps-cr doctor --fix` | repair missing/invalid local config without replacing valid secrets unnecessarily |
| `vps-cr acc <id>` | manually approve a device when local trust is intentionally disabled |
| `vps-cr list` | list approved + pending devices |
| `vps-cr revoke <id>` | revoke a device |
| `vps-cr secret` | print a fresh 32-byte hex secret |
| `vps-cr help` | show command menu |
| `vps-cr term [n]` | Windows wrapper only: native Windows Terminal panes |
| `vps-cr ssh [target]` | Windows wrapper only: native SSH pane |

Flags also accept the `--` form where the local command parser supports it, e.g.
`vps-cr --doctor --fix`.

---

## Build once for lighter local startup

```bash
vps-cr build
```

This creates:

```text
frontend/build/index.js
agent/dist/index.js
```

When both exist, the local launcher starts package `start` scripts rather than
Vite/tsx development servers. Rebuild after pulling source changes.

If the build is absent, `vps-cr` falls back to development mode automatically.

---

## Doctor first when something is wrong

```bash
vps-cr doctor
vps-cr doctor --fix
```

Doctor checks:

- Node/Bun availability;
- installed dependencies;
- root + frontend env files and sync;
- auth/gateway secret validity;
- device store readability;
- frontend/agent local health.

It does not deploy production or modify remote Git state.

---

## Manual local install

```bash
git clone https://github.com/rahmanef63/control-room.git
cd control-room

node scripts/local/control.mjs config --yes
bun install --cwd frontend
bun install --cwd agent
node scripts/local/control.mjs open
```

Or run components separately:

```bash
bun run --cwd agent dev
bun run --cwd frontend dev -- --host 127.0.0.1 --port 4000
```

Open `http://127.0.0.1:4000`.

---

## Cross-platform terminal behavior

- **Shell profile**: uses the host shell (`PowerShell`/configured shell on Windows,
  `$SHELL`/bash-compatible host shell elsewhere).
- **Codex / Claude / Gemini / OpenClaw profiles**: thin launch wrappers. They work
  when the corresponding CLI is installed; Control Room does not own their
  authentication or tool configuration.
- **Host overview**: CPU/RAM/disk are cross-platform; Windows network byte/rate
  counters intentionally remain neutral because Node's standard APIs do not
  expose Linux-style `/proc/net/dev` counters.
- **Configured environment cwd**: an empty cwd means use the host terminal default.

Avoid opening many heavyweight AI CLI sessions when you only need shells; each CLI
is its own process tree and resource cost.

---

## Local security rules

- Keep frontend/agent loopback-bound unless you intentionally design a private LAN
  access setup.
- Never expose port 4001 directly.
- Do not paste `.env.local` contents into chat/issues/logs.
- Do not run production `scripts/deploy.sh` / `scripts/install-systemd.sh` as part
  of local troubleshooting.
- Local trust is a localhost convenience, not a production authentication mode.

---

## Definition of done

```bash
vps-cr doctor
vps-cr status
```

Then verify in the UI:

1. login works;
2. **+ New shell** creates a terminal;
3. a command runs and renders output;
4. a duplicate/second terminal can coexist;
5. resize/reload does not lose the live PTY.

For lightweight Windows launch options, see [NATIVE-WINDOWS.md](./NATIVE-WINDOWS.md).
