/** West, south, east, north. A view with west > east crosses the antimeridian. */
export type Bbox = [number, number, number, number];

export function splitBbox(b: Bbox): Bbox[] {
  const [w, s, e, n] = b;
  if (![w, s, e, n].every((v) => Number.isFinite(v))) return [];
  if (w <= e) return [[w, s, e, n]];
  return [
    [w, s, 180, n],
    [-180, s, e, n],
  ];
}

export function intersects(a: Bbox, b: Bbox): boolean {
  const as = splitBbox(a);
  const bs = splitBbox(b);
  return as.some((p) =>
    bs.some((q) => p[0] <= q[2] && p[2] >= q[0] && p[1] <= q[3] && p[3] >= q[1]),
  );
}

function expandOne(b: Bbox): Bbox {
  const [w, s, e, n] = b;
  const dx = e - w;
  const dy = n - s;
  return [
    Math.max(-180, w - dx),
    Math.max(-85, s - dy),
    Math.min(180, e + dx),
    Math.min(85, n + dy),
  ];
}

/** One screen of margin around the view, split if the view crosses ±180. */
export function viewPads(b: Bbox): Bbox[] {
  return splitBbox(b).map(expandOne);
}

export function hits(bounds: Bbox | null, view: Bbox, pad: boolean): boolean {
  if (!bounds) return false;
  const boxes = pad ? viewPads(view) : splitBbox(view);
  return boxes.some((box) => intersects(bounds, box));
}

export function asBbox(raw: number[] | null | undefined): Bbox | null {
  if (!raw || raw.length !== 4) return null;
  const n = raw.map((v) => Number(v));
  if (n.some((v) => !Number.isFinite(v))) return null;
  return [n[0], n[1], n[2], n[3]];
}
