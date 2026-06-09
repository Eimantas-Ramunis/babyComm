// Admin preview of tomorrow's card: shows whether the nightly pre-generation has run, what
// the notification + homepage message will say, and the image — with a "generate now" button
// so tomorrow's card can be prepared/refreshed without waiting for the scheduled run.

import { useEffect, useState } from 'react';
import { getTomorrowCard, generateTomorrowCard } from '../services/api.js';

const STATUS_LABEL = { ai: 'AI-generated', fallback: 'fallback (canned) text' };

export default function TomorrowPreview({ onResult }) {
  const [data, setData] = useState(null); // { date, card, pregen }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setData(await getTomorrowCard());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    try {
      const res = await generateTomorrowCard();
      onResult?.({ ok: true, message: `Tomorrow’s card generated (${res.mode}).` });
      await load();
    } catch (e) {
      onResult?.({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="status status--error">{error}</p>;
  if (!data) return <p className="muted">Loading tomorrow’s card…</p>;

  const { date, card, pregen } = data;

  return (
    <div className="panel">
      <h3 className="panel__title">Tomorrow’s card ({date})</h3>

      <p className="muted">
        {pregen.enabled
          ? pregen.ranToday
            ? `Nightly pre-generation already ran today (scheduled ${pregen.time}).`
            : `Nightly pre-generation has not run yet today (scheduled ${pregen.time}).`
          : 'Nightly pre-generation is disabled.'}
      </p>

      {card ? (
        <div className="tomorrow-preview">
          {card.imageUrl && (
            <img className="tomorrow-preview__img" src={card.imageUrl} alt={card.title || 'Tomorrow'} loading="lazy" />
          )}
          <div className="tomorrow-preview__body">
            <p>
              <span className="chip">{STATUS_LABEL[card.generationStatus] || card.generationStatus}</span>{' '}
              {card.mood && <span className="chip mood-chip">nuotaika: {card.mood}</span>}
            </p>
            {card.title && <p><strong>{card.title}</strong></p>}
            <p className="muted">Notification: “{card.shortNotification}”</p>
            <p>“{card.homepageMessage}”</p>
            {!card.imageUrl && <p className="muted">No image yet.</p>}
          </div>
        </div>
      ) : (
        <p className="muted">
          Not generated yet — it will be created by the nightly run, or you can generate it now.
        </p>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn--primary" disabled={busy} onClick={generate}>
          {busy ? 'Generating…' : card ? 'Regenerate tomorrow’s card' : 'Generate tomorrow’s card now'}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={load}>
          Refresh
        </button>
      </div>
    </div>
  );
}
