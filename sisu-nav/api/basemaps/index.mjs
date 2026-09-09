/**
 * Server-side session brokering for the Google live basemap (#116).
 * Esri/OSM/Mapbox/Azure Maps are plain {z}/{x}/{y} templates + optional
 * client-exposed key (see /api/config). Google still needs POST createSession
 * (~2 weeks) before any tile URL exists — the GET still carries the raw key
 * per Google's contract; this only avoids a POST on every page load.
 *
 * Bing Maps Basic was retired 2026-06-30 (#126); live Microsoft imagery is
 * Azure Maps `microsoft.imagery`, not this module.
 */
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

export async function handle(req, res, url) {
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
