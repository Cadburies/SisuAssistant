import type { NavPlugin } from '../../app/plugin';
import { HarvestPanel } from './HarvestPanel';

export const plugin: NavPlugin = {
  id: 'harvest',
  title: 'Charts',
  slot: 'panel',
  order: 30,
  Component: HarvestPanel,
};
