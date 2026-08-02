import path from 'path';
import type { NextConfig } from 'next';

// Stable per-deploy build id. CI / deploy.sh sets COMMIT_SHA / GITHUB_SHA;
// fallback timestamp keeps dev unique. Exposed to the client as
// NEXT_PUBLIC_BUILD_ID so VersionGuard can compare and prompt reload.
const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  process.env.DOKPLOY_COMMIT_SHA ||
  `dev-${Date.now()}`;
process.env.NEXT_PUBLIC_BUILD_ID = BUILD_ID;

const nextConfig: NextConfig = {
  // Monorepo root so Next.js file-tracing resolves shared packages correctly
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  // Middleware runs on the Node.js runtime via `export const runtime = 'nodejs'`
  // in middleware.ts — stable since Next 15.5, so no experimental flag is
  // needed. (Earlier 15.2–15.4 required `experimental.nodeMiddleware`; on 15.5+
  // that key is gone from the config types and ignored at runtime.) Node runtime
  // is required so the node:crypto HMAC session verify works instead of bouncing
  // every authenticated request to /login on Edge.
  // Deploys stage a new build into a separate dist dir, then promote it to
  // `.next` only after the build succeeds. This keeps the live build intact
  // while mobile clients are still connected during rollout.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  compress: true,
  generateBuildId: async () => BUILD_ID,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },

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
