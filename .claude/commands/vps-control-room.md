# VPS Control Room — Project Playbook

Gunakan skill ini untuk konteks project-level, deploy/redeploy, dan troubleshoot live runtime issues yang melibatkan frontend, agent, Traefik, firewall, atau static asset delivery.

## Invariants

- Repo root: auto-detected by `scripts/deploy.sh` (or set via `GITHUB_WORKSPACE`)
- Frontend: `<repo-root>/frontend`
- Agent: `<repo-root>/agent`
- Domain publik: configured via `CONTROL_ROOM_DOMAIN` env var / Traefik config
- Frontend runtime: Bun. The systemd unit's ExecStart is literally
  `bun --bun node_modules/.bin/next start --hostname 0.0.0.0 --port 4000` —
  it bypasses package.json on purpose so systemd gets an absolute bun path.
- Agent runtime: `node dist/index.js` — daemon stays on Node 22 even though the
  repo installs/builds with bun: node-pty delivers no data under Bun, so every
  terminal would be silently blank.
- Traefik routes domain traffic to host port `4000`
- UFW must allow Docker bridge traffic to `4000` and `4001`
- `favicon.ico` should be handled by `/icon` rewrite in middleware

## Use When

- Live site returns `504`, `404`, or missing `_next/static` assets.
- A restart works locally but not in production.
- You need the project-specific deploy sequence or service layout.
- You need a quick reminder of which file owns which runtime behavior.

## Fast Checks

```bash
curl -I http://127.0.0.1:4000/
curl -I http://127.0.0.1:4000/_next/static/chunks/app/login/page-998462684bab48f6.js
curl -I "https://${CONTROL_ROOM_DOMAIN:-<your-domain>}/"
sudo systemctl status vps-control-room-frontend
sudo journalctl -u vps-control-room-frontend -n 50 --no-pager
sudo ufw status verbose
```

## Common Fixes

### `/_next/static/*` 404

1. Confirm the frontend unit's ExecStart is `bun --bun node_modules/.bin/next start --hostname 0.0.0.0 --port 4000`, not a stale `npm run start` wrapper from before the bun migration.
2. Rebuild `frontend` and restart `vps-control-room-frontend`.
3. Re-check the exact chunk URL from the browser console.

### `504` on `/` or `/favicon.ico`

1. Confirm `127.0.0.1:4000` responds locally.
2. Confirm Traefik can reach the host through the Docker bridge.
3. Ensure UFW allows `docker0` inbound to `4000` and `4001`.

### Login page loads but assets are missing

1. Check `frontend/.next/static` exists.
2. Check the active systemd unit's ExecStart matches `bun --bun node_modules/.bin/next start --hostname 0.0.0.0 --port 4000` (regenerate with `sudo bash scripts/install-systemd.sh` if not).
3. Verify the browser is not replaying a stale service worker or cached HTML.

## Recommended Workflow

1. Read the relevant runtime file first: `scripts/install-systemd.sh`, `scripts/deploy.sh`, or `ops/traefik/vps-control-room.yml`.
2. Use the specialist agent for the owning domain.
3. Verify with `curl` before and after any restart.
4. Update the playbook if you discover a new live invariant.
