/** Signal K REST for resources/routes. Browser never writes; this process does. */

const UA = 'sisu-nav/0.1 (+yacht-sisu)';

const SK_CANDIDATES = [
  process.env.SIGNALK_URL,
  process.env.SIGNALK_HTTP,
  'http://127.0.0.1:3000',
  'http://host.docker.internal:3000',
  'http://signalk:3000',
]
  .filter(Boolean)
  .map((u) => String(u).replace(/\/$/, ''));

let resolved = '';

async function probe(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 800);
  try {
    const res = await fetch(`${url}/signalk`, { headers: { 'user-agent': UA }, signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function skBase() {
  if (resolved) return resolved;
  if (process.env.SIGNALK_URL || process.env.SIGNALK_HTTP) {
    resolved = SK_CANDIDATES[0];
    return resolved;
  }
  for (const url of SK_CANDIDATES) {
    if (await probe(url)) {
      resolved = url;
      return resolved;
    }
  }
  resolved = SK_CANDIDATES[0] || 'http://127.0.0.1:3000';
  return resolved;
}

export async function skToken(req) {
  const h = req?.headers?.authorization || '';
  const m = String(h).match(/^(?:Bearer|JWT)\s+(\S+)/i);
  if (m) return m[1];
  if (process.env.SIGNALK_TOKEN) return process.env.SIGNALK_TOKEN;
  const user = process.env.SIGNALK_USER;
  const password = process.env.SIGNALK_PASSWORD;
  if (!user || !password) return '';
  const res = await fetch(`${await skBase()}/signalk/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ username: user, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) {
    throw Object.assign(new Error(body.message || `SK login failed (${res.status})`), {
      status: 502,
    });
  }
  return body.token;
}

function headers(token) {
  const h = { 'content-type': 'application/json', 'user-agent': UA, accept: 'application/json' };
  if (token) {
    h.authorization = `Bearer ${token}`;
  }
  return h;
}

export async function listRoutes(token) {
  const url = `${await skBase()}/signalk/v2/api/resources/routes`;
  const res = await fetch(url, { headers: headers(token) });
  const text = await res.text();
  if (!res.ok) {
    throw Object.assign(new Error(`SK routes ${res.status}: ${text.slice(0, 200)}`), {
      status: res.status === 401 ? 401 : 502,
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function putRoute(token, id, record) {
  const url = `${await skBase()}/signalk/v2/api/resources/routes/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(record),
  });
  const text = await res.text();
  if (res.ok) {
    try {
      return JSON.parse(text);
    } catch {
      return { id, ok: true };
    }
  }
  if (res.status === 404 || res.status === 405) {
    const post = await fetch(`${await skBase()}/signalk/v2/api/resources/routes`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(record),
    });
    const ptext = await post.text();
    if (!post.ok) {
      throw Object.assign(new Error(`SK route write ${post.status}: ${ptext.slice(0, 240)}`), {
        status: post.status === 401 ? 401 : 502,
      });
    }
    try {
      return JSON.parse(ptext);
    } catch {
      return { ok: true };
    }
  }
  throw Object.assign(new Error(`SK route write ${res.status}: ${text.slice(0, 240)}`), {
    status: res.status === 401 ? 401 : 502,
  });
}

export function routeRecord({ name, description, coordinates, distanceNm, mode, polar }) {
  const distance = (distanceNm || 0) * 1852;
  return {
    name: name || 'Sisu Nav route',
    description: description || `Advisory isochrone (${mode}). Polar: ${polar}. Not coupled to autopilot.`,
    distance,
    feature: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates },
      properties: {
        source: 'sisu-nav',
        mode,
        polar,
        advisory: true,
      },
    },
  };
}
