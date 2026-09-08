/** Disk-quota guard for the dated harvest tree — never let a harvest job fill the volume. */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_QUOTA_BYTES = 20 * 1024 ** 3; // dated harvest output ceiling (manual/ is exempt — owned by #76)
const DEFAULT_MIN_FREE_BYTES = 2 * 1024 ** 3; // always keep this much free on the volume

export function harvestQuotaBytes() {
  return Number(process.env.SISU_HARVEST_QUOTA_BYTES) || DEFAULT_QUOTA_BYTES;
}

export function harvestMinFreeBytes() {
  return Number(process.env.SISU_HARVEST_MIN_FREE_BYTES) || DEFAULT_MIN_FREE_BYTES;
}

export function dirSizeBytes(dir) {
  let total = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      total += dirSizeBytes(full);
    } else {
      try {
        total += fs.statSync(full).size;
      } catch {
        /* file removed mid-walk — ignore */
      }
    }
  }
  return total;
}

/** @param {string} tilesRoot SISU_TILES_DIR */
export function checkQuota(tilesRoot) {
  const used =
    dirSizeBytes(path.join(tilesRoot, 'satellite')) +
    dirSizeBytes(path.join(tilesRoot, 'nautical')) +
    dirSizeBytes(path.join(tilesRoot, 'bathymetry'));
  const quotaBytes = harvestQuotaBytes();
  const minFreeBytes = harvestMinFreeBytes();

  let freeBytes = null;
  try {
    const st = fs.statfsSync(tilesRoot);
    freeBytes = st.bsize * st.bavail;
  } catch {
    /* statfs not available on this platform/volume — quota-only check still applies */
  }

  const overQuota = used >= quotaBytes;
  const lowDisk = freeBytes != null && freeBytes < minFreeBytes;
  return { usedBytes: used, quotaBytes, freeBytes, minFreeBytes, overQuota, lowDisk, ok: !overQuota && !lowDisk };
}
