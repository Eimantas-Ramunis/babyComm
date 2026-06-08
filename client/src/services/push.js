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

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await getVapidPublicKey();

  const subscription =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await registerPush({
    subscription: subscription.toJSON(),
    deviceName: deviceName || undefined,
    userAgent: navigator.userAgent,
  });

  return true;
}

export async function unsubscribe() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) await sub.unsubscribe();
}
