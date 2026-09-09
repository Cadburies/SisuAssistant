import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { HazardsPanel } from './HazardsPanel';

registerLayer({ id: 'hazards-cables', ready: true });

export const plugin: NavPlugin = {
  id: 'hazards',
  title: 'Hazards',
  slot: 'panel',
  order: 24,
  Component: HazardsPanel,
};
