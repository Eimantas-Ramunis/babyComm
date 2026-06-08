# Baby Growth PWA 🌱

A small, private Progressive Web App where an unborn baby "sends" warm, funny daily
updates to mom during pregnancy. Dad configures everything from a private admin page.
This is a personal gift for one family — not a generic pregnancy tracker or SaaS.

> **Status: Phase 1 (runnable skeleton).** No AI, push notifications, or scheduler yet —
> those are Phase 2+. Everything degrades to friendly fallback content so the homepage
> never depends on AI.

## Stack

- **Frontend:** React + Vite + React Router, `vite-plugin-pwa`, plain CSS.
- **Backend:** Node.js + Express, SQLite via `better-sqlite3`.
- **Tests:** Node's built-in test runner (`node --test`).

## Project layout

```
babyComm/
  client/   React + Vite PWA frontend
  server/   Express + SQLite backend
  docs/      Product spec + this phase's plan
  .env.example
  docker-compose.yml
```

## Setup

### 1. Environment

Copy the example env file to the repo root and edit it:

```bash
cp .env.example .env
# set ADMIN_PASSWORD to something private
```

The server reads `.env` from the repo root. The SQLite database is created
automatically on first boot at `server/data/app.sqlite` (relative to the server).
Phase 1 ignores the `GEMINI_*` and `VAPID_*` keys — leave them blank.

### 2. Backend

```bash
cd server
npm install
npm run dev     # starts http://localhost:3000 (auto-restarts on change)
```

The database schema is created and a default settings row is seeded on boot.

### 3. Frontend (separate terminal)

```bash
cd client
npm install
npm run dev         # starts Vite, proxies /api -> http://localhost:3000
```

Open the URL Vite prints (usually http://localhost:5173).

## Admin access

Admin endpoints require the header `x-admin-password: <ADMIN_PASSWORD>`. In the UI, go to
**/admin**, enter the password (stored in `localStorage` for dev convenience), then edit
settings, save, and click **Generate today's card**.

## What's implemented (Phase 1)

- Pregnancy calculation engine (week/day, trimester, days remaining, due-date-passed) in
  `server/src/services/pregnancyService.js`, with size/development data per week.
- SQLite schema + seeded default settings.
- Public API: `GET /api/today`, `GET /api/history`, `GET /api/memories`,
  `POST /api/push/register` (stub).
- Admin API (password-protected): settings GET/PUT, `cards/generate-today` (fallback card),
  schedules GET/POST, devices GET, memories CRUD.
- Fallback daily cards so the homepage always renders.
- Frontend: Home, History, Memories, Admin pages; cozy warm theme.
- PWA manifest + service worker via `vite-plugin-pwa`; app icons are generated
  automatically before `npm run build` (zero-dependency `scripts/gen-icons.mjs`).
- Tests for pregnancy + date logic.

## What's NOT implemented yet (Phase 2+)

- Real web push (VAPID / `web-push`), service-worker push handling, test notifications.
- Notification scheduler (cron).
- Gemini text + image generation.
- Docker HTTPS / DuckDNS production deployment.

Service files for these exist as clearly-labeled stubs:
`aiTextService.js`, `aiImageService.js`, `pushService.js`, `schedulerService.js`.

## Tests

```bash
cd server
npm test
```

## Manual QA

1. `cd server && npm install && npm test` → all tests pass.
2. Start the server, then:
   ```bash
   curl http://localhost:3000/api/today        # returns status + a fallback card
   curl http://localhost:3000/api/history       # array (today's card after first /today)
   curl http://localhost:3000/api/memories       # []
   curl -i http://localhost:3000/api/admin/settings                 # 401
   curl -H "x-admin-password: change-me" http://localhost:3000/api/admin/settings  # 200
   ```
3. Start the client, open the app:
   - Home shows the cozy card from the live API.
   - History and Memories render (empty states until data exists).
   - Admin: log in → edit settings → save → "Generate today's card" shows a success notice;
     the card then appears on Home/History.
4. `cd client && npm run build` succeeds; manifest + icons are present in `dist/`.

## Next phase

**Phase 4 (push)** or **Phase 5 (Gemini text)** — see `docs/Phase1Plan.md` and
`docs/ReadMe.md` for the full roadmap.
