// History timeline: one entry per saved card, newest first.

export default function Timeline({ cards }) {
  return (
    <ol className="timeline">
      {cards.map((card) => (
        <li key={card.date} className="timeline__item card">
          <div className="timeline__head">
            <span className="timeline__date">{card.date}</span>
            <span className="timeline__week">
              {card.gestationalWeek} sav. + {card.gestationalDay} d.
            </span>
          </div>
          {card.title && <h3 className="timeline__title">{card.title}</h3>}
          {card.homepageMessage && <p className="timeline__message">“{card.homepageMessage}”</p>}
          <div className="timeline__meta">
            {card.sizeLabel && <span className="chip">dydis: {card.sizeLabel}</span>}
            {card.mood && <span className="chip">nuotaika: {card.mood}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
