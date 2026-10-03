import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { loadTilesets } from '../../app/config';
import type { PluginProps } from '../../app/plugin';
import { subscribeNavMap } from '../map/registry';
import { clearImportedOverlay, syncImportedOverlay } from './overlay';
import { listEnabledImports, subscribeImports } from './state';

/** Bathymetry-kind USB sets. Nautical and satellite imports are the chart itself. */
export function ImportSync({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [on, setOn] = useState(() => listEnabledImports());
  const seen = useRef(new Map<string, string>());

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeImports(() => setOn(listEnabledImports())), []);

  useEffect(() => {
    if (!map) return;
    let stop = false;
    const sync = async () => {
      const listed = await loadTilesets();
      if (stop) return;
      await syncImportedOverlay(map, config.tileserver, listed, on, seen.current);
    };
    const t = window.setInterval(sync, 8000);
    void sync();
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [map, config.tileserver, on]);

  useEffect(() => {
    const current = seen.current;
    return () => clearImportedOverlay(map, current);
  }, [map]);

  return null;
}
