/* Violão Descomplicado — service worker (um só, na raiz, cobre as 3 telas).
   Ao publicar mudanças nos arquivos, aumente VERSION para forçar a atualização do cache. */
const VERSION = 'v3';
const PREFIX = 'violao-descomplicado-';
const CACHE = PREFIX + VERSION;
const LEGACY = ['afinador-v1']; // cache do afinador antigo
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/base.css', './css/home.css', './js/pwa.js',
  './afinador/', './afinador/index.html',
  './metronomo/', './metronomo/index.html', './metronomo/metronomo.css', './metronomo/metronomo.js',
  './jornada/', './jornada/index.html', './jornada/jornada.css', './jornada/js/app.js', './jornada/js/acordes.js', './jornada/js/store.js',
  './dados/modulos.json',
  './dados/modulos/m01.json', './dados/modulos/m02.json', './dados/modulos/m03.json', './dados/modulos/m04.json', './dados/modulos/m05.json', './dados/modulos/m06.json', './dados/modulos/m07.json', './dados/modulos/m08.json', './dados/modulos/m09.json', './dados/modulos/m10.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async url => {
      const res = await fetch(new Request(url, { cache: 'reload' })); // ignora cache HTTP antigo
      if (!res.ok) throw new Error(url + ' ' + res.status);
      await cache.put(url, res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Só apaga caches deste projeto (o domínio github.io é compartilhado com outros repositórios).
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && (k.startsWith(PREFIX) || LEGACY.includes(k))).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Cache primeiro (abre na hora e offline) + atualização silenciosa em segundo plano.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.registration.scope)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') { const home = await cache.match('./index.html'); if (home) return home; }
    return Response.error();
  })());
});
