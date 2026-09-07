import { useEffect, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PluginProps } from '../../app/plugin';
import { subscribeNavMap } from '../map/registry';
import { deleteNote, genId, listNotes, saveNote } from './api';
import { bindNoteClicks, clearNotes, paintNotes } from './overlay';
import type { LatLon, Note, NoteDraft } from './types';
import './notes.css';

const EMPTY_DRAFT: NoteDraft = { name: '', description: '', url: '' };

export function NotesPanel({ config }: PluginProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [draftPos, setDraftPos] = useState<LatLon | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_DRAFT);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => subscribeNavMap(setMap), []);

  async function refresh() {
    try {
      setNotes(await listNotes(config.signalkHttp));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.signalkHttp]);

  useEffect(() => {
    if (!map) return;
    paintNotes(map, notes, selected?.id);
  }, [map, notes, selected]);

  useEffect(() => {
    return () => {
      if (map) clearNotes(map);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    return bindNoteClicks(map, (id) => {
      const n = notes.find((x) => x.id === id);
      if (!n) return;
      setDraftPos(null);
      setPicking(false);
      setSelected(n);
      setDraft({ name: n.name, description: n.description || '', url: n.url || '' });
    });
  }, [map, notes]);

  useEffect(() => {
    if (!map || !picking) return;
    const onClick = (e: { lngLat: { lat: number; lng: number } }) => {
      setSelected(null);
      setDraft(EMPTY_DRAFT);
      setDraftPos({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      setPicking(false);
    };
    map.getCanvas().style.cursor = 'crosshair';
    map.on('click', onClick);
    return () => {
      map.getCanvas().style.cursor = '';
      map.off('click', onClick);
    };
  }, [map, picking]);

  function cancelForm() {
    setSelected(null);
    setDraftPos(null);
    setDraft(EMPTY_DRAFT);
    setError(undefined);
  }

  async function onSave() {
    const pos = selected
      ? selected.position
      : draftPos
        ? { latitude: draftPos.lat, longitude: draftPos.lon }
        : null;
    if (!pos) return;
    const name = draft.name.trim();
    if (!name) {
      setError('Name required.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const note: Note = {
        id: selected?.id || genId(),
        name,
        description: draft.description.trim() || undefined,
        url: draft.url.trim() || undefined,
        position: pos,
      };
      await saveNote(config.signalkHttp, note);
      cancelForm();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selected) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteNote(config.signalkHttp, selected.id);
      cancelForm();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const formOpen = !!selected || !!draftPos;
  const formPos = selected?.position
    ? { lat: selected.position.latitude, lon: selected.position.longitude }
    : draftPos;

  return (
    <section className="nt">
      <div className="nt-head">
        <span>Notes</span>
        {busy ? <span className="nt-muted">saving</span> : null}
      </div>
      <p className="nt-note">Private, this boat only. Not a shared wiki — see #79.</p>
      <div className="nt-actions">
        <button
          type="button"
          className={picking ? 'active' : ''}
          onClick={() => {
            cancelForm();
            setPicking(true);
          }}
        >
          {picking ? 'Click map…' : 'Add note'}
        </button>
      </div>
      {error ? <p className="nt-err">{error}</p> : null}
      {!formOpen && notes.length ? (
        <div className="nt-list">
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              className="nt-row"
              onClick={() => {
                setDraftPos(null);
                setPicking(false);
                setSelected(n);
                setDraft({ name: n.name, description: n.description || '', url: n.url || '' });
              }}
            >
              <span className="nt-row-name">
                {n.name}
                {n.url ? ' ↗' : ''}
              </span>
              <span className="nt-row-pos">
                {n.position.latitude.toFixed(3)}° {n.position.longitude.toFixed(3)}°
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {!formOpen && !notes.length ? <p className="nt-muted">No notes yet.</p> : null}
      {formOpen ? (
        <div className="nt-form">
          <p className="nt-muted">
            {formPos ? `${formPos.lat.toFixed(3)}° ${formPos.lon.toFixed(3)}°` : null}
          </p>
          <label className="nt-field">
            Name
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Good holding, sand"
            />
          </label>
          <label className="nt-field">
            Description
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Notes for next time…"
            />
          </label>
          <label className="nt-field">
            Link (optional — NFL / Navily / other)
            <input
              type="text"
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              placeholder="https://…"
            />
          </label>
          {selected?.url ? (
            <a className="nt-link" href={selected.url} target="_blank" rel="noreferrer">
              Open ↗
            </a>
          ) : null}
          <div className="nt-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void onSave()}>
              Save
            </button>
            {selected ? (
              <button type="button" className="danger" disabled={busy} onClick={() => void onDelete()}>
                Delete
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={cancelForm}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
