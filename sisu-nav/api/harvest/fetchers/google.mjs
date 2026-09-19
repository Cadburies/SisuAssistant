/**
 * Google Map Tiles API harvest (#117): createSession then 2dtiles/{z}/{x}/{y}.
 * Session is per job; MBTiles persist through runTemplateHarvest.
 */
import { runTemplateHarvest } from './template.mjs';

async function createSession(key) {
  const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mapType: 'satellite', language: 'en-US', region: 'US' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google createSession ${res.status}: ${text.slice(0, 160)}`);
  }
  const body = await res.json();
  if (!body.session) throw new Error('google createSession: no session');
  return body.session;
}

export async function runGoogle(ctx) {
  const key = process.env[ctx.provider.secretEnv] || '';
  const session = await createSession(key);
  return runTemplateHarvest(ctx, { session, key });
}
