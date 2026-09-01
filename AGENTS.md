# VPS Control Room — Agent Instructions

The coding-agent source of truth is **[CLAUDE.md](./CLAUDE.md)**. Read it before changing this repository.

Architecture summary: browser → SvelteKit frontend → authenticated agent boundary → host. Ordinary calls use server-side HTTP proxies; terminal output reaches the browser over SSE while the SvelteKit server is the WebSocket client to the Node 22 agent. There is no Convex layer on the runtime hot path.

Do not create parallel frontend implementations or compatibility placeholders. `frontend/` is the only frontend SSOT and uses SvelteKit 2 + Svelte 5 runes.
