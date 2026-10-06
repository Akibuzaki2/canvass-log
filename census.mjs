const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const center = [33.2981, -111.8665], km = 3;
const base = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer';
const j = await (await fetch(base + '?f=json')).json();
const layer = j.layers.find(l => /^census block groups$/i.test(l.name)); console.log('2020 layer', layer);
const dLat = km / 110.54, dLng = km / (111.32 * Math.cos(center[0] * Math.PI / 180));
const env = [center[1] - dLng, center[0] - dLat, center[1] + dLng, center[0] + dLat].join(',');
const q = await (await fetch(`${base}/${layer.id}/query?geometry=${env}&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json`)).json();
console.log('features', q.features.length, JSON.stringify(q.features[0].attributes));
const j2 = await (await fetch('https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer?f=json')).json();
console.log('ACS2024 BG layer', j2.layers.find(l => /^census block groups$/i.test(l.name)));
for (const u of ['https://api.census.gov/data/2023/acs/acs5?get=NAME,B19013_001E&for=tract:*&in=state:04&in=county:013',
  'https://api.censusreporter.org/1.0/data/show/latest?table_ids=B19013,B25003&geo_ids=150|05000US04013']) {
  const r = await fetch(u, { headers: { 'User-Agent': UA, Origin: 'https://akibuzaki2.github.io', Referer: 'https://akibuzaki2.github.io/canvass-log/' } });
  const t = await r.text(); console.log(r.status, r.headers.get('access-control-allow-origin'), t.length, t.slice(0, 300).replace(/\s+/g, ' '));
}
