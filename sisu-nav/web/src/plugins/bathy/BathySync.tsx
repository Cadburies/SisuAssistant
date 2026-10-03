import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { loadTilesets } from '../../app/config';
import type { PluginProps } from '../../app/plugin';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { depthProviderIds, subscribeDepth } from './choice';
import { clearBathyOverlay, syncBathyOverlay } from './overlay';

/** Paints the depth providers chosen in Charts. Mounted with the Charts panel. */
export function BathySync({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [ids, setIds] = useState(() => depthProviderIds());
  const [layerTick, setLayerTick] = useState(0);
  const seen = useRef(new Map<string, string>());

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(
    () =>
      subscribeDepth(() => {
        setIds((cur) => {
          const next = depthProviderIds();
          return cur.join('|') === next.join('|') ? cur : next;
        });
      }),
    [],
  );
  useEffect(() => subscribeLayers(() => setLayerTick((n) => n + 1)), []);

  useEffect(() => {
    if (!map) return;
    let stop = false;
    const sync = async () => {
      const listed = await loadTilesets();
      if (stop) return;
      await syncBathyOverlay(map, config.tileserver, listed, isLayerOn, seen.current, ids);
    };
    const t = window.setInterval(sync, 3000);
    void sync();
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [map, config.tileserver, ids, layerTick]);

  useEffect(() => {
    const current = seen.current;
    return () => clearBathyOverlay(map, current);
  }, [map]);

  return null;
}
