// Read-only schedule list for Phase 1. Creating/editing schedules and the actual
// sending logic land in Phase 4.

export default function ScheduleManager({ schedules }) {
  return (
    <div className="panel">
      <h3 className="panel__title">Notification schedules</h3>
      {schedules.length === 0 ? (
        <p className="muted">No schedules yet. Scheduling arrives in Phase 4.</p>
      ) : (
        <ul className="list">
          {schedules.map((s) => (
            <li key={s.id} className="list__item">
              <strong>{s.name}</strong> — {s.type} at {s.timeOfDay}
              {s.enabled ? '' : ' (disabled)'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
