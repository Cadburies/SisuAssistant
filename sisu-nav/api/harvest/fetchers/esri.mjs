import { runTemplateHarvest } from './template.mjs';

/**
 * Esri World Imagery export. providers.yaml's exportLimitTiles is enforced
 * before this ever runs (jobs.mjs's estimate()/createJob() reject an
 * over-limit request with 413) — this stays a plain template harvest.
 */
export const runEsri = (ctx) => runTemplateHarvest(ctx);
