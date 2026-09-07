/**
 * NOAA ENC -> MBTiles is deliberately NOT implemented: converting S-57 vector
 * charts to raster/vector tiles needs GDAL (ogr2ogr) + a tiler, and adding
 * GDAL to sisu-nav-api mirrors the exact thing #78's routing spike is told
 * to avoid (no gdal-async in this container). This stays a coverage-check
 * placeholder so the provider can exist in the dropdown for documentation —
 * BVI is not reliably charted by NOAA ENC, so it must never be presented as
 * a working local plotter for these waters.
 */
export async function runNoaaEnc({ job }) {
  return {
    unimplemented: true,
    message:
      `NOAA ENC harvesting for "${job.region}" is not implemented (needs GDAL/S-57 tooling, ` +
      'kept out of sisu-nav-api on purpose). Verify chart coverage yourself at ' +
      'https://www.charts.noaa.gov/InteractiveCatalog/nrnc.shtml before relying on NOAA ENC as a ' +
      'plotter here — BVI in particular is not reliably covered.',
  };
}
