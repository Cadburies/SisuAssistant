import type { NavPlugin } from '../../app/plugin';
import { NotesPanel } from './NotesPanel';

export const plugin: NavPlugin = {
  id: 'notes',
  title: 'Notes',
  slot: 'panel',
  group: 'plan',
  order: 27,
  Component: NotesPanel,
};
