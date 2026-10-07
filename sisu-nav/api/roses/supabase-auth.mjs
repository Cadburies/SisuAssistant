/**
 * User-level Supabase access (#187). Sisu Nav signs in as the boat's own
 * Supabase user — the same email + password + publishable/anon key a crew
 * member uses in SisuMate — and every read/write goes through RLS as that
 * user. No service-role key: the box can only touch boats that user owns or
 * crews on, plus its own community contributions.
 *
 * Never log the password or a token.
 */
const isSet = (v) => Boolean(v) && v !== 'CHANGE_ME';

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function authCfg() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY || '';
  const email = process.env.SUPABASE_EMAIL || '';
  const password = process.env.SUPABASE_PASSWORD || '';
  return {
    url,
    key: isSet(key) ? key : '',
    canRead: Boolean(url && isSet(key)),
    canSignIn: Boolean(url && isSet(key) && isSet(email) && isSet(password)),
    email,
    password,
  };
}

let session = null; // { access, refresh, exp, userId, who }
let boat = null; // { id, name, who }

async function tokenRequest(grant, body) {
  const c = authCfg();
  const res = await fetch(`${c.url}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: c.key, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw httpError(res.status === 400 ? 401 : res.status, `supabase sign-in: ${json.error_description || json.msg || json.error || res.status}`);
  }
  return {
    access: json.access_token,
    refresh: json.refresh_token,
    exp: Date.now() + (Number(json.expires_in) || 3600) * 1000,
    userId: json.user?.id,
    who: c.email,
  };
}

/** Access token for the configured user, signing in / refreshing as needed. */
export async function accessToken() {
  const c = authCfg();
  if (!c.canSignIn) throw httpError(503, 'Supabase sign-in not set (supabase_email / supabase_password)');
  if (session && session.who !== c.email) session = null; // account changed in Settings
  if (session && session.exp - Date.now() > 60 * 1000) return session.access;
  if (session?.refresh) {
    try {
      session = await tokenRequest('refresh_token', { refresh_token: session.refresh });
      return session.access;
    } catch {
      session = null;
    }
  }
  session = await tokenRequest('password', { email: c.email, password: c.password });
  boat = null;
  return session.access;
}

/** PostgREST call as the signed-in user (or anonymously with user: false). */
export async function rest(path, { method = 'GET', body, prefer, user = true } = {}) {
  const c = authCfg();
  if (!c.canRead) throw httpError(503, 'Supabase not configured (supabase_url / supabase_anon_key)');
  const headers = { apikey: c.key, 'content-type': 'application/json' };
  if (user) headers.authorization = `Bearer ${await accessToken()}`;
  if (prefer) headers.prefer = prefer;
  const res = await fetch(`${c.url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) throw httpError(res.status, `supabase ${res.status}: ${(json && (json.message || json.hint)) || text.slice(0, 160)}`);
  return json;
}

/**
 * The boat this user writes as. SISU_BOAT_ID picks one when the account
 * reaches several boats; otherwise the single boat it owns (or can reach).
 */
export async function resolveBoat() {
  const c = authCfg();
  const want = (process.env.SISU_BOAT_ID || '').trim();
  if (boat && boat.who === c.email && (!isSet(want) || boat.id === want)) return boat;
  await accessToken();
  const ids = ((await rest('rpc/accessible_boat_ids', { method: 'POST', body: {} })) || []).map((r) =>
    typeof r === 'string' ? r : r.accessible_boat_ids,
  );
  if (!ids.length) throw httpError(409, `${c.email} owns or crews no boat in SisuMate`);
  const list = ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
  const rows = (await rest(`boats?select=supabaseId,name,ownerId&supabaseId=in.(${encodeURIComponent(list)})`)) || [];
  let pick = null;
  if (isSet(want)) {
    pick = rows.find((r) => r.supabaseId === want);
    if (!pick) throw httpError(409, `SISU_BOAT_ID is not a boat ${c.email} can reach`);
  } else if (rows.length === 1) {
    pick = rows[0];
  } else {
    const owned = rows.filter((r) => r.ownerId === session.userId);
    if (owned.length === 1) pick = owned[0];
    else
      throw httpError(
        409,
        `${c.email} reaches ${rows.length} boats (${rows.map((r) => r.name || r.supabaseId).join(', ')}) — set SISU_BOAT_ID`,
      );
  }
  boat = { id: pick.supabaseId, name: pick.name || pick.supabaseId, who: c.email };
  return boat;
}

export function signedInAs() {
  return session ? { email: session.who, boat: boat?.name || null } : null;
}
