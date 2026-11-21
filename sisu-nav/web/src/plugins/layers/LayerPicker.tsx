import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { subscribeNavMap } from '../map/registry';
import { MapSheet, type MapSheetTab } from './MapSheet';
import './layers.css';

function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.2 3 8l9 4.8L21 8 12 3.2zm0 12.3L4.2 11 3 11.6 12 16.4 21 11.6 19.8 11 12 15.5zm0 3.5L4.2 14.5 3 15.1 12 19.9 21 15.1 19.8 14.5 12 19z"
      />
    </svg>
  );
}

const OPEN_LAYERS = 'sisu-open-layers';

export function openLayersPanel(tab: MapSheetTab = 'base'): void {
  window.dispatchEvent(new CustomEvent(OPEN_LAYERS, { detail: { tab } }));
}

export function LayerPicker({ config, sk }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<MapSheetTab>('base');

  useEffect(() => subscribeNavMap(setMap), []);
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: MapSheetTab }>).detail;
      setTab(detail?.tab ?? 'base');
      setOpen(true);
    };
    window.addEventListener(OPEN_LAYERS, onOpen);
    return () => window.removeEventListener(OPEN_LAYERS, onOpen);
  }, []);

  useEffect(() => {
    if (!map) return;
    let el: HTMLDivElement | null = null;
    const ctrl: IControl = {
      onAdd() {
        el = document.createElement('div');
        el.className = 'maplibregl-ctrl sisu-ly';
        setHost(el);
        return el;
      },
      onRemove() {
        setHost(null);
        el = null;
      },
    };
    map.addControl(ctrl, 'top-right');
    return () => {
      try {
        map.removeControl(ctrl);
      } catch {
        /* map already gone */
      }
    };
  }, [map]);

  if (!host) return null;
  return createPortal(
    <>
      <button
        type="button"
        className="sisu-ly-btn"
        aria-label="Map layers"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <LayersIcon />
      </button>
      {open ? (
        <MapSheet config={config} sk={sk} initialTab={tab} onClose={() => setOpen(false)} />
      ) : null}
    </>,
    host,
  );
}
