export type Provider = {
  id: string;
  label: string;
  kind: 'nautical' | 'satellite' | 'bathymetry';
  access: 'free' | 'free-ish' | 'secret';
  harvestable: boolean;
  default: boolean;
  minZoom: number;
  maxZoom: number;
  attribution: string;
  notes: string;
  sourceUrl: string;
  exportLimitTiles: number | null;
  secretConfigured: boolean;
  secretEnv?: string;
};

export type Quota = {
  usedBytes: number;
  quotaBytes: number;
  freeBytes: number | null;
  minFreeBytes: number;
  overQuota: boolean;
  lowDisk: boolean;
  ok: boolean;
};

export type Estimate = {
  tileCount: number;
  minZoom: number;
  maxZoom: number;
  limitTiles: number | null;
  withinLimit: boolean;
  quota: Quota;
};

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'unsupported' | 'interrupted' | 'skipped';
export type JobMode = 'harvest' | 'fill' | 'skip';

export type Job = {
  id: string;
  providerId: string;
  providerLabel: string;
  kind: 'nautical' | 'satellite' | 'bathymetry';
  region: string;
  bbox: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  time: string | null;
  notes: string;
  outDir: string;
  status: JobStatus;
  mode?: JobMode;
  sourceDate?: string | null;
  total: number;
  completed: number;
  fetched?: number;
  failed?: number;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};

export type Bbox = [number, number, number, number]; // west, south, east, north
