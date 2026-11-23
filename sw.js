'use strict';

const assets = [
  {
    "path": "./",
    "sha256": "f06f42f69a3dbc8c05395257ec2088ea2c2946e7d64bb337155174fbdc5c3ee4",
    "type": "text/html; charset=utf-8"
  },
  {
    "path": "manifest.webmanifest",
    "sha256": "628834e2805142e94fa7ba1b0a0ae74fbe0a6ce2310f5b1614307941591e25b5",
    "type": "application/manifest+json"
  },
  {
    "path": "register-offline.js",
    "sha256": "0738476f6ec7c4b19d3457c03fb513590c877c8e618a3c5f2e1157e5ad1f0eab",
    "type": "text/javascript; charset=utf-8"
  },
  {
    "path": "icon-180.png",
    "sha256": "4c9bd7e0f08c52fd5886a8f94073f6b0fdfaf68fb2d27e19d64ae77c201ce974",
    "type": "image/png"
  },
  {
    "path": "icon-192.png",
    "sha256": "f14e9233b0a5fd742e542134faf735d7a7054907816710a2cb8408acd4536764",
    "type": "image/png"
  },
  {
    "path": "icon-512.png",
    "sha256": "2c35d0a3baa054d5bcc6e5b2b2501cb6061de362825bbe83e706b80f71c851fb",
    "type": "image/png"
  }
];
const scope = self.registration.scope;
const indexUrl = new URL('index.html', scope).href;
const staticUrls = new Set(assets.slice(1).map(({ path }) => new URL(path, scope).href));
const cachePrefix = `go-travel-shell:${scope}:`;
const cacheName = `${cachePrefix}f7ef0a5131aabb79`;

async function verifiedAsset(asset) {
  const url = new URL(asset.path, scope).href;
  const response = await fetch(url, { credentials: 'same-origin', redirect: 'error', cache: 'no-store' });
  if (response.status !== 200 || response.url !== url) throw new Error('Static asset unavailable.');
  const contents = await response.arrayBuffer();
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', contents));
  const hash = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== asset.sha256) throw new Error('Unexpected content for static asset.');

  // Save only verified build bytes. Response headers from the hosting gateway are excluded.
  return [url, new Response(contents, { headers: {
    'Content-Type': asset.type,
    'X-Content-Type-Options': 'nosniff',
  } })];
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const files = await Promise.all(assets.map(verifiedAsset));
    const cache = await caches.open(cacheName);
    await Promise.all(files.map(([url, response]) => cache.put(url, response)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(cachePrefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function fetchWithOfflineFallback(request, cacheKey) {
  try {
    // HTTP errors and redirects must reach the browser, including the host login flow.
    return await fetch(request, { cache: 'no-store' });
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate' && (request.url === scope || request.url === indexUrl)) {
    event.respondWith(fetchWithOfflineFallback(request, scope));
  } else if (staticUrls.has(request.url)) {
    event.respondWith(fetchWithOfflineFallback(request, request.url));
  }
});
