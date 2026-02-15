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
  "js/sync.js",
  "js/app.js",
  "manifest.json",
  "icons/icon-192.svg",
  "icons/icon-512.svg",
];

// Install: pre-cache all assets, then skip waiting
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches, then claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first, fall back to cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache OAuth callback URLs — strip ?code= from cache ops
  const isOAuthCallback = url.searchParams.has("code");

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && !isOAuthCallback) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // ignoreSearch: match "." or "index.html" even when URL has ?code=…
        caches.match(event.request, { ignoreSearch: true })
      )
  );
});
