import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { EnsemblePanel } from './EnsemblePanel';

registerLayer({ id: 'ens-ecmwf', ready: true });

export const plugin: NavPlugin = {
  id: 'ensemble',
  title: 'Ensemble',
  slot: 'panel',
  order: 21,
  Component: EnsemblePanel,
};
