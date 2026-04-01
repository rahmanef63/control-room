// Cache version is stamped automatically by scripts/deploy.sh using the git
// commit hash. Do NOT edit these lines manually — the deploy sed pattern
// matches `vps-control-room-v*` and `vps-static-v*` to replace them.
const CACHE_NAME = 'vps-control-room-v0';
const STATIC_CACHE = 'vps-static-v0';

const APP_SHELL = [
  '/manifest.webmanifest',
  '/favicon.ico',
  '/offline.html',
];

// Never cache these — mutations and live data must always hit the network
const NO_CACHE_PATTERNS = [
  /^\/api\//,
  /\/_convex\//,
  /\/convex\//,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Cache each resource independently so a single network failure
        // (common on mobile) does not block the entire SW install.
        Promise.allSettled(
          APP_SHELL.map((url) =>
            cache.add(url).catch(() => {
              /* non-critical — skip failed assets */
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Never cache API / Convex routes
  if (NO_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
    return;
  }

  // Never intercept Next.js RSC / App Router data payloads
  if (
    request.headers.has('RSC') ||
    request.headers.has('Next-Router-Prefetch') ||
    url.searchParams.has('_rsc')
  ) {
    return;
  }

  // Static Next.js assets — cache-first (immutable content-hashed filenames).
  // Safe because Next.js guarantees a new hash whenever content changes.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Next.js image optimization — network-first, cache fallback
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Navigation requests (HTML pages) — network-only with offline fallback.
  //
  // We intentionally do NOT cache HTML here. Next.js App Router pages
  // embed content-hashed chunk URLs at build time. If the browser were
  // served stale cached HTML after a redeploy, it would request old
  // (now-deleted) chunk hashes and receive 404s. Fetching HTML fresh
  // from the network on every navigation prevents this entirely.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached ?? (await caches.match('/offline.html'));
      })
    );
    return;
  }

  // Everything else — stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);
      return cached ?? (await networkFetch) ?? new Response('', { status: 503 });
    })
  );
});
