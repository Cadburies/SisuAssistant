import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { bindAircraftClick, clearAircraft, paintAircraft } from './overlay';
import './aircraft.css';

async function load(map: MapLibreMap) {
  const b = map.getBounds();
  const qs = new URLSearchParams({
    west: String(b.getWest()),
    south: String(b.getSouth()),
    east: String(b.getEast()),
    north: String(b.getNorth()),
  });
  const res = await fetch(`/api/aircraft?${qs}`);
  const body = (await res.json().catch(() => ({}))) as GeoJSON.FeatureCollection & { error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export function AircraftPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [n, setN] = useState(0);
  const on = isLayerOn('aircraft');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setTick((x) => x + 1)), []);

  useEffect(() => {
    if (!map || !on) {
      if (map) clearAircraft(map);
      return;
    }
    let stop = false;
    const run = () => {
      load(map)
        .then((fc) => {
          if (stop) return;
          setN(fc.features?.length ?? 0);
          setError(undefined);
          paintAircraft(map, fc);
        })
        .catch((e) => {
          if (!stop) setError(e instanceof Error ? e.message : String(e));
        });
    };
    run();
    const t = window.setInterval(run, 12000);
    const onMove = () => run();
    map.on('moveend', onMove);
    const unbind = bindAircraftClick(map);
    return () => {
      stop = true;
      window.clearInterval(t);
      map.off('moveend', onMove);
      unbind();
      clearAircraft(map);
    };
  }, [map, on]);

  return (
    <section className="ac">
      <div className="ac-head">
        <span>Aircraft</span>
      </div>
      <p className="ac-muted">Live ADS-B in this view (adsb.lol, ODbL). Not collision-avoidance. Toggle in Layers.</p>
      {on ? <p className="ac-muted">{n} aircraft</p> : null}
      {error ? <p className="ac-err">{error}</p> : null}
    </section>
  );
}
