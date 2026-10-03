/**
 * Boat Signal K login (#190). The password stays in secrets.yaml.
 * The browser receives only the token Signal K already issues to a logged-in client.
 */
import fs from 'node:fs';

function yamlValue(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function usable(value) {
  return Boolean(value) && value !== 'CHANGE_ME';
}

export async function boatSignalKSession() {
  const path = process.env.SISU_SECRETS_YAML || '';
  if (!path) return { ok: false };
  let text = '';
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch {
    return { ok: false };
  }
  const username = yamlValue(text, 'SignalKUser');
  const password = yamlValue(text, 'SignalKPwd');
  if (!usable(username) || !usable(password)) return { ok: false };
  const port = Number(process.env.SISU_SIGNALK_PORT || 3000);
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${port}/signalk/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    return { ok: false };
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.token) return { ok: false, username };
  return { ok: true, username, token: body.token };
}
