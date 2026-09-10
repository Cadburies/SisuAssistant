import type { NavPlugin } from '../../app/plugin';

// Live rasters are chosen from the Charts dropdown (#127), not Layers.
// HarvestPanel mounts LiveBasemapSync so this plugin has no UI of its own.
export const plugin: NavPlugin = {
  id: 'basemaps',
  title: 'Basemap',
  slot: 'none',
  order: 22,
};
