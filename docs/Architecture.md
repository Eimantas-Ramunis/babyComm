# Architecture

A single-family PWA: an Express + SQLite backend serves a React PWA and a small JSON API.
In production one container runs the server, which also serves the built client; Caddy sits
in front for HTTPS.

## Components

```
Browser (PWA + service worker)
   │  HTTPS
   ▼
Caddy (auto TLS, DuckDNS domain)  ──reverse_proxy──▶  app container (Express :3000)
                                                          ├─ /api/*        JSON API
                                                          ├─ /uploads/*    generated images
                                                          └─ /*            built React client
                                                          │
                                                          ▼
                                              SQLite (better-sqlite3)  + data/uploads/
                                                          │
                              node-cron tick (every minute) ─▶ Gemini API / Web Push (VAPID)
```

## Backend modules (`server/src`)

- `app.js` — builds the Express app (routes, static, error handler). Importable by tests.
- `index.js` — loads `.env`, creates the app, listens, starts the scheduler.
- `db/database.js` — opens the SQLite file (path from `DATABASE_PATH`); WAL mode.
- `db/migrations.js` — idempotent schema + **upgrade-safe** column adds (`addColumnIfMissing`)
  + default settings seed.
- `services/`
  - `pregnancyService.js` — pure week/day/trimester math + per-week size data.
  - `cardService.js` — daily card storage + AI generation orchestration. `getTodayCard`
    (fast, fallback-only) vs `generateCardForDate` (AI text + optional image).
  - `aiTextService.js` / `aiImageService.js` — Gemini calls; throw on failure (caller falls back).
  - `pushService.js` — VAPID key bootstrap, device upsert by endpoint, send + auto-deactivate.
  - `schedulerService.js` — pure `shouldRunSchedule` + per-minute cron `runDueSchedules`.
  - `settingsService.js` / `memoryService.js` / `configService.js` — table accessors.
- `routes/` — `publicRoutes` (today/history/memories), `pushRoutes` (vapid key, register),
  `adminRoutes` (settings, cards, notifications, devices, schedules; all behind `adminAuth`).
- `middleware/` — `adminAuth` (constant-time password check), `rateLimit` (AI endpoints).
- `utils/` — `dateUtils` (timezone via `Intl`), `serializers` (snake_case → camelCase + key
  masking), `paths` (data/uploads locations).

## Key flows

**Homepage (`GET /api/today`)** — never blocks on AI: computes pregnancy status and returns
today's card, creating a fast fallback card if none exists. Trimester is derived from the
card's week so week + trimester always agree.

**Card generation (admin)** — `generateCardForDate(today, {withImage:true})`: try Gemini text
(fallback on failure), then optionally Gemini image (best-effort, saved to `data/uploads`).
Images are never generated on page load.

**Scheduler** — every minute the cron tick runs two independent jobs:
- `pregenerateUpcomingCard`: once per day at/after `auto_generate_time`, AI-generates **tomorrow's**
  card (text + image) in advance so it's ready before the morning. Deduped via the
  `last_pregen_date` app_config key; retries (bounded) if the AI text falls back; guarded against
  overlapping runs. Skipped without a Gemini key. Not gated by the notifications switch.
- `runDueSchedules`: if notifications are enabled, for each schedule where the pure
  `shouldRunSchedule` returns true it ensures today's card (fast path — already AI if
  pre-generated) and sends the short notification to all active devices, then stamps
  `last_run_at` (dedupe by calendar date in the configured timezone).

Future-dated cards (the pre-generated tomorrow card) are excluded from `/api/history` until
their day arrives.

**Push** — `ensureVapidKeys` on boot (env → app_config → generate+persist). Devices subscribe
via the public `POST /api/push/register` (deduped by endpoint). Sends that return 404/410 mark
the device inactive.

## Data model (SQLite)

`settings` (single row; includes `notifications_enabled`, `gemini_*`), `daily_cards`
(unique by `card_date`), `notification_schedules`, `push_devices` (unique by `endpoint`),
`memories`, `app_config` (server-managed key/value, e.g. VAPID keys).

## Security notes

- Gemini API key + VAPID private key live server-side only; the key is masked on read.
- Admin auth is a shared password via `x-admin-password` (constant-time compare). No sessions.
- `POST /api/push/register` is intentionally public (how mom's phone subscribes).
- `trust proxy` is enabled for correct client IPs behind Caddy.

## Extension points (later phases)

- Special events (F11) / delivery-day mode (F12): add tables/branches in `cardService`.
- Notification deep-links: the push payload already carries `url`; point it at a per-card route.
- Multi-process scaling would require moving the in-memory rate limiter + scheduler lock to
  shared storage (not needed for a single-family, single-container deploy).
