// OpenFreeMap vector tiles as a backup source of houses
const tj = await fetch('https://tiles.openfreemap.org/planet', { headers: { Origin: 'https://akibuzaki2.github.io' } });
console.log('tilejson', tj.status, tj.headers.get('access-control-allow-origin'));
const j = await tj.json(); console.log('tiles', j.tiles, 'maxzoom', j.maxzoom, 'layers', (j.vector_layers || []).map(l => l.id + ':' + Object.keys(l.fields || {}).join('|')).join(' '));
const t2 = (lat, lng, z) => { const n = 2 ** z; return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n)]; };
const [x, y] = t2(40.015, -105.27, 14);
const url = j.tiles[0].replace('{z}', 14).replace('{x}', x).replace('{y}', y);
const t0 = Date.now(); const r = await fetch(url, { headers: { Origin: 'https://akibuzaki2.github.io' } });
const buf = new Uint8Array(await r.arrayBuffer());
console.log('tile', url, r.status, r.headers.get('access-control-allow-origin'), r.headers.get('content-encoding'), buf.length, 'bytes', Date.now() - t0, 'ms');
// minimal protobuf walk: count features per layer
let p = 0; const varint = b => { let v = 0, s = 0, c; do { c = b[p++]; v += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return v; };
const layers = {};
while (p < buf.length) { const key = varint(buf); if ((key & 7) !== 2) break; const len = varint(buf), end = p + len; let name = '', feats = 0; while (p < end) { const k = varint(buf), w = k & 7; if (w === 2) { const l = varint(buf); if (k >> 3 === 1) name = new TextDecoder().decode(buf.slice(p, p + l)); if (k >> 3 === 2) feats++; p += l; } else if (w === 0) varint(buf); else if (w === 5) p += 4; else if (w === 1) p += 8; } layers[name] = feats; p = end; }
console.log('layers', JSON.stringify(layers));
