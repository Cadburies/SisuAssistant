import { useEffect, useState } from 'react';
import type { PluginProps } from '../../app/plugin';
import { isSideEditing, subscribeSide } from '../map/side';
import {
  MAX_CELLS,
  addCell,
  addRow,
  getInstruments,
  moveCell,
  moveRow,
  moveRowTo,
  removeCell,
  setCell,
  subscribeInstruments,
  valueFontPx,
  type InstRow,
} from './layout';
import { getMetric, listMetrics } from './metrics';
import './instruments.css';

export function InstrumentsPanel({ sk }: PluginProps) {
  const [editing, setEditing] = useState(isSideEditing);
  const [grid, setGrid] = useState(getInstruments);
  const [err, setErr] = useState<string | undefined>();
  const [drag, setDrag] = useState<string | null>(null);

  useEffect(() => subscribeSide(() => setEditing(isSideEditing())), []);
  useEffect(() => subscribeInstruments(() => setGrid(getInstruments())), []);

  function fail(msg: string | undefined) {
    setErr(msg);
    if (msg) window.setTimeout(() => setErr((e) => (e === msg ? undefined : e)), 2400);
  }

  return (
    <section className="inst">
      <div className="inst-head">
        <span>Instruments</span>
      </div>
      {err ? <p className="inst-err">{err}</p> : null}
      <div className="inst-grid">
        {grid.rows.map((row, ri) => (
          <RowView
            key={row.id}
            row={row}
            ri={ri}
            last={ri === grid.rows.length - 1}
            editing={editing}
            drag={drag}
            setDrag={setDrag}
            fail={fail}
            sk={sk}
          />
        ))}
      </div>
      {editing ? (
        <button type="button" className="inst-add-row" onClick={() => addRow()}>
          + row
        </button>
      ) : null}
    </section>
  );
}

function RowView({
  row,
  ri,
  last,
  editing,
  drag,
  setDrag,
  fail,
  sk,
}: {
  row: InstRow;
  ri: number;
  last: boolean;
  editing: boolean;
  drag: string | null;
  setDrag: (d: string | null) => void;
  fail: (m: string | undefined) => void;
  sk: PluginProps['sk'];
}) {
  const n = Math.max(1, row.cells.length);
  const size = valueFontPx(n);
  const dragOver = drag?.startsWith('row:') && drag !== `row:${row.id}`;

  return (
    <div
      className={`inst-row${dragOver ? ' drop' : ''}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        if (!editing) return;
        e.preventDefault();
        const d = e.dataTransfer.getData('text/plain');
        if (d.startsWith('row:')) {
          const id = d.slice(4);
          if (id && id !== row.id) moveRowTo(id, ri);
        } else if (d.startsWith('cell:')) {
          const [, fromRow, fromIdx] = d.split(':');
          fail(moveCell(fromRow, Number(fromIdx), row.id, row.cells.length));
        }
        setDrag(null);
      }}
    >
      {row.cells.map((id, ci) => (
        <CellView
          key={`${row.id}-${ci}`}
          rowId={row.id}
          index={ci}
          metricId={id}
          size={size}
          editing={editing}
          setDrag={setDrag}
          fail={fail}
          sk={sk}
        />
      ))}
      {editing ? (
        <div
          className="inst-row-tools"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', `row:${row.id}`);
            setDrag(`row:${row.id}`);
          }}
          onDragEnd={() => setDrag(null)}
        >
          <button
            type="button"
            aria-label="Add metric to row"
            disabled={row.cells.length >= MAX_CELLS}
            title={row.cells.length >= MAX_CELLS ? `max ${MAX_CELLS} metrics in a row` : 'Add metric'}
            onClick={() => fail(addCell(row.id))}
          >
            +
          </button>
          <button type="button" aria-label="Move row up" disabled={ri === 0} onClick={() => moveRow(row.id, -1)}>
            ↑
          </button>
          <button type="button" aria-label="Move row down" disabled={last} onClick={() => moveRow(row.id, 1)}>
            ↓
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CellView({
  rowId,
  index,
  metricId,
  size,
  editing,
  setDrag,
  fail,
  sk,
}: {
  rowId: string;
  index: number;
  metricId: string;
  size: number;
  editing: boolean;
  setDrag: (d: string | null) => void;
  fail: (m: string | undefined) => void;
  sk: PluginProps['sk'];
}) {
  const def = getMetric(metricId);
  const empty = !metricId;

  return (
    <div
      className="inst-cell"
      draggable={editing && !empty}
      onDragStart={(e) => {
        if (!editing) return;
        const payload = `cell:${rowId}:${index}`;
        e.dataTransfer.setData('text/plain', payload);
        setDrag(payload);
      }}
      onDragEnd={() => setDrag(null)}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        if (!editing) return;
        e.preventDefault();
        e.stopPropagation();
        const d = e.dataTransfer.getData('text/plain');
        if (d.startsWith('cell:')) {
          const [, fromRow, fromIdx] = d.split(':');
          fail(moveCell(fromRow, Number(fromIdx), rowId, index));
        }
        setDrag(null);
      }}
    >
      {empty || !def ? (
        editing ? (
          <Picker rowId={rowId} index={index} />
        ) : (
          <>
            <span>—</span>
            <strong style={{ fontSize: size }}>—</strong>
          </>
        )
      ) : (
        <>
          <span>{def.label}</span>
          <strong style={{ fontSize: size }}>{def.format(sk)}</strong>
        </>
      )}
      {editing && !empty ? (
        <button
          type="button"
          className="inst-x"
          aria-label={`Remove ${def?.label ?? 'metric'}`}
          onClick={() => removeCell(rowId, index)}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function Picker({ rowId, index }: { rowId: string; index: number }) {
  const metrics = listMetrics();
  return (
    <label className="inst-pick">
      <span>Metric</span>
      <select
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) setCell(rowId, index, v);
        }}
        aria-label="Choose metric"
      >
        <option value="" disabled>
          select…
        </option>
        {metrics.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
