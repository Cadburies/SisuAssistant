/**
 * Anchoring hazards overlay (#118) — submarine telecom cables, fetched
 * live from TeleGeography's own API rather than a bundled snapshot, so
 * this doesn't go stale relative to their map. Framed as "hazards" (not
 * just "cables") so a second hazard type (wrecks, pipelines) can be added
 * as another key in the served payload later without restructuring.
 *
 * License: CC BY-NC-SA 3.0 (non-commercial, share-alike) — fine for this
 * personal, non-commercial, currently-private project. If Sisu Assist is
 * ever monetized, this module has to come out (or a commercial
 * TeleGeography license obtained) — see providers.yaml's header for the
 * same accepted-risk framing applied to the tile providers.
 */
const CABLE_URL = 'https://www.submarinecablemap.com/api/v3/cable/cable-geo.json';
const LANDING_URL = 'https://www.submarinecablemap.com/api/v3/landing-point/landing-point-geo.json';
const ATTRIBUTION = '© TeleGeography — submarinecablemap.com';
const TTL_MS = 30 * 24 * 3600 * 1000; // this data moves on a "new cable laid" timescale, not daily

let cache = null; // { at, payload }

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'sisu-nav/0.1 (+yacht-sisu)' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function refresh() {
  const [cables, landingPoints] = await Promise.all([fetchJson(CABLE_URL), fetchJson(LANDING_URL)]);
  return {
    attribution: ATTRIBUTION,
    license: 'CC BY-NC-SA 3.0',
    sourceUrl: 'https://www.submarinecablemap.com/',
    fetchedAt: new Date().toISOString(),
    cables,
    landingPoints,
    stale: false,
  };
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
  if (url.pathname !== '/api/hazards/cables') {
    return send(res, 404, { error: 'unknown hazards route' });
  }
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return send(res, 200, cache.payload);
  }
  try {
    const payload = await refresh();
    cache = { at: now, payload };
    return send(res, 200, payload);
  } catch (err) {
    // Serve stale-on-failure rather than a hard error — a submarine-cable
    // map that's a few weeks older than it should be is still useful; no
    // map at all is not.
    if (cache) {
      return send(res, 200, { ...cache.payload, stale: true, staleError: String(err) });
    }
    return send(res, 502, { error: String(err) });
  }
}
