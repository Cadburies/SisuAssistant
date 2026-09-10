import type { NavPlugin } from '../../app/plugin';
import { ImportPanel } from './ImportPanel';

export const plugin: NavPlugin = {
  id: 'imported',
  title: 'Imported',
  slot: 'panel',
  order: 29,
  Component: ImportPanel,
};
