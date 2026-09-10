import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import * as satellite from 'satellite.js';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { bindSatsClick, clearSats, paintSats } from './overlay';
import './satellites.css';

type Tle = { name: string; norad: string; line1: string; line2: string };
type Catalog = { groups: Array<{ group: string; sats: Tle[] }>; attribution?: string };

async function loadTle(): Promise<Catalog> {
  const res = await fetch('/api/satellites/tle');
  const body = (await res.json().catch(() => ({}))) as Catalog & { error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function inView(lat: number, lon: number, b: { w: number; s: number; e: number; n: number }): boolean {
  return lat >= b.s && lat <= b.n && lon >= b.w && lon <= b.e;
}

export function SatellitesPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [n, setN] = useState(0);
  const catalog = useRef<Tle[]>([]);
  const recs = useRef<ReturnType<typeof satellite.twoline2satrec>[]>([]);
  const on = isLayerOn('satellites');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setTick((x) => x + 1)), []);

  useEffect(() => {
    if (!on) return;
    let stop = false;
    loadTle()
      .then((cat) => {
        if (stop) return;
        const sats = cat.groups.flatMap((g) => g.sats);
        catalog.current = sats;
        recs.current = sats.map((s) => satellite.twoline2satrec(s.line1, s.line2));
        setError(undefined);
      })
      .catch((e) => {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      stop = true;
    };
  }, [on]);

  useEffect(() => {
    if (!map || !on) {
      if (map) clearSats(map);
      return;
    }
    const unbind = bindSatsClick(map);
    const tick = () => {
      if (!map.isStyleLoaded() || !recs.current.length) return;
      const b = map.getBounds();
      const box = { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() };
      const now = new Date();
      const gmst = satellite.gstime(now);
      const features: GeoJSON.Feature[] = [];
      recs.current.forEach((rec, i) => {
        const pv = satellite.propagate(rec, now);
        const pos = pv?.position;
        if (!pos || typeof pos === 'boolean') return;
        const geo = satellite.eciToGeodetic(pos, gmst);
        const lat = satellite.degreesLat(geo.latitude);
        const lon = satellite.degreesLong(geo.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inView(lat, lon, box)) return;
        const tle = catalog.current[i];
        features.push({
          type: 'Feature',
          properties: { name: tle?.name, norad: tle?.norad },
          geometry: { type: 'Point', coordinates: [lon, lat] },
        });
      });
      setN(features.length);
      paintSats(map, { type: 'FeatureCollection', features });
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(t);
      unbind();
      clearSats(map);
    };
  }, [map, on]);

  return (
    <section className="sat">
      <div className="sat-head">
        <span>Satellites</span>
      </div>
      <p className="sat-muted">
        Ground tracks in this view from CelesTrak TLEs (Dr. T.S. Kelso). Not pass prediction. Toggle in
        Layers.
      </p>
      {on ? <p className="sat-muted">{n} overhead this view</p> : null}
      {error ? <p className="sat-err">{error}</p> : null}
    </section>
  );
}
