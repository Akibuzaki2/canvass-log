import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const APP = path.resolve(process.argv[2]);
const srv = http.createServer((q, r) => { const f = path.join(APP, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream' }); r.end(d); } }); }).listen(8080);
const browser = await chromium.launch();
const CASES = [
  { name: 'middleton_10mi_any', plan: { from: 'map', mi: 10, mode: 'homes', size: 40 } },
  { name: 'middleton_25mi_100k', plan: { from: 'map', mi: 25, mode: 'homes', size: 60, minIncome: 100000, minOwner: 0.7 } },
];
for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(p => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem('canvass-log.view', JSON.stringify({ lat: 43.7068, lng: -116.6201, z: 13 })); localStorage.setItem('canvass-log.plan', JSON.stringify(p)); localStorage.setItem('canvass-log.tab', 'routes'); localStorage.setItem('canvass-log.listmode', 'plan'); } }, c.plan);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const hosts = {}; page.on('requestfinished', async rq => { const h = new URL(rq.url()).hostname; const res = await rq.response(); hosts[h] = (hosts[h] || '') + (res ? res.status() : '?') + ' '; });
  page.on('requestfailed', rq => { const h = new URL(rq.url()).hostname; hosts[h] = (hosts[h] || '') + 'FAIL '; });
  await page.goto('http://localhost:8080/'); await page.waitForTimeout(1500);
  const t0 = Date.now();
  await page.click('#planGo'); await page.waitForTimeout(1000);
  await page.waitForFunction(() => document.getElementById('planGo') && !document.getElementById('planGo').disabled, null, { timeout: 170000 }).catch(() => console.log('plan timed out'));
  console.log(`== ${c.name}: plan in ${Date.now() - t0} ms`);
  console.log('PLAN fine:', await page.$$eval('#planPanel p.fine, #planPanel .warn', a => a.map(x => x.textContent).join(' | ')));
  const cards = await page.$$eval('.plan-card', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim().slice(0, 260)));
  console.log('cards:', cards.length, '\n  ' + cards.join('\n  '));
  await page.screenshot({ path: `${c.name}-plan.png` });
  if (cards.length) {
    const t1 = Date.now();
    await page.click('[data-start="0"]');
    await page.waitForFunction(() => !/Finding houses/.test(document.getElementById('walkbar').textContent), null, { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log(`walk in ${Date.now() - t1} ms:`, (await page.textContent('#walkPanel .report')).replace(/\s+/g, ' ').trim().slice(0, 400));
    const h2 = await page.$$eval('#walkPanel li.street', a => a.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
    console.log('  ' + h2.slice(0, 14).join('\n  '));
    await page.screenshot({ path: `${c.name}-walk.png` });
  }
  console.log('hosts:', JSON.stringify(hosts), 'errors:', errs);
  await ctx.close();
}
await browser.close(); srv.close();
