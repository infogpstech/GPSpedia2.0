// ============================================================================
// GPSPEDIA SERVICE WORKER V3 (MULTI-STRATEGY CACHING)
// ============================================================================
// COMPONENT VERSION: 3.0.0

const CACHE_NAME = 'gpsepedia-cache-v8'; // <-- Incremented to force update
const AUTH_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyp96RV2NtENye_bnT-LT-7h4R5rq7rjs8qOTlv4lrOg_2ozeNzpXfcthvUlvVktpQn/exec';
const API_PREFIX = 'https://script.google.com/macros/s/';

const STATIC_ASSETS = [
  '/',
  './index.html',
  './add_cortes.html',
  './users.html',
  './api-manager.js',
  './manifest.json',
  './icon-v3-192x192.png',
  './icon-v3-512x512.png',
  './icon-pwa-192x192.png',
  './icon-pwa-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // --- STRATEGY 1: AUTHENTICATION REQUESTS ---
  // Always go to the network. Never cache. This is critical for session handling.
  if (request.url === AUTH_ENDPOINT) {
    console.log('[SW] Handling auth request: Network only.');
    event.respondWith(fetch(request));
    return;
  }

  // --- STRATEGY 2: OTHER API REQUESTS (DATA) ---
  // Network falling back to Cache. Get fresh data if online, show stale if offline.
  if (request.url.startsWith(API_PREFIX)) {
    console.log('[SW] Handling data API request: Network falling back to Cache.');
    event.respondWith(
      fetch(request)
        .then(response => {
          // If the network request is successful, clone it, cache it, and return it.
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // If the network fails, try to get the response from the cache.
          console.log(`[SW] Network failed for ${request.url}, serving from cache.`);
          return caches.match(request);
        })
    );
    return;
  }

  // --- STRATEGY 3: STATIC ASSETS & NAVIGATION ---
  // Cache First, falling back to Network. Makes the app shell load instantly.
  console.log(`[SW] Handling static asset request: Cache first.`);
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // If not in cache, fetch from network and cache it for next time.
        return fetch(request).then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
  );
});
