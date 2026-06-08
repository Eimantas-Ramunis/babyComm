// Push notification helpers: subscribe the current device to Web Push and register it
// with the backend. Works on http://localhost and on HTTPS origins.

import { registerPush, getVapidPublicKey } from './api.js';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Returns 'unsupported' | 'denied' | 'subscribed' | 'default'. */
export async function getSubscriptionState() {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) return 'subscribed';
  return 'default';
}

// VAPID public keys are base64url; PushManager needs a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Request permission, subscribe via PushManager, and register the device with the backend.
 * Throws with a friendly message on failure.
 */
export async function subscribe(deviceName) {
  if (!isPushSupported()) throw new Error('Push notifications are not supported on this device.');

  console.log('[push] requesting notification permission…');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  console.log('[push] waiting for the service worker to be ready…');
  // Guard against a missing/unregistered SW hanging forever on serviceWorker.ready.
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Service worker not ready (is it registered?)')), 10000),
    ),
  ]);

  console.log('[push] fetching VAPID public key…');
  const { publicKey } = await getVapidPublicKey();

  const subscription =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  console.log('[push] subscription obtained, registering with server…');

  await registerPush({
    subscription: subscription.toJSON(),
    deviceName: deviceName || undefined,
    userAgent: navigator.userAgent,
  });

  console.log('[push] device registered ✓');
  return true;
}

export async function unsubscribe() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await sub.unsubscribe();
}
