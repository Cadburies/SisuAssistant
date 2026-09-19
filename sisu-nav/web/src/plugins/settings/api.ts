import type { SettingsCatalog } from './types';

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: (T & { error?: string }) | undefined;
  try {
    body = text ? (JSON.parse(text) as T & { error?: string }) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  if (body === undefined) throw new Error(`empty or invalid JSON response (HTTP ${res.status})`);
  return body;
}

export async function fetchKeys(): Promise<SettingsCatalog> {
  const res = await fetch('/api/settings/keys', { cache: 'no-store' });
  return asJson<SettingsCatalog>(res);
}

export async function saveKeys(keys: Record<string, string>): Promise<void> {
  const res = await fetch('/api/settings/keys', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  await asJson<{ saved: unknown }>(res);
}
