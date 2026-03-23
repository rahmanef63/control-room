import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VPS Control Room',
    short_name: 'Control Room',
    description: 'Live VPS operations cockpit for apps, agents, terminals, and security.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08111f',
    theme_color: '#22d3ee',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
