import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, registerLayer, subscribeLayers, type LayerId } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { basemapDef, setBasemap } from './overlay';
import './basemaps.css';

const LIVE_IDS: LayerId[] = ['esri-live', 'osm-live', 'mapbox-live', 'google-live', 'bing-live'];

const LABELS: Record<LayerId, string> = {
  'esri-live': 'Esri World Imagery',
  'osm-live': 'OpenStreetMap',
  'mapbox-live': 'Mapbox Satellite',
  'google-live': 'Google Satellite',
  'bing-live': 'Bing Aerial',
} as Record<LayerId, string>;

export function BasemapsPanel({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setLayerTick] = useState(0);

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  // mapbox-live's availability depends on whether the operator configured
  // MAPBOX_ACCESS_TOKEN — flip it once config has loaded, same "stub until
  // ready()" mechanism every other gated layer uses.
  useEffect(() => {
    registerLayer({ id: 'mapbox-live', ready: Boolean(config.mapboxToken) });
  }, [config.mapboxToken]);

  const active = LIVE_IDS.find((id) => isLayerOn(id)) ?? null;

  useEffect(() => {
    if (!map) return;
    if (!active) {
      setBasemap(map, null);
      return;
    }
    setBasemap(map, basemapDef(active, config.mapboxToken));
  }, [map, active, config.mapboxToken]);

  useEffect(() => {
    return () => {
      if (map) setBasemap(map, null);
    };
  }, [map]);

  return (
    <section className="bml">
      <div className="bml-head">
        <span>Basemap</span>
      </div>
      <p className="bml-muted">
        {active ? `${LABELS[active]} — live, un-cached` : 'Chart default. Toggle a live basemap in Layers.'}
      </p>
    </section>
  );
}
