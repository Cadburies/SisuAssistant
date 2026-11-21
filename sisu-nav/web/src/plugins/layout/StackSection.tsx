import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { NavPlugin, PluginGroup } from '../../app/plugin';
import { getBasemap, subscribeBasemap } from '../map/basemap';
import { isLayerOn, subscribeLayers, type LayerId } from '../map/layers';

const WEATHER_LAYERS: LayerId[] = [
  'wx-wind',
  'wx-discrepancy',
  'wx-particles',
  'ens-ecmwf',
  'ens-aifs',
  'ens-gefs',
  'rain',
  'radar',
  'clouds',
  'dust',
  'waves',
  'currents',
];

const TRAFFIC_LAYERS: LayerId[] = ['ais', 'ais-global', 'aircraft', 'satellites', 'hazards-cables'];

function countOn(ids: LayerId[]): number {
  return ids.filter((id) => isLayerOn(id)).length;
}

function basemapStatus(): string {
  const choice = getBasemap();
  return choice.kind === 'auto' ? 'Auto' : 'Picked';
}

function statusFor(group: PluginGroup, panels: NavPlugin[]): string {
  switch (group) {
    case 'weather': {
      const n = countOn(WEATHER_LAYERS);
      return n ? `${n} on` : 'all off';
    }
    case 'traffic': {
      const n = countOn(TRAFFIC_LAYERS);
      return n ? `${n} on` : 'all off';
    }
    case 'charts':
      return `map sources · ${basemapStatus()}`;
    case 'setup':
      return 'API keys';
    case 'plan':
      return panels
        .slice(0, 2)
        .map((p) => p.title)
        .join(' · ');
    default:
      return '';
  }
}

type Props = {
  group: PluginGroup;
  title: string;
  panels: NavPlugin[];
  open: boolean;
  openPanel: string | null;
  alwaysOpen?: boolean;
  onToggle: () => void;
  onPanel: (id: string) => void;
  renderPanel: (plugin: NavPlugin) => ReactNode;
};

export function StackSection({
  group,
  title,
  panels,
  open,
  openPanel,
  alwaysOpen = false,
  onToggle,
  onPanel,
  renderPanel,
}: Props) {
  const [, bump] = useState(0);
  useEffect(() => subscribeLayers(() => bump((n) => n + 1)), []);
  useEffect(() => subscribeBasemap(() => bump((n) => n + 1)), []);

  if (!panels.length) return null;
  const status = statusFor(group, panels);
  const bodyId = `sisu-group-${group}`;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape') return;
    const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
    // A text field or select keeps its own Escape behavior.
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (open && openPanel) {
      event.stopPropagation();
      onPanel(openPanel);
      return;
    }
    if (!alwaysOpen && open) {
      event.stopPropagation();
      onToggle();
    }
  };

  return (
    <section
      className={`sisu-stack-group${open ? ' open' : ''}${alwaysOpen ? ' pinned' : ''}`}
      onKeyDown={onKeyDown}
    >
      {alwaysOpen ? (
        <div className="sisu-stack-head pinned">
          <span className="sisu-stack-title">{title}</span>
          {status ? <span className="sisu-stack-status">{status}</span> : null}
        </div>
      ) : (
        <button
          type="button"
          className="sisu-stack-head"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <span className="sisu-stack-chev" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className="sisu-stack-title">{title}</span>
          {status ? <span className="sisu-stack-status">{status}</span> : null}
        </button>
      )}

      {open ? (
        <div className="sisu-stack-body" id={bodyId}>
          {panels.map((plugin) => {
            if (alwaysOpen) {
              return (
                <div className="sisu-panel pinned" key={plugin.id}>
                  {renderPanel(plugin)}
                </div>
              );
            }
            const expanded = openPanel === plugin.id;
            const panelBodyId = `sisu-panel-${plugin.id}`;
            return (
              <div className={`sisu-panel${expanded ? ' open' : ''}`} key={plugin.id}>
                <button
                  type="button"
                  className="sisu-panel-head"
                  aria-expanded={expanded}
                  aria-controls={panelBodyId}
                  onClick={() => onPanel(plugin.id)}
                >
                  <span className="sisu-panel-chev" aria-hidden="true">
                    {expanded ? '▾' : '▸'}
                  </span>
                  <span>{plugin.title}</span>
                </button>
                {expanded ? (
                  <div className="sisu-panel-body" id={panelBodyId}>
                    {renderPanel(plugin)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
