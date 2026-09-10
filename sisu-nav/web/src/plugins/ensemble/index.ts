import type { NavPlugin } from '../../app/plugin';
import { registerLayer } from '../map/layers';
import { EnsemblePanel } from './EnsemblePanel';

registerLayer({ id: 'ens-ecmwf', ready: true });
registerLayer({ id: 'ens-aifs', ready: true, defaultOn: false });
registerLayer({ id: 'ens-gefs', ready: true, defaultOn: false });

export const plugin: NavPlugin = {
  id: 'ensemble',
  title: 'Ensemble',
  slot: 'panel',
  order: 21,
  Component: EnsemblePanel,
};
