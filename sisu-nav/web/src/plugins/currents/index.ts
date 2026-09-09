import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { CurrentsPanel } from './CurrentsPanel';

registerLayer({ id: 'currents', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'currents',
  title: 'Currents',
  slot: 'panel',
  order: 24,
  Component: CurrentsPanel,
};
