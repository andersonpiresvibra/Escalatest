const CACHE_NAME = 'escala-easy-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Fall back to network
        return response || fetch(event.request).catch(() => {
            return caches.match('/index.html');
        });
      })
  );
});
