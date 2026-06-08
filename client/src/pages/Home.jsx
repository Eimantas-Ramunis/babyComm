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
        else setError('No update available.');
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="status status--error">Could not load today: {error}</p>;
  if (!today) return <p className="status">Loading today’s update…</p>;

  return (
    <div className="stack">
      <TodayCard today={today} />
      <BabyMessageCard today={today} />
      <SubscribeButton />
    </div>
  );
}
