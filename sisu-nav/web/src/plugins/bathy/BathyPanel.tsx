import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { loadTilesets } from '../../app/config';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { fetchEstimate, fetchJobs, fetchProviders, resumeJob, startJob } from '../harvest/api';
import { SecretField } from '../harvest/SecretField';
import type { Bbox, Estimate, Job, Provider } from '../harvest/types';
import { ImportedSets } from '../imported/ImportedSets';
import { clearBathyOverlay, syncBathyOverlay } from './overlay';
import './bathy.css';

const BBOX_SOURCE = 'bathy-bbox';
const AUTO_MIN_ZOOM = 8;
const AUTO_DEBOUNCE_MS = 1600;
const AUTO_MAX_TILES = 400;

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
    paint: { 'fill-color': '#3ec6d8', 'fill-opacity': 0.08 },
  });
  map.addLayer({
    id: `${BBOX_SOURCE}-line`,
    type: 'line',
    source: BBOX_SOURCE,
    paint: { 'line-color': '#3ec6d8', 'line-width': 1.5, 'line-dasharray': [2, 1] },
  });
}

function statusClass(status: Job['status'], failed?: number): string {
  switch (status) {
    case 'done':
    case 'skipped':
      return failed ? 'bt-wait' : 'bt-ok';
    case 'error':
      return 'bt-bad';
    case 'unsupported':
      return 'bt-wait';
    case 'interrupted':
      return 'bt-bad';
    default:
      return 'bt-muted';
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

export function BathyPanel({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [auto, setAuto] = useState(true);
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
  const overlaySeen = useRef(new Map<string, string>());
  const [layerTick, setLayerTick] = useState(0);
  // Newest first, same as Charts (#111) — and this panel only ever shows its
  // own kind so a bathymetry job never mixes with a satellite/nautical one.
  const bathyJobs = useMemo(
    () => jobs.filter((j) => j.kind === 'bathymetry').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobs],
  );

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  useEffect(() => {
    if (!map) return;
    let stop = false;
    const sync = async () => {
      const listed = await loadTilesets();
      if (stop) return;
      await syncBathyOverlay(map, config.tileserver, listed, isLayerOn, overlaySeen.current);
    };
    const t = window.setInterval(sync, 8000);
    void sync();
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [map, config.tileserver, layerTick]);

  useEffect(() => {
    return () => {
      clearBathyOverlay(map, overlaySeen.current);
    };
  }, [map]);

  const reloadProviders = useCallback(() => {
    fetchProviders()
      .then((list) => {
        setProviders(list.filter((p) => p.kind === 'bathymetry'));
      })
      .catch(() => {
        /* keep whatever providers we already have — transient fetch failure */
      });
  }, []);

  useEffect(() => {
    reloadProviders();
  }, [reloadProviders]);

  useEffect(() => {
    setProviderId((cur) => {
      if (cur && providers.some((p) => p.id === cur)) return cur;
      const def = providers.find((p) => p.default) ?? providers.find((p) => p.harvestable);
      return def?.id ?? '';
    });
  }, [providers]);

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
    src.setData(bbox && provider ? rectFeature(bbox) : { type: 'FeatureCollection', features: [] });
  }, [map, bbox, provider]);

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
  const tooFar = z != null && z < AUTO_MIN_ZOOM;
  const overLimit = estimate != null && !estimate.withinLimit;
  const quotaBlocked = estimate != null && !estimate.quota.ok;
  const tooMany = estimate != null && estimate.tileCount > AUTO_MAX_TILES;
  const outOfCoverage = estimate != null && estimate.inCoverage === false;
  const canHarvest = Boolean(
    provider &&
      bbox &&
      z != null &&
      !secretBlocked &&
      !overLimit &&
      !quotaBlocked &&
      !outOfCoverage &&
      !starting,
  );

  const startHarvest = useCallback(
    async (reason: 'auto' | 'manual') => {
      if (!provider || !bbox || z == null) return;
      if (secretBlocked) return;
      if (reason === 'auto' && (tooFar || tooMany || overLimit || quotaBlocked || outOfCoverage)) return;
      if (reason === 'auto' && provider.autoHarvest === false) return;
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
        });
        lastKey.current = key;
        setJobs(await fetchJobs());
      } catch (e) {
        setStartError(e instanceof Error ? e.message : String(e));
      } finally {
        setStarting(false);
      }
    },
    [provider, bbox, z, secretBlocked, tooFar, tooMany, overLimit, quotaBlocked, outOfCoverage],
  );

  useEffect(() => {
    if (!auto || !canHarvest || !estimate) return;
    const t = window.setTimeout(() => {
      void startHarvest('auto');
    }, AUTO_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [auto, canHarvest, estimate, startHarvest]);

  return (
    <section className="bt">
      <div className="bt-head">
        <span>Bathymetry ⇩ download</span>
        <label className="bt-auto">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto this view
        </label>
      </div>

      <p className="bt-banner">
        Not for navigation. ENC / paper charts remain the plotter — depth datum varies by source.
      </p>

      <div className="bt-head">
        <span>Imported (USB / drop-in)</span>
      </div>
      <p className="bt-muted">
        Bathymetry-kind USB drop-ins overlay the Charts basemap. Check a set here (not Layers).
        Folder + file pick is in the Imported panel.
      </p>
      <ImportedSets kinds={['bathymetry']} />

      {providers.length === 0 ? (
        <p className="bt-muted">No harvestable bathymetry providers in this build.</p>
      ) : (
        <label className="bt-field">
          <span>Provider</span>
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            {providers
              .filter((p) => p.harvestable)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                  {p.access === 'secret' && !p.secretConfigured ? ' (needs server secret)' : ''}
                </option>
              ))}
          </select>
        </label>
      )}

      {provider?.attribution ? <p className="bt-attribution">© {provider.attribution}</p> : null}
      {provider?.notes ? <p className="bt-note">{provider.notes}</p> : null}
      {provider?.access === 'secret' && provider.secretEnv ? (
        <SecretField
          secretEnv={provider.secretEnv}
          configured={provider.secretConfigured}
          onChange={reloadProviders}
        />
      ) : null}

      {provider && bbox && z != null ? (
        <p className="bt-muted mono">
          view z{z} · {bbox[1].toFixed(3)}°,{bbox[0].toFixed(3)}° → {bbox[3].toFixed(3)}°,{bbox[2].toFixed(3)}°
        </p>
      ) : provider ? (
        <p className="bt-muted">Waiting for the chart…</p>
      ) : null}
      {provider && tooFar ? <p className="bt-wait">Zoom in to z{AUTO_MIN_ZOOM}+ to auto-harvest this view.</p> : null}

      {outOfCoverage ? (
        <p className="bt-wait">{estimate?.coverageReason || 'no BlueTopo in this view'}</p>
      ) : null}
      {estError ? <p className="bt-bad">{estError}</p> : null}
      {estimate ? (
        <div className="bt-estimate">
          <span>
            ~{estimate.tileCount.toLocaleString()} tiles at z{z}
            {estimate.limitTiles != null ? ` (limit ${estimate.limitTiles.toLocaleString()})` : ''}
          </span>
          <span className={overLimit || tooMany ? 'bt-bad' : 'bt-muted'}>
            {overLimit
              ? 'Exceeds export limit — zoom in.'
              : tooMany
                ? `Auto skips views over ${AUTO_MAX_TILES} tiles — zoom in.`
                : ''}
          </span>
          <span className="bt-muted">
            harvest disk: {formatBytes(estimate.quota.usedBytes)} / {formatBytes(estimate.quota.quotaBytes)}
            {estimate.quota.freeBytes != null ? ` · ${formatBytes(estimate.quota.freeBytes)} free` : ''}
          </span>
          {quotaBlocked ? <span className="bt-bad">Disk quota/free-space limit reached.</span> : null}
        </div>
      ) : null}

      {startError ? <p className="bt-bad">{startError}</p> : null}
      {provider ? (
        <button type="button" disabled={!canHarvest || tooFar || tooMany} onClick={() => void startHarvest('manual')}>
          {starting ? 'Harvesting…' : auto ? 'Harvest this view now' : 'Harvest this view'}
        </button>
      ) : null}
      {provider && auto && provider.autoHarvest === false ? (
        <p className="bt-wait">Auto-harvest is off for this provider (research WMS / paid CDN) — use the button.</p>
      ) : null}
      {provider && auto && provider.autoHarvest !== false ? (
        <p className="bt-muted">Auto uses the selected provider on the current map view after you stop panning.</p>
      ) : null}

      <div className="bt-jobs">
        <div className="bt-head">
          <span>Jobs</span>
        </div>
        {bathyJobs.length === 0 ? <p className="bt-muted">No bathymetry harvest jobs yet.</p> : null}
        {bathyJobs.map((j) => (
          <div key={j.id} className="bt-job">
            <div className="bt-job-top">
              <span className={statusClass(j.status, j.failed)}>{jobLabel(j)}</span>
              <span>{j.providerLabel}</span>
            </div>
            <div className="bt-muted mono">
              {j.outDir}
              {j.sourceDate ? ` · ${j.sourceDate}` : ''}
            </div>
            {j.status === 'running' || j.status === 'queued' ? (
              <div className="bt-bar">
                <div className="bt-bar-fill" style={{ width: `${j.total ? (100 * j.completed) / j.total : 0}%` }} />
              </div>
            ) : null}
            {j.error ? <p className="bt-note">{j.error}</p> : null}
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
