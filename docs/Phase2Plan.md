# Baby Growth PWA — Phase 2 Implementation Plan

## Context

Phase 1 delivered a stable skeleton (Express + better-sqlite3 + React/Vite PWA, pregnancy
engine, fallback cards, admin settings, history, memories). Phase 2 turns it into a working
product: the baby actually *notifies* mom, the messages/images are AI-generated, and the whole
thing ships as a Docker image for a Raspberry Pi 4 (arm64) deployed via Portainer behind HTTPS.

**Confirmed scope (user decisions):**
- **Push notifications** (real web-push/VAPID) + **service-worker push handling** + device mgmt.
- **Scheduler** (per-minute cron) that sends scheduled notifications with dedupe.
- **Gemini text *and* image generation**, with the **API key + model names set in the admin
  panel** (stored in DB, masked on read — never hardcoded, never sent to the browser).
- **Docker**: single multi-stage image (server serves built client + API on one port);
  `docker-compose` includes **Caddy (auto-HTTPS via DuckDNS)** + a **DuckDNS updater**; plus
  **notes for pushing a multi-arch image to GHCR**.
- **Robustness improvement (approved):** device **upsert by endpoint** (no duplicate rows) +
  **auto-deactivate** on 404/410 Gone.
- Synthetic tests for all new logic; clean maintenance-oriented docs.

**Spec-driven additions folded in:** global **notifications enable/disable** master switch
(F4); a **self-subscribe button on Home** so mom's phone can register via the public
`POST /api/push/register` (the spec makes that endpoint public — it's how mom subscribes
without the admin password).

---

## 1. Data model changes (`server/src/db/migrations.js`)

Migrations must be **idempotent and upgrade-safe** for existing Phase 1 DBs. Add a helper
`addColumnIfMissing(table, col, ddl)` using `PRAGMA table_info`.

- **`settings`** — add: `notifications_enabled INTEGER DEFAULT 1`,
  `gemini_api_key TEXT`, `gemini_text_model TEXT`, `gemini_image_model TEXT`.
- **New `app_config`** (server-managed key/value, not user-edited):
  `CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT)`.
  Holds the VAPID keypair + subject so push "just works" on deploy.
- **`push_devices`** — add a UNIQUE index on the subscription endpoint for upsert:
  store `endpoint TEXT` (extracted from subscription) with `CREATE UNIQUE INDEX IF NOT EXISTS`.

Default model values seeded on first set: text `gemini-2.5-flash`, image
`gemini-2.5-flash-image` (admin-editable; documented as "verify current names").

---

## 2. VAPID + Push (`server/src/services/pushService.js`, deps: `web-push`)

- **`ensureVapidKeys()`** on boot: if `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` env vars set, use
  them; else read from `app_config`; else `webpush.generateVAPIDKeys()` and persist. Configure
  `webpush.setVapidDetails(subject, pub, priv)`. Zero manual key-gen for the user.
- **`getVapidPublicKey()`**.
- **`registerDevice({subscription, deviceName, userAgent})`** — upsert by
  `subscription.endpoint` (`ON CONFLICT(endpoint) DO UPDATE`): refresh subscription_json/UA,
  set `active=1`. No duplicate rows on re-subscribe.
- **`sendToDevice(device, payload)`** — `webpush.sendNotification`; on success set
  `last_success_at`; on `statusCode` 404/410 → set `active=0`, `last_failure_at` (auto-dedeact);
  other errors → record failure, continue.
- **`sendToAllActiveDevices(payload)`** — fan out to active devices, return per-device results.
- **`listDevices()`, `removeDevice(id)`, `setDeviceActive(id, bool)`**.

Pure helper **`classifyPushError(statusCode)` → 'gone' | 'transient'** for unit testing the
deactivation logic without real network calls.

---

## 3. Scheduler (`server/src/services/schedulerService.js`, deps: `node-cron`)

- **`shouldRunSchedule(schedule, nowParts)`** — PURE, testable. `nowParts =
  { date, time:'HH:mm', dayOfWeek:0-6, gestationalDay, lastRunDate }`. Returns boolean:
  enabled, `time === time_of_day`, day-of-week match (`days_of_week` = CSV of 0–6 or empty=every
  day), dedupe (`lastRunDate !== date`), and if `send_on_new_week` then `gestationalDay === 0`.
- **`startScheduler()`** — `cron.schedule('* * * * *', tick)`. `tick()`: read settings; if
  `notifications_enabled`, compute `nowParts` in `settings.timezone` (via Intl + dateUtils);
  for each enabled schedule where `shouldRunSchedule` → `getOrCreateTodayCard()` (text only, no
  image block) → `sendToAllActiveDevices({title, body: card.short_notification, url:'/'})` →
  set `last_run_at`. Started from `index.js` (replaces the Phase 1 no-op).
