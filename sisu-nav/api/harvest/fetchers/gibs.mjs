import { runTemplateHarvest } from './template.mjs';

/**
 * NASA GIBS (MODIS/VIIRS) — template also needs {layer} and {time}.
 * job.time is an optional ISO date (YYYY-MM-DD) to pin a specific day;
 * "default" (GIBS's own literal) resolves to the most recent available day.
 */
export const runGibs = (ctx) =>
  runTemplateHarvest(ctx, { layer: ctx.provider.layer, time: ctx.job.time || 'default' });
