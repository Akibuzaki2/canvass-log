import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const APP = path.resolve(process.argv[2]);
const srv = http.createServer((q, r) => { const f = path.join(APP, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream' }); r.end(d); } }); }).listen(8080);
const browser = await chromium.launch();
const spots = [['Boulder', 40.0178, -105.2836], ['Nampa', 43.5860, -116.5770]];
for (const [name, lat, lng] of spots) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([lat, lng]) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem('canvass-log.view', JSON.stringify({ lat, lng, z: 18 })); localStorage.setItem('canvass-log.tab', 'map'); } }, [lat, lng]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const got = []; page.on('response', async r => { if (/overpass|kumi|private\.coffee|interpreter/.test(r.url())) { try { const j = await r.json(); if (j && j.elements) got.push(...j.elements); } catch {} } });
  await page.goto('http://localhost:8080/'); await page.waitForTimeout(2500);
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(3000);
  await page.click('#startWalkBtn');
  await page.waitForFunction(() => { const w = JSON.parse(localStorage.getItem('canvass-log.walk') || 'null'); return w && !w.loading && w.sections && w.sections.length; }, null, { timeout: 120000 }).catch(() => console.log(name, 'walk timed out'));
  await page.waitForTimeout(1500);
  const w = await page.evaluate(() => JSON.parse(localStorage.getItem('canvass-log.walk')));
  if (!w || !w.sections) { console.log(name, 'no walk', errs); await ctx.close(); continue; }
  const pts = w.sections.flatMap(s => (s.path || []).flat());
  const hs = w.sections.flatMap(s => s.houses);
  let la0 = Math.min(...pts.map(p => p[0])), la1 = Math.max(...pts.map(p => p[0])), ln0 = Math.min(...pts.map(p => p[1])), ln1 = Math.max(...pts.map(p => p[1]));
  const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540, xy = ([a, b]) => [(b - lng) * kx, (a - lat) * ky];
  const sd = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  // A line through a yard passes close to houses; a street line stays out in front of them.
  const H = hs.map(h => xy([h.lat, h.lng]));
  let segs = 0, close = 0, len = 0, straight = 0, gaps = 0; const where = [];
  for (const s of w.sections) { gaps += Math.max(0, (s.path || []).length - 1); for (const line of s.path || []) for (let i = 1; i < line.length; i++) {
    const a = xy(line[i - 1]), b = xy(line[i]); segs++; len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m = Math.min(...H.map(p => sd(p, a, b))); if (m < 7) { close++; where.push(line[i].join(',') + ' ' + m.toFixed(1)); }
  } }
  for (let i = 1; i < H.length; i++) straight += Math.hypot(H[i][0] - H[i - 1][0], H[i][1] - H[i - 1][1]);
  const noPath = w.sections.filter(s => !(s.path || []).length).length;
  console.log(`${name}: ${hs.length} houses, ${w.sections.length} stretches (${noPath} with no line), ${gaps} breaks, line ${Math.round(len)} m vs door-to-door ${Math.round(straight)} m, ${segs} pieces, ${close} pass within 7 m of a house, errors ${JSON.stringify(errs)}`);
  if (where.length) console.log('  close at', where.slice(0, 8).join(' | '));
  for (const pt of where.filter((_, i) => i % Math.max(1, Math.floor(where.length / 6)) === 0).slice(0, 6)) {
    const [la, ln] = pt.split(' ')[0].split(',');
    const q = `[out:json][timeout:25];(way(around:4,${la},${ln})[highway];node(around:12,${la},${ln})["addr:housenumber"];way(around:12,${la},${ln})[building];);out tags center;`;
    try { let j = null; for (const host of ['https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) { try { const r = await fetch(host + '?data=' + encodeURIComponent(q)); j = JSON.parse(await r.text()); break; } catch {} } if (!j) throw new Error('all mirrors');
      console.log('   ', pt, '->', j.elements.map(e => `${e.type}:${JSON.stringify(e.tags).slice(0, 140)}`).join(' || ')); } catch (e) { console.log('    overpass failed', e.message); }
    await new Promise(r => setTimeout(r, 1500));
  }
  const spurs = hs.filter(h => h.curb).map(h => Math.hypot((h.curb[0] - h.lat) * ky, (h.curb[1] - h.lng) * kx)).sort((a, b) => a - b);
  console.log('  door spur m: median', Math.round(spurs[spurs.length >> 1] || 0), 'max', Math.round(spurs[spurs.length - 1] || 0));
  await page.screenshot({ path: name + '.png' });
  await ctx.close();
}
await browser.close(); srv.close();
