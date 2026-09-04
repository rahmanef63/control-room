# Control Room — Product Requirements

**Current product baseline: v2.0.0 — terminal-first.**

## 1. Product definition

Control Room is a **web/mobile terminal multiplexer for a single host**. The closest mental model is tmux with a browser/PWA interface.

Its job is to make persistent terminal sessions easier to create, organize, reconnect to, and operate from desktop or mobile. It must not become a general operations platform.

## 2. Product principles

1. **Terminal first.** Every user-facing feature must directly improve terminal use.
2. **Standalone.** Core terminal workflows must work from this repository alone.
3. **Thin conveniences, not parallel platforms.** CLI launchers, activity detection, file picking, history, templates, and overview are helpers around the PTY.
4. **No credential ownership.** Tools running inside terminals manage their own credentials and accounts.
5. **No project-specific runtime coupling.** Control Room must not depend on another internal repository or service.
6. **Mobile is first-class.** Narrow screens, safe areas, soft keyboards, fullscreen, and reconnect behavior are product requirements.
7. **Engineering complexity stays behind the product.** Memory, evidence, testing, rollback, and recipes may be sophisticated internally while the UI remains simple.

## 3. Core user jobs

The operator must be able to:

- open a shell quickly;
- keep a command or CLI running after closing the browser;
- reconnect to an existing terminal session;
- create multiple panes;
- switch between single-pane and grid views;
- group sessions into workspaces;
- rename, duplicate, move, focus, resize, and close panes;
- broadcast input to selected panes;
- restore recently closed terminal context;
- launch a saved terminal template;
- choose a working directory without typing long paths;
- operate common terminal keys from a phone;
- see whether a terminal stream is connected;
- optionally see lightweight activity state for recognized long-running CLIs.

## 4. Non-goals

Control Room does not implement:

- provider/account stores;
- API-key or OAuth management for other tools;
- browser automation;
- cron/job orchestration dashboards;
- AI supervisory orchestration;
- managed application lifecycle platforms;
- database/application backends unrelated to terminal persistence;
- generic project deployment orchestration.

A tool may do any of those things **inside its terminal process**. Control Room does not need to understand them.

## 5. Runtime architecture

```text
browser / installed PWA
        │
        │ HTTPS + SSE
        ▼
SvelteKit frontend
        │
        │ authenticated loopback HTTP + WebSocket
        ▼
Node 22 host agent
        │
        │ node-pty
        ▼
terminal process
```

### 5.1 Frontend

- SvelteKit 2 + Svelte 5 runes; adapter-node production runtime on Node 22, with Bun as the package/test/build toolchain.
- Browser authentication and server-side proxying.
- Terminal workspace UI.
- SSE stream from frontend server to browser.
- PWA/safe-area/mobile behavior.

### 5.2 Host agent

- Node.js 22 because PTY semantics are critical.
- Loopback-bound privileged API by default.
- PTY create/input/resize/buffer/close operations.
- Minimal host telemetry required by the overview.
- Bounded filesystem operations required by directory/file UI.
- Local JSON state for durable terminal/workspace-related state.

### 5.3 State

Canonical durable state stays local to the host. UI-only preferences may use browser localStorage when cross-browser durability is not required.

## 6. Terminal model

A terminal session contains at least:

- stable session id;
- profile/command identity;
- title;
- cwd;
- process id;
- rows/columns;
- lifecycle status;
- created/updated timestamps;
- reconnect buffer.

The terminal process must survive ordinary browser disconnects. Closing a browser is equivalent to tmux detach, not process termination. The agent currently caps terminal records at 16 and evicts an exited record first, otherwise the most idle session, to bound resource use.

## 7. Workspace model

A workspace is a lightweight grouping of terminal sessions.

Required operations:

- create workspace;
- rename workspace;
- delete workspace safely;
- assign/move a terminal to another workspace;
- switch active workspace;
- preserve terminal sessions while switching UI context.

