import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

import { resolveBuildId } from './build-id.mjs';

const BUILD_ID = resolveBuildId();

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Node adapter: this app runs behind systemd, same as the Next.js build it
    // replaces. Browser terminal streams remain SSE; the server is only a WS
    // client to the agent, so no custom upgrade server is needed.
    adapter: adapter({
      out: 'build'
    }),
    alias: {
      $lib: 'src/lib'
    },
    // SvelteKit's built-in version system is the SSOT for deployment identity.
    // `$app/environment.version`, `$service-worker.version` and
    // `/_app/version.json` all receive this exact deterministic value.
    version: {
      name: BUILD_ID,
      pollInterval: 5 * 60 * 1000
    }
  }
};

export default config;
