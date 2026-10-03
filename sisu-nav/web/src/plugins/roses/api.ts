import type { AnchorSpotsPayload, RosesPayload } from './types';

export type RoseQuery = {
  kind: 'days' | 'months' | 'monthOfYear';
  n?: number;
  month?: number;
};

export async function fetchCommunityRoses(q: {
  west: number;
  south: number;
  east: number;
  north: number;
  month?: number;
}): Promise<{
  configured: boolean;
  cells: RosesPayload['cells'];
  minBoats: number;
  spec?: RosesPayload['spec'];
}> {
  const qs = new URLSearchParams({
    west: String(q.west),
    south: String(q.south),
    east: String(q.east),
    north: String(q.north),
  });
  if (q.month) qs.set('month', String(q.month));
  const res = await fetch(`/api/roses/community?${qs}`);
  const data = (await res.json()) as {
    configured?: boolean;
    cells?: RosesPayload['cells'];
    minBoats?: number;
    spec?: RosesPayload['spec'];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || `community ${res.status}`);
  return {
    configured: Boolean(data.configured),
    cells: data.cells || [],
    minBoats: data.minBoats || 3,
    spec: data.spec,
  };
}

export async function shareRoses(body: {
  boatId: string;
  month?: number;
  cells: RosesPayload['cells'];
}): Promise<{ uploaded: number }> {
  const res = await fetch('/api/roses/share', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { uploaded?: number; error?: string };
  if (!res.ok) throw new Error(data.error || `share ${res.status}`);
  return { uploaded: data.uploaded || 0 };
}

function boatId(): string {
  try {
    let id = localStorage.getItem('sisu-nav.boat-id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('sisu-nav.boat-id', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export { boatId };

export async function fetchRoses(q: RoseQuery): Promise<RosesPayload> {
  const qs = new URLSearchParams({ kind: q.kind });
  if (q.kind === 'monthOfYear' && q.month != null) qs.set('month', String(q.month));
  else if (q.n != null) qs.set('n', String(q.n));
  const res = await fetch(`/api/roses?${qs}`);
  const data = (await res.json()) as RosesPayload & { error?: string };
  if (!res.ok) throw new Error(data.error || `roses ${res.status}`);
  return data;
}

/** Opt-in: show + sync marina/slip stays alongside anchor spots (#187). */
export async function setAnchorBerths(berths: boolean): Promise<void> {
  const res = await fetch('/api/roses/anchor-spots/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ berths }),
  });
  if (!res.ok) throw new Error(`berths opt-in ${res.status}`);
}

/** Server-side opt-in: anchor-spot roses join the community map (#187). */
export async function setAnchorCommunity(optIn: boolean): Promise<void> {
  const res = await fetch('/api/roses/anchor-spots/community', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ optIn }),
  });
  if (!res.ok) throw new Error(`community opt-in ${res.status}`);
}

export async function fetchAnchorSpots(refresh = false): Promise<AnchorSpotsPayload> {
  const res = refresh
    ? await fetch('/api/roses/anchor-spots/run?sync=1', { method: 'POST' })
    : await fetch('/api/roses/anchor-spots');
  const data = (await res.json()) as AnchorSpotsPayload;
  if (!res.ok) throw new Error(data.error || `anchor spots ${res.status}`);
  return data;
}
