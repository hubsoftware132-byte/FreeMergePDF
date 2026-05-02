const CACHE_NAME = "flaviano-mergepdf-v4";
const APP_SHELL = [
  "./",
  "./mergepdf.html",
  "./mergepdf.js",
  "./privacy-policy.html",
  "./manifest.webmanifest",
  "./pdf-lib.min.js",
  "./pwa.js?v=20260502-1",
  "./donation-qr-only.png",
  "./brand-mark.svg",
  "./donation-qr.jpg",
  "./apple-touch-icon.png",
  "./favicon.ico",
  "./favicon-16.png",
  "./favicon-32.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

const STATIC_DESTINATIONS = new Set(["document", "script", "style", "image", "font", "manifest"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(event.request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, fresh.clone());
          return fresh;
        } catch (error) {
          return (
            (await caches.match(event.request)) ||
            (await caches.match("./mergepdf.html"))
          );
        }
      })()
    );
    return;
  }

  if (!isSameOrigin || !STATIC_DESTINATIONS.has(event.request.destination)) {
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) {
        return cached;
      }

      try {
        const fresh = await fetch(event.request);

        if (fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, fresh.clone());
        }

        return fresh;
      } catch (error) {
        if (event.request.destination === "image") {
          return caches.match("./icon-192.png");
        }

        throw error;
      }
    })()
  );
});
