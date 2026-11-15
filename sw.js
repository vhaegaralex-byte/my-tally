const CACHE = 'weekly-tally-v2';
const APP_URL = new URL('./Weekly%20Tally.html', self.registration.scope).href;
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const MANIFEST_URL = new URL('./manifest.json', self.registration.scope).href;
const ICON_URL = new URL('./tally-icon.svg', self.registration.scope).href;
const SHELL_URLS = [APP_URL, INDEX_URL, MANIFEST_URL, ICON_URL];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('weekly-tally-') && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request, { ignoreSearch: true })) ||
          (await cache.match(APP_URL)) ||
          new Response('You are offline. Open Weekly Tally after reconnecting once to make it available offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
      }
    })());
    return;
  }

  // Keep the app shell and same-origin assets usable without a connection.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
