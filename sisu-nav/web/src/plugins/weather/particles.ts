import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Forecast, WindSample } from './types';

type Particle = { x: number; y: number; age: number };

function sampleField(
  forecast: Forecast,
  timeIndex: number,
  modelId: string,
  lng: number,
  lat: number,
): WindSample | null {
  let best: Forecast['cells'][0] | null = null;
  let bestD = Infinity;
  for (const c of forecast.cells) {
    const d = (c.lat - lat) ** 2 + (c.lon - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best?.values[modelId]?.[timeIndex] ?? null;
}

export function startParticles(
  map: MapLibreMap,
  opts: () => { forecast: Forecast | null; timeIndex: number; modelId: string },
): () => void {
  const canvas = document.createElement('canvas');
  canvas.className = 'wx-particles';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.pointerEvents = 'none';
  map.getContainer().appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const particles: Particle[] = [];
  let raf = 0;
  let running = true;

  const resize = () => {
    const c = map.getCanvas();
    canvas.width = c.width;
    canvas.height = c.height;
    canvas.style.width = `${c.clientWidth}px`;
    canvas.style.height = `${c.clientHeight}px`;
  };
  resize();
  map.on('resize', resize);

  const spawn = (n: number) => {
    const w = canvas.width;
    const h = canvas.height;
    for (let i = 0; i < n; i++) {
      particles.push({ x: Math.random() * w, y: Math.random() * h, age: Math.random() * 80 });
    }
  };

  const tick = () => {
    if (!running) return;
    const { forecast, timeIndex, modelId } = opts();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!forecast || !modelId) {
      particles.length = 0;
      raf = requestAnimationFrame(tick);
      return;
    }
    if (particles.length < 350) spawn(350 - particles.length);
    ctx.strokeStyle = 'rgba(231,238,246,0.45)';
    ctx.lineWidth = 1.2;
    for (const p of particles) {
      const lngLat = map.unproject([p.x, p.y]);
      const s = sampleField(forecast, timeIndex, modelId, lngLat.lng, lngLat.lat);
      if (!s) {
        p.age = 80;
        continue;
      }
      const to = ((s.twd + 180) * Math.PI) / 180;
      const pxPerKn = 0.35;
      const dx = Math.sin(to) * s.tws * pxPerKn;
      const dy = -Math.cos(to) * s.tws * pxPerKn;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      p.x += dx;
      p.y += dy;
      p.age += 1;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (p.age > 80 || p.x < 0 || p.y < 0 || p.x > canvas.width || p.y > canvas.height) {
        p.x = Math.random() * canvas.width;
        p.y = Math.random() * canvas.height;
        p.age = 0;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    map.off('resize', resize);
    canvas.remove();
  };
}
