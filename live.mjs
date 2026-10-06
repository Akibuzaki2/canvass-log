import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const APP = path.resolve(process.argv[2]);
const srv = http.createServer((q, r) => { const f = path.join(APP, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream' }); r.end(d); } }); }).listen(8080);
const browser = await chromium.launch();
const spots = [['Middleton', 43.7110, -116.6085], ['Middleton2', 43.7036, -116.6260], ['Boulder', 40.0178, -105.2836], ['Nampa', 43.5860, -116.5770]];
for (const [name, lat, lng] of spots) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([lat, lng]) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem('canvass-log.view', JSON.stringify({ lat, lng, z: 18 })); localStorage.setItem('canvass-log.tab', 'map'); } }, [lat, lng]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
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
  const q = `[out:json][timeout:60];way[highway](${la0 - .001},${ln0 - .001},${la1 + .001},${ln1 + .001});out geom;`;
  let ways = [];
  for (let t = 0; t < 3 && !ways.length; t++) { try { const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) }); ways = (await r.json()).elements; } catch (e) { await new Promise(r => setTimeout(r, 5000)); } }
  const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540, xy = ([a, b]) => [(b - lng) * kx, (a - lat) * ky];
  const good = [], bad = [];
  for (const wy of ways) { const t = wy.tags || {}; const isBad = /^(driveway|parking_aisle|drive-through)$/.test(t.service || '') || /^(private|no)$/.test(t.access || '') || /^(no|private)$/.test(t.foot || ''); for (let i = 1; i < (wy.geometry || []).length; i++) (isBad ? bad : good).push([xy([wy.geometry[i - 1].lat, wy.geometry[i - 1].lon]), xy([wy.geometry[i].lat, wy.geometry[i].lon])]); }
  const sd = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const near = (p, S) => { let m = Infinity; for (const [a, b] of S) { const d = sd(p, a, b); if (d < m) m = d; } return m; };
  let n = 0, off = 0, onBad = 0, len = 0, worst = 0; const offs = [];
  for (const s of w.sections) for (const line of s.path || []) for (let i = 1; i < line.length; i++) {
    const a = xy(line[i - 1]), b = xy(line[i]); len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const t of [0, .25, .5, .75, 1]) { const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; n++; const d = near(m, good); if (d > worst) worst = d; if (d > 3) { off++; offs.push(line[i].join(',')); if (near(m, bad) < 3) onBad++; } }
  }
  const lines = w.sections.reduce((t, s) => t + (s.path || []).length, 0);
  console.log(`${name}: ${hs.length} houses, ${w.sections.length} stretches, ${lines} lines, ${Math.round(len)} m, curbs ${hs.filter(h => h.curb).length}/${hs.length}, ways ${ways.length}, checked ${n}, off-network ${off} (on driveway/private ${onBad}), worst ${worst.toFixed(1)} m, errors ${JSON.stringify(errs)}`);
  if (offs.length) console.log('  off at', offs.slice(0, 6).join(' | '));
  const spurs = hs.filter(h => h.curb).map(h => Math.hypot((h.curb[0] - h.lat) * ky, (h.curb[1] - h.lng) * kx)).sort((a, b) => a - b);
  console.log('  door spur m: median', Math.round(spurs[spurs.length >> 1] || 0), 'max', Math.round(spurs[spurs.length - 1] || 0));
  await page.screenshot({ path: name + '.png' });
  await ctx.close();
}
await browser.close(); srv.close();
