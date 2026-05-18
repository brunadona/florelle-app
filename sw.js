const CACHE = 'florelle-v8';  
  '/florelle-app/',
  '/florelle-app/index.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Skip non-GET and cross-origin requests (e.g. Google APIs, fonts)
  if (e.request.method !== 'GET') return;
  if (!url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cache successful same-origin responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(e.request)
          .then(cached => cached || caches.match('/florelle-app/'))
      )
  );
});
