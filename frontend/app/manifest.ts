import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'VPS Control Room',
    short_name: 'Control Room',
    description: 'Live VPS operations cockpit for apps, agents, terminals, and security.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#08111f',
    theme_color: '#111821',
    categories: ['utilities', 'productivity', 'developer'],
    dir: 'ltr',
    lang: 'en',
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
    shortcuts: [
      {
        name: 'Terminals',
        short_name: 'Terminals',
        description: 'Open terminal sessions',
        url: '/terminals',
      },
      {
        name: 'Apps',
        short_name: 'Apps',
        description: 'Manage apps and services',
        url: '/apps',
      },
      {
        name: 'Security',
        short_name: 'Security',
        description: 'Security dashboard',
        url: '/security',
      },
    ],
  };
}
