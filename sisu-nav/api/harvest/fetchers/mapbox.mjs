import { runTemplateHarvest } from './template.mjs';

/**
 * Mapbox Satellite (Raster Tiles API v4) — template needs {token}. Mapbox is
 * the least ToS-restrictive of the four providers accepted in providers.yaml's
 * header (personal, non-commercial, accepted-risk); its raster tiles API is
 * a plain {z}/{x}/{y} template like Esri/EOX, just with the access token as
 * a query param rather than baked into a fixed URL.
 */
export const runMapbox = (ctx) =>
  runTemplateHarvest(ctx, {
    token: process.env[ctx.provider.secretEnv] || '',
  });
