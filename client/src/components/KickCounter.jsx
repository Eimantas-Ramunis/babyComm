// Kick counter (Phase 7): a big friendly button, one tap per kick. The latest day's count
// is fed into the AI context, so the baby can brag about his training.

import { useState } from 'react';
import { addKick } from '../services/api.js';

export default function KickCounter({ initialKicks }) {
  const [count, setCount] = useState(initialKicks?.count ?? 0);
  const [pulse, setPulse] = useState(false);
  const [error, setError] = useState(null);

  async function handleKick() {
    setPulse(true);
    setTimeout(() => setPulse(false), 300);
    try {
      const res = await addKick();
      setCount(res.count);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card kick-counter">
      <h3 className="panel__title">Spyriukų skaitliukas</h3>
      <p className="kick-counter__count" aria-live="polite">
        Šiandien: <strong>{count}</strong>
      </p>
      <button
        type="button"
        className={`btn btn--primary kick-counter__btn${pulse ? ' kick-counter__btn--pulse' : ''}`}
        onClick={handleKick}
      >
        Spyrė! ⚽
      </button>
      <p className="muted">Pajutai spyriuką? Paspausk — aš skaičiuoju savo treniruotes. 💪</p>
      {error && <p className="status status--error">{error}</p>}
    </section>
  );
}
