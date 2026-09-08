import type { NavPlugin } from '../../app/plugin';

/** Layout gear is mounted from App.tsx aside header — not a stack panel. */
export const plugin: NavPlugin = {
  id: 'layout',
  title: 'Layout',
  slot: 'none',
};
