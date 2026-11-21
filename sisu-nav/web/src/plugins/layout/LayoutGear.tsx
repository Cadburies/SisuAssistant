import { Fragment, useEffect, useState } from 'react';
import { GROUP_TITLES, groupOf, type NavPlugin } from '../../app/plugin';
import {
  isSideEditing,
  setPluginHidden,
  setSideEditing,
  subscribeSide,
  swapPlugins,
} from '../map/side';
import './layout.css';

type Props = {
  plugins: NavPlugin[];
  hiddenIds: Set<string>;
};

export function LayoutGear({ plugins, hiddenIds }: Props) {
  const [editing, setEditing] = useState(isSideEditing);
  useEffect(() => subscribeSide(() => setEditing(isSideEditing())), []);

  return (
    <div className="sisu-side-gear">
      <button
        type="button"
        className={editing ? 'active' : ''}
        aria-pressed={editing}
        aria-label={editing ? 'Done editing layout' : 'Edit right-hand layout'}
        onClick={() => setSideEditing(!editing)}
      >
        {editing ? 'Done' : 'Layout'}
      </button>
      {editing ? (
        <ol className="sisu-side-list">
          {plugins.map((p, i) => {
            const hidden = hiddenIds.has(p.id);
            const group = groupOf(p);
            const previous = i > 0 ? groupOf(plugins[i - 1]) : null;
            const siblings = plugins.filter((item) => groupOf(item) === group);
            const at = siblings.findIndex((item) => item.id === p.id);
            const prev = at > 0 ? siblings[at - 1] : null;
            const next = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null;
            return (
              <Fragment key={p.id}>
                {group !== previous ? (
                  <li className="sisu-side-group-head">{GROUP_TITLES[group]}</li>
                ) : null}
                <li className={hidden ? 'off' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={() => setPluginHidden(p.id, !hidden)}
                    />
                    <span>{p.title}</span>
                  </label>
                  <span className="sisu-side-move">
                    <button
                      type="button"
                      aria-label={`Move ${p.title} up`}
                      disabled={!prev}
                      onClick={() => prev && swapPlugins(p.id, prev.id)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${p.title} down`}
                      disabled={!next}
                      onClick={() => next && swapPlugins(p.id, next.id)}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              </Fragment>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
