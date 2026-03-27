const CACHE_NAME = 'carbon-mastery-v1';
const CORE_ASSETS = ['index.html', 'manifest.json'];

// Install: cache core assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches, claim clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const path = url.pathname;

  // Video / PDF: network-only (too large to cache)
  if (/\.(mp4|webm|pdf)$/i.test(path)) {
    return; // default browser fetch
  }

  // Audio (mp3): stale-while-revalidate
  if (/\.mp3$/i.test(path)) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(resp => {
            if (resp.ok) cache.put(e.request, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Images / icons: cache-first
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(path)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }

  // JSON (with cache-bust) + HTML: network-first, fallback cache
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        // Strip cache-bust param for cache key
        const cacheReq = /[?&]_cb=/.test(e.request.url)
          ? new Request(e.request.url.replace(/[?&]_cb=\d+/, ''))
          : e.request;
        caches.open(CACHE_NAME).then(cache => cache.put(cacheReq, clone));
      }
      return resp;
    }).catch(() => {
      const cacheReq = /[?&]_cb=/.test(e.request.url)
        ? new Request(e.request.url.replace(/[?&]_cb=\d+/, ''))
        : e.request;
      return caches.match(cacheReq);
    })
  );
});
