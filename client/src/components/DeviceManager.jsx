// Read-only device list for Phase 1. Registration + test notifications land in Phase 4.

export default function DeviceManager({ devices }) {
  return (
    <div className="panel">
      <h3 className="panel__title">Registered devices</h3>
      {devices.length === 0 ? (
        <p className="muted">No devices registered yet. Push notifications arrive in Phase 4.</p>
      ) : (
        <ul className="list">
          {devices.map((d) => (
            <li key={d.id} className="list__item">
              <strong>{d.deviceName || 'Unnamed device'}</strong>
              {d.active ? '' : ' (inactive)'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
