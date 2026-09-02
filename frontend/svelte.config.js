import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

import { resolveBuildId } from './build-id.mjs';

const BUILD_ID = resolveBuildId();

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      out: 'build'
    }),
    alias: {
      $lib: 'src/lib'
    },
    // SvelteKit generates nonces/hashes for its own inline bootstrap code. Keep
    // this at the framework layer so route output and future prerendered pages
    // cannot accidentally drift from the production CSP.
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        // xterm/Svelte transitions can create inline style nodes at runtime.
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'blob:'],
        'font-src': ['self', 'data:'],
        'connect-src': ['self'],
        'worker-src': ['self', 'blob:'],
        'manifest-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'frame-ancestors': ['none'],
        'upgrade-insecure-requests': true
      }
    },
    version: {
      name: BUILD_ID,
      pollInterval: 5 * 60 * 1000
    }
  }
};

export default config;
