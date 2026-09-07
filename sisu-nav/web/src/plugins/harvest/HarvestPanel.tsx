import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { subscribeNavMap } from '../map/registry';
import { fetchEstimate, fetchJobs, fetchProviders, resumeJob, startJob } from './api';
import type { Bbox, Estimate, Job, Provider } from './types';
import './harvest.css';

const BBOX_SOURCE = 'harvest-bbox';

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
          coordinates: [
            [
              [w, s],
              [e, s],
              [e, n],
              [w, n],
              [w, s],
            ],
          ],
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
    paint: { 'fill-color': '#e0b43a', 'fill-opacity': 0.12 },
  });
  map.addLayer({
    id: `${BBOX_SOURCE}-line`,
    type: 'line',
    source: BBOX_SOURCE,
    paint: { 'line-color': '#e0b43a', 'line-width': 2, 'line-dasharray': [2, 1] },
  });
}

function statusClass(status: Job['status']): string {
  switch (status) {
    case 'done':
      return 'hv-ok';
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

export function HarvestPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [region, setRegion] = useState('bvi');
  const [minZoom, setMinZoom] = useState(8);
  const [maxZoom, setMaxZoom] = useState(12);
  const [time, setTime] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estError, setEstError] = useState<string | undefined>();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | undefined>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const cornersRef = useRef<[number, number][]>([]);

  useEffect(() => subscribeNavMap(setMap), []);

  useEffect(() => {
    fetchProviders()
      .then((list) => {
        setProviders(list);
        const def = list.find((p) => p.default) ?? list.find((p) => p.harvestable);
        if (def) {
          setProviderId(def.id);
          setMaxZoom(Math.min(def.maxZoom, 12));
        }
      })
      .catch(() => setProviders([]));
  }, []);

  const provider = useMemo(() => providers.find((p) => p.id === providerId), [providers, providerId]);

  // Clamp zoom inputs whenever the selected provider changes.
  useEffect(() => {
    if (!provider) return;
    setMinZoom((z) => Math.max(provider.minZoom, Math.min(provider.maxZoom, z)));
    setMaxZoom((z) => Math.max(provider.minZoom, Math.min(provider.maxZoom, z)));
  }, [provider]);

  useEffect(() => {
    if (!map) return;
    if (map.isStyleLoaded()) ensureBboxLayer(map);
    else map.once('load', () => ensureBboxLayer(map));
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const src = map.getSource(BBOX_SOURCE) as GeoJSONSource | undefined;
    if (!src) return;
    src.setData(bbox ? rectFeature(bbox) : { type: 'FeatureCollection', features: [] });
  }, [map, bbox]);

  useEffect(() => {
    if (!map || !drawing) return;
    const onClick = (e: MapMouseEvent) => {
      cornersRef.current.push([e.lngLat.lng, e.lngLat.lat]);
      if (cornersRef.current.length === 2) {
        const [[x1, y1], [x2, y2]] = cornersRef.current;
        setBbox([Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)]);
        cornersRef.current = [];
        setDrawing(false);
      }
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, drawing]);

  // Estimate, debounced, whenever the request shape changes.
  useEffect(() => {
    if (!provider || !bbox) {
      setEstimate(null);
      return;
    }
    const t = window.setTimeout(() => {
      setEstError(undefined);
      fetchEstimate({ providerId: provider.id, bbox, minZoom, maxZoom })
        .then(setEstimate)
        .catch((e) => {
          setEstimate(null);
          setEstError(e instanceof Error ? e.message : String(e));
        });
    }, 300);
    return () => window.clearTimeout(t);
  }, [provider, bbox, minZoom, maxZoom]);

  // Poll job list — cheap, and the only way to see jobs resumed from disk after a restart.
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

  async function onStart() {
    if (!provider || !bbox) return;
    setStarting(true);
    setStartError(undefined);
    try {
      await startJob({
        providerId: provider.id,
        region,
        bbox,
        minZoom,
        maxZoom,
        time: provider.id === 'nasa-gibs' && time ? time : undefined,
      });
      const j = await fetchJobs();
      setJobs(j);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  const secretBlocked = provider?.access === 'secret' && !provider.secretConfigured;
  const overLimit = estimate != null && !estimate.withinLimit;
  const quotaBlocked = estimate != null && !estimate.quota.ok;
  const canStart = Boolean(provider && bbox && !secretBlocked && !overLimit && !quotaBlocked && !starting);

  return (
    <section className="hv">
      <div className="hv-head">
        <span>Charts ⇩ download</span>
      </div>

      <label className="hv-field">
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

      {provider?.attribution ? <p className="hv-attribution">© {provider.attribution}</p> : null}
      {provider?.notes ? <p className="hv-note">{provider.notes}</p> : null}
      {secretBlocked ? (
        <p className="hv-bad">
          Requires <code>{provider?.secretEnv}</code> set on the server — refusing to run without it.
        </p>
      ) : null}

      <div className="hv-row">
        <label className="hv-field hv-narrow">
          <span>Min zoom</span>
          <input
            type="number"
            value={minZoom}
            min={provider?.minZoom ?? 0}
            max={provider?.maxZoom ?? 18}
            onChange={(e) => setMinZoom(Number(e.target.value))}
          />
        </label>
        <label className="hv-field hv-narrow">
          <span>Max zoom</span>
          <input
            type="number"
            value={maxZoom}
            min={provider?.minZoom ?? 0}
            max={provider?.maxZoom ?? 18}
            onChange={(e) => setMaxZoom(Number(e.target.value))}
          />
        </label>
      </div>

      <label className="hv-field">
        <span>Region name (folder)</span>
        <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="bvi" />
      </label>

      {provider?.id === 'nasa-gibs' ? (
        <label className="hv-field">
          <span>Date (optional — most recent if blank)</span>
          <input type="date" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      ) : null}

      <div className="hv-row">
        <button type="button" className={drawing ? 'active' : ''} onClick={() => setDrawing((v) => !v)}>
          {drawing ? 'Click two corners…' : bbox ? 'Redraw area' : 'Draw area on map'}
        </button>
        {bbox ? (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setBbox(null);
              setDrawing(false);
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {bbox ? (
        <p className="hv-muted mono">
          {bbox[1].toFixed(3)}°,{bbox[0].toFixed(3)}° → {bbox[3].toFixed(3)}°,{bbox[2].toFixed(3)}°
        </p>
      ) : (
        <p className="hv-muted">Click "Draw area on map", then click two opposite corners.</p>
      )}

      {estError ? <p className="hv-bad">{estError}</p> : null}
      {estimate ? (
        <div className="hv-estimate">
          <span>
            ~{estimate.tileCount.toLocaleString()} tiles
            {estimate.limitTiles != null ? ` (limit ${estimate.limitTiles.toLocaleString()})` : ''}
          </span>
          <span className={overLimit ? 'hv-bad' : 'hv-muted'}>
            {overLimit ? 'Exceeds export limit — narrow the area or zoom.' : ''}
          </span>
          <span className="hv-muted">
            harvest disk: {formatBytes(estimate.quota.usedBytes)} / {formatBytes(estimate.quota.quotaBytes)}
            {estimate.quota.freeBytes != null ? ` · ${formatBytes(estimate.quota.freeBytes)} free` : ''}
          </span>
          {quotaBlocked ? <span className="hv-bad">Disk quota/free-space limit reached.</span> : null}
        </div>
      ) : null}

      {startError ? <p className="hv-bad">{startError}</p> : null}
      <button type="button" disabled={!canStart} onClick={onStart}>
        {starting ? 'Starting…' : 'Start harvest'}
      </button>

      <div className="hv-jobs">
        <div className="hv-head">
          <span>Jobs</span>
        </div>
        {jobs.length === 0 ? <p className="hv-muted">No harvest jobs yet.</p> : null}
        {jobs.map((j) => (
          <div key={j.id} className="hv-job">
            <div className="hv-job-top">
              <span className={statusClass(j.status)}>{j.status}</span>
              <span>{j.providerLabel}</span>
            </div>
            <div className="hv-muted mono">{j.outDir}</div>
            {j.status === 'running' || j.status === 'queued' ? (
              <div className="hv-bar">
                <div className="hv-bar-fill" style={{ width: `${j.total ? (100 * j.completed) / j.total : 0}%` }} />
              </div>
            ) : null}
            {j.error ? <p className="hv-note">{j.error}</p> : null}
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
