import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { SatellitesPanel } from './SatellitesPanel';

registerLayer({ id: 'satellites', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'satellites',
  title: 'Satellites',
  slot: 'panel',
  order: 34,
  Component: SatellitesPanel,
};
