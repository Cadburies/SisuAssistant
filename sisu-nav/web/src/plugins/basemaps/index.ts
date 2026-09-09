import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { BasemapsPanel } from './BasemapsPanel';

// Free/keyless — no config needed, ready immediately.
registerLayer({ id: 'esri-live', ready: true });
registerLayer({ id: 'osm-live', ready: true });
// mapbox-live's ready state is flipped in BasemapsPanel once RuntimeConfig
// loads (depends on whether MAPBOX_ACCESS_TOKEN is configured server-side).
// google-live/bing-live stay stub (ready: false) — not implemented yet.

export const plugin: NavPlugin = {
  id: 'basemaps',
  title: 'Basemap',
  slot: 'panel',
  order: 22,
  Component: BasemapsPanel,
};
