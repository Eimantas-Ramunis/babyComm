import { useEffect, useRef, useState } from 'react';
import {
  getMemories,
  getStoredPassword,
  createMemory,
  updateMemory,
  deleteMemory,
} from '../services/api.js';

// Local "now" as a naive datetime-local value (YYYY-MM-DDTHH:mm), no timezone shifting.
function localNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatStamp(value) {
  return value ? value.slice(0, 16).replace('T', ' ') : '';
}

// Coerce a stored memoryAt into a valid datetime-local value (YYYY-MM-DDTHH:mm).
// Legacy rows may hold a date-only value; pad it with a midday time so the input isn't blank.
function toLocalInput(value) {
  if (!value) return localNow();
  if (value.length === 10) return `${value}T12:00`; // date-only legacy value
  return value.slice(0, 16);
}

// Add/edit form. `initial` pre-fills for editing; image is optional.
function MemoryForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [body, setBody] = useState(initial?.body || '');
  const [memoryAt, setMemoryAt] = useState(
    initial?.memoryAt ? toLocalInput(initial.memoryAt) : localNow(),
  );
  const fileRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData();
    form.append('title', title);
    form.append('body', body);
    form.append('memoryAt', memoryAt);
    if (fileRef.current?.files?.[0]) form.append('image', fileRef.current.files[0]);
    onSubmit(form);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Antraštė (caption)</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className="field">
        <span>Užrašas (optional)</span>
        <textarea value={body} rows={2} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="field">
        <span>Data ir laikas</span>
        <input type="datetime-local" value={memoryAt} onChange={(e) => setMemoryAt(e.target.value)} />
      </label>
      <label className="field">
        <span>Nuotrauka {initial?.imageUrl ? '(replace optional)' : '(optional)'}</span>
        <input type="file" accept="image/*" ref={fileRef} />
      </label>
      <div className="btn-row">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? '…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Atšaukti
          </button>
        )}
      </div>
    </form>
  );
}

export default function Memories() {
  const [memories, setMemories] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = Boolean(getStoredPassword());

  function load() {
    return getMemories()
      .then((data) => setMemories(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
  }, []);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      setAdding(false);
      setEditingId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !memories) return <p className="status status--error">Nepavyko įkelti prisiminimų: {error}</p>;
  if (!memories) return <p className="status">Kraunami prisiminimai…</p>;

  return (
    <div className="stack">
      <div className="admin-head">
        <h2 className="page-title">Prisiminimų skrynelė</h2>
        {isAdmin && !adding && (
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            + Pridėti
          </button>
        )}
      </div>

      {error && <p className="status status--error">{error}</p>}

      {isAdmin && adding && (
        <section className="card">
          <h3 className="panel__title">Naujas prisiminimas</h3>
          <MemoryForm
            busy={busy}
            submitLabel="Išsaugoti"
            onSubmit={(form) => run(() => createMemory(form))}
            onCancel={() => setAdding(false)}
          />
        </section>
      )}

      {memories.length === 0 && !adding ? (
        <p className="status">
          Kol kas prisiminimų nėra.{' '}
          {isAdmin ? 'Paspausk „Pridėti“, kad įrašytum pirmą.' : 'Netrukus jų atsiras. 💛'}
        </p>
      ) : (
        <ol className="timeline">
          {memories.map((m) => (
            <li key={m.id} className="timeline__item card">
              {isAdmin && editingId === m.id ? (
                <MemoryForm
                  initial={m}
                  busy={busy}
                  submitLabel="Atnaujinti"
                  onSubmit={(form) => run(() => updateMemory(m.id, form))}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  {m.imageUrl && (
                    <img className="memory__image" src={m.imageUrl} alt={m.title} loading="lazy" />
                  )}
                  <div className="timeline__head">
                    <span className="timeline__date">{formatStamp(m.memoryAt)}</span>
                  </div>
                  <h3 className="timeline__title">{m.title}</h3>
                  {m.body && <p className="timeline__message">{m.body}</p>}
                  {isAdmin && (
                    <div className="btn-row">
                      <button type="button" className="btn btn--small" onClick={() => setEditingId(m.id)}>
                        Redaguoti
                      </button>
                      <button
                        type="button"
                        className="btn btn--small"
                        disabled={busy}
                        onClick={() => run(() => deleteMemory(m.id))}
                      >
                        Ištrinti
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
