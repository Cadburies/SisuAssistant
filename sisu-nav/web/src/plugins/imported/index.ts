import type { NavPlugin } from '../../app/plugin';

/** USB import is a drawer on Charts, not its own sidebar panel. */
export const plugin: NavPlugin = {
  id: 'imported',
  title: 'Imported',
  slot: 'none',
  order: 29,
};
