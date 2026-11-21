import type { NavPlugin } from '../../app/plugin';
import { InstrumentsPanel } from './InstrumentsPanel';

export const plugin: NavPlugin = {
  id: 'instruments',
  title: 'Instruments',
  slot: 'panel',
  group: 'now',
  order: 11,
  Component: InstrumentsPanel,
};
