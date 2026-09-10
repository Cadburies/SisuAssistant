/** CelesTrak TLE cache (#121). Browser never hits CelesTrak directly. */
const UA = 'sisu-nav/0.1 (+yacht-sisu; https://github.com/Cadburies/SisuAssistant)';
const GROUPS = ['stations', 'visual', 'gps-ops', 'glo-ops', 'galileo', 'geo'];
const TTL = 6 * 3600 * 1000;
const cache = { at: 0, tle: null };

function send(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
}

function parseTle(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (!l1?.startsWith('1 ') || !l2?.startsWith('2 ')) continue;
    const norad = l1.slice(2, 7).trim();
    out.push({ name, norad, line1: l1, line2: l2 });
  }
  return out;
}

async function fetchGroup(group) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`celestrak ${group} ${res.status}`);
  return parseTle(await res.text());
}

export async function handle(req, res, url) {
  if (url.pathname !== '/api/satellites/tle') {
    return send(res, 404, { error: 'unknown satellites route' });
  }
  if (cache.tle && Date.now() - cache.at < TTL) {
    return send(res, 200, { ...cache.tle, cached: true });
  }
  try {
    const sets = await Promise.all(GROUPS.map((g) => fetchGroup(g).then((sats) => ({ group: g, sats }))));
    const payload = {
      attribution: 'CelesTrak (celestrak.org), Dr. T.S. Kelso',
      fetchedAt: new Date().toISOString(),
      groups: sets,
    };
    cache.at = Date.now();
    cache.tle = payload;
    return send(res, 200, payload);
  } catch (err) {
    return send(res, 502, { error: String(err) });
  }
}
