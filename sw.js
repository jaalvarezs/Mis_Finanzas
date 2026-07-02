const CACHE_NAME = 'finanzas-cache-v28';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/api.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instala la nueva versión inmediatamente
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
});

// Borra la basura vieja (esto arreglará tu problema actual)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Las llamadas a Supabase (datos y autenticación) y a la librería externa
  // por CDN nunca se sirven desde caché — siempre deben ir a la red.
  if (event.request.url.includes('supabase.co') || event.request.url.includes('jsdelivr.net')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cachea en segundo plano recursos same-origin nuevos (p. ej. íconos agregados después)
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const copia = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copia));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
