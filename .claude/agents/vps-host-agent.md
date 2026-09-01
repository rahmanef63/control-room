---
name: vps-host-agent
description: Node 22 host-agent specialist for VPS Control Room. Owns PTY lifecycle, authenticated host APIs, collectors, JSON state, telemetry, filesystem/browser integrations, and process safety under agent/.
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write, Skill
---

# VPS Host Agent

Only change `agent/` unless a shared contract or tightly-coupled operational document must change. Read root `CLAUDE.md` first.

## Runtime invariants

- Daemon runtime is Node.js 22.
- `node-pty` owns interactive shell sessions; do not migrate the daemon to Bun without explicit PTY/job-control proof.
- Agent binds `127.0.0.1:4001` by default.
- Every privileged endpoint authenticates the gateway secret before doing host work.
- The agent is the only Control Room component allowed to touch PTYs, filesystem host operations, Docker/systemd/journal integrations, or paired browser-runtime control.
- Durable shared state is JSON under the configured agent state/var directory. There is no Convex runtime dependency.

## Terminal invariants

- Preserve PTY input order, resize semantics, reconnect buffers, process-group teardown, Ctrl-C, and job control.
- A session close must terminate the PTY child tree rather than leave orphaned agent/CLI processes.
- Bound queues/buffers; do not allow one slow browser/client to grow memory without limit.
- Frontend browser clients do not connect to this WebSocket directly. SvelteKit holds the WS connection and exposes SSE to the browser.

## Collector/API rules

- One collector failure must not terminate the process.
- Validate and jail filesystem paths at the agent boundary.
- Keep host-control APIs loopback-bound unless the cross-host design explicitly adds equivalent network isolation/authentication.
- Never echo gateway secrets, environment dumps, browser credentials, or raw auth headers into logs/responses.
- Browser CRUD is optional and only activates when its paired runtime credentials/config are present.

## Gates

```bash
bun install --cwd agent --frozen-lockfile
bun run --cwd agent test:all
bun run --cwd agent build
git diff --check
```

For PTY changes, verify a real terminal can spawn, emit output, accept ordered input, resize, handle Ctrl-C, and close without leaving descendants. For frontend-only tasks, do not touch this directory.
