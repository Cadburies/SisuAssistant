/**
 * Server-side session/metadata brokering for the two remaining live
 * basemap toggles from #116 — Google and Bing, unlike Esri/OSM/Mapbox,
 * can't be reduced to a static {z}/{x}/{y} template + key:
 *
 * - Google's Map Tiles API requires a session token (POST createSession,
 *   valid ~2 weeks) before any tile request; the actual GET still needs
 *   both the session AND the raw key, so brokering the session server-side
 *   doesn't hide the key from the browser — it's still client-exposed by
 *   design, same trust model as Mapbox's token (see server.mjs's
 *   /api/config comment). What IS worth doing server-side: creating and
 *   caching the session so the browser doesn't need to POST on every load.
 * - Bing addresses tiles by quadkey, not separate z/x/y — its Imagery
 *   Metadata API returns a URL template + subdomain list once, which the
 *   browser then uses to build a real tile URL per pan (see
 *   web/src/plugins/basemaps/overlay.ts's registerBingProtocol()).
 *
 * NOTE: this module is implemented against Google's and Bing's published
 * API docs, not live-tested — no real GOOGLE_MAPS_API_KEY/BING_MAPS_API_KEY
 * was available in this session to verify against. Treat "correct per
 * spec" and "confirmed working" as different claims here; the first real
 * key used should get a proper end-to-end check (does a tile actually
 * render), not just a "configured: true" response.
 */
const GOOGLE_SESSION_URL = 'https://tile.googleapis.com/v1/createSession';
const GOOGLE_REFRESH_SAFETY_MS = 24 * 3600 * 1000; // refresh a day before the ~2-week expiry
const BING_METADATA_URL = 'https://dev.virtualearth.net/REST/v1/Imagery/Metadata/Aerial';
const BING_META_TTL_MS = 30 * 24 * 3600 * 1000; // URL template/subdomains change on a "product" timescale

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

let bingMeta = null; // { at, key, imageUrl, subdomains }

async function ensureBingMeta() {
  const key = apiKey('BING_MAPS_API_KEY');
  if (!key) return null;
  const now = Date.now();
  if (bingMeta && bingMeta.key === key && now - bingMeta.at < BING_META_TTL_MS) return bingMeta;
  const res = await fetch(`${BING_METADATA_URL}?key=${encodeURIComponent(key)}&output=json`);
  if (!res.ok) throw new Error(`bing metadata -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  const resource = body.resourceSets?.[0]?.resources?.[0];
  if (!resource?.imageUrl) throw new Error('bing metadata: no imageUrl in response');
  bingMeta = {
    at: now,
    key,
    imageUrl: resource.imageUrl,
    subdomains: Array.isArray(resource.imageUrlSubdomains) ? resource.imageUrlSubdomains : [],
  };
  return bingMeta;
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
  if (url.pathname === '/api/basemaps/bing') {
    try {
      const m = await ensureBingMeta();
      if (!m) return send(res, 200, { configured: false });
      return send(res, 200, {
        configured: true,
        key: m.key,
        imageUrl: m.imageUrl,
        subdomains: m.subdomains,
      });
    } catch (err) {
      return send(res, 502, { configured: false, error: String(err) });
    }
  }
  return send(res, 404, { error: 'unknown basemaps route' });
}
