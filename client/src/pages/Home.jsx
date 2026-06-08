import { useEffect, useState } from 'react';
import { getToday } from '../services/api.js';
import SubscribeButton from '../components/SubscribeButton.jsx';

const ORDINAL = ['—', '1-as', '2-as', '3-as'];

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

  const {
    babyNickname,
    gestationalWeek,
    gestationalDay,
    trimester,
    daysRemaining,
    isDueDatePassed,
    sizeLabel,
    developmentFact,
    title,
    homepageMessage,
    mood,
    imageUrl,
  } = today;

  return (
    <div className="home">
      {/* Big animated hero image */}
      <section className="hero hero--enter">
        <div className="hero__art">
          {imageUrl ? (
            <img className="hero__img" src={imageUrl} alt={babyNickname} />
          ) : (
            <div className="hero__placeholder" aria-hidden="true">
              <span className="hero__emoji">🍼</span>
            </div>
          )}

          {/* Floating decorative hearts (pure CSS) */}
          <span className="floaty floaty--1" aria-hidden="true">💛</span>
          <span className="floaty floaty--2" aria-hidden="true">✨</span>
          <span className="floaty floaty--3" aria-hidden="true">🫧</span>

          <span className="hero__badge">
            {gestationalWeek} savaitė<small>+{gestationalDay} d.</small>
          </span>
        </div>
      </section>

      <section className="card glow-in home-name">
        <h2 className="baby-name">{babyNickname}</h2>
        <p className="size-line">
          Šiandien esu maždaug <strong>{sizeLabel}</strong> dydžio.
        </p>
        <div className="pill-row">
          <span className="pill">
            <span className="pill__label">Trimestras</span>
            <span className="pill__value">{ORDINAL[trimester] || `${trimester}-as`}</span>
          </span>
          <span className="pill">
            <span className="pill__label">{isDueDatePassed ? 'Vėluoja' : 'Iki termino'}</span>
            <span className="pill__value">{Math.abs(daysRemaining)} d.</span>
          </span>
        </div>
      </section>

      <section className="card glow-in home-message" style={{ '--delay': '0.12s' }}>
        {title && <h3 className="message-title">{title}</h3>}
        <p className="message-quote">“{homepageMessage}”</p>
        {developmentFact && <p className="message-fact">{developmentFact}</p>}
        {mood && <span className="chip mood-chip">nuotaika: {mood}</span>}
      </section>

      <div className="glow-in" style={{ '--delay': '0.24s' }}>
        <SubscribeButton />
      </div>
    </div>
  );
}
