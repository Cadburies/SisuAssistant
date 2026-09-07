/** Grafana WeatherTWD stacked rose (#35/#36). TWD + AWS, N up. */

export const BINS = [
  { id: 'kn2', name: '2.0–4.9 kn', lo: 2.0, hi: 5.0, color: '#1d3557' },
  { id: 'kn5', name: '5.0–6.9 kn', lo: 5.0, hi: 7.0, color: '#2a9d8f' },
  { id: 'kn7', name: '7.0–9.9 kn', lo: 7.0, hi: 10.0, color: '#8ac926' },
  { id: 'kn10', name: '10.0–14.9 kn', lo: 10.0, hi: 15.0, color: '#ffd166' },
  { id: 'kn15', name: '15.0–19.9 kn', lo: 15.0, hi: 20.0, color: '#f4a261' },
  { id: 'kn20', name: '20.0+ kn', lo: 20.0, hi: Infinity, color: '#e63946' },
];

export const N_PETALS = 36;
export const CALM_MAX = 2.0;
export const MIN_CELL_SAMPLES = 8;
export const GEOHASH_PRECISION = 5;

export function sectorOf(twd) {
  const deg = ((twd % 360) + 360) % 360;
  return Math.floor(((deg + 5) % 360) / 10);
}

export function binOf(aws) {
  for (const b of BINS) {
    if (aws >= b.lo && aws < b.hi) return b;
  }
  return BINS[BINS.length - 1];
}

export function emptyCounts() {
  return BINS.map(() => Array(N_PETALS).fill(0));
}

export function toRose(counts, calm, used) {
  const toPct = (c) => (used ? (100 * c) / used : 0);
  const petals = [];
  for (let k = 0; k < N_PETALS; k++) {
    const bands = {};
    let total = 0;
    for (let b = 0; b < BINS.length; b++) {
      const pct = toPct(counts[b][k]);
      bands[BINS[b].id] = pct;
      total += pct;
    }
    petals.push({ deg: k * 10, total, bands });
  }
  return {
    n: used,
    calmPct: toPct(calm),
    petals,
  };
}
