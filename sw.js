// Pajama Workout — Service Worker (offline-first)
// APP_VERSION is defined in config.js — bump it there, not here.
importScripts("js/config.js");

const CACHE_NAME = "pajama-workout-v" + APP_VERSION;
const ASSETS = [
  ".",
  "index.html",
  "css/styles.css",
  "js/config.js",
  "js/history.js",
  "js/app.js",
  "manifest.json",
  "icons/icon-192.svg",
  "icons/icon-512.svg",
];

// Install: pre-cache all assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first, fall back to cache (so updates appear immediately)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
