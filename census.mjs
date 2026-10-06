const tries = [
  'https://api.census.gov/data/2023/acs/acs5?get=NAME,B19013_001E&for=block%20group:*&in=state:04%20county:013%20tract:522401',
  'https://api.census.gov/data/2023/acs/acs5?get=NAME,B19013_001E&for=tract:*&in=state:04&in=county:013',
  'https://api.censusreporter.org/1.0/data/show/latest?table_ids=B19013,B25003&geo_ids=150|05000US04013',
  'https://api.censusreporter.org/1.0/data/show/latest?table_ids=B19013,B25003,B25024,B25001,B25077&geo_ids=150|14000US04013522401',
];
for (const u of tries) {
  const t0 = Date.now();
  try { const r = await fetch(u, { headers: { Origin: 'https://akibuzaki2.github.io' } }); const t = await r.text(); console.log(r.status, r.headers.get('access-control-allow-origin'), Date.now() - t0, 'ms', t.length, u.slice(0, 110), '\n   ', t.slice(0, 400).replace(/\s+/g, ' ')); }
  catch (e) { console.log('FAIL', u, e.message); }
}
