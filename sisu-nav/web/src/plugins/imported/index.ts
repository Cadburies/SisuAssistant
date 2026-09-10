import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { ImportPanel } from './ImportPanel';

registerLayer({ id: 'imported-charts', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'imported',
  title: 'Imported',
  slot: 'panel',
  order: 29,
  Component: ImportPanel,
};
