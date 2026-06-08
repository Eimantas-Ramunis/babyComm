// Generic admin list manager: shows items with a delete button + an add input.
// Reused for personalities and tones.

import { useState } from 'react';

export default function ListManager({ title, items, labelKey, placeholder, onAdd, onDelete }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    try {
      await onAdd(v);
      setValue('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3 className="panel__title">{title}</h3>
      {items.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul className="chip-list">
          {items.map((item) => (
            <li key={item.id} className="chip chip--removable">
              {item[labelKey]}
              <button
                type="button"
                className="chip__remove"
                aria-label={`Remove ${item[labelKey]}`}
                disabled={busy}
                onClick={() => onDelete(item.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn btn--small btn--primary" disabled={busy}>
          Add
        </button>
      </form>
    </div>
  );
}
