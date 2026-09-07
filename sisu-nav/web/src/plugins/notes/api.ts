import type { Note } from './types';

/**
 * This boat's own SK resources — direct browser↔SK REST, same pattern the
 * live WS already uses (app/sk.ts connects straight to SK, no api/ proxy).
 * Unlike route/commit (server assembles the record), a note is just what
 * the user typed, so there's nothing for sisu-nav/api to add here — keeps
 * this issue's Touches to web/src/plugins/notes/** only (#79, parallel vs
 * #86 editing server.mjs/Dockerfile for roses).
 */
const TOKEN_KEY = 'sisu-nav.skToken';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  const h: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

function base(signalkHttp: string): string {
  return `${signalkHttp.replace(/\/$/, '')}/signalk/v2/api/resources/notes`;
}

/** RFC4122 v4 id. `crypto.randomUUID` needs a secure context, which plain http on the LAN isn't. */
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through to manual bytes */
    }
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10, 16).join('')}`;
}

export async function listNotes(signalkHttp: string): Promise<Note[]> {
  const res = await fetch(base(signalkHttp), { headers: authHeaders(), cache: 'no-store' });
  if (res.status === 404) return [];
  const text = await res.text();
  if (!res.ok) throw new Error(`notes ${res.status}: ${text.slice(0, 200)}`);
  let data: Record<string, Omit<Note, 'id'>> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  return Object.entries(data || {}).map(([id, v]) => ({ id, ...v }));
}

export async function saveNote(signalkHttp: string, note: Note): Promise<void> {
  const { id, ...record } = note;
  const res = await fetch(`${base(signalkHttp)}/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`save note ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function deleteNote(signalkHttp: string, id: string): Promise<void> {
  const res = await fetch(`${base(signalkHttp)}/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`delete note ${res.status}: ${text.slice(0, 200)}`);
  }
}
