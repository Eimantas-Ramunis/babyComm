// Admin notification schedules: list, create, enable/disable, delete.
// days_of_week is a CSV of 0-6 (0=Sunday); empty = every day.

import { useState } from 'react';
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '../services/api.js';

const EMPTY = { name: '', type: 'daily', timeOfDay: '09:00', daysOfWeek: '', sendOnNewWeek: false };

export default function ScheduleManager({ schedules, onChange, onResult }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    onChange?.(await getSchedules());
  }

  async function act(fn, msg) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      onResult?.({ ok: true, message: msg });
    } catch (e) {
      onResult?.({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  }

  function handleCreate(e) {
    e.preventDefault();
    act(async () => {
      await createSchedule(form);
      setForm(EMPTY);
    }, 'Schedule created.');
  }

  return (
    <div className="panel">
      <h3 className="panel__title">Notification schedules</h3>

      {schedules.length === 0 ? (
        <p className="muted">No schedules yet.</p>
      ) : (
        <ul className="list">
          {schedules.map((s) => (
            <li key={s.id} className="list__item device-row">
              <span>
                <strong>{s.name}</strong> — {s.timeOfDay}
                {s.daysOfWeek ? ` (days ${s.daysOfWeek})` : ' (every day)'}
                {s.sendOnNewWeek ? ' · new-week only' : ''}
                {s.enabled ? '' : ' · disabled'}
              </span>
              <span className="btn-row">
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={busy}
                  onClick={() => act(() => updateSchedule(s.id, { enabled: !s.enabled }), 'Schedule updated.')}
                >
                  {s.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={busy}
                  onClick={() => act(() => deleteSchedule(s.id), 'Schedule deleted.')}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form className="form schedule-form" onSubmit={handleCreate}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Time of day</span>
          <input
            type="time"
            value={form.timeOfDay}
            onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Days of week (CSV 0–6, blank = every day)</span>
          <input
            type="text"
            placeholder="e.g. 1,3,5"
            value={form.daysOfWeek}
            onChange={(e) => setForm({ ...form, daysOfWeek: e.target.value })}
          />
        </label>
        <label className="field field--check">
          <input
            type="checkbox"
            checked={form.sendOnNewWeek}
            onChange={(e) => setForm({ ...form, sendOnNewWeek: e.target.checked })}
          />
          <span>Only on a new gestational week</span>
        </label>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Add schedule
        </button>
      </form>
    </div>
  );
}
