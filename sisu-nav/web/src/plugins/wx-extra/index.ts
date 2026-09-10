import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { WxExtraPanel } from './WxExtraPanel';

registerLayer({ id: 'rain', ready: true, defaultOn: false });
registerLayer({ id: 'clouds', ready: true, defaultOn: false });
registerLayer({ id: 'radar', ready: true, defaultOn: false });
registerLayer({ id: 'dust', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'wx-extra',
  title: 'Sky',
  slot: 'panel',
  order: 19,
  Component: WxExtraPanel,
};
