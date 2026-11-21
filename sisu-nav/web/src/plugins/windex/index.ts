import type { NavPlugin } from '../../app/plugin';
import { Windex } from './Windex';

export const plugin: NavPlugin = {
  id: 'windex',
  title: 'Windex',
  slot: 'panel',
  group: 'now',
  order: 10,
  Component: Windex,
};
