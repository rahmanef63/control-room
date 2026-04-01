import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Monorepo root so Next.js file-tracing resolves shared packages correctly
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  poweredByHeader: false,
  compress: true,

  async headers() {
    return [
      {
        // HTML pages — always revalidate with the origin so the browser never
        // serves stale HTML containing dead chunk hashes after a redeploy.
        // `no-cache` (unlike `no-store`) still allows bfcache and conditional
        // requests (304), which is critical for mobile back/forward navigation.
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache',
          },
        ],
      },
      {
        // Next.js content-hashed static assets are immutable — safe to cache forever.
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Service worker must always be revalidated so updates are detected promptly.
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
