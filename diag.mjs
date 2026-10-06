const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const HOUSE_TYPES = 'house|detached|residential|semidetached_house|terrace|bungalow|yes';
const ROAD_TYPES = 'residential|living_street|unclassified|tertiary|secondary|primary|service|road';
const q = (lat, lng, r) => `[out:json][timeout:25];(
      node["addr:housenumber"](around:${r},${lat},${lng});
      way["addr:housenumber"](around:${r},${lat},${lng});
      way["building"~"^(${HOUSE_TYPES})$"](around:${r},${lat},${lng});
      way["highway"~"^(${ROAD_TYPES})$"]["name"](around:${r + 150},${lat},${lng});
    );out tags geom;`;
const PLACES = { boulder: [40.015, -105.27], phoenix_suburb: [33.4255, -111.94], dallas_suburb: [33.0198, -96.6989] };
for (const [name, [lat, lng]] of Object.entries(PLACES)) for (const r of [250, 600]) for (const url of SERVERS) {
  const t = Date.now();
  try {
    // A browser preflight check first
    const pre = await fetch(url, { method: 'OPTIONS', headers: { Origin: 'https://akibuzaki2.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }, signal: AbortSignal.timeout(15000) }).catch(e => ({ status: 'ERR ' + e.message, headers: new Headers() }));
    const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q(lat, lng, r)), headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://akibuzaki2.github.io', 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' }, signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let n = '-', remark = '';
    try { const j = JSON.parse(text); n = j.elements.length; remark = j.remark || ''; } catch { remark = text.slice(0, 200).replace(/\s+/g, ' '); }
    console.log(name, r, url.split('/')[2], 'status', res.status, 'acao', res.headers.get('access-control-allow-origin'), 'preflight', pre.status, pre.headers.get('access-control-allow-origin'), 'elements', n, 'ms', Date.now() - t, remark);
  } catch (e) { console.log(name, r, url.split('/')[2], 'FAIL', e.name, e.message, 'ms', Date.now() - t); }
}