- New util in `dateUtils.js`: **`nowPartsInTimezone(tz, now)`** → `{date, time, dayOfWeek}`.

---

## 4. Gemini text (`server/src/services/aiTextService.js`)

Replace the stub. Uses global `fetch` (Node 18+, no dep).
- **`generateMessage(context)`** — build the prompt from `docs/ReadMe.md` §9 (nickname, week/day,
  size, fact, personality, tone, recentMessages). POST to `…/models/{textModel}:generateContent
  ?key=…` with `generationConfig.responseMimeType:'application/json'`. Extract
  `candidates[0].content.parts[0].text`, **strip ```json fences**, `JSON.parse`, validate fields
  `{title, shortNotification, homepageMessage, mood, tags}`, enforce `shortNotification` ≤120
  chars (truncate). Throw on any failure so the caller falls back. Pure `parseAiJson(text)` +
  `validateMessage(obj)` helpers split out for unit tests.

## 5. Gemini image (`server/src/services/aiImageService.js`)

- **`generateImage(context)`** — build image prompt (§10), POST to `{imageModel}:generateContent`,
  find the part with `inlineData`, return `{buffer, mimeType}` decoded from base64. Throw on
  failure. cardService persists it; never called on page load.

## 6. Card service (`server/src/services/cardService.js`)

- **`generateCardForDate(date, { withImage })`** — compute status; if `gemini_api_key` set, try
  `aiTextService.generateMessage` → AI card (`generation_status='ai'`); on failure
  `createFallbackCard`. If `withImage` and image model+key set, try `aiImageService.generateImage`
  → save to `data/uploads/cards/{date}.png`, set `image_url='/uploads/cards/{date}.png'`; image
  failure is non-fatal (keep placeholder).
- **`getOrCreateTodayCard()`** stays text-only/fast (scheduler + homepage path — never blocks on
  image or AI; falls back instantly).
- `getRecentMessages(limit=5)` for anti-repetition context.

---

## 7. Routes

**`pushRoutes.js`** (public): `GET /api/push/vapid-public-key`; real
`POST /api/push/register` (upsert). **`index.js`**: `app.set('trust proxy', 1)` (behind Caddy);
serve `app.use('/uploads', express.static(<data>/uploads))`.

**`adminRoutes.js`** (add, all behind `adminAuth`):
- `PUT /settings` accepts `geminiApiKey`, `geminiTextModel`, `geminiImageModel`,
  `notificationsEnabled`. **`GET /settings` masks the key** (return `geminiApiKeySet:true` +
  `geminiKeyLast4`, never the raw key); `serializeSettings` updated accordingly.
- `POST /cards/generate-today` → `generateCardForDate(today,{withImage:true})`.
- `POST /cards/:date/regenerate-message` (text only); `POST /cards/:date/regenerate-image`.
- `POST /notifications/test` → `sendToAllActiveDevices` test payload (reports count/results).
- `DELETE /devices/:id`; `PATCH /devices/:id` (enable/disable).
- `PUT /schedules/:id`; `DELETE /schedules/:id`.
- **Light rate-limit** on generate/regenerate endpoints (small custom in-memory limiter
  middleware, e.g. 10/min — satisfies spec §15 without a new dep).

---

## 8. Frontend

- **`services/push.js`** (real): `isPushSupported`, `getSubscriptionState`, `subscribe()`
  (SW ready → fetch VAPID public key → `PushManager.subscribe({userVisibleOnly,
  applicationServerKey})` → `POST /api/push/register`), `unsubscribe()`.
- **Service worker** — switch `vite-plugin-pwa` to `strategies:'injectManifest'` with custom
  **`client/src/sw.js`**: `precacheAndRoute(self.__WB_MANIFEST)` + `push` listener
  (`showNotification(title,{body,icon,data})`) + `notificationclick` (focus/open `/`). Dep:
  `workbox-precaching`.
- **Home** — `SubscribeButton` ("Turn on baby updates 💛") with state (unsupported / blocked /
  subscribe / subscribed).
- **Admin** — extend components:
  - `AdminSettingsForm`: Gemini API key (password input, shows "key set ••••1234"), text/image
    model fields, notifications master toggle.
  - `CardGenerator` (new): Generate today (AI+image), Regenerate message, Regenerate image.
  - `DeviceManager`: register-this-device, test-notification, disable/enable, remove.
  - `ScheduleManager`: create/edit/delete (name, type, time, days-of-week, send-on-new-week,
    enabled).
- `services/api.js`: add the new admin + push calls.

---

## 9. Docker + HTTPS (root)

- **`Dockerfile`** (multi-stage): stage 1 `node:22` builds the client (`npm ci && npm run build`);
  stage 2 `node:22-bookworm-slim` installs server prod deps (compiles `better-sqlite3` for
  arm64), copies server src + `client/dist`, `EXPOSE 3000`, `CMD node src/index.js`. Server
  already serves `client/dist` when present. `.dockerignore` excludes node_modules/dist/data/.env.
- **`docker-compose.yml`** (replaces the Phase 1 stub) — three services:
  - `app`: build context `.`, volume `app-data:/app/server/data` (SQLite + uploads), env
    `ADMIN_PASSWORD`, optional VAPID overrides.
  - `caddy`: reverse-proxies to `app:3000`, **automatic HTTPS** for the DuckDNS domain; volumes
    for certs/config; ports 80/443.
  - `duckdns`: `lscr.io/linuxserver/duckdns` to keep the domain → IP current.
  - `.env` (compose) for `DOMAIN`, `DUCKDNS_SUBDOMAIN`, `DUCKDNS_TOKEN`, `ADMIN_PASSWORD`.
- **`Caddyfile`**: `${DOMAIN} { reverse_proxy app:3000 }` (Caddy auto-provisions Let's Encrypt).
- **Docs**: Portainer "Stack from repository/build" path **and** the GHCR multi-arch route
  (`docker buildx build --platform linux/arm64,linux/amd64 --push`).

---

## 10. Tests (synthetic) — `server/src/tests/`

- **`schedulerService.test.js`** — `shouldRunSchedule`: time match/miss, day-of-week filter,
  dedupe by `lastRunDate`, `send_on_new_week` (only at gestationalDay 0), disabled schedule.
- **`pushService.test.js`** — `classifyPushError` (410/404→gone, 500→transient); device upsert
  dedupes by endpoint; `sendToDevice` deactivates on 410 (mock `web-push`).
- **`aiTextService.test.js`** — `parseAiJson` strips fences/whitespace; `validateMessage` rejects
  missing fields + truncates >120-char notification; `generateMessage` falls back path (mock
  `fetch`).
- **`dateUtils.test.js`** — extend with `nowPartsInTimezone`.
- **Integration (`api.test.js`, dep `supertest` devDep)** — boot app against a **temp
  `DATABASE_PATH`**: `POST /api/push/register` upsert returns ok; admin endpoints 401 without
  header; `GET /api/push/vapid-public-key` returns a key.

Run with `node --test`.

---

## 11. Documentation (clean, maintenance-focused)

- **`README.md`** — update implemented/not-implemented, new env, admin Gemini/push/schedule usage,
  local push testing on `http://localhost`.
