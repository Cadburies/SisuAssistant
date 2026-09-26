/**
 * Server-side session brokering for the Google live basemap (#116).
 * Esri/OSM/Mapbox/Azure Maps are plain {z}/{x}/{y} templates + optional
 * client-exposed key (see /api/config). Google still needs POST createSession
 * (~2 weeks) before any tile URL exists — the GET still carries the raw key
 * per Google's contract; this only avoids a POST on every page load.
 *
 * Bing Maps Basic was retired 2026-06-30 (#126); live Microsoft imagery is
 * Azure Maps `microsoft.imagery`. Its subscription key is an account secret
 * (not a referrer-restricted public token), so tiles are proxied here and the
 * key never reaches the browser (#168): GET /api/basemaps/azure/{z}/{x}/{y}.
 */
const AZURE_TILE_URL = 'https://atlas.microsoft.com/map/tile';
const GOOGLE_SESSION_URL = 'https://tile.googleapis.com/v1/createSession';
const GOOGLE_REFRESH_SAFETY_MS = 24 * 3600 * 1000;

function apiKey(name) {
  const k = process.env[name];
  return k && k !== 'CHANGE_ME' ? k : null;
}

let googleSession = null; // { key, session, tileWidth, tileHeight, imageFormat, expiresAt }

async function ensureGoogleSession() {
  const key = apiKey('GOOGLE_MAPS_API_KEY');
  if (!key) return null;
  const now = Date.now();
  if (googleSession && googleSession.key === key && googleSession.expiresAt - now > GOOGLE_REFRESH_SAFETY_MS) {
    return googleSession;
  }
  const res = await fetch(`${GOOGLE_SESSION_URL}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mapType: 'satellite', language: 'en-US', region: 'US' }),
  });
  if (!res.ok) throw new Error(`google createSession -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  if (!body.session) throw new Error('google createSession: no session field in response');
  googleSession = {
    key,
    session: body.session,
    tileWidth: body.tileWidth || 256,
    tileHeight: body.tileHeight || 256,
    imageFormat: body.imageFormat || 'jpeg',
    expiresAt: Number(body.expiry) * 1000 || now + 12 * 3600 * 1000,
  };
  return googleSession;
}

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(data);
}

async function azureTile(res, z, x, y) {
  const key = apiKey('AZURE_MAPS_SUBSCRIPTION_KEY');
  if (!key) return send(res, 404, { error: 'azure maps not configured' });
  const q = new URLSearchParams({
    'api-version': '2024-04-01', tilesetId: 'microsoft.imagery',
    zoom: String(z), x: String(x), y: String(y), tileSize: '256',
  });
  try {
    const up = await fetch(`${AZURE_TILE_URL}?${q}`, { headers: { 'subscription-key': key } });
    if (!up.ok) return send(res, up.status === 404 || up.status === 204 ? 404 : 502, { error: `azure tile -> ${up.status}` });
    const body = Buffer.from(await up.arrayBuffer());
    res.writeHead(200, {
      'content-type': up.headers.get('content-type') || 'image/jpeg',
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': '*',
    });
    return res.end(body);
  } catch (err) {
    return send(res, 502, { error: `azure tile: ${String(err).slice(0, 120)}` });
  }
}

export async function handle(req, res, url) {
  const az = url.pathname.match(/^\/api\/basemaps\/azure\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})$/);
  if (az) return azureTile(res, Number(az[1]), Number(az[2]), Number(az[3]));
  if (url.pathname === '/api/basemaps/google') {
    try {
      const s = await ensureGoogleSession();
      if (!s) return send(res, 200, { configured: false });
      return send(res, 200, {
        configured: true,
        key: s.key,
        session: s.session,
        tileSize: s.tileWidth,
      });
    } catch (err) {
      return send(res, 502, { configured: false, error: String(err) });
    }
  }
  return send(res, 404, { error: 'unknown basemaps route' });
}
