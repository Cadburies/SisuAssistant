/**
 * Viewport coverage for bathymetry defaults (#101).
 * BlueTopo's WMTS WGS84BoundingBox is a huge Atlantic box that still
 * serves empty 1-bit tiles; a single sample GET at the view centre is
 * the cheap check that actually matches data.
 */
import { getProvider, loadProviders } from './providers.mjs';
import { lonLatToTile } from './grid.mjs';
import { fetchBuffer } from './fetchers/http.mjs';
import { isEmptyOceanPng } from './fetchers/wmts.mjs';

const BLUETOPO = 'bluetopo-bathymetry';
const SEASCAPE = 'seascape-dem';
const GEBCO = 'gebco-colour';

function bboxContainsPoint(bbox, lon, lat) {
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function tileUrl(provider, z, x, y) {
  let url = String(provider.template || '');
  url = url.replaceAll('{z}', String(z)).replaceAll('{x}', String(x)).replaceAll('{y}', String(y));
  if (provider.layer) url = url.replaceAll('{layer}', provider.layer);
  if (provider.style) url = url.replaceAll('{style}', provider.style);
  return url;
}

export async function sampleBlueTopo(lon, lat, z) {
  const provider = getProvider(BLUETOPO);
  if (!provider) return { hasData: false, reason: 'no BlueTopo provider' };
  const cov = provider.coverageBbox;
  if (Array.isArray(cov) && cov.length === 4 && !bboxContainsPoint(cov, lon, lat)) {
    return { hasData: false, reason: provider.outOfCoverageReason || 'no BlueTopo in this view' };
  }
  const zoom = Math.max(provider.minZoom, Math.min(provider.maxZoom, Math.round(Number(z) || 11)));
  const { x, y } = lonLatToTile(lon, lat, zoom);
  const url = tileUrl(provider, zoom, x, y);
  try {
    const buf = await fetchBuffer(url, { timeoutMs: 8000, retries: 0 });
    if (isEmptyOceanPng(buf)) {
      return { hasData: false, reason: 'BlueTopo tile empty at this view' };
    }
    return { hasData: true, reason: null };
  } catch {
    return { hasData: false, reason: 'BlueTopo tile empty at this view' };
  }
}

function firstAvailable(ids) {
  const all = loadProviders();
  for (const id of ids) {
    const p = all[id];
    if (p && p.harvestable !== false) return id;
  }
  return ids[ids.length - 1];
}

export async function suggestBathy(lon, lat, z) {
  const sample = await sampleBlueTopo(lon, lat, z);
  if (sample.hasData) {
    return {
      bluetopo: true,
      suggested: BLUETOPO,
      hint: 'US waters — BlueTopo available',
      reason: null,
    };
  }
  const suggested = firstAvailable([SEASCAPE, GEBCO]);
  const label = suggested === SEASCAPE ? 'Seascape / GEBCO' : 'GEBCO';
  return {
    bluetopo: false,
    suggested,
    hint: `Outside NOAA — ${label}`,
    reason: sample.reason,
  };
}