- **`docs/Deployment.md`** (new) — Pi 4 + Portainer: build-on-Pi stack, GHCR option, the Caddy +
  DuckDNS HTTPS setup, port-forwarding 80/443, volumes/backups.
- **`docs/Maintenance.md`** (new) — operations runbook: where data lives (SQLite + uploads
  volume), backup/restore, rotating the Gemini key, regenerating VAPID (and that it invalidates
  subscriptions), logs, updating model names, common failure modes (push 410s, AI fallback).
- **`docs/Architecture.md`** (new) — services map, request/scheduler/push flows, data model,
  extension points (Phase 7 polish/special events).
- Update **`docs/Phase1Plan.md`** sibling note / add `docs/Phase2Plan.md` copy of this plan
  (per the established "persist the plan in-repo" workflow).

---

## Verification

1. `cd server && npm install && npm test` → all unit + integration tests pass.
2. Boot server; with **no Gemini key**: `POST /api/admin/cards/generate-today` → fallback card
   (unchanged Phase 1 behavior). Set a key via `PUT /api/admin/settings` → generate → AI card
   (`generation_status:'ai'`); `GET /api/admin/settings` shows the key **masked**.
3. Push (desktop Chrome, `http://localhost`): Home → "Turn on baby updates" → permission →
   device appears in admin; `POST /api/admin/notifications/test` → notification shows; click →
   opens app. Disable/remove device works; a stale subscription returns 410 → auto-inactive.
4. Scheduler: create a schedule for the current minute → notification fires once; second tick in
   the same day does **not** re-fire (dedupe).
5. Image: regenerate-image with a key → `/uploads/cards/{date}.png` saved and shown on Home;
   homepage load never triggers generation.
6. Docker: `docker compose build` (arm64 on the Pi) → stack up → Caddy serves HTTPS on the
   DuckDNS domain → push works on a real Android phone.

## Out of scope (later phases)
Special-event messages (F11), delivery-day mode (F12), richer animations/polish (Phase 7),
multi-image galleries. Memory image upload UI stays minimal.

## Post-implementation
Run the **code-review** skill on the diff; fix findings; re-review until no major bugs remain.
Then summarize files, commands, features, limitations, and next phase.
