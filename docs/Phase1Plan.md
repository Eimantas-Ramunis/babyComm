# Baby Growth PWA — Phase 1 Implementation Plan

## Context

`babyComm/` currently contains only `docs/` (a detailed Phase-0 spec). The goal of this
pass is to build **Phase 1**: a runnable, stable MVP skeleton of a private pregnancy
companion PWA where the unborn baby "sends" warm, funny updates to mom. Dad configures
everything via an admin page.

Per `docs/AgentInstructions.md`, Phase 1 is **explicitly scoped to a skeleton only** —
no Gemini, no real push notifications, no scheduler. Those are Phase 2+. Everything that
would normally depend on AI/push must degrade to fallback content so the homepage never
breaks.

**Decisions confirmed with user:** Phase 1 only · plain CSS (single `styles.css` + CSS
variables) · `better-sqlite3` (synchronous, prebuilt ARM binaries for the Raspberry Pi target).

## Layout decision

The repo root is already `babyComm/`. Rather than nest an extra `baby-growth-pwa/` folder,
place `client/`, `server/`, `docker-compose.yml`, `.env.example`, `README.md`, `.gitignore`
**at the repo root**, alongside the existing `docs/`.

---

## Server (`server/`) — Node + Express + better-sqlite3, ESM

`package.json` deps: `express`, `cors`, `better-sqlite3`, `dotenv`. Dev/test uses the
**built-in Node test runner** (`node --test`) — zero extra test deps. `"type": "module"`.
Scripts: `dev` (`node --watch src/index.js`), `start`, `test` (`node --test`).

### `src/index.js`
Express app: `cors()` (dev), `express.json()`, mount `publicRoutes`, `pushRoutes`,
`adminRoutes` under `/api`. In production, serve the built client from `../client/dist`
with an SPA fallback. Centralized JSON error handler. Calls migrations on boot, then listens
on `PORT` (default 3000). Loads `.env` via `dotenv`. **Scheduler is NOT started in Phase 1.**

### `src/db/database.js`
Open `better-sqlite3` at `DATABASE_PATH` (default `./data/app.sqlite`). `mkdir -p` the data
dir first. `db.pragma('journal_mode = WAL')`. Export the singleton `db`.

### `src/db/migrations.js`
`CREATE TABLE IF NOT EXISTS` for all 5 tables exactly as in
`docs/AgentInstructions.md` (settings, daily_cards, notification_schedules, push_devices,
memories). Seed a default `settings` row (id=1) if absent: nickname `Tiny Bean`, a sample
`due_date`, timezone `Europe/Vilnius`, personality `Sweet Bean`, tone `funny, warm, loving`,
timestamps now.

### `src/utils/dateUtils.js` — timezone WITHOUT heavy deps
Dates are date-only (`YYYY-MM-DD`), so arithmetic is timezone-independent; only "what day is
it now" needs the tz. Functions:
- `todayInTimezone(tz)` → `Intl.DateTimeFormat('en-CA', {timeZone: tz})` → `YYYY-MM-DD`.
- `daysBetween(a, b)` → parse both as UTC midnight, integer day diff.
- `addDays(dateStr, n)` → returns `YYYY-MM-DD`.
No luxon/dayjs needed.

### `src/services/pregnancyService.js`
- `SIZE_BY_WEEK` map (weeks 6–16 from the spec) + safe fallback for missing weeks
  (`{ sizeLabel: 'tiny seedling', developmentFact: 'The baby is growing steadily.' }`).
- `getPregnancyStatus(settings, today)` returns:
  `{ currentDate, gestationalWeek, gestationalDay, totalDaysPregnant, trimester, daysRemaining, isDueDatePassed, sizeLabel, developmentFact }`.
  - `pregnancyStart = settings.pregnancy_start_date || addDays(due_date, -280)`
  - `week = floor(totalDays/7)`, `day = totalDays % 7`
  - trimester: ≤12 →1, 13–27 →2, ≥28 →3
  - `isDueDatePassed = today > due_date`
- Pure functions (today injected) so tests are deterministic.

### `src/services/cardService.js`
`getTodayCard()`, `getOrCreateCardForDate(date)`, `getHistory()`, `createFallbackCard(date)`.
Fallback card uses pregnancy status for week/day/size/fact and the canonical fallback message
("Hi mom. I am growing a little more today. Dad says I am already extremely impressive.").
`generation_status = 'fallback'`. `getHistory()` returns cards newest-first.

### `src/services/` stubs (structure only, Phase 2)
`aiTextService.js`, `aiImageService.js`, `pushService.js`, `schedulerService.js` — small
modules that export clearly-labeled "not implemented in Phase 1" stubs so the file structure
matches the spec and Phase 2 has a home.

### `src/middleware/adminAuth.js`
Reject unless `x-admin-password` header === `process.env.ADMIN_PASSWORD` → 401 JSON otherwise.

### `src/routes/publicRoutes.js`
- `GET /api/today` → pregnancy status + today's card (creates fallback if none). Shape per spec.
- `GET /api/history` → saved cards newest-first.
- `GET /api/memories` → memories newest-first (empty array OK in Phase 1).

### `src/routes/pushRoutes.js`
- `POST /api/push/register` → stub: `{ ok: true, message: "Push registration not implemented yet" }`.

