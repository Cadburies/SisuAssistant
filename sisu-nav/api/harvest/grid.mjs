/** Slippy-map (XYZ / Web Mercator) tile math shared by every harvest fetcher. */

export function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1) };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function zoomRange(bbox, z) {
  const [west, south, east, north] = bbox;
  const n = 2 ** z;
  const a = lonLatToTile(west, north, z); // top-left
  const b = lonLatToTile(east, south, z); // bottom-right
  return {
    xMin: Math.min(a.x, b.x),
    xMax: Math.max(a.x, b.x),
    yMin: Math.min(a.y, b.y),
    yMax: Math.max(a.y, b.y),
    n,
  };
}

/** Every {z,x,y} XYZ tile covering bbox=[west,south,east,north] across [minZoom,maxZoom]. */
export function tileGrid(bbox, minZoom, maxZoom) {
  const tiles = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const { xMin, xMax, yMin, yMax } = zoomRange(bbox, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) tiles.push({ z, x, y });
    }
  }
  return tiles;
}

/** Same coverage as tileGrid() without allocating the array — used for pre-fetch estimates. */
export function countTiles(bbox, minZoom, maxZoom) {
  let count = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const { xMin, xMax, yMin, yMax } = zoomRange(bbox, z);
    count += (xMax - xMin + 1) * (yMax - yMin + 1);
  }
  return count;
}
