// Service worker — Grand livre
// Stratégie : network-first pour les fichiers de l'application (toujours la
// dernière version quand il y a du réseau ; le cache ne sert que de secours
// hors-ligne), stale-while-revalidate pour les ressources externes (polices,
// Chart.js, SDK Firebase).

const CACHE_VERSION = 'grand-livre-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Ne jamais mettre en cache les échanges avec Firebase (données en temps réel).
  if (url.hostname.includes('firestore') || url.hostname.includes('firebaseio') || url.hostname.includes('googleapis')) {
    return;
  }

  if (sameOrigin) {
    // Network-first : on essaie toujours d'avoir la dernière version en ligne ;
    // le cache ne prend le relais que si le réseau est indisponible.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
  } else {
    // Stale-while-revalidate pour les ressources externes (polices, Chart.js)
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});