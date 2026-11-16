const CACHE = 'weekly-tally-v3';
const APP_URL = new URL('./Weekly%20Tally.html', self.registration.scope).href;
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
const MANIFEST_URL = new URL('./manifest.json', self.registration.scope).href;
const ICON_URL = new URL('./tally-icon.svg', self.registration.scope).href;

// The app's main stylesheet was accidentally left outside a <style> element,
// so browsers displayed the CSS as plain text. Repair that boundary at delivery.
async function repairAppStyles(response) {
  if (!response || !response.ok) return response;

  const html = await response.text();
  const repaired = html.replace(
    /<\/style>\s*(\/\* Layout:)/,
    '</style>\n<style>\n$1'
  );
  if (repaired === html) return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(repaired, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function getAppResponse() {
  const response = await fetch(APP_URL, { cache: 'no-store' });
  return repairAppStyles(response);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([INDEX_URL, MANIFEST_URL, ICON_URL]);
    const app = await getAppResponse();
    if (!app || !app.ok) throw new Error('Unable to cache the Weekly Tally app shell.');
    await cache.put(APP_URL, app);
    await self.skipWaiting();
  })());
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
        if (!response.ok) return response;

        const delivered = new URL(request.url).pathname === new URL(APP_URL).pathname
          ? await repairAppStyles(response)
          : response;
        await cache.put(request, delivered.clone());
        if (new URL(request.url).pathname === new URL(APP_URL).pathname) {
          await cache.put(APP_URL, delivered.clone());
        }
        return delivered;
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
