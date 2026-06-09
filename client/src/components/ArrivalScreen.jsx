// Delivery-day reveal (F12): replaces the daily card once the admin flips "baby has arrived".
// The app's finale — celebratory, Lithuanian, built from the birth details in settings.

const MONTHS_LT = [
  'sausio', 'vasario', 'kovo', 'balandžio', 'gegužės', 'birželio',
  'liepos', 'rugpjūčio', 'rugsėjo', 'spalio', 'lapkričio', 'gruodžio',
];

// "2026-12-20" -> "2026 m. gruodžio 20 d." (falls back to the raw value on anything odd).
function formatBirthDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso;
  return `${m[1]} m. ${MONTHS_LT[Number(m[2]) - 1]} ${Number(m[3])} d.`;
}

export default function ArrivalScreen({ babyNickname, birth }) {
  const name = birth?.name || babyNickname;

  return (
    <div className="arrival">
      <section className="arrival__hero hero--enter">
        <span className="arrival__heart beating" aria-hidden="true">❤️</span>
        <span className="floaty floaty--1" aria-hidden="true">💛</span>
        <span className="floaty floaty--2" aria-hidden="true">✨</span>
        <span className="floaty floaty--3" aria-hidden="true">🎉</span>
        <span className="floaty floaty--4" aria-hidden="true">🤍</span>
      </section>

      <section className="card glow-in arrival__message">
        <h2 className="baby-name">{name}</h2>
        <p className="arrival__hello">Labas, mama. Atvykau. ❤️</p>
        <p className="arrival__sub">Ačiū, kad užauginai mane nuo aguonos grūdelio.</p>
      </section>

      {(birth?.date || birth?.time || birth?.weight) && (
        <section className="card glow-in" style={{ '--delay': '0.12s' }}>
          <div className="pill-row pill-row--wrap">
            {birth.date && (
              <span className="pill">
                <span className="pill__label">Gimimo diena</span>
                <span className="pill__value">{formatBirthDate(birth.date)}</span>
              </span>
            )}
            {birth.time && (
              <span className="pill">
                <span className="pill__label">Laikas</span>
                <span className="pill__value">{birth.time}</span>
              </span>
            )}
            {birth.weight && (
              <span className="pill">
                <span className="pill__label">Svoris</span>
                <span className="pill__value">{birth.weight}</span>
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
