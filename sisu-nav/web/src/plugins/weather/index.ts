import type { NavPlugin } from '../../app/plugin';

/** Stub so the glob loader is proven without editing App.tsx. Logic is #77. */
export const plugin: NavPlugin = {
  id: 'weather',
  title: 'Weather',
  slot: 'none',
};
