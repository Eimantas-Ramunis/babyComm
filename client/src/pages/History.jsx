import { useEffect, useState } from 'react';
import { getHistory } from '../services/api.js';
import Timeline from '../components/Timeline.jsx';

export default function History() {
  const [cards, setCards] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getHistory()
      .then((data) => setCards(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="status status--error">Could not load history: {error}</p>;
  if (!cards) return <p className="status">Loading history…</p>;

  return (
    <div className="stack">
      <h2 className="page-title">Our little timeline</h2>
      {cards.length === 0 ? (
        <p className="status">No updates saved yet. They’ll appear here day by day. 🌱</p>
      ) : (
        <Timeline cards={cards} />
      )}
    </div>
  );
}
