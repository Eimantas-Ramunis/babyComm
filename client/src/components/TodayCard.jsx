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
        <span className="badge-week">Week {gestationalWeek}</span>
        <span className="badge-day">+ {gestationalDay} days</span>
      </div>

      <h2 className="today-card__name">{babyNickname}</h2>

      <p className="today-card__size">
        Today I am roughly the size of a <strong>{sizeLabel}</strong>.
      </p>

      {developmentFact && <p className="today-card__fact">{developmentFact}</p>}

      <div className="today-card__meta">
        <Meta label="Trimester" value={ordinal(trimester)} />
        <Meta
          label={isDueDatePassed ? 'Past due by' : 'Days until due'}
          value={`${Math.abs(daysRemaining)} days`}
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
  return ['0th', '1st', '2nd', '3rd'][n] || `${n}th`;
}
