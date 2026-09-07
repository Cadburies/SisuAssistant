export type WindSample = { twd: number; tws: number };

export type ModelInfo = { id: string; label: string; color: string };

export type ForecastCell = {
  lat: number;
  lon: number;
  values: Record<string, Array<WindSample | null>>;
};

export type Forecast = {
  cellSelection: string;
  models: ModelInfo[];
  ttlSec: number;
  fetchedAt: string;
  step: number;
  times: string[];
  cells: ForecastCell[];
  openMeteo?: { models: string; cell_selection: string };
};
