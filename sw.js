// 20260526004500
self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {});
