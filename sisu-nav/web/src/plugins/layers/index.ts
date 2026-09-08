import type { NavPlugin } from '../../app/plugin';
import { LayerPicker } from './LayerPicker';

export const plugin: NavPlugin = {
  id: 'layers',
  title: 'Layers',
  slot: 'panel',
  order: 1,
  aside: false,
  Component: LayerPicker,
};
