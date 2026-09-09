import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { BathyPanel } from './BathyPanel';

registerLayer({ id: 'bathy-relief', ready: true, defaultOn: false });
registerLayer({ id: 'bathy-hillshade', ready: true, defaultOn: false });
registerLayer({ id: 'bathy-contours', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'bathy',
  title: 'Bathymetry',
  slot: 'panel',
  order: 31,
  Component: BathyPanel,
};
