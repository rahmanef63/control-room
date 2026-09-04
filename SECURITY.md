# Security Policy

**Current baseline: v2.0.0 terminal-first runtime.**

## Threat model

Control Room is a **single-owner administrative terminal surface**. The browser-facing SvelteKit application may be reachable over HTTPS, while the privileged Node agent must stay on loopback.

```text
Internet / optional private network
        │ HTTPS
        ▼
reverse proxy
        │ :4000
        ▼
unprivileged SvelteKit frontend
        │ machine secret
        ▼
127.0.0.1:4001
privileged terminal agent
        │
        ▼
PTY / bounded filesystem / host telemetry
```

In scope:

- login/session/device-approval bypass;
- cross-site scripting, framing, browser-origin attacks, and secret leakage;
- reaching the privileged agent without the machine gateway secret;
- escalating a frontend compromise into host privileges;
- unsafe terminal/file boundaries and resource exhaustion from network input;
- deployment or rollback behavior that can leave frontend and agent inconsistent.

Operator-controlled risks:

- an authenticated owner intentionally executing destructive shell commands;
- physical/root access to the host;
- behavior of third-party CLIs intentionally launched inside a terminal.

## Product security boundary

Control Room does not own credentials for tools running inside terminal panes. Do not add provider tokens, OAuth stores, browser-automation secrets, or project-specific credentials to Control Room runtime state.

Interactive terminal shells must not inherit Control Room's own master auth secrets. The authenticated PTY is intentionally powerful; the perimeter is the security boundary, not a command allowlist.

Developer memory/evidence under `.agent/` may contain operational context, so canonical memory/recipe/receipt files are scanned for secret-like material by `bun run evidence:check`.

The public `/landing` route is presentation-only and must remain unable to read authenticated terminal state or call the privileged agent. It is prerendered with CSR disabled. Search metadata routes (`/robots.txt`, `/sitemap.xml`) are public; terminal APIs remain protected except the explicitly minimal auth/health/version endpoints.

## Production invariants

- Public reverse proxy routes only to frontend port 4000.
- Agent port 4001 binds `127.0.0.1` by default.
- Frontend runs without sudo/Docker privileges.
- Runtime code lives under `/srv/control-room/`; mutable state lives under `/var/lib/control-room/`.
- Runtime env is root-owned mode `0600`.
- Browser sessions are signed with `CONTROL_ROOM_SESSION_SECRET`, use `HttpOnly`, `Secure` in production, and `SameSite=Strict`.
- Frontend→agent requests use `AGENT_GATEWAY_SECRET` when configured.
- CSP, HSTS, anti-framing, MIME-sniffing, referrer, permissions, and opener headers are set by the frontend server.
- Deployment is verified before a release is considered known-good; rollback material remains available.

## Repository security automation

- `.github/workflows/verify.yml` runs the repository verification gate.
- `.github/workflows/security.yml` runs the configured secret/code security checks.
- Dependabot watches the frontend, agent, and GitHub Actions dependencies.
- Third-party GitHub Actions are pinned to immutable commit SHAs where configured.
- Sensitive runtime/workflow files are covered by CODEOWNERS.

## Operator checklist

- [ ] `CONTROL_ROOM_SECRET` and `CONTROL_ROOM_SESSION_SECRET` are different high-entropy values.
- [ ] Prefer a separate `AGENT_GATEWAY_SECRET`.
- [ ] `/etc/control-room/control-room.env` is root-owned mode `0600`.
- [ ] Port 4001 is only listening on `127.0.0.1`.
- [ ] The public proxy has no route to port 4001.
- [ ] The frontend service user has no sudo or Docker-group privileges.
- [ ] `bun run verify` passes before deployment.
- [ ] A known-good previous frontend/agent release exists for rollback.

## Secret rotation

If a Control Room secret may be compromised:

1. Generate replacement high-entropy values.
2. Update the canonical deployment environment.
3. Redeploy/restart the affected trust tiers.
4. Revoke unfamiliar approved devices.
5. Review service and agent logs for the exposure window.

Credentials belonging to CLIs or external tools are outside Control Room's ownership and should be rotated at their own source when needed.

## Reporting a vulnerability

Do not publish exploit details in a normal issue. Use the repository's private security-reporting channel / GitHub Security Advisory and include the affected commit, reproduction, impact, and suggested remediation if known.
