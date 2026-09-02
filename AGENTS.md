# Control Room — Agent Instructions

Read [CLAUDE.md](./CLAUDE.md) before changing architecture or runtime behavior.

Product rule: Control Room is a browser/mobile alternative to tmux. Keep changes centered on terminal sessions, panes, workspaces, reconnect behavior, mobile terminal UX, and thin conveniences around those capabilities.

Do not add provider/account management, credential stores for other tools, browser automation, schedulers, watcher/orchestration systems, managed-app platforms, or project-specific dependencies. A CLI running inside a terminal owns those concerns itself.

`frontend/` is the SvelteKit/Svelte 5 frontend SSOT. `agent/` is the Node 22 PTY/host-agent SSOT. Developer memory/evidence lives under `.agent/` and must stay out of the product runtime.
