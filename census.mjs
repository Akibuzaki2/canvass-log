const center = [33.2981, -111.8665], km = 5;
for (const v of ['ACS2024', 'ACS2023', 'ACS2022']) {
  const base = `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_${v}/MapServer`;
  const r = await fetch(`${base}?f=json`); console.log(v, r.status);
  if (!r.ok) continue;
  const j = await r.json(); const layer = (j.layers || []).find(l => /block groups/i.test(l.name)); console.log('layer', layer && layer.id, layer && layer.name, 'all:', (j.layers||[]).map(l=>l.id+':'+l.name).join(', ').slice(0,600));
  if (!layer) continue;
  const dLat = km / 110.54, dLng = km / (111.32 * Math.cos(center[0] * Math.PI / 180));
  const env = [center[1] - dLng, center[0] - dLat, center[1] + dLng, center[0] + dLat].join(',');
  const url = `${base}/${layer.id}/query?geometry=${env}&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&maxAllowableOffset=0.0002&geometryPrecision=5&f=json`;
  const q = await fetch(url); const t = await q.text(); console.log('query', q.status, t.length, t.slice(0, 300));
  try { const qj = JSON.parse(t); console.log('features', (qj.features||[]).length, 'exceeded', qj.exceededTransferLimit, 'attrs', JSON.stringify((qj.features||[])[0]?.attributes)); } catch {}
  break;
}
for (const y of [2024, 2023]) {
  const r = await fetch(`https://api.census.gov/data/${y}/acs/acs5?get=B19013_001E,B25003_001E&for=block%20group:*&in=state:04&in=county:013&in=tract:*`);
  const t = await r.text(); console.log('acs', y, r.status, t.length, t.slice(0, 300));
}
