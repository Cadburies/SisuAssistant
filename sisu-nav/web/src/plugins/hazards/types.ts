export type HazardsResponse = {
  attribution: string;
  license: string;
  sourceUrl: string;
  fetchedAt: string;
  cables: GeoJSON.FeatureCollection;
  landingPoints: GeoJSON.FeatureCollection;
  stale?: boolean;
  staleError?: string;
  error?: string;
};
