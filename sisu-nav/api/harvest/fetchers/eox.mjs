import { runTemplateHarvest } from './template.mjs';

/** EOX Sentinel-2 cloudless — plain {z}/{y}/{x} WMTS REST template, no extra params. */
export const runEox = (ctx) => runTemplateHarvest(ctx);
