import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { clearOpenSeaMap, setOpenSeaMap } from './overlay';
import './openseamap.css';

export function OpenSeaMapPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setLayerTick] = useState(0);
  const on = isLayerOn('openseamap');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  useEffect(() => {
    if (!map) return;
    if (map.isStyleLoaded()) setOpenSeaMap(map, on);
    else map.once('load', () => setOpenSeaMap(map, on));
  }, [map, on]);

  useEffect(() => {
    return () => clearOpenSeaMap(map);
  }, [map]);

  return (
    <section className="osm-sea">
      <div className="osm-sea-head">
        <span>OpenSeaMap</span>
      </div>
      <p className="osm-sea-muted">
        {on
          ? 'Seamarks (buoys, lights, day-marks) overlay the Charts basemap. Zoom in to ~z9+.'
          : 'Enable “OpenSeaMap marks” in Layers. Marks-only — not a chart replacement. No API key.'}
      </p>
    </section>
  );
}
