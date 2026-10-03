import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';

registerLayer({ id: 'bathy-relief', ready: true, defaultOn: false });
registerLayer({ id: 'bathy-hillshade', ready: true, defaultOn: false });
registerLayer({ id: 'bathy-contours', ready: true, defaultOn: false });

/** No sidebar panel. Depth source choice lives in Charts; these layers stay in Layers. */
export const plugin: NavPlugin = {
  id: 'bathy',
  title: 'Bathymetry',
  slot: 'none',
  order: 31,
};
