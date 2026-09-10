import type { Map as MapLibreMap } from 'maplibre-gl';

const SRC = 'openseamap-seamark';
const LAYER = 'openseamap-seamark-raster';

function remove(map: MapLibreMap): void {
  if (map.getLayer(LAYER)) map.removeLayer(LAYER);
  if (map.getSource(SRC)) map.removeSource(SRC);
}

/** Transparent seamark PNG overlay (#125). Not a basemap. */
export function setOpenSeaMap(map: MapLibreMap, on: boolean): void {
  remove(map);
  if (!on || !map.isStyleLoaded()) return;
  map.addSource(SRC, {
    type: 'raster',
    tiles: ['https://t1.openseamap.org/seamark/{z}/{x}/{y}.png'],
    tileSize: 256,
    minzoom: 9,
    maxzoom: 18,
    attribution: '© OpenSeaMap © OpenStreetMap',
  });
  const before = map.getLayer('track-line') ? 'track-line' : undefined;
  map.addLayer(
    {
      id: LAYER,
      type: 'raster',
      source: SRC,
      paint: { 'raster-opacity': 1 },
    },
    before,
  );
}

export function clearOpenSeaMap(map: MapLibreMap | null): void {
  if (map) remove(map);
}
