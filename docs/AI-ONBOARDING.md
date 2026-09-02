# AI Onboarding Playbook — local Control Room v2

> Use this when helping a non-expert run Control Room on their own
> Windows/macOS/Linux computer. For a production VPS, use
> [INSTALL.md](./INSTALL.md) and [ONBOARDING.md](./ONBOARDING.md).

## 1. Explain the product accurately

Use a simple description:

> “Control Room is a tmux-like terminal workspace in a browser/PWA. It keeps
> terminal processes on your computer, lets you use multiple panes/workspaces,
> and adds mobile/reconnect/history helpers. Locally it starts a web frontend on
> port 4000 and a PTY helper agent on loopback port 4001.”

Do not describe it as a provider manager, deployment OS, browser automation
engine, scheduler, or AI orchestrator.

## 2. Confirm local mode is the right path

Use local mode when the user wants to:

- try the terminal UI;
- develop Control Room;
- operate shells/installed CLIs on this machine;
- avoid VPS/systemd/proxy setup.

Use the VPS guide when they need a persistent remote host reachable from other
devices.

## 3. Check prerequisites

```text
node -v        # v22+
bun -v         # 1.3+
git --version
```

Explain the roles simply:

- Node 22 runs the production adapter-node frontend and PTY agent.
- Bun installs dependencies and runs tests/build tooling.
- Git downloads/updates the repository.

## 4. Run the tracked one-line installer

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/rahmanef63/control-room/main/install.ps1 | iex
```

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/rahmanef63/control-room/main/install.sh | bash
```

The installer is re-runnable. It checks prerequisites, prepares local secrets,
installs dependencies, and wires the `vps-cr` command.

Ask the user to open a new terminal after installation so their shell sees the
new command wrapper.

## 5. Configure login

```bash
vps-cr config
```

Local installs use `CONTROL_ROOM_LOCAL_TRUST=1`, so a correct login password can
auto-approve the localhost browser. Do not recommend local trust for a production
or network-reachable deployment.

If a device is unexpectedly pending:

```bash
vps-cr list
vps-cr acc <device-id>
```

## 6. Start the product

Normal browser:

```bash
vps-cr
```

Dedicated app-mode window:

```bash
vps-cr build
vps-cr app
```

No browser launch:

```bash
vps-cr start
```

On Windows only, native helper commands also exist:

```powershell
vps-cr term 10
vps-cr ssh <target>
```

Do not promise those two native helper commands on macOS/Linux; use the user's
normal terminal/ssh tooling there.

## 7. Verify instead of assuming

Definition of done:

```bash
vps-cr doctor
vps-cr status
```

Then verify in the UI:

1. login succeeds;
2. **+ New shell** creates a pane;
3. `whoami` or another harmless command returns output;
4. duplicate/create a second terminal;
5. resize/reload and confirm the PTY remains usable.

## 8. Troubleshoot with doctor first

```bash
vps-cr doctor
vps-cr doctor --fix
```

Read the output and explain the failing layer in plain language. Do not jump to
production scripts or remote server changes for a local problem.

Useful helpers:

```bash
vps-cr status
vps-cr stop
vps-cr help
```

## 9. Cross-platform expectations

- The normal interactive shell pane works on Windows/macOS/Linux.
- Codex/Claude/Gemini/OpenClaw panes are only thin wrappers around those installed
  CLIs; Control Room does not install/authenticate/manage the CLI for the user.
- CPU/RAM/disk overview is cross-platform; Windows network-rate counters are
  intentionally neutral where the OS/Node API does not expose Linux-style byte
  counters.
- Many AI CLI panes can be CPU/RAM heavy because each is a separate CLI process;
  use plain shells when that is all the user needs.

## 10. Local safety boundaries

Never:

- print or paste `.env.local` contents;
- expose agent port 4001 directly;
- run `scripts/deploy.sh` or `scripts/install-systemd.sh` for local onboarding;
- alter production/VPS state unless the user explicitly switched the task to a
  production deployment.

## 11. Quick command map

| Command | Purpose |
|---|---|
| `vps-cr` | start + browser |
| `vps-cr app` | full UI in dedicated Edge/Chrome app-mode window |
| `vps-cr build` | build production outputs for lighter local startup |
| `vps-cr start` / `stop` | local process lifecycle |
| `vps-cr status` | frontend/agent health |
| `vps-cr config` | local config/login password |
| `vps-cr doctor [--fix]` | diagnose/repair local setup |
| `vps-cr list` / `acc` / `revoke` | device approval management |
| `vps-cr secret` | generate one new random secret |
| `vps-cr term` / `ssh` | Windows wrapper only: native terminal helpers |
