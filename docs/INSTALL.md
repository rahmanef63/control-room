# Install Roadmap — VPS Control Room

Step-by-step end-to-end roadmap: from a blank VPS to a live PWA dashboard.
Pick one of three install paths up front, then walk the prereq phases —
they're the same regardless of which install path you take.

---

## Step 0 — Detect your OS first

**AI agents: before running anything, detect the operating system and pick
the matching commands.** The terminal agent, shell defaults, and secret
generation differ per OS.

```bash
# bash / zsh (Linux, macOS)
uname -s        # Linux | Darwin
```
```powershell
# PowerShell (Windows)
$PSVersionTable.OS   # contains "Windows"
```

| OS | Detected by | Shell the dashboard spawns | Secret generation |
|----|-------------|----------------------------|-------------------|
| **Linux** | `uname -s` = `Linux` | `/bin/bash -li` | `openssl rand -hex 32` |
| **macOS** | `uname -s` = `Darwin` | `$SHELL` (zsh) login | `openssl rand -hex 32` |
| **Windows** | `process.platform` = `win32` | PowerShell `-NoLogo` (or `$env:SHELL`) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

The agent reads `process.platform` at runtime and branches automatically
(see `agent/src/terminal/profiles.ts`). On Windows/macOS you can override the
spawned shell + start dir with the `SHELL` and `TERMINAL_DEFAULT_CWD` env vars.

> **Windows tooling caveats**
> - `openssl` is usually absent → use the `node -e` one-liner above.
> - PowerShell `Invoke-WebRequest` strips the `Cookie` header on redirects, so
>   it's useless for testing the auth flow. Use `curl.exe -b`/`-c` or a small
>   `node fetch` script instead.

---

## Pick an install path

