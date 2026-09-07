import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { RosePanel } from './RosePanel';

registerLayer({ id: 'roses', ready: true });

export const plugin: NavPlugin = {
  id: 'roses',
  title: 'Wind roses',
  slot: 'panel',
  order: 26,
  Component: RosePanel,
};
