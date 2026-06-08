// Push notification helpers — stubbed in Phase 1.
// Phase 4 will request notification permission and register a push subscription
// against POST /api/push/register.

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function registerForPush() {
  throw new Error('Push registration is not implemented in Phase 1.');
}
