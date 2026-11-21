import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { AircraftPanel } from './AircraftPanel';

registerLayer({ id: 'aircraft', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'aircraft',
  title: 'Aircraft',
  slot: 'panel',
  group: 'traffic',
  order: 33,
  Component: AircraftPanel,
};
