import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { BasemapsPanel } from './BasemapsPanel';

// Free/keyless — no config needed, ready immediately.
registerLayer({ id: 'esri-live', ready: true });
registerLayer({ id: 'osm-live', ready: true });
// mapbox-live / google-live / azure-live ready flags are flipped in
// BasemapsPanel once RuntimeConfig loads (token/key presence on the server).

export const plugin: NavPlugin = {
  id: 'basemaps',
  title: 'Basemap',
  slot: 'panel',
  order: 22,
  Component: BasemapsPanel,
};
