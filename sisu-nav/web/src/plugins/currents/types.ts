export type CurrentSample = {
  velocityKn: number | null;
  dir: number | null;
};

export type CurrentCell = {
  lat: number;
  lon: number;
  velocityKn: Array<number | null>;
  dir: Array<number | null>;
};

export type CurrentForecast = {
  cellSelection: string;
  model: { id: string; label: string };
  ttlSec: number;
  fetchedAt: string;
  step: number;
  times: string[];
  cells: CurrentCell[];
  seaCount: number;
  units?: { velocity: string; direction: string };
  openMeteo?: { models: string; cell_selection: string; wind_speed_unit?: string };
};

export function sampleAt(cell: CurrentCell, timeIndex: number): CurrentSample {
  return {
    velocityKn: cell.velocityKn[timeIndex] ?? null,
    dir: cell.dir[timeIndex] ?? null,
  };
}
