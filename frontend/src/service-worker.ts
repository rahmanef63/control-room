/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

const worker = globalThis.self as unknown as ServiceWorkerGlobalScope;
const CACHE_NAME = `vps-control-room-v${version}`;
const STATIC_CACHE = `vps-static-v${version}`;
const OWN_CACHE_PREFIXES = ['vps-control-room-v', 'vps-static-v'];
const OFFLINE_URL = '/offline.html';
const BUILD_ASSETS = new Set(build);
const STATIC_FILES = new Set(files);

const NO_CACHE_PATTERNS = [/^\/api\//];

async function addIndependently(cacheName: string, urls: string[]): Promise<void> {
  const cache = await caches.open(cacheName);
  await Promise.allSettled(
    urls.map((url) =>
      cache.add(url).catch(() => {
        // A transient mobile network miss must not block SW installation.
      })
    )
  );
}

worker.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([addIndependently(STATIC_CACHE, build), addIndependently(CACHE_NAME, files)]).then(() =>
      worker.skipWaiting()
    )
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                OWN_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
                key !== CACHE_NAME &&
                key !== STATIC_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => worker.clients.claim())
  );
});

worker.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void worker.skipWaiting();
});

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== worker.location.origin) return;
  if (NO_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))) return;

  // Never cache HTML. A fresh document prevents stale chunk references after a
  // deploy; offline mode falls back to the static offline shell only.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error())
    );
    return;
  }

  // SvelteKit content-hashed build assets are immutable and safe cache-first.
  if (BUILD_ASSETS.has(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Files from static/ are small app-shell assets. Use stale-while-revalidate;
  // each new deployment gets a new cache namespace from `$service-worker.version`.
  if (STATIC_FILES.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then(async (response) => {
            if (response.ok) await cache.put(request, response.clone());
            return response;
          })
          .catch(() => undefined);
        return cached ?? (await network) ?? new Response('', { status: 503 });
      })
    );
  }
});
