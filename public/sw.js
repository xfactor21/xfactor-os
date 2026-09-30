const SHELL_CACHE = 'xfactor-os-shell-v0.7.0-premium-1';
const RUNTIME_CACHE = 'xfactor-os-runtime-v0.7.0-premium-1';
const CORE = ['/', '/manifest.webmanifest', '/favicon.svg', '/pwa-icon-192.png', '/pwa-icon-512.png', '/pwa-icon-maskable-512.png', '/pwa-icon-192.svg', '/pwa-icon-512.svg', '/pwa-icon-maskable-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('xfactor-os-') && ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

const cacheable = (request, url) =>
  request.method === 'GET' &&
  url.origin === self.location.origin &&
  !url.pathname.startsWith('/api/') &&
  url.pathname !== '/sw.js' &&
  !/\.(?:wasm|zip)$/i.test(url.pathname);

const cacheResponse = async (cacheName, request, response) => {
  if (!response.ok) return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (!cacheable(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(SHELL_CACHE, '/', response))
        .catch(async () => (await caches.match('/')) || Response.error())
    );
    return;
  }

  const runtimeAsset =
    url.pathname.startsWith('/assets/') ||
    ['style', 'script', 'font', 'image'].includes(request.destination);
  if (!runtimeAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => cacheResponse(RUNTIME_CACHE, request, response))
        .catch(() => Response.error());
    })
  );
});
