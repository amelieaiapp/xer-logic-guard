const CACHE = "xer-logic-guard-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/encoding.js",
  "./js/xer-parser.js",
  "./js/detection.js",
  "./js/app.js",
  "./js/xlsx.bundle.js",
  "./js/jszip.min.js",
  "./manifest.json",
  "./assets/logo-banner.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];
// Best-effort offline cache for the Excel + zip libraries. For a GUARANTEED offline build,
// download these two files into ./js/ and reference them locally instead of the CDN.
// Local vendor copies (present => guaranteed offline) with CDN as best-effort fallback.
const BEST_EFFORT = [
  "./js/xlsx.bundle.js",
  "./js/jszip.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(ASSETS).then(() =>
        Promise.all(BEST_EFFORT.map(u => cache.add(u).catch(() => {})))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
