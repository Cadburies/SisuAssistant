import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { OpenSeaMapPanel } from './OpenSeaMapPanel';

registerLayer({ id: 'openseamap', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'openseamap',
  title: 'OpenSeaMap',
  slot: 'panel',
  order: 28,
  Component: OpenSeaMapPanel,
};
