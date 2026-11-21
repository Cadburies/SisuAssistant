import type { NavPlugin } from '../../app/plugin';
import { RoutePanel } from './RoutePanel';

export const plugin: NavPlugin = {
  id: 'route',
  title: 'Route',
  slot: 'panel',
  group: 'plan',
  order: 25,
  Component: RoutePanel,
};
