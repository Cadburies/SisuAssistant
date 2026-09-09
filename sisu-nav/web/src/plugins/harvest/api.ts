import type { Bbox, Estimate, Job, Provider } from './types';

async function asJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: (T & { error?: string }) | undefined;
  try {
    body = text ? (JSON.parse(text) as T & { error?: string }) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  if (body === undefined) {
    // A 2xx with an empty/unparseable body must reject, not silently resolve
    // as `{}` (#111) — a truncated response for GET /api/harvest/jobs was
    // indistinguishable from "zero jobs", so tick()'s 4s poll would wipe a
    // populated Jobs list to empty on a single network/proxy hiccup.
    throw new Error(`empty or invalid JSON response (HTTP ${res.status})`);
  }
  return body;
}

export async function fetchProviders(): Promise<Provider[]> {
  const res = await fetch('/api/harvest/providers', { cache: 'no-store' });
  const j = await asJson<{ providers: Provider[] }>(res);
  return j.providers ?? [];
}

export async function fetchEstimate(input: {
  providerId: string;
  bbox: Bbox;
  minZoom: number;
  maxZoom: number;
}): Promise<Estimate> {
  const res = await fetch('/api/harvest/estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return asJson<Estimate>(res);
}

export async function startJob(input: {
  providerId: string;
  region: string;
  bbox: Bbox;
  minZoom: number;
  maxZoom: number;
  time?: string;
  notes?: string;
}): Promise<Job> {
  const res = await fetch('/api/harvest/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return asJson<Job>(res);
}

export async function fetchJobs(): Promise<Job[]> {
  const res = await fetch('/api/harvest/jobs', { cache: 'no-store' });
  const j = await asJson<{ jobs: Job[] }>(res);
  return j.jobs ?? [];
}

export async function resumeJob(id: string): Promise<Job> {
  const res = await fetch(`/api/harvest/jobs/${encodeURIComponent(id)}/resume`, { method: 'POST' });
  return asJson<Job>(res);
}

export async function saveHarvestSecret(
  secretEnv: string,
  value: string,
): Promise<{ secretEnv: string; configured: boolean }> {
  const res = await fetch('/api/harvest/secrets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secretEnv, value }),
  });
  return asJson<{ secretEnv: string; configured: boolean }>(res);
}

export async function clearHarvestSecret(
  secretEnv: string,
): Promise<{ secretEnv: string; configured: boolean }> {
  const res = await fetch(`/api/harvest/secrets/${encodeURIComponent(secretEnv)}`, { method: 'DELETE' });
  return asJson<{ secretEnv: string; configured: boolean }>(res);
}
