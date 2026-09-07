import type { CommitResult, LatLon, PlanResult, RouteMode } from './types';

const TOKEN_KEY = 'sisu-nav.skToken';

function skAuth(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function planRoute(body: {
  start: LatLon;
  dest: LatLon;
  mode: RouteMode;
  deep: boolean;
  maxTws: number;
  maxHs: number;
  polar?: string;
}): Promise<PlanResult> {
  const res = await fetch('/api/route/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PlanResult & { error?: string };
  if (!res.ok) throw new Error(data.error || `plan ${res.status}`);
  return data;
}

export async function commitRoute(body: {
  name: string;
  coordinates: number[][];
  distanceNm: number;
  mode: RouteMode;
  polar: string;
}): Promise<CommitResult> {
  const res = await fetch('/api/route/commit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...skAuth() },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as CommitResult & { error?: string };
  if (!res.ok) throw new Error(data.error || `commit ${res.status}`);
  return data;
}
