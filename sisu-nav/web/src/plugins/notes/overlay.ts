import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import type { Note } from './types';

const SRC = 'sisu-notes';
const LAYER = `${SRC}-pin`;
const LABEL = `${SRC}-label`;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function toFeatureCollection(notes: Note[], selectedId?: string): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: notes
      .filter((n) => Number.isFinite(n.position?.latitude) && Number.isFinite(n.position?.longitude))
      .map((n) => ({
        type: 'Feature',
        properties: { id: n.id, name: n.name, selected: n.id === selectedId },
        geometry: { type: 'Point', coordinates: [n.position.longitude, n.position.latitude] },
      })),
  };
}

export function paintNotes(map: MapLibreMap, notes: Note[], selectedId?: string): void {
  const data = toFeatureCollection(notes, selectedId);
  const src = map.getSource(SRC) as GeoJSONSource | undefined;
  if (!src) {
    map.addSource(SRC, { type: 'geojson', data });
    map.addLayer({
      id: LAYER,
      type: 'circle',
      source: SRC,
      paint: {
        'circle-radius': ['case', ['get', 'selected'], 8, 6],
        'circle-color': '#3ec6d8',
        'circle-stroke-color': ['case', ['get', 'selected'], '#ffffff', '#0b1016'],
        'circle-stroke-width': 2,
      },
    });
    map.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SRC,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#e7eef6',
        'text-halo-color': '#0b1016',
        'text-halo-width': 1,
      },
    });
    return;
  }
  src.setData(data);
}

export function clearNotes(map: MapLibreMap): void {
  const src = map.getSource(SRC) as GeoJSONSource | undefined;
  if (src) src.setData(EMPTY);
}

/** Click a pin to select it. Returns an unsubscribe for cleanup. */
export function bindNoteClicks(map: MapLibreMap, onSelect: (id: string) => void): () => void {
  const handler = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    const id = f?.properties?.id;
    if (typeof id === 'string') onSelect(id);
  };
  const onEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const onLeave = () => {
    map.getCanvas().style.cursor = '';
  };
  if (!map.getLayer(LAYER)) return () => {};
  map.on('click', LAYER, handler);
  map.on('mouseenter', LAYER, onEnter);
  map.on('mouseleave', LAYER, onLeave);
  return () => {
    map.off('click', LAYER, handler);
    map.off('mouseenter', LAYER, onEnter);
    map.off('mouseleave', LAYER, onLeave);
  };
}
