import type { RosesPayload } from './types';

export type RoseQuery = {
  kind: 'days' | 'months' | 'monthOfYear';
  n?: number;
  month?: number;
};

export async function fetchRoses(q: RoseQuery): Promise<RosesPayload> {
  const qs = new URLSearchParams({ kind: q.kind });
  if (q.kind === 'monthOfYear' && q.month != null) qs.set('month', String(q.month));
  else if (q.n != null) qs.set('n', String(q.n));
  const res = await fetch(`/api/roses?${qs}`);
  const data = (await res.json()) as RosesPayload & { error?: string };
  if (!res.ok) throw new Error(data.error || `roses ${res.status}`);
  return data;
}
