import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'VPS Terminals',
    short_name: 'VPS Terms',
    description: 'Mobile-first VPS terminal workspace with AI agent runners.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#08111f',
    theme_color: '#111821',
    categories: ['utilities', 'productivity', 'developer'],
    dir: 'ltr',
    lang: 'en',
    prefer_related_applications: false,
    // Focus/replace the running window instead of spawning a new one — desktop &
    // Android installed-app feel. (handle_links / edge_side_panel are valid PWA
    // manifest keys but not yet in Next's Manifest type, so they're added at the
    // served-manifest layer when needed.)
    launch_handler: { client_mode: 'navigate-existing' },
    icons: [
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-narrow.png',
        sizes: '430x900',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Mobile terminal workspace',
      },
      {
        src: '/screenshot-wide.png',
        sizes: '1440x900',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Desktop terminal workspace',
      },
    ],
    shortcuts: [
      {
        name: 'New terminal',
        short_name: 'New',
        description: 'Open the terminal workspace',
        url: '/',
      },
    ],
  };
}
