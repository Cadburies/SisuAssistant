export type RouteMode = 'eta' | 'modelAgreement' | 'ensembleAgreement';

export type LatLon = { lat: number; lon: number; snapped?: boolean };

export type PlanResult = {
  mode: RouteMode;
  deep: boolean;
  polar: { id: string; warning: string };
  polarWarning: string;
  cellSelection: string;
  gribFallback: boolean;
  gdal: boolean;
  land: {
    source: string;
    rings: number;
    gdal: boolean;
    weatherRouting?: { tried?: boolean; installed?: boolean };
  };
  membersUsed: string[];
  fetchedAt: string;
  spotCheck?: {
    lat: number;
    lon: number;
    time?: string;
    model?: string;
    member?: string;
    tws?: number | null;
    twd?: number | null;
    cellSelection?: string;
  };
  etaHours: number;
  distanceNm: number;
  arrived: boolean;
  etaHistogram: Array<{ hours: number; count: number }>;
  p90Tws: number | null;
  etaP50: number | null;
  start: LatLon;
  dest: LatLon;
  route: { coordinates: number[][]; distanceNm: number; etaHours: number };
  corridor: GeoJSON.FeatureCollection;
  advisory: boolean;
  error?: string;
};

export type CommitResult = {
  id: string;
  via: string;
  saved?: unknown;
};
