import type { NavPlugin } from '../../app/plugin';
import { BathyPanel } from './BathyPanel';

export const plugin: NavPlugin = {
  id: 'bathy',
  title: 'Bathymetry',
  slot: 'panel',
  order: 31,
  Component: BathyPanel,
};
