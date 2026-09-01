# Svelte Migration Status — Canonical Frontend

The frontend migration is complete at the framework/repository boundary: `frontend/` is the canonical SvelteKit 2 + Svelte 5 frontend and builds to adapter-node output for Bun.

## Canonical architecture

- One frontend SSOT: `frontend/`
- SvelteKit 2 + Svelte 5 runes
- adapter-node production output (`build/index.js`)
- Bun frontend runtime/package manager
- Node 22 + node-pty agent remains separate under `agent/`
- Browser terminal output uses SSE from SvelteKit; the frontend server bridges to the agent WebSocket
- Agent gateway credentials stay server-side
- Route/session protection is handled by `src/hooks.server.ts` plus route-level defense in depth for privileged proxy endpoints

## Completed parity relevant to framework removal

- Login/auth flow
- Terminal create/input/resize/SSE stream
- Workspace/grid/pane controls
- xterm refit behavior across mobile/fullscreen/keyboard/viewport changes
- safe-area handling for portrait, landscape, fullscreen, and home indicator
- history/templates/crons/patrol/settings/devices/files/overview routes
- read-only terminal view
- PWA version/update handling
- optional Browser CRUD UI + `/api/browser/crud`
- `/api/log` GET/DELETE proxy
- route-level error UX and pane-level error isolation

## Verification baseline

Before production switching, require:

```bash
bun run check
bun run test
bun run build
```

Then run the relevant browser regression, including real terminal output/input when terminal behavior changed. For layout changes, run narrow portrait, common phone widths, desktop/tablet, landscape, and simulated safe-area coverage.

## Non-blocking product polish

Framework canonicalization does not imply the UI can never be refined. Future work may still improve visual parity/polish, accessibility, orchestration-component size, dedicated error UX, or optional OS skins. Those improvements must stay within the canonical Svelte architecture rather than reintroducing a second frontend implementation.
