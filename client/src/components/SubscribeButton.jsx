// "Turn on baby updates" — lets mom's device subscribe to push without the admin password.

import { useEffect, useState } from 'react';
import { getSubscriptionState, subscribe } from '../services/push.js';

export default function SubscribeButton() {
  const [state, setState] = useState('loading'); // loading|unsupported|denied|default|subscribed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSubscriptionState().then(setState).catch(() => setState('unsupported'));
  }, []);

  async function handleSubscribe() {
    setBusy(true);
    setError(null);
    try {
      await subscribe();
      setState('subscribed');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading' || state === 'unsupported') return null;

  return (
    <section className="card subscribe-card">
      {state === 'subscribed' ? (
        <p className="subscribe-card__ok">🔔 You’re getting baby updates on this device.</p>
      ) : state === 'denied' ? (
        <p className="muted">
          Notifications are blocked for this site. Enable them in your browser settings to get baby
          updates.
        </p>
      ) : (
        <>
          <p className="subscribe-card__text">Want little notes from me, mom?</p>
          <button type="button" className="btn btn--primary" onClick={handleSubscribe} disabled={busy}>
            {busy ? 'Turning on…' : 'Turn on baby updates 💛'}
          </button>
        </>
      )}
      {error && <p className="status status--error">{error}</p>}
    </section>
  );
}
