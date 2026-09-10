/** Viewport-scoped Overpass POI proxy (#119). */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];
const UA = 'sisu-nav/0.1 (+yacht-sisu)';
const MAX_SPAN = 2;
const cache = new Map();
const MEM_TTL = 24 * 3600 * 1000;

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}

function clampBbox(west, south, east, north) {
  if (east < west) [west, east] = [east, west];
  if (north < south) [south, north] = [north, south];
  if (east - west > MAX_SPAN || north - south > MAX_SPAN) {
    const err = new Error('viewport too large — zoom in');
    err.status = 413;
    throw err;
  }
  return [
    Number(south.toFixed(4)),
    Number(west.toFixed(4)),
    Number(north.toFixed(4)),
    Number(east.toFixed(4)),
  ];
}

function ql([s, w, n, e]) {
  return `[out:json][timeout:25];
(
  nwr["shop"](${s},${w},${n},${e});
  nwr["amenity"~"^(restaurant|bar|pub|cafe|fuel)$"](${s},${w},${n},${e});
  nwr["leisure"="marina"](${s},${w},${n},${e});
);
out center 200;`;
}

function category(tags) {
  if (tags.leisure === 'marina') return 'marina';
  if (tags.shop === 'chandler' || tags.shop === 'boat' || tags.shop === 'marine') return 'chandlery';
  if (tags.amenity === 'fuel') return 'fuel';
  if (['restaurant', 'bar', 'pub', 'cafe'].includes(tags.amenity)) return tags.amenity;
  if (tags.shop) return 'shop';
  return 'other';
}

async function overpass(query) {
  let last = null;
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'user-agent': UA, 'content-type': 'text/plain' },
        body: query,
      });
      if (!res.ok) {
        last = new Error(`${url} ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      last = err;
    }
  }
  throw last || new Error('overpass failed');
}

export async function handle(req, res, url) {
  if (url.pathname !== '/api/pois') return send(res, 404, { error: 'unknown pois route' });
  const west = Number(url.searchParams.get('west'));
  const south = Number(url.searchParams.get('south'));
  const east = Number(url.searchParams.get('east'));
  const north = Number(url.searchParams.get('north'));
  try {
    if (![west, south, east, north].every(Number.isFinite)) {
      return send(res, 400, { error: 'west,south,east,north required' });
    }
    const box = clampBbox(west, south, east, north);
    const key = box.join(',');
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < MEM_TTL) return send(res, 200, { ...hit.payload, cached: true });
    const raw = await overpass(ql(box));
    const features = [];
    for (const el of raw.elements || []) {
      const tags = el.tags || {};
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;
      features.push({
        type: 'Feature',
        properties: {
          id: `${el.type}/${el.id}`,
          name: tags.name || tags['name:en'] || category(tags),
          category: category(tags),
        },
        geometry: { type: 'Point', coordinates: [lon, lat] },
      });
    }
    const payload = {
      type: 'FeatureCollection',
      features,
      attribution: '© OpenStreetMap contributors',
      license: 'ODbL 1.0',
    };
    cache.set(key, { at: Date.now(), payload });
    return send(res, 200, payload);
  } catch (err) {
    return send(res, err.status || 502, { error: err.message || String(err) });
  }
}
