import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { bindPoisClick, clearPois, paintPois } from './overlay';
import './pois.css';

async function loadPois(map: MapLibreMap): Promise<GeoJSON.FeatureCollection & { attribution?: string }> {
  const b = map.getBounds();
  const qs = new URLSearchParams({
    west: String(b.getWest()),
    south: String(b.getSouth()),
    east: String(b.getEast()),
    north: String(b.getNorth()),
  });
  const res = await fetch(`/api/pois?${qs}`);
  const body = (await res.json().catch(() => ({}))) as GeoJSON.FeatureCollection & {
    error?: string;
    attribution?: string;
  };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export function PoisPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [n, setN] = useState(0);
  const on = isLayerOn('pois');
  const lastKey = useRef('');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setTick((x) => x + 1)), []);

  useEffect(() => {
    if (!map || !on) {
      if (map) clearPois(map);
      return;
    }
    let stop = false;
    const run = () => {
      const b = map.getBounds();
      const key = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((x) => x.toFixed(2)).join(',');
      if (key === lastKey.current) return;
      lastKey.current = key;
      loadPois(map)
        .then((fc) => {
          if (stop) return;
          setError(undefined);
          setN(fc.features?.length ?? 0);
          paintPois(map, fc);
        })
        .catch((e) => {
          if (!stop) setError(e instanceof Error ? e.message : String(e));
        });
    };
    run();
    let t = 0;
    const onMove = () => {
      window.clearTimeout(t);
      t = window.setTimeout(run, 700);
    };
    map.on('moveend', onMove);
    const unbind = bindPoisClick(map);
    return () => {
      stop = true;
      window.clearTimeout(t);
      map.off('moveend', onMove);
      unbind();
      clearPois(map);
      lastKey.current = '';
    };
  }, [map, on]);

  return (
    <section className="poi">
      <div className="poi-head">
        <span>Provisions</span>
      </div>
      <p className="poi-muted">
        Shops, bars, restaurants, fuel, chandlery, marinas — current view only. © OpenStreetMap
        contributors (ODbL). Toggle in Layers.
      </p>
      {on ? <p className="poi-muted">{n} places in view</p> : null}
      {error ? <p className="poi-err">{error}</p> : null}
    </section>
  );
}
