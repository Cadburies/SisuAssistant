import type { ComponentType } from 'react';
import type { RuntimeConfig } from './config';
import type { SignalKSnapshot } from './sk';

export type PluginSlot = 'map' | 'panel' | 'none';

/** Right-stack domains (#253). `now` is pinned and always open. */
export type PluginGroup = 'now' | 'weather' | 'traffic' | 'plan' | 'charts' | 'setup';

export const GROUP_ORDER: PluginGroup[] = ['now', 'weather', 'traffic', 'plan', 'charts', 'setup'];

export const GROUP_TITLES: Record<PluginGroup, string> = {
  now: 'NOW',
  weather: 'WEATHER',
  traffic: 'TRAFFIC',
  plan: 'PLAN',
  charts: 'CHARTS',
  setup: 'SETUP',
};

export type PluginProps = {
  sk: SignalKSnapshot;
  config: RuntimeConfig;
};

export type NavPlugin = {
  id: string;
  title: string;
  slot: PluginSlot;
  /** Right-stack domain. Missing falls back to `plan` so a new plugin never disappears. */
  group?: PluginGroup;
  /** Sidebar stack order. Lower first. Missing sorts last. */
  order?: number;
  /**
   * false = map chrome (e.g. Layers button). Always mounted, never listed
   * in the right-hand stack editor (#109).
   */
  aside?: boolean;
  Component?: ComponentType<PluginProps>;
};

export function groupOf(plugin: NavPlugin): PluginGroup {
  return plugin.group ?? 'plan';
}
