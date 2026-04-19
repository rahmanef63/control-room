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
        name: 'New terminal',
        short_name: 'New',
        description: 'Open the terminal workspace',
        url: '/',
      },
    ],
  };
}
