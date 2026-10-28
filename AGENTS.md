# Control Room — Agent Instructions

Read [CLAUDE.md](./CLAUDE.md) before changing architecture or runtime behavior.

Product rule: Control Room is a browser/mobile (PWA) alternative to tmux. Keep changes centered on terminal sessions, panes, workspaces, reconnect behavior, mobile terminal UX, and thin conveniences around those capabilities.

Do not add provider/account management, credential stores for other tools, browser automation, schedulers, watcher/orchestration systems, managed-app platforms, or project-specific dependencies. A CLI running inside a terminal owns those concerns itself.

`frontend/` is the SvelteKit 2 / Svelte 5 frontend SSOT. `agent/` is the Node 22 PTY/host-agent SSOT. Developer memory/evidence lives under `.agent/` and must stay out of the product runtime.

## Runtime notes (current main)

- Each terminal pane is capped in its own cgroup (memory + pids). As of commit `a5b3c73` (2026-10-24), panes no longer inherit a single agent-wide cgroup; default per-pane `memory.max` is 8G, and close uses `cgroup.kill` so double-fork escapees are reaped. See `agent/src/terminal/cgroup.ts` and [CLAUDE.md](./CLAUDE.md) agent rules.
- Keep the product boundary terminal-first: do not expand into orchestration, credentials for other tools, or browser automation.
