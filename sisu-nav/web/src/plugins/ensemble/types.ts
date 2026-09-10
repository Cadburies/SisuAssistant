export type WindSample = { twd: number; tws: number };

export type MemberInfo = { id: string; label: string; color: string };

export type EnsembleCell = {
  lat: number;
  lon: number;
  values: Record<string, Array<WindSample | null>>;
};

export type EnsembleForecast = {
  cellSelection: string;
  deep: boolean;
  model?: string;
  modelLabel?: string;
  models: MemberInfo[];
  ttlSec: number;
  fetchedAt: string;
  step: number;
  times: string[];
  cells: EnsembleCell[];
  openMeteo?: { models: string; cell_selection: string };
  cached?: boolean;
  error?: string;
};
