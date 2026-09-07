const UA = 'sisu-nav/0.1 (+yacht-sisu)';
const CANDIDATES = [
  process.env.INFLUXDB_URL,
  'http://influxdb:8086',
  'http://127.0.0.1:8086',
  'http://host.docker.internal:8086',
]
  .filter(Boolean)
  .map((u) => String(u).replace(/\/$/, ''));

let resolved = '';

async function probe(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 800);
  try {
    const res = await fetch(`${url}/health`, { headers: { 'user-agent': UA }, signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function influxBase() {
  if (resolved) return resolved;
  if (process.env.INFLUXDB_URL) {
    resolved = CANDIDATES[0];
    return resolved;
  }
  for (const url of CANDIDATES) {
    if (await probe(url)) {
      resolved = url;
      return resolved;
    }
  }
  resolved = CANDIDATES[0] || 'http://127.0.0.1:8086';
  return resolved;
}

export function influxAuth() {
  const token = process.env.INFLUXDB_TOKEN || '';
  const org = process.env.INFLUXDB_ORG || 'Sisu';
  return { token, org };
}

/** Parse Influx annotated CSV into { measurement: [{ t, v }] }. */
export function parseAnnotatedCsv(text) {
  const series = new Map();
  let header = null;
  let iTime = -1;
  let iMeas = -1;
  let iVal = -1;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) {
      header = null;
      continue;
    }
    if (line.startsWith('#')) continue;
    const cols = line.split(',');
    if (!header) {
      header = cols;
      iTime = cols.indexOf('_time');
      iMeas = cols.indexOf('_measurement');
      iVal = cols.indexOf('_value');
      continue;
    }
    if (iTime < 0 || iMeas < 0 || iVal < 0) continue;
    const meas = cols[iMeas];
    const t = Date.parse(cols[iTime]);
    const v = Number(cols[iVal]);
    if (!meas || !Number.isFinite(t) || !Number.isFinite(v)) continue;
    let arr = series.get(meas);
    if (!arr) {
      arr = [];
      series.set(meas, arr);
    }
    arr.push({ t, v });
  }
  for (const arr of series.values()) arr.sort((a, b) => a.t - b.t);
  return series;
}

export async function queryFlux(flux) {
  const { token, org } = influxAuth();
  if (!token) {
    throw Object.assign(new Error('INFLUXDB_TOKEN unset — API holds the token, not the browser'), {
      status: 503,
    });
  }
  const base = await influxBase();
  const url = `${base}/api/v2/query?org=${encodeURIComponent(org)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Token ${token}`,
      'content-type': 'application/vnd.flux',
      accept: 'application/csv',
      'user-agent': UA,
    },
    body: flux,
  });
  const text = await res.text();
  if (!res.ok) {
    throw Object.assign(new Error(`influx ${res.status}: ${text.slice(0, 240)}`), { status: 502 });
  }
  return parseAnnotatedCsv(text);
}
