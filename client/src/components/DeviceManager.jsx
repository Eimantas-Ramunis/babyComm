// Admin device management: register this browser, send a test push, enable/disable, remove.

import { useState } from 'react';
import {
  getDevices,
  sendTestNotification,
  setDeviceActive,
  deleteDevice,
} from '../services/api.js';
import { subscribe } from '../services/push.js';

export default function DeviceManager({ devices, onChange, onResult }) {
  const [busy, setBusy] = useState(false);

  async function refresh() {
    onChange?.(await getDevices());
  }

  async function act(fn, successMsg) {
    setBusy(true);
    try {
      const result = await fn();
      await refresh();
      onResult?.({ ok: true, message: typeof successMsg === 'function' ? successMsg(result) : successMsg });
    } catch (e) {
      onResult?.({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h3 className="panel__title">Devices</h3>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => act(() => subscribe('Admin device'), 'This device registered.')}
        >
          Register this device
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() =>
            act(
              () => sendTestNotification(),
              (r) => `Test sent to ${r.sent}/${r.total} device(s).`,
            )
          }
        >
          Send test notification
        </button>
      </div>

      {devices.length === 0 ? (
        <p className="muted">No devices registered yet.</p>
      ) : (
        <ul className="list">
          {devices.map((d) => (
            <li key={d.id} className="list__item device-row">
              <span>
                <strong>{d.deviceName || 'Unnamed device'}</strong>
                {d.active ? '' : ' (inactive)'}
              </span>
              <span className="btn-row">
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={busy}
                  onClick={() => act(() => setDeviceActive(d.id, !d.active), 'Device updated.')}
                >
                  {d.active ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={busy}
                  onClick={() => act(() => deleteDevice(d.id), 'Device removed.')}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
