import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const APP = path.resolve(process.argv[2]);
const srv = http.createServer((q, r) => { const f = path.join(APP, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(d); } }); }).listen(8080);
const PLACES = { boulder: [40.0127, -105.2795], chandler_az: [33.2981, -111.8665], plano_tx: [33.0365, -96.7522], suburb_ohio: [39.9937, -83.0960] };
const browser = await chromium.launch();
for (const [name, [lat, lng]] of Object.entries(PLACES)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(([lat, lng]) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem('canvass-log.view', JSON.stringify({ lat, lng, z: 18 })); } }, [lat, lng]);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const hosts = {}; page.on('requestfinished', async rq => { const h = new URL(rq.url()).hostname; const res = await rq.response(); hosts[h] = (hosts[h] || '') + (res ? res.status() : '?') + ' '; });
  page.on('requestfailed', rq => { const h = new URL(rq.url()).hostname; hosts[h] = (hosts[h] || '') + 'FAIL '; });
  await page.goto('http://localhost:8080/'); await page.waitForTimeout(1500);
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(2500);
  console.log(`== ${name}: sheet "${await page.textContent('#sheetTitle')}" search box "${await page.inputValue('#searchInput')}"`);
  const t0 = Date.now();
  await page.click('#startWalkBtn');
  await page.waitForFunction(() => !/Finding houses/.test(document.getElementById('walkbar').textContent), null, { timeout: 120000 }).catch(() => {});
  console.log(`walk ready in ${Date.now() - t0} ms; walkbar: ${(await page.textContent('#walkbar')).replace(/\s+/g, ' ').trim()}`);
  await page.screenshot({ path: `${name}-map.png` });
  await page.click('#tabList'); await page.waitForTimeout(300);
  const heads = await page.$$eval('#walkPanel li.street', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  console.log('sections:', heads.length, '\n  ' + heads.slice(0, 12).join('\n  '), '\n  ...', heads.at(-1));
  const rows = await page.$$eval('#walkPanel .wrow .addr', a => a.map(x => x.textContent));
  console.log('houses:', rows.length, 'first 15:', rows.slice(0, 15).join(', '));
  const warn = await page.$$eval('#walkPanel .warn', a => a.map(x => x.textContent)); if (warn.length) console.log('WARN', warn);
  await page.screenshot({ path: `${name}-list.png`, fullPage: false });
  console.log('hosts:', JSON.stringify(hosts), 'errors:', errs);
  if (name === 'boulder') {
    await page.click('#walkEnd'); await page.click('#walkEnd');
    await page.evaluate(([lat, lng]) => localStorage.setItem('canvass-log.builder', JSON.stringify({ start: { lat, lng, label: 'Start' }, end: { lat: lat + 0.004, lng: lng + 0.004, label: 'End' }, range: '20-50' })), [lat, lng]);
    await page.reload(); await page.waitForTimeout(1200); await page.click('#tabList'); await page.click('#segWalk');
    const t2 = Date.now(); await page.click('#rbGo');
    await page.waitForFunction(() => !/Finding houses/.test(document.getElementById('walkbar').textContent), null, { timeout: 120000 }).catch(() => {});
    console.log(`A to B 20-50 in ${Date.now() - t2} ms:`, (await page.$$eval('#walkPanel li.street', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()))).join(' | '));
    await page.click('#tabMap'); await page.waitForTimeout(800); await page.screenshot({ path: 'boulder-atob.png' });
  }
  if (name === 'chandler_az') {
    await page.click('#segPlan'); await page.waitForTimeout(300);
    await page.click('#planGo');
    await page.waitForTimeout(1000);
    await page.waitForFunction(() => document.getElementById('planGo') && !document.getElementById('planGo').disabled, null, { timeout: 150000 }).catch(() => console.log('plan timed out'));
    console.log('PLAN panel:', (await page.textContent('#planPanel')).replace(/\s+/g, ' ').slice(0, 900));
    const cards = await page.$$eval('.plan-card', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 200)));
    console.log('PLAN cards:', cards.length, '\n  ' + cards.join('\n  '));
    const w = await page.$$eval('#planPanel .warn', a => a.map(x => x.textContent)); if (w.length) console.log('PLAN WARN', w);
    if (cards.length) {
      const t1 = Date.now();
      await page.click('[data-start="0"]');
      await page.waitForFunction(() => !/Finding houses/.test(document.getElementById('walkbar').textContent), null, { timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(1500);
      console.log(`planned walk in ${Date.now() - t1} ms:`, (await page.textContent('#walkPanel .report')).replace(/\s+/g, ' ').trim().slice(0, 300));
      const h2 = await page.$$eval('#walkPanel li.street', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
      console.log('  ' + h2.join('\n  '));
      await page.screenshot({ path: `plan-walk.png` });
    }
  }
  await ctx.close();
}
await browser.close(); srv.close();
