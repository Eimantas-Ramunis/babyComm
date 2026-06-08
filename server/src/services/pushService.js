// Web Push via VAPID (F5/F8).
//
// VAPID keys are taken from env if provided, otherwise auto-generated once and persisted
// in app_config so push works on a fresh deploy with zero manual key generation.
// Subscriptions are deduped by endpoint and auto-deactivated when the push service reports
// the subscription is gone (404/410).

import webpush from 'web-push';
import db from '../db/database.js';
import { getConfig, setConfig } from './configService.js';
import { serializeDevice } from '../utils/serializers.js';

let vapidPublicKey = null;

/** Classify a push send failure: a 'gone' subscription should be deactivated. */
export function classifyPushError(statusCode) {
  return statusCode === 404 || statusCode === 410 ? 'gone' : 'transient';
}

/**
 * Ensure VAPID keys exist and configure web-push. Called once on boot.
 * Priority: env vars -> persisted app_config -> freshly generated (and persisted).
 */
export function ensureVapidKeys() {
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  let publicKey = process.env.VAPID_PUBLIC_KEY || null;
  let privateKey = process.env.VAPID_PRIVATE_KEY || null;

  if (!publicKey || !privateKey) {
    publicKey = getConfig('vapid_public_key');
    privateKey = getConfig('vapid_private_key');
  }

  if (!publicKey || !privateKey) {
    const generated = webpush.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    setConfig('vapid_public_key', publicKey);
    setConfig('vapid_private_key', privateKey);
    console.log('Generated and persisted a new VAPID keypair.');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidPublicKey = publicKey;
}

export function getVapidPublicKey() {
  return vapidPublicKey;
}

/**
 * Register (or refresh) a device subscription. Deduped by subscription endpoint, so
 * re-subscribing the same browser updates the existing row instead of creating duplicates.
 */
export function registerDevice({ subscription, deviceName, userAgent }) {
  if (!subscription || typeof subscription.endpoint !== 'string') {
    throw new Error('A subscription with an endpoint is required.');
  }
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO push_devices
       (endpoint, device_name, subscription_json, user_agent, active, created_at, updated_at)
     VALUES (@endpoint, @device_name, @subscription_json, @user_agent, 1, @now, @now)
     ON CONFLICT(endpoint) DO UPDATE SET
       device_name = COALESCE(excluded.device_name, push_devices.device_name),
       subscription_json = excluded.subscription_json,
       user_agent = excluded.user_agent,
       active = 1,
       updated_at = excluded.updated_at`,
  ).run({
    endpoint: subscription.endpoint,
    device_name: deviceName ?? null,
    subscription_json: JSON.stringify(subscription),
    user_agent: userAgent ?? null,
    now,
  });

  return db.prepare('SELECT * FROM push_devices WHERE endpoint = ?').get(subscription.endpoint);
}

export function listDevices() {
  return db.prepare('SELECT * FROM push_devices ORDER BY id DESC').all().map(serializeDevice);
}

export function removeDevice(id) {
  return db.prepare('DELETE FROM push_devices WHERE id = ?').run(id).changes > 0;
}

export function setDeviceActive(id, active) {
  const info = db
    .prepare('UPDATE push_devices SET active = ?, updated_at = ? WHERE id = ?')
    .run(active ? 1 : 0, new Date().toISOString(), id);
  return info.changes > 0;
}

function markSuccess(id) {
  const now = new Date().toISOString();
  db.prepare('UPDATE push_devices SET last_success_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    id,
  );
}

function markFailure(id, { deactivate }) {
  const now = new Date().toISOString();
  // Deactivation is conditional; the rest of the update is identical, so build one statement.
  db.prepare(
    `UPDATE push_devices SET last_failure_at = ?, updated_at = ?${deactivate ? ', active = 0' : ''} WHERE id = ?`,
  ).run(now, now, id);
}

/**
 * Send a push payload to one device row. Returns {ok, deactivated}.
 * On a 'gone' subscription the device is deactivated so we stop trying it.
 */
export async function sendToDevice(device, payload) {
  try {
    const subscription = JSON.parse(device.subscription_json);
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    markSuccess(device.id);
    return { ok: true, deactivated: false };
  } catch (err) {
    const kind = classifyPushError(err.statusCode);
    markFailure(device.id, { deactivate: kind === 'gone' });
    return { ok: false, deactivated: kind === 'gone', error: err.message };
  }
}

/** Send a payload to every active device. Returns a per-device result summary. */
export async function sendToAllActiveDevices(payload) {
  const devices = db.prepare('SELECT * FROM push_devices WHERE active = 1').all();
  const results = await Promise.all(
    devices.map(async (device) => ({
      id: device.id,
      ...(await sendToDevice(device, payload)),
    })),
  );
  return {
    total: devices.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