### `src/routes/adminRoutes.js` (all behind `adminAuth`)
- `GET/PUT /api/admin/settings` (validate inputs: required nickname/dueDate, valid date format).
- `POST /api/admin/cards/generate-today` → create/regenerate **fallback** card for today.
- `GET/POST /api/admin/schedules`, `GET /api/admin/devices` (basic; data may be empty).
- Memories CRUD (`POST/PUT/DELETE /api/admin/memories[/:id]`) — cheap, schema exists, feeds
  the Memories page. Sanitize/escape text on render (frontend) since it's user input.

### `src/tests/pregnancyService.test.js` (`node:test` + `node:assert`)
Cover: due-date → pregnancy start (−280d); week/day at a known date; days remaining;
trimester boundaries (12/13, 27/28); fallback week data for an out-of-range week;
due-date-passed behavior.

---

## Client (`client/`) — React + Vite + vite-plugin-pwa

`package.json` deps: `react`, `react-dom`, `react-router-dom`; dev: `vite`,
`@vitejs/plugin-react`, `vite-plugin-pwa`.

### `vite.config.js`
`@vitejs/plugin-react` + `VitePWA({ registerType: 'autoUpdate', manifest: {...} })` with the
manifest from the spec (name "Tiny Bean Updates", theme `#f97316`, bg `#fff7ed`, 192/512 icons).
Dev `server.proxy`: `'/api' → http://localhost:3000` so the client calls `/api/*` directly.

### Icons (`public/icons/icon-192.png`, `icon-512.png`)
Generate **real, valid PNGs** at implementation time with a tiny `scripts/gen-icons.mjs` that
uses only Node core `zlib` to emit solid-color (warm orange) PNGs — no image-lib dependency.
Run once; commit the resulting PNGs. (Also keep an `icon.svg` source.)

### `src/main.jsx` / `src/App.jsx`
BrowserRouter; App renders a warm header + nav (Home / History / Memories / Admin) and the
`<Routes>`. Routes: `/`, `/history`, `/memories`, `/admin`.

### `src/services/api.js`
`fetch` wrappers: `getToday`, `getHistory`, `getMemories`, and admin calls that attach
`x-admin-password` from localStorage. `getStoredPassword/setStoredPassword`.

### `src/services/push.js`
Stub for Phase 1 (exports placeholders) — no SW push wiring yet.

### Pages
- `Home.jsx` → `getToday()`; renders `TodayCard` + `BabyMessageCard` + age badge, trimester,
  days remaining, size, fact, mood, placeholder image area. Loading + error states.
- `History.jsx` → `getHistory()` → `Timeline` of cards. Nice empty state.
- `Memories.jsx` → `getMemories()` → list; friendly empty state.
- `Admin.jsx` → password input (saved to localStorage) → on auth, fetch settings →
  `AdminSettingsForm` → save (PUT) → "Generate Today's Card" button showing the response.
  Includes lightweight `ScheduleManager` / `DeviceManager` (read-only/minimal in Phase 1).

### Components
`TodayCard.jsx`, `BabyMessageCard.jsx`, `Timeline.jsx`, `AdminSettingsForm.jsx`,
`ScheduleManager.jsx`, `DeviceManager.jsx` — small, presentational.

### `src/styles.css`
Plain CSS with `:root` variables: cream bg (`#fff7ed`), warm orange/pink accents, rounded
cards, soft shadows, mobile-first, readable playful type. Cozy, not clinical.

---

## Root files
- `.env.example` — exactly the keys from the spec (PORT, NODE_ENV, APP_BASE_URL,
  ADMIN_PASSWORD, DATABASE_PATH, GEMINI_*, VAPID_*).
- `.gitignore` — `node_modules`, `data/*.sqlite*`, `.env`, `dist`, `.DS_Store`.
- `docker-compose.yml` — minimal single-service starting point for the server (Phase 2 will
  flesh out HTTPS/DuckDNS). Kept simple and labeled as a starting point.
- `README.md` — purpose, setup, env, **two dev commands** (server + client), DB init (auto on
  boot), how to reach admin (`x-admin-password`), what's implemented vs not, manual QA steps,
  next phase.

---

## Verification

1. **Backend**: `cd server && npm install && npm test` → pregnancy tests pass.
2. `npm run dev` (server) → `curl localhost:3000/api/today` returns a fallback card + status;
   `curl localhost:3000/api/history`, `/api/memories` return arrays; admin endpoints 401
   without header and succeed with `x-admin-password: <ADMIN_PASSWORD>`.
3. **Frontend**: `cd client && npm install && npm run dev` → Home shows the cozy card from the
   live API; History/Memories render (empty states OK); Admin login → edit settings → save →
   "Generate Today's Card" works.
4. **PWA**: `npm run build` succeeds; manifest + icons present; app is installable (dev SW via
   plugin).
5. Confirm homepage still renders with no AI/push configured (fallback path).

## Out of scope (Phase 2+, per spec — will NOT build now)
Real web-push/VAPID, service-worker push handling, scheduler/cron, Gemini text & image
generation, Docker HTTPS/DuckDNS deployment. Service files are created as labeled stubs only.

## Post-implementation
Run the **code-review** skill on the diff and fix any issues it surfaces, then summarize files
created, run commands, implemented features, known limitations, and the recommended next phase.
