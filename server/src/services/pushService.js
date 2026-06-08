// Web Push via VAPID (F5/F8) — Phase 4. Not implemented in Phase 1.
//
// Phase 4 will use the `web-push` package with VAPID keys and the push_devices table.

export const NOT_IMPLEMENTED = 'Push notifications are not implemented in Phase 1.';

export async function sendTestNotification() {
  throw new Error(NOT_IMPLEMENTED);
}

export async function sendPushToAllActiveDevices() {
  throw new Error(NOT_IMPLEMENTED);
}
