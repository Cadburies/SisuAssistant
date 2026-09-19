/**
 * Resolve the provider's product date (#83) — not the clock time we harvested.
 * Cadence lives on providers.yaml (`sourceDate.kind` / `updateCadence`).
 */
import { lonLatToTile } from './grid.mjs';
import { fetchHead } from './fetchers/http.mjs';

export function utcYesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function cadenceBucket(cadence) {
  const now = new Date();
  if (cadence === 'annual') return String(now.getUTCFullYear());
  if (cadence === 'daily') return now.toISOString().slice(0, 10);
  if (cadence === '30d') {
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}-${month}`;
  }
  return now.toISOString().slice(0, 10);
}

function sampleTileUrl(provider, job) {
  const z = job.maxZoom;
  const lon = (job.bbox[0] + job.bbox[2]) / 2;
  const lat = (job.bbox[1] + job.bbox[3]) / 2;
  const { x, y } = lonLatToTile(lon, lat, z);
  const zUrl = z + (Number(provider.zOffset) || 0);
  let url = provider.template
    .replaceAll('{z}', String(zUrl))
    .replaceAll('{x}', String(x))
    .replaceAll('{y}', String(y));
  if (provider.layer) url = url.replaceAll('{layer}', provider.layer);
  if (provider.style) url = url.replaceAll('{style}', provider.style);
  if (url.includes('{time}')) url = url.replaceAll('{time}', job.time || 'default');
  // Secret-gated templates (e.g. mapbox's {token}) need the real credential
  // here too, or the HEAD probe 401s before a harvest ever starts.
  if (url.includes('{token}') && provider.secretEnv) {
    url = url.replaceAll('{token}', process.env[provider.secretEnv] || '');
  }
  if (url.includes('{key}') && provider.secretEnv) {
    url = url.replaceAll('{key}', process.env[provider.secretEnv] || '');
  }
  return url;
}

/**
 * @returns {Promise<{ sourceDate: string, layerId?: string, etag?: string }>}
 */
export async function resolveSource(provider, job) {
  const spec = provider.sourceDate || {};
  const kind = spec.kind;

  if (kind === 'layer') {
    const layerId = spec.layerId || 'layer';
    return { sourceDate: layerId, layerId };
  }

  if (kind === 'gibs-time') {
    const pinned = job.time && /^\d{4}-\d{2}-\d{2}$/.test(job.time) ? job.time : utcYesterday();
    return { sourceDate: pinned };
  }

  if (kind === 'http-head') {
    try {
      const url = sampleTileUrl(provider, job);
      const head = await fetchHead(url);
      if (head.lastModified) {
        const d = new Date(head.lastModified);
        if (!Number.isNaN(d.getTime())) {
          return { sourceDate: d.toISOString().slice(0, 10), etag: head.etag || undefined };
        }
      }
      if (head.etag) return { sourceDate: `etag:${head.etag.replace(/"/g, '')}`, etag: head.etag };
    } catch {
      /* fall through to cadence bucket */
    }
    return { sourceDate: cadenceBucket(provider.updateCadence || '30d') };
  }

  return { sourceDate: cadenceBucket(provider.updateCadence || 'daily') };
}
