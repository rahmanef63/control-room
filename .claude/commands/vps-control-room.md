# VPS Control Room — Project Playbook

Use this command for project-level runtime/deploy troubleshooting. Root `CLAUDE.md` is the architecture SSOT; this file only adds a short operational checklist.

## Invariants

- Frontend: `<repo>/frontend` — SvelteKit 2 + Svelte 5, adapter-node on Bun.
- Agent: `<repo>/agent` — Node 22 + node-pty; host access stays here.
- Browser terminal output: SSE from SvelteKit; frontend server bridges to the agent WebSocket.
- Production frontend service: `vps-control-room-frontend.service`, port 4000.
- Production agent service: `vps-control-room-agent.service`, loopback port 4001.
- Frontend production entrypoint: `bun build/index.js` inside the selected immutable release.
- Public domain is supplied by `CONTROL_ROOM_DOMAIN`/Traefik; `ORIGIN` should match the public HTTPS origin.

## Fast checks

```bash
curl -fsS http://127.0.0.1:4000/api/health
curl -I http://127.0.0.1:4000/login
curl -fsS http://127.0.0.1:4001/health
systemctl status vps-control-room-frontend --no-pager
systemctl status vps-control-room-agent --no-pager
journalctl -u vps-control-room-frontend -n 50 --no-pager
```

For asset issues, inspect the current `/_app/immutable/` URLs and verify the active service process cwd points to a valid `frontend/releases/svelte-*` release containing `build/index.js`.

## Workflow

1. Inspect actual git/worktree/service state; never trust an old deployment note blindly.
2. Read the owning file (`scripts/deploy.sh`, `scripts/install-systemd.sh`, Traefik config, frontend route, or agent endpoint).
3. Make the smallest SSOT change; do not add compatibility frontend paths.
4. Run frontend check/tests/build and `git diff --check` before a frontend switch.
5. For UI changes, run real login/xterm/SSE and responsive smoke tests.
6. After a frontend-only deploy, verify the agent PID did not change.
7. Keep rollback material until the new release is verified.

Do not push, merge, rebase, or alter GitHub credentials unless the user explicitly asks.
