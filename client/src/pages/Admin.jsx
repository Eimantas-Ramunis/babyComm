import { useState } from 'react';
import {
  getStoredPassword,
  setStoredPassword,
  getSettings,
  updateSettings,
  generateTodayCard,
  getSchedules,
  getDevices,
} from '../services/api.js';
import AdminSettingsForm from '../components/AdminSettingsForm.jsx';
import ScheduleManager from '../components/ScheduleManager.jsx';
import DeviceManager from '../components/DeviceManager.jsx';

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState(getStoredPassword());
  const [settings, setSettings] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [devices, setDevices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  async function loadAll() {
    const [s, sch, dev] = await Promise.all([getSettings(), getSchedules(), getDevices()]);
    setSettings(s);
    setSchedules(sch);
    setDevices(dev);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setStoredPassword(password);
    try {
      await loadAll();
      setAuthed(true);
    } catch (err) {
      setStoredPassword('');
      setError(err.status === 401 ? 'Wrong password.' : err.message);
    }
  }

  async function handleSave(form) {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      setSettings(await updateSettings(form));
      setNotice('Settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setNotice(null);
    setError(null);
    try {
      const res = await generateTodayCard();
      setNotice(`Today’s card generated (${res.mode}).`);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleLogout() {
    setStoredPassword('');
    setAuthed(false);
    setSettings(null);
    setPassword('');
  }

  if (!authed) {
    return (
      <div className="stack">
        <h2 className="page-title">Admin</h2>
        <form className="form" onSubmit={handleLogin}>
          <label className="field">
            <span>Admin password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </label>
          <button type="submit" className="btn btn--primary">
            Log in
          </button>
        </form>
        {error && <p className="status status--error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="admin-head">
        <h2 className="page-title">Admin</h2>
        <button type="button" className="btn" onClick={handleLogout}>
          Log out
        </button>
      </div>

      {notice && <p className="status status--ok">{notice}</p>}
      {error && <p className="status status--error">{error}</p>}

      {settings && (
        <section className="card">
          <h3 className="panel__title">Settings</h3>
          <AdminSettingsForm settings={settings} onSave={handleSave} saving={saving} />
        </section>
      )}

      <section className="card">
        <h3 className="panel__title">Cards</h3>
        <button type="button" className="btn btn--primary" onClick={handleGenerate}>
          Generate today’s card
        </button>
        <p className="muted">Phase 1 creates a warm fallback card (no AI yet).</p>
      </section>

      <section className="card">
        <ScheduleManager schedules={schedules} />
      </section>

      <section className="card">
        <DeviceManager devices={devices} />
      </section>
    </div>
  );
}
