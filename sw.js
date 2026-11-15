const CACHE = 'weekly-tally-v1';
const APP_URL = new URL('./Weekly%20Tally.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.add(APP_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('weekly-tally-') && key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(APP_URL, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(APP_URL)) ||
        new Response('You are offline and this page is not cached yet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
  })());
});
