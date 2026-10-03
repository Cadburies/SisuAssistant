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
  /** Berth spots (#187): fixed bow heading, drawn as a line on the rose. */
  bowDeg?: number | null;
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

/** #187 — one anchor spot from /api/roses/anchor-spots. */
export type AnchorSpot = {
  id: string;
  geohash: string;
  lat: number;
  lon: number;
  minutes: number;
  visits: number;
  firstSeen: string | null;
  lastSeen: string | null;
  steadiness: number | null;
  swingM: number;
  maxKn: number;
  sources: string[];
  kind: 'anchor' | 'berth';
  headingDeg: number | null;
  n: number;
  calmPct: number;
  petals: RosePetal[];
};

export type AnchorStay = {
  start: string;
  end: string;
  lat: number;
  lon: number;
  source: string;
  accepted: boolean;
  reason: string;
};

export type AnchorStatus = {
  lastRunAt: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  syncConfigured: boolean;
  berths: boolean;
  communityOptIn: boolean;
  communityAt: string | null;
  communityError: string | null;
  pendingHours: number;
  everyMin: number;
  syncMin: number;
  mergeM: number;
};

export type AnchorSpotsPayload = {
  spots: AnchorSpot[];
  stays: AnchorStay[];
  status: AnchorStatus;
  spec: { bins: RoseBin[]; petals: number; calmMax: number };
  error?: string;
};
