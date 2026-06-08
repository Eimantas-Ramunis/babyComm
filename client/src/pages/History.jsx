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

  if (error) return <p className="status status--error">Nepavyko įkelti istorijos: {error}</p>;
  if (!cards) return <p className="status">Kraunama istorija…</p>;

  return (
    <div className="stack">
      <h2 className="page-title">Mūsų mažoji istorija</h2>
      {cards.length === 0 ? (
        <p className="status">Kol kas nėra išsaugotų naujienų. Jos atsiras diena po dienos. 🌱</p>
      ) : (
        <Timeline cards={cards} />
      )}
    </div>
  );
}
