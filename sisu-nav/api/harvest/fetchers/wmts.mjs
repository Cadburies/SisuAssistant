/**
 * Generic WMTS KVP harvester (#98 BlueTopo). Template substitutes
 * {z}/{x}/{y} plus {layer}/{style}. Empty ocean tiles (tiny 1-bit PNGs)
 * are not stored.
 */
import { runTemplateHarvest } from './template.mjs';

/** BlueTopo open-ocean tiles are ~256 B, 1-bit indexed PNG. */
export function isEmptyOceanPng(buf) {
  if (!buf || buf.length < 512) return true;
  if (buf.length >= 25 && buf[0] === 0x89 && buf[1] === 0x50 && buf[24] === 1) return true;
  return false;
}

export const runWmts = (ctx) =>
  runTemplateHarvest(ctx, {
    layer: ctx.provider.layer,
    style: ctx.provider.style,
    skipTile: isEmptyOceanPng,
  });
