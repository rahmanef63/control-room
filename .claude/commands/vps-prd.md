# Control Room — PRD Quick Reference

Read root `PRD.md` for the complete spec. This file is only a compressed operational reference.

## Product

Single-owner, mobile-first browser/PWA terminal multiplexer: persistent PTYs, panes, workspaces, reconnect, terminal history/templates, cwd helpers, broadcast input, mobile terminal controls, and lightweight terminal/host status.

A CLI launched in a pane owns its own authentication, deployment, browser work, tools, and agent behavior. Control Room does not orchestrate those concerns.

## Runtime

```text
browser / PWA
  -> SvelteKit 2 / Svelte 5 frontend (:4000, Node 22 production runtime)
       -> authenticated HTTP proxies
       -> SSE terminal output
       -> server-side WebSocket bridge to agent
  -> Node 22 agent (:4001 loopback)
       -> node-pty
       -> bounded file/state/telemetry helpers required by terminal UX
```

## Frontend constraints

- Svelte 5 runes only.
- One `frontend/` SSOT.
- adapter-node production output on Node 22; Bun is package/test/build tooling.
- Mobile safe-area and usable narrow-screen terminal behavior are product invariants.
- Gateway secrets remain server-side.

## Agent constraints

- Node 22 daemon remains mandatory for current node-pty semantics.
- Privileged endpoints require the gateway secret.
- Host APIs stay minimal and terminal-UX driven.
- Frontend-only changes should not alter/restart the agent.

## Verification

Frontend: check → tests → build → browser/mobile smoke as relevant.
Agent: test:all → build when changed.
Deploy: immutable release → health/auth/terminal verification → preserve rollback.
