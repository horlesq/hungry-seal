// Offline support (registered by src/main.ts in production builds only). The game is static
// files, so:
// - the page itself: network first, so a new release shows up as soon as you're online;
// - everything else (hashed bundles, WebP art, fonts, icons): served from the cache and
//   refreshed in the background (stale-while-revalidate).
// Each release registers sw.js?v=<version>, which gets its own cache; older caches are deleted
// when the new worker takes over. The first visit loads before the worker is in control, so the
// page then sends the list of files it used (plus art loaded later, like skins and bosses) to be
// cached for offline play ('precache' message).
const VERSION = new URL(self.location.href).searchParams.get('v') ?? 'dev';
const CACHE = `hungry-seal-${VERSION}`;

self.addEventListener('install', (event) => {
  // Cache the page up front; the rest fills in as the game loads it.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['./', './index.html']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('hungry-seal-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'precache' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter(
    (u) => typeof u === 'string' && new URL(u, self.location.href).origin === self.location.origin,
  );
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        urls.map(async (u) => {
          if (await cache.match(u, { ignoreVary: true })) return;
          // One missing file mustn't stop the rest from being cached.
          await cache.add(u).catch(() => undefined);
        }),
      ),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true })),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // ignoreVary: module scripts send an Origin header the precache requests didn't.
      const cached = await cache.match(req, { ignoreVary: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached ?? fresh;
    }),
  );
});
