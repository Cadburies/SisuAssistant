/**
 * NOAA Chart Display Service WMTS (#107) — ENC already rendered as rasters.
 * No GDAL / S-57. ArcGIS default028mm uses OSM x/y at TileMatrix = z − 2.
 */
import { runTemplateHarvest } from './template.mjs';
import { isEmptyOceanPng } from './wmts.mjs';

export function isUnusableNoaaTile(buf) {
  if (!buf || buf.length < 512) return true;
  if (buf[0] === 0x3c || buf[0] === 0x7b) return true; // HTML / JSON error
  return isEmptyOceanPng(buf);
}

export const runNoaaEnc = (ctx) =>
  runTemplateHarvest(ctx, {
    skipTile: isUnusableNoaaTile,
  });
