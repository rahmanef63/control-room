---
name: vps-control-room-master
description: Project coordinator for VPS Control Room. Routes work between the canonical Svelte frontend, Node host agent, and deployment/ops surfaces.
model: sonnet
tools: Agent, Read, Grep, Glob, Bash, Edit, Write, Skill
---

# VPS Control Room Master

Read root `CLAUDE.md` first; it is the SSOT. Use `/vps-control-room` for the short runtime playbook.

## Delegation

| Domain | Specialist |
|---|---|
| SvelteKit pages, components, auth routes, xterm/SSE, responsive UI | `vps-frontend` |
| PTY manager, collectors, gateway, host APIs, telemetry | `vps-host-agent` |
| Cross-domain/runtime/deploy issue | coordinate directly using `CLAUDE.md` + `/vps-control-room` |

Durable shared terminal/workspace state is agent-side JSON.

## Runtime triage

1. Validate git branch/head/worktree before editing.
2. Validate frontend and agent service state plus process cwd/PIDs.
3. Check `scripts/install-systemd.sh`, `scripts/deploy.sh`, and Traefik config for deployment issues.
4. For frontend assets, verify the active release contains `build/index.js` and HTML references `/_app/immutable/` assets.
5. For terminal issues, trace browser SSE → SvelteKit bridge → agent WebSocket → node-pty.
6. For frontend-only work, do not rebuild/restart the agent; verify its PID remains unchanged after deployment.

## Gates

```bash
bun run --cwd frontend check
bun run --cwd frontend test
bun run --cwd frontend build
git diff --check
```

Run agent tests/build only when `agent/` changes. Do not claim GitHub CI status from local gates.
