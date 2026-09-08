import type { ComponentType } from 'react';
import type { RuntimeConfig } from './config';
import type { SignalKSnapshot } from './sk';

export type PluginSlot = 'map' | 'panel' | 'none';

export type PluginProps = {
  sk: SignalKSnapshot;
  config: RuntimeConfig;
};

export type NavPlugin = {
  id: string;
  title: string;
  slot: PluginSlot;
  /** Sidebar stack order. Lower first. Missing sorts last. */
  order?: number;
  /**
   * false = map chrome (e.g. Layers button). Always mounted, never listed
   * in the right-hand stack editor (#109).
   */
  aside?: boolean;
  Component?: ComponentType<PluginProps>;
};
