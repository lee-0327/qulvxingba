'use strict';

const assets = [
  {
    "path": "./",
    "sha256": "babb365b1b4db69a719dd15479e55a92e966490db45fab67b07506efaf1e5df9",
    "type": "text/html; charset=utf-8"
  },
  {
    "path": "manifest.webmanifest",
    "sha256": "628834e2805142e94fa7ba1b0a0ae74fbe0a6ce2310f5b1614307941591e25b5",
    "type": "application/manifest+json"
  },
  {
    "path": "register-offline.js",
    "sha256": "5ceaf7f9897b61d100237e344eca93b53d765057c1fc48448404ff36d1bf79ed",
    "type": "text/javascript; charset=utf-8"
  },
  {
    "path": "icon-180.png",
    "sha256": "4c9bd7e0f08c52fd5886a8f94073f6b0fdfaf68fb2d27e19d64ae77c201ce974",
    "type": "image/png",
    "required": false
  },
  {
    "path": "icon-192.png",
    "sha256": "f14e9233b0a5fd742e542134faf735d7a7054907816710a2cb8408acd4536764",
    "type": "image/png",
    "required": false
  },
  {
    "path": "icon-512.png",
    "sha256": "2c35d0a3baa054d5bcc6e5b2b2501cb6061de362825bbe83e706b80f71c851fb",
    "type": "image/png",
    "required": false
  },
  {
    "path": "assets/trip-cover.5a04429b4f93.webp",
    "type": "image/webp",
    "required": false,
    "sha256": "5a04429b4f93c15e73822b19595318ffd51d2cdbe57e3f5ccf71482d036a44d8"
  },
  {
    "path": "assets/ai-cat.3a8681517f8b.webp",
    "type": "image/webp",
    "required": false,
    "sha256": "3a8681517f8bf554b26981372d4359abcaa9d3b913382bc4dfdd6e5c325613b5"
  }
];
const scope = self.registration.scope;
const indexUrl = new URL('index.html', scope).href;
const staticFiles = new Map(assets.slice(1).map(asset => [new URL(asset.path, scope).href, asset]));
const cachePrefix = `go-travel-shell:${scope}:`;
const cacheName = `${cachePrefix}d456e125ba02d6ae`;

async function readAsset(asset, cacheMode) {
  const url = new URL(asset.path, scope).href;
  const response = await fetch(url, { credentials: 'same-origin', redirect: 'error', cache: cacheMode });
  if (response.status !== 200 || response.url !== url) throw new Error('Static asset unavailable.');
  const contents = await response.arrayBuffer();
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', contents));
  const hash = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== asset.sha256) return null;

  // Save only verified build bytes. Response headers from the hosting gateway are excluded.
  return [url, new Response(contents, { headers: {
    'Content-Type': asset.type,
    'X-Content-Type-Options': 'nosniff',
  } })];
}

async function verifiedAsset(asset) {
  // Reuse the just-loaded HTTP response when it has the expected bytes.
  const cached = await readAsset(asset, 'default');
  if (cached) return cached;
  const fresh = await readAsset(asset, 'no-store');
  if (!fresh) throw new Error('Unexpected content for static asset.');
  return fresh;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const required = assets.filter(asset => asset.required !== false);
    const files = await Promise.all(required.map(verifiedAsset));
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

async function findCached(url) {
  try { return await caches.match(url, { cacheName }); }
  catch { return undefined; }
}

async function navigation(request, fresh) {
  const cached = await findCached(scope);
  if (!fresh) return cached || fetch(request);

  // Explicit updates can bypass the warmed document without leaving a stalled navigation.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(request, { cache: 'no-store', signal: controller.signal });
    if (!response.ok && cached) return cached;
    await response.clone().arrayBuffer();
    return response;
  } catch (error) {
    if (cached) return cached;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function serveStatic(request, asset) {
  const cached = await findCached(request.url);
  if (cached) return cached;
  const [url, response] = await verifiedAsset(asset);
  try {
    const cache = await caches.open(cacheName);
    await cache.put(url, response.clone());
  } catch { /* The resource can still be displayed if storage is full. */ }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    const url = new URL(request.url);
    const fresh = /^[1-9]\d*$/.test(url.searchParams.get('trip-update') || '');
    url.search = '';
    url.hash = '';
    if (url.href === scope || url.href === indexUrl) event.respondWith(navigation(request, fresh));
  } else if (staticFiles.has(request.url)) {
    event.respondWith(serveStatic(request, staticFiles.get(request.url)));
  }
});
