# Control Room — Canonical Agent Instructions

## Product boundary

Control Room is a **tmux-like terminal multiplexer with a browser/PWA UI**.

Core product scope:

- PTY lifecycle and reconnect;
- multiple terminal panes;
- workspaces;
- single/grid/fullscreen terminal views;
- mobile terminal UX and safe areas;
- rename/duplicate/move/focus/close;
- terminal history and restore;
- terminal templates;
- cwd/file-picker helpers;
- broadcast input;
- lightweight terminal/host status;
- optional CLI launch profiles and activity decoration.

Out of scope:

- provider/account or credential management;
- browser automation;
- cron/job orchestration;
- AI supervisory orchestration;
- managed application lifecycle platforms;
- project-specific runtime dependencies;
- deployment orchestration unrelated to deploying Control Room itself.

A CLI inside a pane manages its own auth, tools, browser work, deployments, and agent behavior.

## Architecture

```text
browser / PWA
  -> SvelteKit 2 + Svelte 5 frontend
       -> authenticated HTTP proxies
       -> terminal output to browser over SSE
       -> frontend server is the WebSocket client to the agent
  -> Node 22 host agent on loopback
       -> node-pty
       -> bounded host/file/state helpers required by terminal UX
```

The frontend never shells out directly and never exposes `AGENT_GATEWAY_SECRET` or `CONTROL_ROOM_SECRET` to browser JavaScript.

## Standalone rule

The repository must remain independently understandable and runnable. Do not add architecture, docs, configuration, imports, or runtime requirements that assume another internal repository exists.

Optional third-party CLI programs may be launched as normal terminal processes. Their existence is not a Control Room runtime dependency.

## Frontend rules

- SvelteKit 2 + Svelte 5 runes.
- Use `$props()`, `$state`, `$derived`, `$effect`, snippets, and rune-backed state modules.
- Do not introduce legacy `export let`, `$:`, `on:click`, legacy `<slot>`, or writable/readable store patterns in modified code.
- UI primitives: `frontend/src/lib/components/ui/`.
- Terminal features: `frontend/src/lib/features/terminals/`.
- Server-only helpers: `frontend/src/lib/server/`.
- Route APIs: `frontend/src/routes/api/**/+server.ts`.
- Preserve safe-area, mobile keyboard, fullscreen, viewport and xterm-fit behavior.
- Delete obsolete implementations; do not keep compatibility placeholder files.

## Agent rules

- Keep the privileged daemon on Node.js 22 unless PTY behavior is proven equivalent elsewhere.
- Every privileged endpoint requires the machine gateway secret.
- Agent binds loopback by default.
- PTY data, resize, Ctrl-C, process-group teardown and reconnect semantics are critical.
- Interactive shells must not inherit Control Room master auth secrets.
- Keep host APIs minimal and directly justified by terminal UX.

## Engineering workflow and memory

Use [docs/engineering-workflow.md](docs/engineering-workflow.md).

- Low-risk isolated UI/copy changes may go directly to main after targeted verification.
- High-risk shared/auth/runtime/deploy changes use a short-lived branch/worktree.
- For heavy/debug tasks, query relevant `.agent/memory/` first.
- Significant verification should produce an evidence receipt.
- Repeated reasoning workflows may become recipes; deterministic stable workflows may become scripts.
- Never store passwords, tokens, cookies, session secrets, or API keys in `.agent/`.

## Build and verification

```bash
bun install --cwd frontend --frozen-lockfile
bun install --cwd agent --frozen-lockfile
bun run verify
```

Focused gates:

```bash
bun run check
bun run lint
bun run test:coverage
bun run build
bun run test:e2e
```

UI changes require relevant browser/mobile verification, not only a successful compile.

## Deployment and rollback

`scripts/deploy.sh` is the deployment SSOT for Control Room itself.

- Deploy immutable frontend/agent releases.
- Switch through stable `current` symlinks.
- Preserve mutable state outside Git.
- Verify health before considering a release known-good.
- Restore the previous pair if a production switch fails.

Do not push, merge, rewrite remote history, or deploy unless the user explicitly requests it or the current task already includes that action.
