// Keeps the app opening when signal is weak: app files come from cache when the network fails.
const CACHE = 'canvass-log-v36', TILES = 'canvass-log-tiles-v1', MAX_TILES = 1500;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'apple-touch-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Map tiles you've seen stay for offline use, oldest dropped first, so they can't fill the phone.
let trimming = false;
async function trimTiles() {
  if (trimming) return; trimming = true;
  try { const c = await caches.open(TILES), ks = await c.keys(); for (const k of ks.slice(0, Math.max(0, ks.length - MAX_TILES))) await c.delete(k); }
  finally { trimming = false; }
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Address and Census lookups go straight to the network: they change, and caching them only fills the phone.
  if (e.request.method !== 'GET' || /nominatim|photon|arcgis|census|zippopotam/.test(url.hostname)) return;
  const isTile = url.hostname.endsWith('tile.openstreetmap.org');
  e.respondWith(
    fetch(e.request).then(r => {
      // Opaque (no-CORS) answers count as megabytes each against the phone's storage, so only readable ones are kept.
      if (r.ok) { const copy = r.clone(); e.waitUntil(caches.open(isTile ? TILES : CACHE).then(c => c.put(e.request, copy)).then(() => isTile && trimTiles())); }
      return r;
    }).catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
