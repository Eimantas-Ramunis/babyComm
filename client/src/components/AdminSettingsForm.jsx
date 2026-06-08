// Editable settings form for the admin page.

import { useState } from 'react';

// Build the personality <select> options, ensuring the currently-saved value is present even if
// it was removed from the list (so the select reflects state instead of silently showing #1).
function personalityOptions(personalities, current) {
  const names = personalities.map((p) => p.name);
  if (current && !names.includes(current)) return [current, ...names];
  return names.length ? names : [current].filter(Boolean);
}

export default function AdminSettingsForm({ settings, personalities = [], onSave, saving }) {
  const [form, setForm] = useState({
    babyNickname: settings.babyNickname || '',
    dueDate: settings.dueDate || '',
    pregnancyStartDate: settings.pregnancyStartDate || '',
    timezone: settings.timezone || 'Europe/Vilnius',
    personality: settings.personality || 'Sweet Bean',
    randomizePersonality: settings.randomizePersonality ?? true,
    notificationsEnabled: settings.notificationsEnabled ?? true,
    autoGenerateEnabled: settings.autoGenerateEnabled ?? true,
    autoGenerateTime: settings.autoGenerateTime || '20:00',
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
      randomizePersonality: form.randomizePersonality,
      notificationsEnabled: form.notificationsEnabled,
      autoGenerateEnabled: form.autoGenerateEnabled,
      autoGenerateTime: form.autoGenerateTime,
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

      <label className="field field--check">
        <input
          type="checkbox"
          checked={form.randomizePersonality}
          onChange={(e) => update('randomizePersonality', e.target.checked)}
        />
        <span>Randomize personality each card</span>
      </label>

      <label className="field">
        <span>{form.randomizePersonality ? 'Personality (fallback when not randomizing)' : 'Personality'}</span>
        <select value={form.personality} onChange={(e) => update('personality', e.target.value)}>
          {personalityOptions(personalities, form.personality).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <p className="muted">Tone: 3 random tones are picked per card from your tone list (managed below).</p>

      <label className="field field--check">
        <input
          type="checkbox"
          checked={form.notificationsEnabled}
          onChange={(e) => update('notificationsEnabled', e.target.checked)}
        />
        <span>Notifications enabled (master switch)</span>
      </label>

      <label className="field field--check">
        <input
          type="checkbox"
          checked={form.autoGenerateEnabled}
          onChange={(e) => update('autoGenerateEnabled', e.target.checked)}
        />
        <span>Auto-generate tomorrow’s card daily</span>
      </label>

      <label className="field">
        <span>Auto-generate time (when tomorrow’s card is prepared)</span>
        <input
          type="time"
          value={form.autoGenerateTime}
          onChange={(e) => update('autoGenerateTime', e.target.value)}
        />
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
