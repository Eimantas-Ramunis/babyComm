// Custom service worker (vite-plugin-pwa injectManifest strategy).
// Handles offline precaching + Web Push display + notification clicks.

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

// Injected at build time by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);

// Generated card images live at /uploads/* (not precached). Serve them from cache and refresh
// in the background, so they load instantly and the router stops logging "no route found".
registerRoute(
  ({ url }) => url.pathname.startsWith('/uploads/'),
  new StaleWhileRevalidate({ cacheName: 'card-images' }),
);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Show a notification when a push arrives.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Tiny Bean Updates';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // One stable tag: a retried/duplicate daily send replaces the previous notification
    // instead of stacking; renotify still buzzes for the replacement.
    tag: 'babycomm-daily',
    renotify: true,
    data: { url: payload.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Browsers rotate push subscriptions (key/endpoint expiry). Without this handler the device
// silently stops receiving until someone manually re-subscribes — so re-subscribe with the
// same VAPID key and register the fresh subscription with the server automatically.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      let applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
      if (!applicationServerKey) {
        const res = await fetch('/api/push/vapid-public-key');
        const { publicKey } = await res.json();
        applicationServerKey = urlBase64ToUint8Array(publicKey);
      }
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceName: 'Re-subscribed automatically',
        }),
      });
    })(),
  );
});

// Focus an existing window or open a new one on click.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
