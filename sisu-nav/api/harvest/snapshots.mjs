/** Find existing harvest snapshots on disk (meta.json trees) for skip/fill (#83). */
import fs from 'node:fs';
import path from 'node:path';

export function bboxContains(outer, inner, eps = 0.03) {
  if (!Array.isArray(outer) || outer.length !== 4) return false;
  if (!Array.isArray(inner) || inner.length !== 4) return false;
  return (
    outer[0] <= inner[0] + eps &&
    outer[1] <= inner[1] + eps &&
    outer[2] >= inner[2] - eps &&
    outer[3] >= inner[3] - eps
  );
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function walkMeta(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const metaFile = entries.find((e) => e.isFile() && e.name === 'meta.json');
  if (metaFile) {
    const meta = readJson(path.join(dir, metaFile.name));
    if (meta) {
      const mb = entries.find((e) => e.isFile() && e.name.endsWith('.mbtiles'));
      out.push({
        dir,
        meta,
        mbtiles: mb ? path.join(dir, mb.name) : path.join(dir, `${meta.provider || 'tiles'}.mbtiles`),
      });
    }
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) walkMeta(path.join(dir, e.name), out);
  }
}

/** Do the two bboxes actually overlap at all (no tolerance — plain rectangle test)? */
export function bboxIntersects(a, b) {
  if (!Array.isArray(a) || a.length !== 4) return false;
  if (!Array.isArray(b) || b.length !== 4) return false;
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export function inferSourceDate(meta, provider) {
  if (meta.sourceDate) return meta.sourceDate;
  if (provider?.sourceDate?.kind === 'layer' && provider.sourceDate.layerId) {
    return provider.sourceDate.layerId;
  }
  return null;
}

export function listSnapshots(tilesRoot, kind, providerId, provider) {
  const root = path.join(tilesRoot, kind, providerId);
  const found = [];
  walkMeta(root, found);
  return found.map((s) => ({
    ...s,
    sourceDate: inferSourceDate(s.meta, provider),
  }));
}

/**
 * Prefer a same-sourceDate snapshot that already covers this view; else the
 * most recent same-sourceDate snapshot that at least *overlaps* it (a "fill"
 * target). Never reuse a same-sourceDate snapshot from an unrelated place —
 * sourceDate is often geography-blind (EOX's annual layer id, an Esri
 * cadence bucket), so without an overlap check two disjoint regions
 * harvested the same day/layer would get merged into one snapshot,
 * corrupting its bbox/region label and silently growing forever.
 */
export function pickSnapshot(snaps, sourceDate, bbox, zMin, zMax) {
  const same = snaps.filter((s) => s.sourceDate && s.sourceDate === sourceDate);
  if (!same.length) return null;
  const covering = same.find((s) => {
    const minZ = s.meta.minZoom ?? 0;
    const maxZ = s.meta.maxZoom ?? 99;
    return minZ <= zMin && maxZ >= zMax && bboxContains(s.meta.bbox, bbox);
  });
  if (covering) return covering;
  const overlapping = same.filter((s) => bboxIntersects(s.meta.bbox, bbox));
  if (!overlapping.length) return null;
  overlapping.sort((a, b) => String(b.meta.acquired_at || '').localeCompare(String(a.meta.acquired_at || '')));
  return overlapping[0];
}

export function unionBbox(a, b) {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}