| Path | Command | Time | Best for |
|------|---------|------|----------|
| 🤖 AI-assisted | `bunx rahman-cr ai claude` | ~20 min | First-timers, want guidance, paste into Claude/Codex/Gemini |
| ⚡ One-line | `bunx rahman-cr install --vps ... --domain ...` | ~10 min | Have all values ready, want minimum prompts |
| 🛠️ Manual | follow [ONBOARDING.md](./ONBOARDING.md) | ~30 min | Want to understand each step |
| 💻 Local / dev | [Phase L below](#phase-l--local--dev-install-any-os-no-vps) | ~5 min | Run on your own laptop (any OS), no VPS/Tailscale/DNS |

The first three end at the same place: dashboard live on a Tailscale-only
domain. The roadmap below is identical for them — the AI just walks it with
you, the one-liner walks it for you. The **Local / dev** path skips the VPS,
SSH, Tailscale, DNS, and systemd entirely — jump to [Phase L](#phase-l--local--dev-install-any-os-no-vps).

---

## Phase 0 — Local prereqs (your laptop)

Run on **your laptop**, not the VPS.

```bash
bunx rahman-cr doctor
```

Confirms:

- [ ] Bun 1.3+ (for `bunx`) — `curl -fsSL https://bun.sh/install | bash`
- [ ] Node 22 (the agent daemon runs on Node)
- [ ] `ssh` client
- [ ] `git`
- [ ] `openssl` (for secret generation)

Also have ready:

- [ ] An SSH key (`ls ~/.ssh/id_ed25519.pub`). If missing:
      `ssh-keygen -t ed25519 -C "your-email"`.
- [ ] A GitHub account (only required if you plan to fork).
- [ ] A password manager (1Password / Bitwarden / KeePassXC). You will
      need to store two 32-char secrets at the end.

---

## Phase 1 — VPS provisioning

Bring your own VPS. Minimum specs:

| | Min | Recommended |
|---|-----|-------------|
| OS | Ubuntu 22.04 | Ubuntu 24.04 LTS |
| RAM | 1 GB | 2 GB+ |
| Disk | 5 GB free | 10 GB+ |
| CPU | 1 vCPU | 2 vCPU+ |

Tested providers: Hostinger VPS, DigitalOcean, Vultr, Hetzner.
Any cloud or bare-metal Linux works as long as you have root or
passwordless sudo.

After provisioning:

- [ ] You have the **public IPv4** of the VPS
- [ ] You can `ssh root@<ip>` (or `ssh ubuntu@<ip>`) with a password

---

## Phase 2 — SSH key push

Get rid of password auth before doing anything else.

```bash
# from your laptop
ssh-copy-id user@<vps-ip>
ssh user@<vps-ip> 'echo ok'   # should print: ok (no password prompt)
```

If `ssh-copy-id` isn't available, manually paste `~/.ssh/id_ed25519.pub`
into `~/.ssh/authorized_keys` on the VPS.

(Optional but recommended) Disable password auth in
`/etc/ssh/sshd_config`:

```
PasswordAuthentication no
PubkeyAuthentication yes
```
Then `sudo systemctl restart sshd`.

---

## Phase 3 — Tailscale (on the VPS)

The dashboard is designed for **Tailscale-only** access. The reverse
proxy binds to the Tailscale interface; the public IP never sees it.

### 3.1 Generate a Tailscale auth key

Visit https://login.tailscale.com/admin/settings/keys → **Generate auth key**:

- Reusable: **No**
- Ephemeral: **No**
- Pre-authorized: **Yes**
- Tags: `tag:server`

Copy the `tskey-auth-…` string.

### 3.2 Install Tailscale on the VPS

```bash
ssh user@<vps-ip>
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey=tskey-auth-XXXX --hostname=control-room
tailscale ip -4    # → 100.x.y.z
exit
```

### 3.3 Note your tailnet hostname

Your dashboard URL will be:

```
control-room.<tailnet>.ts.net
```

Find your tailnet name at https://login.tailscale.com/admin/dns.

---

## Phase 4 — DNS (optional, only for custom domain)

Skip this phase if you're happy using `.ts.net`. Otherwise:

### 4.1 Get your Tailscale 100.x IP

```bash
tailscale ip -4    # on the VPS
```

### 4.2 Create an A record

At your DNS provider (Hostinger / Cloudflare / route53 / …):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `control` | `100.x.y.z` (Tailscale IP) | 300 |

### 4.3 Verify

```bash
dig +short control.yourdomain.com    # → 100.x.y.z
```

⚠️ **Do NOT set the A record to your public IP.** That defeats the
threat model — Traefik will bind to Tailscale only, so a public record
just leaks the IP.

---

## Phase 5 — Generate secrets

Either run this locally (one-line install will pass them over SSH):

```bash
openssl rand -hex 32     # → CONTROL_ROOM_SECRET
openssl rand -hex 32     # → CONTROL_ROOM_SESSION_SECRET (different!)
```

Or let the AI / one-liner generate them for you. Either way:

**📋 Save both values in your password manager immediately.**

Losing them locks you out of the dashboard. Rotating them invalidates
all active sessions, so saving them is critical.

---

## Phase 6 — Install + deploy

Three flavors. Pick the one matching your install path.

### 6a. AI-assisted

```bash
bunx rahman-cr ai claude    # or codex / gemini
```

The CLI prints a structured prompt to stdout + clipboard. Paste it into
your AI. The AI will:

1. Trigger `/sc-all` skill if available.
2. Ask for each value as it reaches the relevant phase.
3. Run every command in front of you.
4. Verify each phase before moving to the next.

### 6b. One-line

```bash
# already on tailnet
bunx rahman-cr install --vps user@<ip> --domain control-room.<tailnet>.ts.net

# fresh VPS not on tailnet
bunx rahman-cr install \
  --vps user@<ip> \
  --domain control-room.<tailnet>.ts.net \
  --tailscale-key tskey-auth-XXXX
```

The CLI SSHs in and runs everything. First build takes 3–5 minutes.

### 6c. Manual

Follow [ONBOARDING.md](./ONBOARDING.md) Phase 3 onward. Same end state.

---

## Phase 6.5 — Approve your device (first login always lands in "pending")

The login route is device-gated. Typing the correct `CONTROL_ROOM_SECRET` on a
**new** browser does **not** log you in — it drops that device into a `pending`
list and writes an alert to the journal. You must approve the device id once,
from the host (or wherever the agent runs):

```bash
# list approved + pending devices (copy the pending id)
node scripts/approve-device.js --list

# approve it (label is optional)
node scripts/approve-device.js <deviceId> "my phone"
```

Reload the login page and sign in again — now it succeeds. The store lives at
`agent/var/auth-devices.json` (override with `AUTH_DEVICE_STORE`; it must match
the path the frontend process sees). Revoke with `--revoke <deviceId>`.

> First login looking "stuck" or "wrong password" is almost always an
> unapproved device, not a bad secret. Check `--list` first.

---

## Phase L — Local / dev install (any OS, no VPS)

Run the whole dashboard on your own laptop — Linux, macOS, or Windows. No SSH,
Tailscale, DNS, systemd, or Convex. Good for development and for driving your
**local** machine's shell from a browser/phone on the same LAN.

### L.1 Clone + install

```bash
git clone git@github.com:rahmanef63/control-room.git
cd control-room
bun install --cwd frontend
bun install --cwd agent         # node-pty ships prebuilt binaries — no Visual Studio build tools needed
```

> Needs **Bun 1.3+** and **Node 22**: bun installs and runs the frontend; the
> agent daemon runs on Node (node-pty streams no data under Bun).

> Pin note: `frontend/package.json` pins `next` to an exact version. Don't
> loosen it to a `^` range — a newer 15.x patch changes how node-runtime
> middleware is gated and breaks login on a fresh install.

### L.2 Secrets + env

Generate two **different** 32-char secrets:

```bash
# Linux / macOS
openssl rand -hex 32
openssl rand -hex 32
```
```powershell
# Windows (openssl usually absent)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy `.env.example` and fill them in. **Two locations matter:**

- The **agent** + `scripts/deploy.sh` read the **root** `.env.local`.
- `next dev` only loads `.env.local` from **its own dir** (`frontend/.env.local`).

So for local dev you need the env in `frontend/.env.local` (the root copy alone
is invisible to `next dev`):

```bash
# Linux / macOS — root copy for the agent, plus a copy Next can see
cp .env.example .env.local            # then edit secrets
cp .env.local   frontend/.env.local
```
```powershell
# Windows
Copy-Item .env.example .env.local     # then edit secrets
Copy-Item .env.local   frontend\.env.local
```

For local use set the public URL to localhost and pick local ports:

```
NEXT_PUBLIC_APP_URL=http://localhost:4000
NEXT_PUBLIC_APP_HOST=localhost
CONTROL_ROOM_PORT=4000
AGENT_HEALTH_PORT=4001
CONTROL_ROOM_HOST=localhost
```

(Optional, Windows/macOS) override the spawned terminal shell + start dir:

```
SHELL=powershell.exe
TERMINAL_DEFAULT_CWD=C:\Users\<you>\projects
```

### L.3 Run both processes

```bash
bun run --cwd agent dev           # pty gateway + telemetry on :4001 (runs on Node via tsx)
bun run --cwd frontend dev        # dashboard on :4000
```

Open `http://localhost:4000`, paste `CONTROL_ROOM_SECRET`, then approve the
device per [Phase 6.5](#phase-65--approve-your-device-first-login-always-lands-in-pending).

> **Dev "new version" toast won't go away?** The dev build id changes on every
> restart. Pin it to stop the reload prompt churning:
> `NEXT_PUBLIC_BUILD_ID=unknown` (set it before `bun run dev`).

---

## Phase 7 — Verify

### 7.1 Services up

```bash
ssh user@<vps-ip> 'systemctl is-active vps-control-room-agent vps-control-room-frontend'
# expect: active
#         active
```

### 7.2 Health endpoint

```bash
ssh user@<vps-ip> 'curl -s http://127.0.0.1:4001/health'
# expect: {"ok":true,...}
```

### 7.3 Browser login (from your laptop / phone)

1. Open `https://control-room.<tailnet>.ts.net` (or your custom domain).
2. Paste `CONTROL_ROOM_SECRET` from your password manager.
3. Spawn a terminal, type `whoami`, expect your VPS user.

### 7.4 Install as a PWA

On iOS Safari → Share → **Add to Home Screen**.
On Android Chrome → ⋮ → **Install app**.

You now have a fullscreen control panel for your VPS that lives on your
home screen. 🎉

---

## API endpoints reference (for AI / automation)

The AI prompt embeds this catalog, but here it is for direct reference:

### Tailscale
- Docs: https://tailscale.com/api
- Auth: `Bearer ${TAILSCALE_API_KEY}`
- Create auth key: `POST https://api.tailscale.com/api/v2/tailnet/-/keys`
- List devices: `GET https://api.tailscale.com/api/v2/tailnet/-/devices`

### Hostinger
- Docs: https://developers.hostinger.com/
- Auth: `Bearer ${HOSTINGER_API_TOKEN}`
- List VPS: `GET /api/vps/v1/virtual-machines`
- Create DNS record: `POST /api/dns/v1/zones/{domain}/records`

### Dokploy (if you're using Dokploy in front)
- Auth: `x-api-key: ${DOKPLOY_API_KEY}`
- App create: `POST ${DOKPLOY_API_URL}/api/application.create`
- App deploy: `POST ${DOKPLOY_API_URL}/api/application.deploy`
- Domain create: `POST ${DOKPLOY_API_URL}/api/domain.create`

### GitHub
- Docs: https://docs.github.com/rest
- Auth: `Bearer ${GITHUB_TOKEN}`
- Create repo: `POST https://api.github.com/user/repos`
- Create deploy key: `POST https://api.github.com/repos/{owner}/{repo}/keys`

---

## Skill anchor — `/sc-all`

If you have the `sc-all` skill installed at `~/.claude/skills/sc-all/`
(or equivalent for Codex / Gemini), the AI prompt auto-loads it.
`/sc-all` orchestrates:

- GitHub repo ensure (private fork) + push
- Dokploy project + application creation
- Self-hosted Convex deploy (skipped for control-room — terminal-only)
- DNS record creation
- Deploy poll until done

For control-room, `/sc-all` skips Convex but reuses the GitHub + Dokploy
+ DNS phases. The control-room one-line installer also reuses this
sequencing.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `ssh: connection refused` | VPS firewall blocking port 22 | Open port 22 in provider firewall |
| `tailscale up` hangs | Auth key expired | Regenerate at admin.tailscale.com |
| `dig` returns nothing | DNS not propagated | Wait 5 min, try `+trace` |
| Login page returns "invalid" | Secret mismatch | Re-check `.env.local` on the VPS |
| Right password still won't log in | Device not approved (lands in `pending`) | `node scripts/approve-device.js --list` then approve — [Phase 6.5](#phase-65--approve-your-device-first-login-always-lands-in-pending) |
| Login bounces to `/login` on fresh install | `next` drifted off the pinned patch → node-runtime middleware gated off | Keep the exact pin in `frontend/package.json`; reinstall |
| `next dev` ignores your secrets locally | env only at root, not `frontend/.env.local` | Copy env into `frontend/.env.local` too ([Phase L.2](#l2-secrets--env)) |
| Terminal pane won't open on Windows/macOS | Shell defaults assume Linux | Set `SHELL` + `TERMINAL_DEFAULT_CWD` env vars |
| White dashboard after deploy | Build failed silently | `journalctl -u vps-control-room-frontend` |
| `systemctl` shows `failed` | Wrong WorkingDirectory | Re-run `scripts/install-systemd.sh` |

More in [runbook.md](./runbook.md) and [ONBOARDING.md](./ONBOARDING.md).

---

## Next steps

- Read [../SECURITY.md](../SECURITY.md) to understand the threat model.
- Read [../CONTRIBUTING.md](../CONTRIBUTING.md) if you want to send PRs.
- Read [runbook.md](./runbook.md) for incident playbooks.
