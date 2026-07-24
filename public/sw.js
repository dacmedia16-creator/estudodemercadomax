// Minimal service worker: just enough for installability + faster repeat
// loads of the fixed icon/manifest assets. It deliberately does NOT cache
// hashed JS/CSS bundles (those change every deploy and aren't known here)
// or SSR/auth-gated page navigations (this app has no real offline mode).
const CACHE_VERSION = "v1";
const CACHE_NAME = `edm-static-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/favicon-16.png",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !PRECACHE_URLS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
