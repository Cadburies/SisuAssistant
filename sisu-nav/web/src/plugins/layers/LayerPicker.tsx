import { useEffect, useRef, useState } from 'react';
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

function stopMapScroll(e: { stopPropagation: () => void }) {
  // MapLibre listens on the map container; without this, wheel/touch on
  // the picker zooms the chart instead of scrolling the list.
  e.stopPropagation();
}

function Menu() {
  const popRef = useRef<HTMLDivElement>(null);
  const [, bump] = useState(0);
  useEffect(() => subscribeLayers(() => bump((n) => n + 1)), []);
  useEffect(() => {
    const el = popRef.current;
    if (!el) return;
    const mapEl = el.closest('.maplibregl-map');
    const fit = () => {
      const mapBox = mapEl?.getBoundingClientRect();
      const top = el.getBoundingClientRect().top;
      const bottom = mapBox ? mapBox.bottom : window.innerHeight;
      // Attribution / scale sit in the map's bottom controls and would
      // cover the last layer rows if we used the full map height.
      let clearance = 8;
      if (mapEl) {
        for (const node of mapEl.querySelectorAll(
          '.maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right',
        )) {
          const b = node.getBoundingClientRect();
          if (b.height > 0) clearance = Math.max(clearance, Math.ceil(bottom - b.top) + 8);
        }
      }
      el.style.maxHeight = `${Math.max(120, Math.floor(bottom - top - clearance))}px`;
    };
    fit();
    const ro = mapEl ? new ResizeObserver(fit) : null;
    if (mapEl && ro) ro.observe(mapEl);
    window.addEventListener('resize', fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);
  const rows = listLayers();
  return (
    <div
      ref={popRef}
      className="sisu-ly-pop"
      role="menu"
      aria-label="Map layers"
      onWheel={stopMapScroll}
      onTouchMove={stopMapScroll}
    >
      <div className="sisu-ly-head">Overlays</div>
      <div className="sisu-ly-list">
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
