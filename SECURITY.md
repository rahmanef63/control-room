# Security Policy

## Threat model

VPS Control Room is designed for **one operator on a private network**.
Threats explicitly **in scope**:

- Compromise of the shared secret leading to host RCE.
- Bypass of the shell allowlist via crafted input.
- Session-cookie forgery without the session secret.
- Privilege escalation from the dashboard's Node process to root.

Threats explicitly **out of scope** (these are operator responsibility):

- Public-internet exposure of the dashboard (don't do that).
- A malicious operator with the secret. The threat model assumes
  the secret holder is trusted.
- Supply-chain attacks on npm dependencies. We pin versions; you audit.
- Physical access to the VPS.

---

## Reporting a vulnerability

**Do NOT open a public GitHub issue for security bugs.**

Instead, open a [GitHub Security Advisory](https://github.com/) on the
repository (Security tab → Report a vulnerability). Include:

- Affected component (`frontend`, `agent`, `cli`)
- Affected version / commit SHA
- Reproduction steps or proof of concept
- Impact (RCE? info disclosure? session hijack?)
- Suggested fix (optional)

You'll get a response within **7 days**. If the issue is confirmed,
expect a fix within **30 days** for high-severity, longer for low.

If you don't get a response in 7 days, open a public issue saying only
"I reported a security issue 7+ days ago and am following up" — no
details.

---

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | ✅ Active |
| 1.x     | ❌ End of life |
| 0.x     | ❌ Never released publicly |

Patches go to `main` only. Pin to a commit SHA if you need stability.

---

## Hardening checklist (operators)

If you're self-hosting, run through this list before exposing the
service to anything beyond loopback:

- [ ] `CONTROL_ROOM_SECRET` is ≥ 32 hex chars from `openssl rand -hex 32`
- [ ] `CONTROL_ROOM_SESSION_SECRET` is **different** from the above
- [ ] `.env.local` permissions are `600` (`chmod 600 .env.local`)
- [ ] Traefik binds only to the Tailscale interface (not `0.0.0.0`)
- [ ] No `NEXT_PUBLIC_*` variable contains a secret
- [ ] systemd services run as a **non-root user**
- [ ] Docker socket access is intentional (`usermod -aG docker`)
- [ ] You have an out-of-band way to rotate secrets (password manager)
- [ ] No `.env*` file is tracked in git (`git ls-files | grep env`
      should only show `.env.example`)
- [ ] CI workflows are `workflow_dispatch:` only (no auto-deploy from PR)

---

## Secret rotation

If you suspect a leak:

1. Generate two fresh 32-char secrets: `openssl rand -hex 32` (×2).
2. Update `.env.local` on the VPS.
3. Restart both services:
   `sudo systemctl restart vps-control-room-{agent,frontend}`.
4. All active sessions invalidate — log back in with the new secret.
5. Audit `agent/var/log.json` for the leak window. Look for unexpected
   source IPs or unfamiliar commands.

---

## Terminal profile additions

Terminal launches go through `agent/src/terminal/profiles.ts`. Adding a
new profile (a new AI agent CLI, a new shell flavor) is a security-relevant
change because the profile decides what process pty-spawns under your VPS
user. To add one:

1. Open an issue first explaining what + why + worst-case-impact.
2. Wait for maintainer ack.
3. Send a PR that:
   - Sets `command` + `args` literally (no shell expansion).
   - Documents the new profile in `docs/runbook.md`.

---

## What we won't fix

- Vulnerabilities that require already-authenticated session cookie
  access. The threat model already considers session-cookie holders
  trusted.
- Resource exhaustion attacks (one operator can't DoS themselves).
- Timing attacks on the login endpoint — we already use constant-time
  HMAC compare. If you find a side-channel, do report it.

---

## Credits

We acknowledge security researchers in release notes (with permission).
Indicate in your report if you'd like attribution and what name to use.
