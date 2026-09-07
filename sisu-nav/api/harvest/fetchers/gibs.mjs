import { runTemplateHarvest } from './template.mjs';

/**
 * NASA GIBS (MODIS/VIIRS) — template also needs {layer} and {time}.
 * job.time is an optional ISO date (YYYY-MM-DD) to pin a specific day;
 * "default" (GIBS's own literal) resolves to the most recent available day.
 */
export const runGibs = (ctx) =>
  runTemplateHarvest(ctx, {
    layer: ctx.provider.layer,
    // Pin a real product day (#83) so skip/fill can compare sourceDate.
    time: ctx.job.sourceDate || ctx.job.time || 'default',
  });
