import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { subscribeNavMap } from '../map/registry';
import { fetchEstimate, fetchJobs, startJob } from './api';
import type { Bbox, Estimate, Job, Provider } from './types';

const AUTO_MIN_ZOOM = 8;
const AUTO_DEBOUNCE_MS = 1600;
const AUTO_MAX_TILES = 400;
const FILL_KEY = 'sisu-nav.chart.fill';

function readFill(id: string, fallback: boolean): boolean {
  try {
    const all = JSON.parse(localStorage.getItem(FILL_KEY) || '{}') as Record<string, unknown>;
    if (typeof all[id] === 'boolean') return all[id];
  } catch {
    /* private mode */
  }
  return fallback;
}

function writeFill(id: string, on: boolean): void {
  try {
    const all = JSON.parse(localStorage.getItem(FILL_KEY) || '{}') as Record<string, boolean>;
    all[id] = on;
    localStorage.setItem(FILL_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

function q(n: number): number {
  return Math.round(n * 100);
}

function viewKey(providerId: string, bbox: Bbox, z: number): string {
  return `${providerId}|${q(bbox[0])}|${q(bbox[1])}|${q(bbox[2])}|${q(bbox[3])}|${z}`;
}

function bboxContains(outer: Bbox, inner: Bbox, eps = 0.03): boolean {
  return outer[0] <= inner[0] + eps && outer[1] <= inner[1] + eps && outer[2] >= inner[2] - eps && outer[3] >= inner[3] - eps;
}

function alreadyHave(jobs: Job[], providerId: string, bbox: Bbox, z: number): boolean {
  return jobs.some((j) => {
    if (j.providerId !== providerId) return false;
    if (j.minZoom > z || j.maxZoom < z) return false;
    if (!['queued', 'running', 'done', 'skipped'].includes(j.status)) return false;
    return bboxContains(j.bbox, bbox);
  });
}

export function regionName(bbox: Bbox, z: number): string {
  const lat = (bbox[1] + bbox[3]) / 2;
  const lon = (bbox[0] + bbox[2]) / 2;
  const ns = lat >= 0 ? 'n' : 's';
  const ew = lon >= 0 ? 'e' : 'w';
  return `z${z}-${Math.abs(lat).toFixed(2)}${ns}-${Math.abs(lon).toFixed(2)}${ew}`;
}

export function useViewHarvest(provider: Provider | null, time = '', allowAuto = true) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [z, setZ] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estError, setEstError] = useState<string | undefined>();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | undefined>();
  const [auto, setAutoState] = useState(false);
  const lastKey = useRef('');
  const jobsRef = useRef<Job[]>([]);

  useEffect(() => subscribeNavMap(setMap), []);

  const fillFallback = Boolean(provider && provider.autoHarvest !== false && !provider.stub);
  useEffect(() => {
    if (!provider) {
      setAutoState(false);
      return;
    }
    setAutoState(readFill(provider.id, fillFallback));
  }, [provider, fillFallback]);

  const setAuto = useCallback(
    (on: boolean) => {
      setAutoState(on);
      if (provider) writeFill(provider.id, on);
    },
    [provider],
  );

  const syncView = useCallback(() => {
    if (!map || !provider) return;
    const b = map.getBounds();
    const zoom = Math.round(map.getZoom());
    const clamped = Math.max(provider.minZoom, Math.min(provider.maxZoom, zoom));
    setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    setZ(clamped);
  }, [map, provider]);

  useEffect(() => {
    if (!map) return;
    syncView();
    map.on('moveend', syncView);
    return () => {
      map.off('moveend', syncView);
    };
  }, [map, syncView]);

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
    const tick = () => {
      fetchJobs()
        .then((jobs) => {
          if (!stop) jobsRef.current = jobs;
        })
        .catch(() => {});
    };
    tick();
    const t = window.setInterval(tick, 4000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  const secretBlocked = Boolean(provider?.access === 'secret' && !provider.secretConfigured);
  const stub = Boolean(provider?.stub);
  const tooFar = z != null && z < AUTO_MIN_ZOOM;
  const tooMany = (estimate?.tileCount ?? 0) > AUTO_MAX_TILES;
  const overLimit = estimate ? !estimate.withinLimit : false;
  const quotaBlocked = estimate ? !estimate.quota.ok : false;
  const outOfCoverage = estimate ? estimate.inCoverage === false : false;
  const canStart = Boolean(
    provider && bbox && z != null && !secretBlocked && !overLimit && !quotaBlocked && !starting && !stub && !outOfCoverage,
  );
  const canAuto = canStart && !tooFar && !tooMany && provider?.autoHarvest !== false;

  const start = useCallback(
    async (reason: 'manual' | 'auto') => {
      if (!provider || !bbox || z == null) return;
      if (reason === 'auto' && provider.autoHarvest === false) return;
      const key = viewKey(provider.id, bbox, z);
      if (reason === 'auto' && key === lastKey.current) return;
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
          notes: reason === 'auto' ? 'auto' : '',
        });
        lastKey.current = key;
      } catch (e) {
        setStartError(e instanceof Error ? e.message : String(e));
      } finally {
        setStarting(false);
      }
    },
    [provider, bbox, z, time],
  );

  useEffect(() => {
    if (!allowAuto || !auto || !canAuto || !estimate) return;
    const t = window.setTimeout(() => {
      void start('auto');
    }, AUTO_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [allowAuto, auto, canAuto, estimate, start]);

  return {
    map,
    bbox,
    z,
    estimate,
    estError,
    starting,
    startError,
    auto,
    setAuto,
    canStart,
    canAuto,
    tooFar,
    tooMany,
    overLimit,
    quotaBlocked,
    secretBlocked,
    stub,
    outOfCoverage,
    start,
  };
}
