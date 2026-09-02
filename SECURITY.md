# Security Policy

## Threat model

VPS Control Room is a **single-owner administrative shell**. The browser-facing
Svelte application may be reachable over HTTPS, so it is treated as an
internet-facing security boundary. The privileged Node agent is a separate
trust tier and must stay on loopback.

```text
Internet / optional Tailscale
        │ HTTPS
        ▼
     Traefik
        │ :4000
        ▼
control-room-web              no sudo, no Docker group, no login shell
   SvelteKit/Bun
        │ machine secret
        ▼
127.0.0.1:4001
   privileged agent           host PTY / Docker / systemd / filesystem
```

In scope:

- Login/session/device-approval bypass.
- Cross-site scripting, framing, browser-origin attacks, and secret leakage.
- Reaching the privileged agent without the machine gateway secret.
- Escalating a frontend compromise into host privileges.
- Unsafe terminal/file/managed-app boundaries and resource exhaustion caused by
  untrusted network input.
- Deployment or rollback behavior that can leave frontend and agent versions
  inconsistent.

Operator-controlled risks:

- An authenticated owner intentionally executing destructive shell commands.
- Physical/root access to the host.
- Third-party CLI behavior launched intentionally from a terminal profile.

The frontend is intentionally unprivileged; the agent is intentionally
privileged because the product is a host control surface. Do not merge those
trust tiers.

## Production invariants

- Public reverse proxy routes **only** to frontend port 4000.
- Agent port 4001 binds `127.0.0.1`; there is no public `/ws/terminals` router.
- Frontend runs as `control-room-web`, which must not have sudo or Docker access.
- Runtime code lives under `/srv/control-room/`; mutable state lives under
  `/var/lib/control-room/`; runtime env is `/etc/control-room/control-room.env`
  mode `0600` owned by root.
- Browser sessions are signed with `CONTROL_ROOM_SESSION_SECRET`, use
  `HttpOnly`, `Secure` in production, and `SameSite=Strict`, and are tied to an
  approved device. Revoking a device invalidates API access and closes an
  active terminal SSE stream on its next authorization heartbeat.
- Frontend-to-agent requests use `AGENT_GATEWAY_SECRET` (falling back to
  `CONTROL_ROOM_SECRET` only for backwards compatibility).
- CSP, HSTS, anti-framing, MIME sniffing, referrer, permissions, and opener
  headers are set by the Svelte server.
- CI Actions are pinned to immutable commit SHAs. Deployment is manual and
  environment-gated; PR code never auto-deploys.

Tailscale is recommended as an additional restriction when practical, but it is
not a substitute for the application security controls above.

## Operator checklist

- [ ] `CONTROL_ROOM_SECRET` and `CONTROL_ROOM_SESSION_SECRET` are independent high-entropy values.
- [ ] Prefer a separate `AGENT_GATEWAY_SECRET`.
- [ ] `/etc/control-room/control-room.env` is root-owned `0600`.
- [ ] `ss -ltnp` shows port 4001 only on `127.0.0.1`.
- [ ] Traefik has no backend/router for port 4001.
- [ ] `control-room-web` is not in `sudo` or `docker` groups.
- [ ] `systemd-analyze security vps-control-room-frontend.service` is reviewed after unit changes.
- [ ] `bun run verify` and `bun audit` pass before deployment.
- [ ] A known-good frontend and agent release exist under `/srv/control-room/*/releases`.
- [ ] Git commits and mutable state have an off-host recovery copy appropriate to your environment.

## Secret rotation

If a Control Room secret is suspected to be compromised:

1. Generate replacement secrets using a cryptographically secure password manager or `openssl rand -hex 32`.
2. Update the canonical source environment used for deployment.
3. Redeploy so `/etc/control-room/control-room.env` is regenerated and both trust tiers restart when required.
4. Revoke unfamiliar approved devices.
5. Review agent/deploy journals and `/var/lib/control-room/agent/log.json` for the exposure window.

External credentials that are not used by Control Room should not be injected
into its process environment. Removing a legacy key from this application is
separate from revoking that credential at its provider; rotate/revoke externally
only after confirming no other workload depends on it.

## Reporting a vulnerability

Do not publish exploit details in a normal issue. Use the repository's private
security-reporting channel / GitHub Security Advisory and include the affected
commit, reproduction, impact, and suggested remediation if known.
