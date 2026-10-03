import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { HarvestPanel } from './HarvestPanel';

registerLayer({ id: 'chart-coverage', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'harvest',
  title: 'Charts',
  slot: 'panel',
  order: 30,
  Component: HarvestPanel,
};
