import { useEffect, useState } from 'react';
import { getToday } from '../services/api.js';
import TodayCard from '../components/TodayCard.jsx';
import BabyMessageCard from '../components/BabyMessageCard.jsx';
import SubscribeButton from '../components/SubscribeButton.jsx';

export default function Home() {
  const [today, setToday] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getToday()
      .then((data) => {
        if (data) setToday(data);
        else setError('Naujienų kol kas nėra.');
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="status status--error">Nepavyko įkelti: {error}</p>;
  if (!today) return <p className="status">Kraunama šiandienos naujiena…</p>;

  return (
    <div className="stack">
      <TodayCard today={today} />
      <BabyMessageCard today={today} />
      <SubscribeButton />
    </div>
  );
}
