import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { loadTilesets } from '../../app/config';
import type { PluginProps } from '../../app/plugin';
import { subscribeBasemap, subscribeChartSurface } from '../map/basemap';
import { subscribeNavMap } from '../map/registry';
import { clearImportedOverlay, syncImportedOverlay } from './overlay';
import { listEnabledImports, subscribeImports } from './state';

/** Bathymetry-kind USB sets. Nautical and satellite imports are the chart itself. */
export function ImportSync({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [on, setOn] = useState(() => listEnabledImports());
  const [baseTick, setBaseTick] = useState(0);
  const seen = useRef(new Map<string, string>());

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeImports(() => setOn(listEnabledImports())), []);
  useEffect(() => subscribeBasemap(() => setBaseTick((n) => n + 1)), []);
  // The photo layer is added after the chart choice. Repaint once it is on the map.
  useEffect(() => subscribeChartSurface(() => setBaseTick((n) => n + 1)), []);

  useEffect(() => {
    if (!map) return;
    let stop = false;
    let generation = 0;
    const sync = async () => {
      const mine = ++generation;
      const current = () => !stop && generation === mine && Boolean(map.isStyleLoaded());
      const listed = await loadTilesets();
      if (!current()) return;
      await syncImportedOverlay(map, config.tileserver, listed, on, seen.current, current);
    };
    const t = window.setInterval(() => {
      void sync();
    }, 8000);
    void sync();
    return () => {
      stop = true;
      generation += 1;
      window.clearInterval(t);
    };
  }, [map, config.tileserver, on, baseTick]);

  useEffect(() => {
    const current = seen.current;
    return () => clearImportedOverlay(map, current);
  }, [map]);

  return null;
}
