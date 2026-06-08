// Editable settings form for the admin page.

import { useState } from 'react';

const PERSONALITIES = [
  'Sweet Bean',
  'Tiny Viking',
  'Chaos Goblin',
  'Little CEO',
  'Future Supervillain',
  'Soft Poet',
  'Dad Joke Machine',
];

export default function AdminSettingsForm({ settings, onSave, saving }) {
  const [form, setForm] = useState({
    babyNickname: settings.babyNickname || '',
    dueDate: settings.dueDate || '',
    pregnancyStartDate: settings.pregnancyStartDate || '',
    timezone: settings.timezone || 'Europe/Vilnius',
    personality: settings.personality || 'Sweet Bean',
    tone: settings.tone || '',
  });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      ...form,
      // Send null (not "") so the backend treats an empty start date as "unset".
      pregnancyStartDate: form.pregnancyStartDate || null,
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Baby nickname</span>
        <input
          type="text"
          value={form.babyNickname}
          onChange={(e) => update('babyNickname', e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Due date</span>
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => update('dueDate', e.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Pregnancy start date (optional)</span>
        <input
          type="date"
          value={form.pregnancyStartDate}
          onChange={(e) => update('pregnancyStartDate', e.target.value)}
        />
      </label>

      <label className="field">
        <span>Timezone</span>
        <input
          type="text"
          value={form.timezone}
          onChange={(e) => update('timezone', e.target.value)}
        />
      </label>

      <label className="field">
        <span>Personality</span>
        <select value={form.personality} onChange={(e) => update('personality', e.target.value)}>
          {PERSONALITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Tone</span>
        <input type="text" value={form.tone} onChange={(e) => update('tone', e.target.value)} />
      </label>

      <button type="submit" className="btn btn--primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
