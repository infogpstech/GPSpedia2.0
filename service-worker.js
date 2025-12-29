// ============================================================================
// GPSPEDIA SERVICE WORKER V2 (STABLE CACHING)
// ============================================================================
// COMPONENT VERSION: 2.0.0

const CACHE_NAME = 'gpsepedia-cache-v7'; // <-- Incremented to force update
const API_ENDPOINT = 'https://script.google.com/macros/s/';

// Pre-cache the main application shell files for offline capabilities.
const urlsToCache = [
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

// On install, pre-cache the application shell.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching application shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Install complete, activating immediately.');
        return self.skipWaiting(); // Force the new service worker to become active.
      })
  );
});

// On activation, clean up old caches.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activated and claimed clients.');
      return self.clients.claim(); // Take control of all open pages.
    })
  );
});

// On fetch, apply the correct caching strategy.
self.addEventListener('fetch', event => {
  const requestUrl = event.request.url;

  // *** CRITICAL FIX ***
  // If the request is for our API, ALWAYS fetch from the network.
  // NEVER cache API responses. This is essential for authentication to work.
  if (requestUrl.startsWith(API_ENDPOINT)) {
    event.respondWith(fetch(event.request));
    return; // Do not proceed further.
  }

  // For all other requests (static assets), use a "network falling back to cache" strategy.
  // This ensures the app is fast and works offline, but always tries for the freshest assets first.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If we get a valid response from the network, update the cache for future offline use.
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // If the network request fails (e.g., offline), serve the matched asset from the cache.
        console.log(`[Service Worker] Network failed for ${requestUrl}, serving from cache.`);
        return caches.match(event.request);
      })
  );
});