Workspaces must not become nested project-management objects.

## 8. Application chrome and responsive hierarchy

Global controls must preserve terminal area while keeping navigation predictable.

Desktop hierarchy:

1. compact application menu/status bar for discoverability and low-frequency commands;
2. horizontally scrollable workspace rail;
3. session rail plus frequent terminal toolbar;
4. terminal stage consuming the remaining viewport.

At medium desktop/tablet widths, toolbar text labels may collapse to icon-only controls when every control keeps an accessible name/title. Secondary utilities should move to menus instead of wrapping the toolbar.

Mobile hierarchy:

1. safe-area-aware context bar with current workspace/live-session context;
2. horizontal workspace rail;
3. horizontal session rail with only primary quick actions visible;
4. secondary terminal/app controls in a dismissible action sheet;
5. focused terminal stage below the chrome.

Global bars must never cause document-level horizontal overflow. Fullscreen terminal mode hides global chrome while retaining safe-area spacing.

### 8.1 Public portfolio surface

A public `/landing` route may explain the product for portfolio/sharing purposes, provided it stays isolated from the authenticated terminal runtime. It must not expose host state or gateway credentials. Prefer prerendered, zero-CSR output, no external runtime resources, semantic HTML, route-specific SEO metadata, structured data, and reduced-motion-safe CSS interactions. The authenticated terminal workspace and login page remain non-indexable.

## 9. Pane UX

Each pane should expose terminal-relevant actions only:

- rename;
- duplicate;
- move to workspace;
- focus/single view;
- fullscreen;
- font size / fit;
- optional color marker;
- optional CLI launcher/injection;
- file/directory tools;
- close.

On mobile, low-frequency actions may move into a compact action sheet/menu.

## 10. Optional CLI assistance

Runtime config may define convenient CLI profiles. A profile is only a command/cwd/environment launch description.

Recognized CLI activity may produce UI states such as `working`, `planning`, `asking`, or `done`, but the detection layer must not become a separate orchestration system.

## 11. History and templates

History exists to restore terminal context. Templates exist to recreate terminal launch configuration.

Neither system should grow into a scheduler, workflow engine, or deployment engine.

## 12. Mobile requirements

At minimum:

- one-column usable layout at narrow widths;
- no horizontal document overflow;
- safe-area padding for notches/home indicators;
- fullscreen behavior that retains safe spacing;
- soft-key controls for Tab, Escape, Ctrl-C, arrows and other terminal navigation needs;
- viewport/keyboard changes must refit the terminal;
- portrait and landscape must remain usable.

## 13. Security model

Control Room is a single-owner administrative terminal surface.

- Human login and browser session signing use separate secrets.
- Frontend→agent calls use a machine secret.
- The privileged agent stays loopback-bound by default.
- The frontend process remains unprivileged.
- Interactive terminal shells must not inherit Control Room's own master secrets.
- Arbitrary shell execution is expected inside an authenticated PTY; the perimeter is the primary security boundary.

## 14. Reliability

A change is not complete merely because it compiles.

Required verification is selected by scope and may include:

- type/lint checks;
- unit tests;
- production build;
- Playwright terminal lifecycle tests;
- responsive matrix;
- accessibility checks;
- console/page/network error detection;
- deployment health verification;
- evidence receipt for significant changes.

## 15. Engineering memory

Repository-local developer memory may store task, debug, test, decision, and failure records. It exists only to make future maintenance faster and more reliable.

It must never become a user-facing knowledge product or runtime dependency.

## 16. Definition of done

For relevant changes:

- repository remains standalone;
- no non-terminal product scope is introduced accidentally;
- Svelte check/lint pass;
- agent/frontend tests pass;
- build passes;
- relevant Playwright flows pass;
- mobile regression is checked for UI changes;
- no unexpected browser console/page/network errors remain;
- docs match the actual runtime;
- temporary artifacts are cleaned;
- known-good commit is identifiable.
