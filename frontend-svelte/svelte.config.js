import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Node adapter: this app runs behind systemd, same as the Next.js build it
    // replaces — no serverless/edge target. See docs/media + README-MIGRATION.md
    // for why (frontend proxies to a loopback-bound agent over HTTP, and the
    // browser talks to /api/terminals/[id]/stream over plain SSE — no custom
    // WebSocket server needed on this side, so the stock adapter-node output
    // (`build/handler.js` via `build/index.js`) is used unmodified).
    adapter: adapter({
      out: 'build'
    }),
    alias: {
      $lib: 'src/lib'
    }
  }
};

export default config;
