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
    notificationsEnabled: settings.notificationsEnabled ?? true,
    geminiTextModel: settings.geminiTextModel || '',
    geminiImageModel: settings.geminiImageModel || '',
    geminiApiKey: '', // never prefilled; only sent if the user types a new key
  });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      babyNickname: form.babyNickname,
      dueDate: form.dueDate,
      // Send null (not "") so the backend treats an empty start date as "unset".
      pregnancyStartDate: form.pregnancyStartDate || null,
      timezone: form.timezone,
      personality: form.personality,
      tone: form.tone,
      notificationsEnabled: form.notificationsEnabled,
      geminiTextModel: form.geminiTextModel,
      geminiImageModel: form.geminiImageModel,
    };
    // Only include the key when the admin actually entered one (avoids wiping it on save).
    if (form.geminiApiKey.trim()) payload.geminiApiKey = form.geminiApiKey.trim();
    onSave(payload);
    setForm((prev) => ({ ...prev, geminiApiKey: '' }));
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

      <label className="field field--check">
        <input
          type="checkbox"
          checked={form.notificationsEnabled}
          onChange={(e) => update('notificationsEnabled', e.target.checked)}
        />
        <span>Notifications enabled (master switch)</span>
      </label>

      <fieldset className="fieldset">
        <legend>AI (Gemini)</legend>
        <label className="field">
          <span>
            API key{' '}
            {settings.geminiApiKeySet ? `(set ••••${settings.geminiKeyLast4})` : '(not set)'}
          </span>
          <input
            type="password"
            value={form.geminiApiKey}
            placeholder={settings.geminiApiKeySet ? 'Enter a new key to replace' : 'Paste Gemini API key'}
            onChange={(e) => update('geminiApiKey', e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Text model</span>
          <input
            type="text"
            value={form.geminiTextModel}
            placeholder="gemini-2.5-flash"
            onChange={(e) => update('geminiTextModel', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Image model</span>
          <input
            type="text"
            value={form.geminiImageModel}
            placeholder="gemini-2.5-flash-image"
            onChange={(e) => update('geminiImageModel', e.target.value)}
          />
        </label>
      </fieldset>

      <button type="submit" className="btn btn--primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
