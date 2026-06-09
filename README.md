# Baby Growth PWA 🌱

A small, private Progressive Web App where an unborn baby "sends" warm, funny daily
updates to mom during pregnancy. Dad configures everything from a private admin page.
This is a personal gift for one family — not a generic pregnancy tracker or SaaS.

> **Status: Phase 2.** Push notifications, the per-minute scheduler, and Gemini AI text +
> image generation are implemented. The homepage still degrades gracefully to fallback
> content if AI is unavailable.

## Stack

- **Frontend:** React + Vite + React Router, `vite-plugin-pwa` (custom service worker for
  push), plain CSS.
- **Backend:** Node.js + Express, SQLite via `better-sqlite3`, `web-push` (VAPID),
  `node-cron`, Gemini API (text + image) called server-side only.
- **Tests:** Node's built-in test runner (`node --test`) + `supertest` integration tests.
- **Deploy:** single Docker image (server serves the built client + API); `docker-compose`
  with Caddy (auto-HTTPS) + DuckDNS. See [`docs/Deployment.md`](docs/Deployment.md).

## Project layout

```
babyComm/
  client/            React + Vite PWA frontend
  server/            Express + SQLite backend
  docs/              Product spec, plans, deployment/maintenance/architecture
  Dockerfile         Multi-stage image (client build -> server runtime)
  docker-compose.yml app + Caddy + DuckDNS stack
  Caddyfile          Reverse proxy with automatic HTTPS
  .env.example          local dev env (server)
  .env.compose.example  production stack env (compose)
```

## Local setup

### 1. Environment

```bash
cp .env.example .env
# set ADMIN_PASSWORD to something private
```

The server reads `.env` from the repo root. The SQLite database + generated images are
created automatically under `server/data/` on first boot. VAPID keys are auto-generated and
persisted on first boot — no manual key generation needed for local dev. The Gemini API key
is **not** set here; it is configured in the admin panel.

### 2. Backend

```bash
cd server && npm install && npm run dev   # http://localhost:3000
```

### 3. Frontend (separate terminal)

```bash
cd client && npm install && npm run dev   # Vite, proxies /api -> :3000
```

Open the URL Vite prints (usually http://localhost:5173).

## Admin access

Admin endpoints require the header `x-admin-password: <ADMIN_PASSWORD>`. In the UI go to
**/admin**, enter the password (stored in `localStorage` for dev convenience). From there you can:

- Edit settings (nickname, due date, timezone, personality, tone).
- **Set the Gemini API key + model names** (key is stored server-side and shown masked).
- Toggle the **notifications master switch**.
- **Generate today's card** (AI text + image when a key is set, otherwise a fallback card),
  and regenerate the message or image.
- **Preview tomorrow's card** — see whether the nightly pre-generation already ran and exactly
  what tomorrow's notification/homepage/image will be, or generate it on the spot.
- Manage **schedules** (create/enable/disable/delete; each shows when it last sent) and
  **devices** (register this device, send a test notification, enable/disable, remove; each
  shows its last successful/failed push).
- **Delivery day 🎉** — tick *Baby has arrived* + birth name/date/time/weight to switch the
  homepage to the reveal screen and stop notifications/pre-generation (untick to undo).

## Push notifications (local testing)

Web Push works on `http://localhost` in desktop Chrome/Edge without HTTPS:

1. On **Home**, click **"Turn on baby updates"** and allow notifications.
2. In **/admin → Devices**, click **Send test notification** — it should appear; clicking it
   focuses/opens the app.

On a real phone, push requires HTTPS — see [`docs/Deployment.md`](docs/Deployment.md).

## Gemini setup

1. Get an API key from Google AI Studio.
2. In **/admin**, paste it into **AI (Gemini) → API key** and Save.
3. Optionally set the text/image model names (defaults: `gemini-2.5-flash` and
   `gemini-2.5-flash-image`). **Verify current model names in the Gemini docs** — they change.
4. Click **Generate today's card**. `generationStatus` becomes `ai`; images are saved under
   `server/data/uploads/cards/` and served from `/uploads/...`. The key never reaches the
   browser (masked on read).

## Tests

```bash
cd server && npm test   # unit + supertest integration (no network/Gemini calls)
```

## What's implemented

- **Phase 1:** pregnancy engine, fallback cards, settings, history, memories, PWA shell.
- **Phase 2:** web-push/VAPID with device upsert + auto-deactivate on 410; custom
  service-worker push handling + self-subscribe; per-minute scheduler with dedupe + master
  switch; Gemini text + image generation configured via admin (masked key); daily
  pre-generation of tomorrow's card; Docker + Caddy + DuckDNS deployment; expanded tests.
- **Phase 3:** admin-managed **personality** list with a randomize toggle (random per card or
  pinned); admin-managed **tone** list (3 chosen at random per card); **memory editing** on the
  Prisiminimai page (admin-gated) with one image upload + caption + an editable date-time.
- **Phase 4 (spec "Phase 7 — Polish"):** richer animations (page transitions, staggered
  timelines, hero Ken-Burns zoom, badge heartbeat, swaying floaties, micro-interactions — all
  CSS, disabled under reduced-motion) and a PWA **install prompt** (Chromium
  `beforeinstallprompt` button + iOS "Add to Home Screen" hint, dismissible); **tomorrow's
  card preview** in admin + schedule/device delivery timestamps; scheduler catch-up window so
  a restart or slow pre-generation can't silently skip the day's notification.
- **Phase 5:** size/development data covers the **whole pregnancy (weeks 4–42)** — size +
  fact change weekly by design; the AI message changes daily. Each AI generation also weaves
  in **one random funny twist** (fruit fun fact, week-development fact from the model's own
  knowledge, dad joke, womb-news report, cheeky promise, or pun), voiced to match the randomly
  picked personality + tones.
- **Phase 6:** **delivery-day mode (F12)** — /admin gets a "Delivery day 🎉" fieldset (*Baby has
  arrived* + birth name/date/time/weight); flipping it turns the homepage into a celebratory
  reveal screen («Labas, mama. Atvykau. ❤️»), stops card generation, notifications, and nightly
  pre-generation; past the due date (not yet arrived) the homepage shows an "any moment now"
  banner and messages switch to excited anticipation. Plus **automated backups**: a `backup`
  sidecar tars the `app-data` volume daily into `BACKUP_DIR` with rotation (`BACKUP_KEEP`),
  and a `syncthing` service replicates the tarballs to another LAN machine — no cloud
  (setup + restore drill in [`docs/Maintenance.md`](docs/Maintenance.md)). The `app` container
  also has a `/api/health` healthcheck.

## What's NOT implemented yet

Special-event messages (F11), multi-image memory galleries.
Real-phone push needs the HTTPS deployment.

## Docs

- [`docs/Architecture.md`](docs/Architecture.md) — how it fits together.
- [`docs/Deployment.md`](docs/Deployment.md) — Raspberry Pi + Portainer + HTTPS.
- [`docs/Maintenance.md`](docs/Maintenance.md) — operations runbook.
- [`docs/Phase2Plan.md`](docs/Phase2Plan.md) — this phase's plan.
