import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { PoisPanel } from './PoisPanel';

registerLayer({ id: 'pois', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'pois',
  title: 'Provisions',
  slot: 'panel',
  order: 32,
  Component: PoisPanel,
};
