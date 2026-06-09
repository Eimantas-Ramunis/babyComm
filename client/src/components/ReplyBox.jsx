// Mom answers the baby (Phase 7): today's replies as bubbles + a send box.
// Recent replies are fed into the next AI generation, so the baby can answer back tomorrow.

import { useState } from 'react';
import { sendReply } from '../services/api.js';

export default function ReplyBox({ initialReplies = [] }) {
  const [replies, setReplies] = useState(initialReplies);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await sendReply(text.trim());
      setReplies(res.replies);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card reply-box">
      <h3 className="panel__title">Atsakyk mažyliui 💬</h3>

      {replies.length > 0 && (
        <ul className="reply-list">
          {replies.map((r) => (
            <li key={r.id} className="reply-bubble">
              <span className="reply-bubble__who">Mama</span>
              {r.body}
            </li>
          ))}
        </ul>
      )}

      <form className="reply-form" onSubmit={handleSend}>
        <textarea
          rows={2}
          value={text}
          maxLength={1000}
          placeholder="Parašyk man ką nors, mama…"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn--primary" disabled={busy || !text.trim()}>
          {busy ? 'Siunčiama…' : 'Siųsti 💌'}
        </button>
      </form>
      <p className="muted">Mažylis perskaitys ir gali atsakyti rytojaus žinutėje. 😉</p>
      {error && <p className="status status--error">{error}</p>}
    </section>
  );
}
