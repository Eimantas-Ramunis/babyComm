// The big homepage card: who, how far along, and the size comparison.

export default function TodayCard({ today }) {
  const {
    babyNickname,
    gestationalWeek,
    gestationalDay,
    trimester,
    daysRemaining,
    sizeLabel,
    developmentFact,
    isDueDatePassed,
  } = today;

  return (
    <section className="card today-card">
      <div className="today-card__badge">
        <span className="badge-week">{gestationalWeek} savaitė</span>
        <span className="badge-day">+ {gestationalDay} d.</span>
      </div>

      <h2 className="today-card__name">{babyNickname}</h2>

      <p className="today-card__size">
        Šiandien esu maždaug <strong>{sizeLabel}</strong> dydžio.
      </p>

      {developmentFact && <p className="today-card__fact">{developmentFact}</p>}

      <div className="today-card__meta">
        <Meta label="Trimestras" value={ordinal(trimester)} />
        <Meta
          label={isDueDatePassed ? 'Vėluoja' : 'Dienų iki termino'}
          value={`${Math.abs(daysRemaining)} d.`}
        />
      </div>
    </section>
  );
}

function Meta({ label, value }) {
  return (
    <div className="meta">
      <span className="meta__label">{label}</span>
      <span className="meta__value">{value}</span>
    </div>
  );
}

function ordinal(n) {
  return ['—', '1-as', '2-as', '3-as'][n] || `${n}-as`;
}
