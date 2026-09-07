import type { NavPlugin } from '../../app/plugin';
import { MapView } from './MapView';

export const plugin: NavPlugin = {
  id: 'map',
  title: 'Chart',
  slot: 'map',
  Component: MapView,
};
