import type { Bbox, Estimate, Job, Provider } from './types';

async function asJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
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
