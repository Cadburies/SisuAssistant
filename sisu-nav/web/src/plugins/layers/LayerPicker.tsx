import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import {
  isLayerOn,
  layerBlockReason,
  listLayers,
  subscribeLayers,
  toggleLayer,
  type LayerId,
} from '../map/layers';
import { subscribeNavMap } from '../map/registry';
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

function Menu() {
  const [, bump] = useState(0);
  useEffect(() => subscribeLayers(() => bump((n) => n + 1)), []);
  const rows = listLayers();
  return (
    <div className="sisu-ly-pop" role="menu" aria-label="Map layers">
      <div className="sisu-ly-head">Layers</div>
      {rows.map((l) => {
        const why = layerBlockReason(l.id);
        const on = isLayerOn(l.id);
        const blocked = !!why;
        return (
          <label key={l.id} className={`sisu-ly-row${blocked ? ' blocked' : ''}`}>
            <input
              type="checkbox"
              checked={on}
              disabled={blocked && !on}
              onChange={() => toggleLayer(l.id as LayerId)}
            />
            <span className="sisu-ly-meta">
              <span>{l.label}</span>
              {blocked ? <span className="sisu-ly-why">{why}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function LayerPicker(_props: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeNavMap(setMap), []);

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
      {open ? <Menu /> : null}
    </>,
    host,
  );
}
