import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { AisGlobalPanel } from './AisGlobalPanel';

registerLayer({ id: 'ais-global', ready: true });

export const plugin: NavPlugin = {
  id: 'ais-global',
  title: 'AIS (global)',
  slot: 'panel',
  order: 12,
  Component: AisGlobalPanel,
};
