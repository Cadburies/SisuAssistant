import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { subscribeNavMap } from '../map/registry';
import { fetchEstimate, fetchJobs, fetchProviders, resumeJob, startJob } from './api';
import type { Bbox, Estimate, Job, Provider } from './types';
import { SecretField } from './SecretField';
import { ImportedSets } from '../imported/ImportedSets';
import './harvest.css';

const BBOX_SOURCE = 'harvest-bbox';
/** Below this zoom the viewport is too wide for an automatic scrape. */
const AUTO_MIN_ZOOM = 8;
const AUTO_DEBOUNCE_MS = 1600;
const AUTO_MAX_TILES = 400;
const NO_AUTO = new Set([
  'noaa-enc',
  'maptiler-satellite',
  'maptiler-ocean',
  'maptiler-ocean-rgb',
  'maxar',
  'planet',
]);

function formatBytes(n: number | null): string {
  if (n == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function q(n: number): number {
  return Math.round(n * 100);
}

function viewKey(providerId: string, bbox: Bbox, z: number): string {
  return `${providerId}|${q(bbox[0])}|${q(bbox[1])}|${q(bbox[2])}|${q(bbox[3])}|${z}`;
}

function bboxContains(outer: Bbox, inner: Bbox, eps = 0.03): boolean {
  return (
    outer[0] <= inner[0] + eps &&
    outer[1] <= inner[1] + eps &&
    outer[2] >= inner[2] - eps &&
    outer[3] >= inner[3] - eps
  );
}

function alreadyHave(jobs: Job[], providerId: string, bbox: Bbox, z: number): boolean {
  return jobs.some((j) => {
    if (j.providerId !== providerId) return false;
    if (j.minZoom > z || j.maxZoom < z) return false;
    if (!['queued', 'running', 'done', 'skipped'].includes(j.status)) return false;
    return bboxContains(j.bbox, bbox);
  });
}

function regionName(bbox: Bbox, z: number): string {
  const lat = (bbox[1] + bbox[3]) / 2;
  const lon = (bbox[0] + bbox[2]) / 2;
  const ns = lat >= 0 ? 'n' : 's';
  const ew = lon >= 0 ? 'e' : 'w';
  return `z${z}-${Math.abs(lat).toFixed(2)}${ns}-${Math.abs(lon).toFixed(2)}${ew}`;
}

function readView(map: MapLibreMap, provider: Provider): { bbox: Bbox; z: number } | null {
  const b = map.getBounds();
  const z = Math.round(map.getZoom());
  const clamped = Math.max(provider.minZoom, Math.min(provider.maxZoom, z));
  return {
    bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    z: clamped,
  };
}

function rectFeature(bbox: Bbox) {
  const [w, s, e, n] = bbox;
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
        },
      },
    ],
  };
}

function ensureBboxLayer(map: MapLibreMap) {
  if (map.getSource(BBOX_SOURCE)) return;
  map.addSource(BBOX_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: `${BBOX_SOURCE}-fill`,
    type: 'fill',
    source: BBOX_SOURCE,
    paint: { 'fill-color': '#e0b43a', 'fill-opacity': 0.08 },
  });
  map.addLayer({
    id: `${BBOX_SOURCE}-line`,
    type: 'line',
    source: BBOX_SOURCE,
    paint: { 'line-color': '#e0b43a', 'line-width': 1.5, 'line-dasharray': [2, 1] },
  });
}

function statusClass(status: Job['status'], failed?: number): string {
  switch (status) {
    case 'done':
    case 'skipped':
      return failed ? 'hv-wait' : 'hv-ok';
    case 'error':
      return 'hv-bad';
    case 'unsupported':
      return 'hv-wait';
    case 'interrupted':
      return 'hv-bad';
    default:
      return 'hv-muted';
  }
}

function jobLabel(j: Job): string {
  if (j.status === 'skipped') return 'skipped';
  const failedSuffix = j.failed ? ` (${j.failed} unavailable)` : '';
  if (j.mode === 'fill' && j.status === 'done') {
    if (!j.fetched) return `filled 0 — none landed${failedSuffix}`;
    return `filled ${j.fetched}${failedSuffix}`;
  }
  if (j.mode === 'fill') return 'fill';
  if (j.status === 'done') return `done${failedSuffix}`;
  return j.status;
}

