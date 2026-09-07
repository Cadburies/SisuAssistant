import type { NavPlugin } from '../../app/plugin';
import { WeatherPanel } from './WeatherPanel';

export const plugin: NavPlugin = {
  id: 'weather',
  title: 'Weather',
  slot: 'panel',
  Component: WeatherPanel,
};
