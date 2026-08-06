# AI Onboarding Playbook — LOCAL install

> **You are an AI assistant** (Claude / Codex / Gemini / Claude Code) helping a
> non-expert run **VPS Control Room locally on their own computer** — no VPS,
> SSH, or domain. Read this file, then walk them from zero to a working
> dashboard. Use plain language; assume they don't know the jargon.
>
> For the **production VPS deploy** instead, use [INSTALL.md](./INSTALL.md).
> Human version of this local guide: [INSTALL-LOCAL.md](./INSTALL-LOCAL.md).

## 0. One-paragraph explanation to give the user

"VPS Control Room is a dashboard you open in your browser to manage a computer
through a web page — terminals, file browsing, system stats, and AI-agent
panes. Normally it runs on a server (VPS); here we'll run the **whole thing on
your own laptop** so you can try it. It starts two small local programs (a web
app on port 4000 and a helper 'agent' on 4001) and opens in your browser."

## 1. Decide — is LOCAL the right path?

- **Local (this doc):** trying it out, developing, or single-machine use. No
  server needed. Works on Windows, macOS, Linux.
- **VPS (INSTALL.md):** you want it reachable from your phone anywhere, behind
  Tailscale. Needs SSH + a domain + systemd.

If they just want to "see it work on this computer", continue here.

## 2. Check prerequisites first

Tell them you'll check three things, then run:

```
bun -v       # need 1.3 or newer
node -v      # need v22 or newer
git --version
```

- If `bun` is missing or < 1.3 → the installer in step 3 installs it, or point
  them to https://bun.sh/.
- If `node` is missing or < 22 → point them to https://nodejs.org/ (LTS).
- If `git` is missing → https://git-scm.com/.

Explain: "Bun runs the dashboard, Node runs the helper agent, git downloads it.
That's all we need."

## 3. Install (one command)

Pick the user's OS and give them exactly one line. Explain it's re-runnable
(safe to run twice).

- **Windows (PowerShell):**
  ```powershell
  irm https://raw.githubusercontent.com/rahmanef63/control-room/main/install.ps1 | iex
  ```
- **macOS / Linux:**
  ```bash
  curl -fsSL https://raw.githubusercontent.com/rahmanef63/control-room/main/install.sh | bash
  ```

What it does (tell them, briefly): "checks Bun + Node + git, downloads the project,
creates a private config file with fresh random secrets, installs the parts,
and sets up a `vps-cr` command." Nothing leaves their computer.

Then have them **open a new terminal window** so the `vps-cr` command loads.

## 4. Tell them their password

The installer printed a **login password** (auto-generated). Make sure they
have it. They can change it any time:

```
vps-cr config
```

Local installs set `CONTROL_ROOM_LOCAL_TRUST=1`, so a correct password
auto-approves this machine — **no device-approval dance**. (That second factor
only kicks in on a VPS, where the flag is off.)

## 5. Start it

For the lightest, native experience (recommended on Windows), build once then
open the dashboard in a native app window:

```
vps-cr build      # one-time, 1–3 min — light production servers
vps-cr app        # full dashboard in a native window (not a heavy browser tab)
```

Or the classic browser path:

```
vps-cr            # start both parts + open your default browser
```

Tell them: "This starts both parts and shows the login page when ready (~20s)."

> **Keep it light** (say this): the dashboard is a web app, so it needs a browser
> engine to render. `vps-cr app` uses a small native window instead of their heavy
> everyday browser. For *just shells*, `vps-cr term 10` opens native terminals
> with no browser at all. Tell them NOT to open many AI panes (claude/codex/
> gemini) — each boots a full CLI agent and is heavy.

## 6. Log in

They enter the password from step 4 → they're in. First login on a fresh browser
is auto-trusted (local mode), so there's nothing else to approve.

> If they somehow see a `device_pending` message, local-trust is off — approve
> once with `vps-cr acc <device-id>` (the id is shown), or check
> `CONTROL_ROOM_LOCAL_TRUST=1` is in `.env.local`.

## 7. When something looks broken — the doctor

Always reach for this first; read its output back to them in plain words:

```
vps-cr doctor          # tells you exactly what's wrong
vps-cr doctor --fix     # auto-repairs config (regenerates a missing secret,
                        # recreates/syncs the config file) without touching a
                        # password or secret that's already valid
```

Other helpers: `vps-cr status` (are both parts up?), `vps-cr stop`, `vps-cr help`.

## 8. Definition of done (confirm with the user)

You're finished when ALL of these are true — verify, don't assume:
- `vps-cr doctor` shows frontend(4000) and agent(4001) **up**.
- They logged in (device approved) and see the dashboard.
- A terminal pane opens and accepts a command.

Say: "That's a fully working local Control Room. Use `vps-cr` to start it next
time and `vps-cr stop` when done."

## 9. Set expectations — cross-platform caveats

Be honest so they don't think it's broken:
- **Default terminal** pane works on all OSes (PowerShell on Windows; your shell
  on macOS/Linux).
- **AI CLI panes** (Codex/Claude/Gemini/OpenClaw) run if that CLI is installed;
  full support is best on macOS/Linux.
- **Host stats** (CPU/RAM/disk) show real numbers on every OS now; load average
  and network rates read zero on Windows (the OS doesn't expose them).

## 10. What to NEVER do locally (tell them if relevant)

- Don't run `scripts/deploy.sh`, `install-systemd.sh`, or `bump-version.sh` —
  those are for the Linux VPS and assume systemd/root.
- Don't expose ports 4000/4001 to the public internet. This is single-user and
  meant for localhost / your private network only.
- The config file (`.env.local`) holds secrets and the password — it stays on
  their machine and is git-ignored. Never paste its contents anywhere.

## 11. `vps-cr` quick reference

| Command | Does |
| --- | --- |
| `vps-cr` | start + open browser |
| `vps-cr app` | start + open the full dashboard in a **native app window** (light) |
| `vps-cr term [n]` | open **n native terminal panes** (Windows, no browser) |
| `vps-cr ssh [target]` | open a **native SSH pane** to the VPS (default `vpsku`) |
| `vps-cr build` | build the **light production servers** (do this once) |
| `vps-cr start` | start services only — no browser |
| `vps-cr stop` | stop both parts |
| `vps-cr status` | health of 4000 / 4001 |
| `vps-cr config` / `--reset` | set password / regenerate config |
| `vps-cr doctor` / `--fix` | diagnose / repair |
| `vps-cr acc <id>` · `list` · `revoke <id>` | manage trusted devices |
| `vps-cr secret` | print a fresh random secret |
| `vps-cr help` | menu |
