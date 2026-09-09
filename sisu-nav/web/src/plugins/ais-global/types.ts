export type GlobalVessel = {
  mmsi: string;
  name: string | null;
  lat: number;
  lon: number;
  sog: number | null;
  cog: number | null;
  heading: number | null;
  updatedAt: number;
};

export type AisGlobalResponse = {
  connected: boolean;
  error: string | null;
  boundingBoxes: unknown;
  vessels: GlobalVessel[];
};
