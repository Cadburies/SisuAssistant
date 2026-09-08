import { useEffect, useState } from 'react';
import type { NavPlugin } from '../../app/plugin';
import {
  isSideEditing,
  movePlugin,
  setPluginHidden,
  setSideEditing,
  subscribeSide,
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
            return (
              <li key={p.id} className={hidden ? 'off' : ''}>
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
                    disabled={i === 0}
                    onClick={() => movePlugin(p.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${p.title} down`}
                    disabled={i === plugins.length - 1}
                    onClick={() => movePlugin(p.id, 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
