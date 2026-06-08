// Admin card generation controls. Generates today's card (AI text + image when a Gemini key
// is configured, otherwise a fallback card) and regenerates message/image for today.

import { useState } from 'react';
import {
  getToday,
  generateTodayCard,
  regenerateMessage,
  regenerateImage,
} from '../services/api.js';

export default function CardGenerator({ onResult }) {
  const [busy, setBusy] = useState(null); // 'today' | 'message' | 'image' | null

  // Use the date the SERVER considers "today" (its configured timezone), not the browser's
  // UTC date — otherwise regenerate could target a different calendar day than generate-today.
  async function serverToday() {
    const today = await getToday();
    return today.date;
  }

  async function run(kind, fn) {
    setBusy(kind);
    try {
      const res = await fn();
      onResult?.({ ok: true, message: describe(kind, res) });
    } catch (e) {
      onResult?.({ ok: false, message: e.message });
    } finally {
      setBusy(null);
    }
  }

  function describe(kind, res) {
    if (kind === 'today') return `Today’s card generated (${res.mode}).`;
    if (kind === 'message') return `Message regenerated (${res.mode}).`;
    return 'Image regenerated.';
  }

  return (
    <div className="panel">
      <h3 className="panel__title">Cards</h3>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy !== null}
          onClick={() => run('today', () => generateTodayCard())}
        >
          {busy === 'today' ? 'Generating…' : 'Generate today’s card'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy !== null}
          onClick={() => run('message', async () => regenerateMessage(await serverToday()))}
        >
          {busy === 'message' ? 'Working…' : 'Regenerate message'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy !== null}
          onClick={() => run('image', async () => regenerateImage(await serverToday()))}
        >
          {busy === 'image' ? 'Working…' : 'Regenerate image'}
        </button>
      </div>
      <p className="muted">
        With a Gemini key set, this uses AI; otherwise it writes a warm fallback card. Image
        generation needs a key.
      </p>
    </div>
  );
}
