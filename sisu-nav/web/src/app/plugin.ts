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
  Component?: ComponentType<PluginProps>;
};
