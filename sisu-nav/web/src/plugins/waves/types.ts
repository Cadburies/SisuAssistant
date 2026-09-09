export type WaveSample = {
  hs: number | null;
  dir: number | null;
  swellHs: number | null;
  swellDir: number | null;
  windSeaHs: number | null;
  windSeaDir: number | null;
};

export type WaveCell = {
  lat: number;
  lon: number;
  hs: Array<number | null>;
  dir: Array<number | null>;
  swellHs: Array<number | null>;
  swellDir: Array<number | null>;
  windSeaHs: Array<number | null>;
  windSeaDir: Array<number | null>;
};

export type WaveModel = { id: string; label: string };

export type WaveForecast = {
  cellSelection: string;
  model: WaveModel;
  ttlSec: number;
  fetchedAt: string;
  step: number;
  times: string[];
  cells: WaveCell[];
  hasComponents: boolean;
  openMeteo?: { models: string; cell_selection: string };
};

export function sampleAt(cell: WaveCell, timeIndex: number): WaveSample {
  return {
    hs: cell.hs[timeIndex] ?? null,
    dir: cell.dir[timeIndex] ?? null,
    swellHs: cell.swellHs[timeIndex] ?? null,
    swellDir: cell.swellDir[timeIndex] ?? null,
    windSeaHs: cell.windSeaHs[timeIndex] ?? null,
    windSeaDir: cell.windSeaDir[timeIndex] ?? null,
  };
}
