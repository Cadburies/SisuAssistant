/** Viewport-scoped ADS-B via adsb.lol (#120). */
const UA = 'sisu-nav/0.1 (+yacht-sisu)';
const TTL = 12_000;
const cache = new Map();

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}

function radiusNm(west, south, east, north) {
  const lat = (south + north) / 2;
  const dLat = (north - south) * 60;
  const dLon = (east - west) * 60 * Math.cos((lat * Math.PI) / 180);
  const half = Math.hypot(dLat, dLon) / 2;
  return Math.min(120, Math.max(15, Math.round(half)));
}

export async function handle(req, res, url) {
  if (url.pathname !== '/api/aircraft') return send(res, 404, { error: 'unknown aircraft route' });
  const west = Number(url.searchParams.get('west'));
  const south = Number(url.searchParams.get('south'));
  const east = Number(url.searchParams.get('east'));
  const north = Number(url.searchParams.get('north'));
  if (![west, south, east, north].every(Number.isFinite)) {
    return send(res, 400, { error: 'west,south,east,north required' });
  }
  const lat = (south + north) / 2;
  const lon = (west + east) / 2;
  const dist = radiusNm(west, south, east, north);
  const key = `${lat.toFixed(2)}|${lon.toFixed(2)}|${dist}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return send(res, 200, { ...hit.payload, cached: true });
  try {
    const path = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${dist}`;
    const rr = await fetch(path, { headers: { 'user-agent': UA } });
    if (!rr.ok) throw new Error(`adsb.lol ${rr.status}`);
    const j = await rr.json();
    const ac = Array.isArray(j.ac) ? j.ac : [];
    const features = ac
      .filter((a) => a.lat != null && a.lon != null)
      .map((a) => ({
        type: 'Feature',
        properties: {
          hex: a.hex,
          flight: (a.flight || a.r || a.hex || '').trim(),
          alt: a.alt_baro ?? a.alt_geom,
          track: a.true_track ?? a.track ?? 0,
          gs: a.gs,
        },
        geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
      }));
    const payload = {
      type: 'FeatureCollection',
      features,
      attribution: 'adsb.lol',
      license: 'ODbL 1.0',
      radiusNm: dist,
    };
    cache.set(key, { at: Date.now(), payload });
    return send(res, 200, payload);
  } catch (err) {
    return send(res, 502, { error: String(err) });
  }
}
