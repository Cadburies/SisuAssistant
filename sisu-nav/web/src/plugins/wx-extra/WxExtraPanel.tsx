import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { formatForecastTime } from '../../app/units';
import { isLayerOn, subscribeLayers } from '../map/layers';
import { subscribeNavMap } from '../map/registry';
import { clearHeat, paintHeat, setRadar, type SkyCell } from './overlay';
import './wx-extra.css';

type Sky = {
  times: string[];
  rain: SkyCell[];
  clouds: SkyCell[];
  dust: SkyCell[];
  dustTimes?: string[];
  step: number;
};

async function loadSky(map: MapLibreMap): Promise<Sky> {
  const b = map.getBounds();
  const qs = new URLSearchParams({
    west: String(b.getWest()),
    south: String(b.getSouth()),
    east: String(b.getEast()),
    north: String(b.getNorth()),
  });
  const res = await fetch(`/api/weather/sky?${qs}`);
  const body = (await res.json().catch(() => ({}))) as Sky & { error?: string };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function loadRadar(): Promise<{ frames: Array<{ time: number; tiles: string }>; reason?: string }> {
  const res = await fetch('/api/weather/radar');
  const body = (await res.json().catch(() => ({}))) as {
    frames?: Array<{ time: number; tiles: string }>;
    reason?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return { frames: body.frames ?? [], reason: body.reason };
}

export function WxExtraPanel(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [, setTick] = useState(0);
  const [sky, setSky] = useState<Sky | null>(null);
  const [radar, setRadarState] = useState<string | null>(null);
  const [radarReason, setRadarReason] = useState<string | undefined>();
  const [timeIndex, setTimeIndex] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const rainOn = isLayerOn('rain');
  const cloudsOn = isLayerOn('clouds');
  const dustOn = isLayerOn('dust');
  const radarOn = isLayerOn('radar');
  const anySky = rainOn || cloudsOn || dustOn;

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => subscribeLayers(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!map || !anySky) return;
    let stop = false;
    const run = () => {
      loadSky(map)
        .then((s) => {
          if (stop) return;
          setSky(s);
          setError(undefined);
          setTimeIndex((i) => Math.min(i, Math.max(0, s.times.length - 1)));
        })
        .catch((e) => {
          if (!stop) setError(e instanceof Error ? e.message : String(e));
        });
    };
    run();
    let t = 0;
    const onMove = () => {
      window.clearTimeout(t);
      t = window.setTimeout(run, 500);
    };
    map.on('moveend', onMove);
    return () => {
      stop = true;
      window.clearTimeout(t);
      map.off('moveend', onMove);
    };
  }, [map, anySky]);

  useEffect(() => {
    if (!radarOn) {
      setRadarState(null);
      return;
    }
    let stop = false;
    loadRadar()
      .then((r) => {
        if (stop) return;
        setRadarReason(r.reason);
        const last = r.frames[r.frames.length - 1];
        setRadarState(last?.tiles ?? null);
      })
      .catch((e) => {
        if (!stop) setRadarReason(e instanceof Error ? e.message : String(e));
      });
    return () => {
      stop = true;
    };
  }, [radarOn]);

  useEffect(() => {
    if (!map) return;
    if (rainOn && sky) paintHeat(map, 'wx-rain', sky.rain, timeIndex, 'rain', sky.step);
    else clearHeat(map, 'wx-rain');
    if (cloudsOn && sky) paintHeat(map, 'wx-clouds', sky.clouds, timeIndex, 'clouds', sky.step);
    else clearHeat(map, 'wx-clouds');
    if (dustOn && sky) paintHeat(map, 'wx-dust', sky.dust, timeIndex, 'dust', sky.step);
    else clearHeat(map, 'wx-dust');
    setRadar(map, radarOn ? radar : null);
  }, [map, sky, timeIndex, rainOn, cloudsOn, dustOn, radarOn, radar]);

  useEffect(() => {
    return () => {
      if (!map) return;
      clearHeat(map, 'wx-rain');
      clearHeat(map, 'wx-clouds');
      clearHeat(map, 'wx-dust');
      setRadar(map, null);
    };
  }, [map]);

  return (
    <section className="wxx">
      <div className="wxx-head">
        <span>Sky layers</span>
      </div>
      <p className="wxx-muted">
        Rain, clouds, radar, and dust — toggle in Layers. Dust is mutex with weather particles.
        Radar is RainViewer (no key). Not instrument.
      </p>
      {error ? <p className="wxx-err">{error}</p> : null}
      {radarOn && radarReason && !radar ? <p className="wxx-err">{radarReason}</p> : null}
      {anySky ? (
        <label className="wxx-time">
          <span>{formatForecastTime(sky?.times[timeIndex])}</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, (sky?.times.length ?? 1) - 1)}
            value={timeIndex}
            onChange={(e) => setTimeIndex(Number(e.target.value))}
          />
        </label>
      ) : (
        <p className="wxx-muted">Enable Rain / Clouds / Dust / Radar in Layers.</p>
      )}
    </section>
  );
}
