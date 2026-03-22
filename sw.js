// GymLog Service Worker — offline cache + PWA
const CACHE_NAME = 'gymlog-v2';

// Resursi koje cachiramo pri instalaciji
const PRECACHE = [
  '/moja-aplikacija/',
  '/moja-aplikacija/index.html',
  '/moja-aplikacija/icon-192.png',
  '/moja-aplikacija/icon-512.png',
  '/moja-aplikacija/apple-touch-icon.png',
  '/moja-aplikacija/manifest.json',
];

// Instaliraj service worker i cacchiraj ključne resurse
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Aktiviraj — obriši stare cacheve
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategija: Network First za Firebase, Cache First za statiku
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Nikad ne cachiramo Firebase pozive
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis')
  ) {
    return; // Neka ide normalno kroz mrežu
  }

  // Za fontove i CDN resurse — Cache First
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Za naše vlastite resurse — Network First, fallback na cache
  if (url.hostname === self.location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