export function HarvestPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [auto, setAuto] = useState(true);
  const [time, setTime] = useState('');
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [z, setZ] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estError, setEstError] = useState<string | undefined>();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | undefined>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const lastKey = useRef('');
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;
  // Newest first (#111) — the API returns Map insertion order (oldest
  // first); sort at render time so it stays correct regardless of API order.
  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobs],
  );

  useEffect(() => subscribeNavMap(setMap), []);

  const reloadProviders = useCallback(() => {
    fetchProviders()
      .then((list) => {
        setProviders(list);
        setProviderId((cur) => {
          if (cur && list.some((p) => p.id === cur)) return cur;
          const def = list.find((p) => p.default) ?? list.find((p) => p.harvestable);
          return def?.id ?? '';
        });
      })
      .catch(() => {
        /* keep whatever providers we already have — a transient fetch
         * failure shouldn't blank the provider dropdown (#111) */
      });
  }, []);

  useEffect(() => {
    reloadProviders();
  }, [reloadProviders]);

  const provider = useMemo(() => providers.find((p) => p.id === providerId), [providers, providerId]);

  useEffect(() => {
    if (!map) return;
    if (map.isStyleLoaded()) ensureBboxLayer(map);
    else map.once('load', () => ensureBboxLayer(map));
  }, [map]);

  const syncView = useCallback(() => {
    if (!map || !provider) return;
    const v = readView(map, provider);
    if (!v) return;
    setBbox(v.bbox);
    setZ(v.z);
  }, [map, provider]);

  useEffect(() => {
    if (!map) return;
    syncView();
    map.on('moveend', syncView);
    map.on('zoomend', syncView);
    return () => {
      map.off('moveend', syncView);
      map.off('zoomend', syncView);
    };
  }, [map, syncView]);

  useEffect(() => {
    if (!map) return;
    const src = map.getSource(BBOX_SOURCE) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(bbox ? rectFeature(bbox) : { type: 'FeatureCollection', features: [] });
  }, [map, bbox]);

  useEffect(() => {
    if (!provider || !bbox || z == null) {
      setEstimate(null);
      return;
    }
    const t = window.setTimeout(() => {
      setEstError(undefined);
      fetchEstimate({ providerId: provider.id, bbox, minZoom: z, maxZoom: z })
        .then(setEstimate)
        .catch((e) => {
          setEstimate(null);
          setEstError(e instanceof Error ? e.message : String(e));
        });
    }, 300);
    return () => window.clearTimeout(t);
  }, [provider, bbox, z]);

  useEffect(() => {
    let stop = false;
    const tick = () => fetchJobs().then((j) => !stop && setJobs(j)).catch(() => {});
    tick();
    const t = window.setInterval(tick, 4000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  const secretBlocked = provider?.access === 'secret' && !provider.secretConfigured;
  const stub = Boolean(provider && NO_AUTO.has(provider.id));
  const tooFar = z != null && z < AUTO_MIN_ZOOM;
  const overLimit = estimate != null && !estimate.withinLimit;
  const quotaBlocked = estimate != null && !estimate.quota.ok;
  const tooMany = estimate != null && estimate.tileCount > AUTO_MAX_TILES;
  const canHarvest = Boolean(
    provider && bbox && z != null && !secretBlocked && !overLimit && !quotaBlocked && !starting && !stub,
  );

  const startHarvest = useCallback(
    async (reason: 'auto' | 'manual') => {
      if (!provider || !bbox || z == null) return;
      if (secretBlocked || stub) return;
      if (reason === 'auto' && (tooFar || tooMany || overLimit || quotaBlocked)) return;
      const key = viewKey(provider.id, bbox, z);
      if (reason === 'auto' && lastKey.current === key) return;
      if (alreadyHave(jobsRef.current, provider.id, bbox, z)) {
        lastKey.current = key;
        return;
      }
      setStarting(true);
      setStartError(undefined);
      try {
        await startJob({
          providerId: provider.id,
          region: regionName(bbox, z),
          bbox,
          minZoom: z,
          maxZoom: z,
          time: provider.id === 'nasa-gibs' && time ? time : undefined,
        });
        lastKey.current = key;
        setJobs(await fetchJobs());
      } catch (e) {
        setStartError(e instanceof Error ? e.message : String(e));
      } finally {
        setStarting(false);
      }
    },
    [provider, bbox, z, secretBlocked, stub, tooFar, tooMany, overLimit, quotaBlocked, time],
  );

  useEffect(() => {
    if (!auto || !canHarvest || !estimate) return;
    const t = window.setTimeout(() => {
      void startHarvest('auto');
    }, AUTO_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [auto, canHarvest, estimate, startHarvest]);

  return (
    <section className="hv">
      <div className="hv-head">
        <span>Charts ⇩ download</span>
        <label className="hv-auto">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto this view
        </label>
      </div>

      <label className="hv-field">
        <span>Provider</span>
        <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {providers
            .filter((p) => p.harvestable && p.kind !== 'bathymetry')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.access === 'secret' && !p.secretConfigured ? ' (needs server secret)' : ''}
              </option>
            ))}
        </select>
      </label>

      <div className="hv-head">
        <span>Imported (USB / drop-in)</span>
      </div>
      <p className="hv-muted">
        Nautical/satellite archives you copied in. Overlay stays off until you check a set (and
        Layers → Imported charts). Pick folder + files in the Imported panel — Mac: a small
        subset; F8: the circumnavigation dump.
      </p>
      <ImportedSets kinds={['nautical', 'satellite']} />

      {provider?.attribution ? <p className="hv-attribution">© {provider.attribution}</p> : null}
      {provider?.notes ? <p className="hv-note">{provider.notes}</p> : null}
      {provider?.access === 'secret' && provider.secretEnv ? (
        <SecretField
          secretEnv={provider.secretEnv}
          configured={provider.secretConfigured}
          onChange={reloadProviders}
        />
      ) : null}
      {stub && provider?.id === 'noaa-enc' ? (
        <p className="hv-wait">NOAA ENC is a coverage stub (no GDAL in this container) — not auto-harvested.</p>
      ) : null}

      {provider?.id === 'nasa-gibs' ? (
        <label className="hv-field">
          <span>Date (optional — most recent if blank)</span>
          <input type="date" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      ) : null}

      {bbox && z != null ? (
        <p className="hv-muted mono">
          view z{z} · {bbox[1].toFixed(3)}°,{bbox[0].toFixed(3)}° → {bbox[3].toFixed(3)}°,{bbox[2].toFixed(3)}°
        </p>
      ) : (
        <p className="hv-muted">Waiting for the chart…</p>
      )}
      {tooFar ? (
        <p className="hv-wait">Zoom in to z{AUTO_MIN_ZOOM}+ to auto-harvest this view.</p>
      ) : null}

      {estError ? <p className="hv-bad">{estError}</p> : null}
      {estimate ? (
        <div className="hv-estimate">
          <span>
            ~{estimate.tileCount.toLocaleString()} tiles at z{z}
            {estimate.limitTiles != null ? ` (limit ${estimate.limitTiles.toLocaleString()})` : ''}
          </span>
          <span className={overLimit || tooMany ? 'hv-bad' : 'hv-muted'}>
            {overLimit
              ? 'Exceeds export limit — zoom in.'
              : tooMany
                ? `Auto skips views over ${AUTO_MAX_TILES} tiles — zoom in.`
                : ''}
          </span>
          <span className="hv-muted">
            harvest disk: {formatBytes(estimate.quota.usedBytes)} / {formatBytes(estimate.quota.quotaBytes)}
            {estimate.quota.freeBytes != null ? ` · ${formatBytes(estimate.quota.freeBytes)} free` : ''}
          </span>
          {quotaBlocked ? <span className="hv-bad">Disk quota/free-space limit reached.</span> : null}
        </div>
      ) : null}

      {startError ? <p className="hv-bad">{startError}</p> : null}
      <button
        type="button"
        disabled={!canHarvest || tooFar || tooMany}
        onClick={() => void startHarvest('manual')}
      >
        {starting ? 'Harvesting…' : auto ? 'Harvest this view now' : 'Harvest this view'}
      </button>
      {auto ? (
        <p className="hv-muted">
          Auto uses the selected provider on the current map view after you stop panning.
        </p>
      ) : null}

      <div className="hv-jobs">
        <div className="hv-head">
          <span>Jobs</span>
        </div>
        {sortedJobs.length === 0 ? <p className="hv-muted">No harvest jobs yet.</p> : null}
        {sortedJobs.map((j) => (
          <div key={j.id} className="hv-job">
            <div className="hv-job-top">
              <span className={statusClass(j.status, j.failed)}>{jobLabel(j)}</span>
              <span>{j.providerLabel}</span>
            </div>
            <div className="hv-muted mono">
              {j.outDir}
              {j.sourceDate ? ` · ${j.sourceDate}` : ''}
            </div>
            {j.status === 'running' || j.status === 'queued' ? (
              <div className="hv-bar">
                <div className="hv-bar-fill" style={{ width: `${j.total ? (100 * j.completed) / j.total : 0}%` }} />
              </div>
            ) : null}
            {j.error ? <p className="hv-note">{j.error}</p> : null}
            {j.notes && j.status === 'done' && j.mode === 'fill' && !j.fetched ? (
              <p className="hv-note">{j.notes}</p>
            ) : null}
            {j.status === 'error' || j.status === 'interrupted' ? (
              <button type="button" className="ghost" onClick={() => resumeJob(j.id).then(() => fetchJobs().then(setJobs))}>
                Resume
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
