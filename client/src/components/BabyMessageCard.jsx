// The baby's "message to mom" plus a placeholder image area (real images: Phase 6).

export default function BabyMessageCard({ today }) {
  const { title, homepageMessage, mood, imageUrl, sizeLabel } = today;

  return (
    <section className="card message-card">
      <div className="message-card__image" aria-hidden="true">
        {imageUrl ? (
          <img src={imageUrl} alt="" />
        ) : (
          <span className="message-card__placeholder">🍼</span>
        )}
      </div>

      <div className="message-card__body">
        {title && <h3 className="message-card__title">{title}</h3>}
        <p className="message-card__text">“{homepageMessage}”</p>
        <div className="message-card__footer">
          {mood && <span className="chip">mood: {mood}</span>}
          {sizeLabel && <span className="chip">size: {sizeLabel}</span>}
        </div>
      </div>
    </section>
  );
}
