import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { WavesPanel } from './WavesPanel';

registerLayer({ id: 'waves', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'waves',
  title: 'Waves',
  slot: 'panel',
  order: 23,
  Component: WavesPanel,
};
