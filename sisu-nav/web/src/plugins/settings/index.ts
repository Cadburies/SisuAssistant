import type { NavPlugin } from '../../app/plugin';
import { SettingsPanel } from './SettingsPanel';

export const plugin: NavPlugin = {
  id: 'settings',
  title: 'Settings',
  slot: 'panel',
  order: 40,
  Component: SettingsPanel,
};
