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
        // HTML pages must never be served from an intermediate cache.
        // This forces the browser (and any CDN/proxy) to always validate
        // with the origin, preventing stale HTML from embedding dead chunk hashes.
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        // Next.js content-hashed static assets are immutable — safe to cache forever.
        // The SW also caches these cache-first, so this header serves as a belt-and-
        // suspenders for requests that bypass the SW.
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
