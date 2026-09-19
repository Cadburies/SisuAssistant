/** Azure Maps microsoft.imagery XYZ harvest (#117). Replaces Bing Aerial. */
import { runTemplateHarvest } from './template.mjs';

export const runAzure = (ctx) =>
  runTemplateHarvest(ctx, {
    key: process.env[ctx.provider.secretEnv] || '',
  });
