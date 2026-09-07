export type RoseBin = {
  id: string;
  name: string;
  lo: number;
  hi: number;
  color: string;
};

export type RosePetal = {
  deg: number;
  total: number;
  bands: Record<string, number>;
};

export type RoseCell = {
  geohash: string;
  lat: number;
  lon: number;
  n: number;
  calmPct: number;
  petals: RosePetal[];
};

export type RosesPayload = {
  window: { kind: string; n?: number; month?: number; range?: string };
  bucket: string;
  pairing: { direction: string; speed: string };
  spec: { bins: RoseBin[]; petals: number; calmMax: number; geohash: number };
  joined: number;
  skippedNoPos: number;
  raw: { twd: number; aws: number };
  cellCount: number;
  cells: RoseCell[];
  cached?: boolean;
  error?: string;
};
