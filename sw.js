/* 記賬本 service worker — 離線快取（網絡優先，離線時回退快取） */
const V = 'jzb-v1.0.1';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.json',
  './js/data.js',
  './js/charts.js',
  './js/ui-core.js',
  './js/ui-add.js',
  './js/ui-list.js',
  './js/ui-stats.js',
  './js/ui-settle.js',
  './js/ui-settings.js',
  './js/sync.js',
  './js/boot.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 絕不介入 GitHub API 等跨域請求

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(V).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'offline' });
        })
      )
  );
});
