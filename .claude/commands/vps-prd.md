# VPS Control Room — PRD Quick Reference

Read root `PRD.md` for the complete spec. This file is only a compressed operational reference.

## Product

Single-owner mobile-first PWA for controlling one VPS through authenticated multi-pane terminals, AI-agent launchers, files, host telemetry, schedules/patrol, and operational utilities.

## Runtime

```text
browser
  -> SvelteKit 2 / Svelte 5 frontend on Bun (:4000)
       -> HTTP proxies for ordinary agent APIs
       -> SSE for browser terminal output
       -> server-side WebSocket bridge for the agent terminal stream
  -> Node 22 agent (:4001 loopback)
       -> node-pty + host integrations
       -> durable JSON state
```

No Convex layer is used on the Control Room runtime hot path.

## Frontend constraints

- Svelte 5 runes only.
- One `frontend/` SSOT.
- adapter-node production output.
- Mobile safe-area and one-column portrait behavior are product invariants.
- Gateway secrets remain server-side.

## Agent constraints

- Node 22 daemon remains mandatory for current node-pty semantics.
- Privileged endpoints require the gateway secret.
- Collectors fail independently.
- Frontend-only changes should not alter/restart the agent.

## Verification

Frontend: check → tests → build → browser/mobile smoke as relevant.
Agent: test:all → build when changed.
Deploy: immutable frontend release → health/auth/xterm verification → preserve rollback → confirm agent PID behavior.
