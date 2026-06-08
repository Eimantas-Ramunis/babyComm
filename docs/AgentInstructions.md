You are a senior full-stack engineer building a private PWA called Baby Growth PWA.

Build this app carefully, in small vertical slices. Do not overengineer. The app is for one family, not SaaS.

Use:

- React + Vite frontend
- Node.js + Express backend
- SQLite database
- PWA support with service worker/manifest
- Web Push with VAPID using web-push
- Gemini API integration later, behind backend only

Use vite-plugin-pwa for Vite PWA setup unless there is a strong reason not to. Vite PWA supports React and can generate a service worker and manifest setup. Web push must work through a service worker and stored push subscriptions. The backend should use VAPID keys with web-push.

Important references:
- Vite PWA guide: https://vite-pwa-org.netlify.app/guide/
- Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- web-push package: https://www.npmjs.com/package/web-push

---

# Product Summary

Build a private pregnancy companion PWA where the unborn baby “sends” funny, loving updates to mom.

The app should:

- Track pregnancy week/day from due date.
- Show today’s baby growth status.
- Display a funny/sweet baby message.
- Display a visual/card for the current stage.
- Save history.
- Let dad configure settings in an admin page.
- Register Android PWA push notifications.
- Send scheduled notifications.
- Later generate text/images using Gemini API.

Do not build:

- Native Android app
- Play Store APK
- Multi-user SaaS
- Public registration
- Medical advice
- Social sharing
- Payment system

---

# Phase 1 Goal

Build a runnable MVP skeleton with:

1. React/Vite frontend
2. Express backend
3. SQLite database
4. Pregnancy calculation logic
5. Homepage using real /api/today
6. History page using real /api/history
7. Admin page with password auth
8. Admin settings form
9. Basic PWA manifest/service worker
10. Project README
11. Basic tests for pregnancy calculation

Do not implement Gemini or push notifications in the first commit unless the previous items are stable.

---

# Required Project Structure

Create this structure:

baby-growth-pwa/
  client/
    src/
      pages/
        Home.jsx
        History.jsx
        Memories.jsx
        Admin.jsx
      components/
        TodayCard.jsx
        BabyMessageCard.jsx
        Timeline.jsx
        AdminSettingsForm.jsx
        ScheduleManager.jsx
        DeviceManager.jsx
      services/
        api.js
        push.js
      main.jsx
      App.jsx
      styles.css
    public/
      manifest.webmanifest
      icons/
    package.json
    vite.config.js

  server/
    src/
      index.js
      db/
        database.js
        migrations.js
      routes/
        publicRoutes.js
        adminRoutes.js
        pushRoutes.js
      services/
        pregnancyService.js
        cardService.js
        aiTextService.js
        aiImageService.js
        pushService.js
        schedulerService.js
      middleware/
        adminAuth.js
      utils/
        dateUtils.js
      tests/
        pregnancyService.test.js
    data/
      app.sqlite
    package.json

  docker-compose.yml
  .env.example
  README.md

---

# Backend Requirements

## Server

Use Express.

Default port:

env PORT=3000 

Frontend dev server may run separately during development.

Enable:

- JSON body parsing
- CORS for local frontend dev
- static serving for production build later
- clean error responses

---

# Environment Variables

Create .env.example:

PORT=3000
NODE_ENV=development

APP_BASE_URL=https://your-domain.duckdns.org
ADMIN_PASSWORD=change-me

DATABASE_PATH=./data/app.sqlite

GEMINI_API_KEY=
GEMINI_TEXT_MODEL=
GEMINI_IMAGE_MODEL=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your-email@example.com

Never expose secrets to frontend.

---

# Database Schema

Use SQLite.

Create migration/init logic that creates these tables if missing:

## settings

sql CREATE TABLE IF NOT EXISTS settings (   id INTEGER PRIMARY KEY CHECK (id = 1),   baby_nickname TEXT NOT NULL,   due_date TEXT NOT NULL,   pregnancy_start_date TEXT,   timezone TEXT DEFAULT 'Europe/Vilnius',   personality TEXT DEFAULT 'Sweet Bean',   tone TEXT DEFAULT 'funny, warm, loving',   created_at TEXT NOT NULL,   updated_at TEXT NOT NULL ); 

Seed default settings if missing.

## daily_cards

sql CREATE TABLE IF NOT EXISTS daily_cards (   id INTEGER PRIMARY KEY AUTOINCREMENT,   card_date TEXT NOT NULL UNIQUE,   gestational_week INTEGER NOT NULL,   gestational_day INTEGER NOT NULL,   size_label TEXT,   development_fact TEXT,   title TEXT,   short_notification TEXT,   homepage_message TEXT,   mood TEXT,   image_url TEXT,   image_prompt TEXT,   generation_status TEXT DEFAULT 'fallback',   created_at TEXT NOT NULL,   updated_at TEXT NOT NULL ); 

## notification_schedules

sql CREATE TABLE IF NOT EXISTS notification_schedules (   id INTEGER PRIMARY KEY AUTOINCREMENT,   name TEXT NOT NULL,   enabled INTEGER DEFAULT 1,   type TEXT NOT NULL,   time_of_day TEXT NOT NULL,   days_of_week TEXT,   send_on_new_week INTEGER DEFAULT 0,   last_run_at TEXT,   created_at TEXT NOT NULL,   updated_at TEXT NOT NULL ); 

## push_devices

sql CREATE TABLE IF NOT EXISTS push_devices (   id INTEGER PRIMARY KEY AUTOINCREMENT,   device_name TEXT,   subscription_json TEXT NOT NULL,   user_agent TEXT,   active INTEGER DEFAULT 1,   last_success_at TEXT,   last_failure_at TEXT,   created_at TEXT NOT NULL,   updated_at TEXT NOT NULL ); 

## memories

sql CREATE TABLE IF NOT EXISTS memories (   id INTEGER PRIMARY KEY AUTOINCREMENT,   memory_date TEXT NOT NULL,   gestational_week INTEGER,   gestational_day INTEGER,   title TEXT NOT NULL,   body TEXT,   image_url TEXT,   created_at TEXT NOT NULL,   updated_at TEXT NOT NULL ); 

---

# Pregnancy Calculation

Implement in:

txt server/src/services/pregnancyService.js 

Rules:

If pregnancy_start_date exists, use it.

Otherwise:

txt pregnancyStartDate = dueDate - 280 days 

Calculate using Europe/Vilnius timezone by default.

Return:

js {   currentDate,   gestationalWeek,   gestationalDay,   totalDaysPregnant,   trimester,   daysRemaining,   isDueDatePassed } 

Trimester:

txt 1st: weeks 0–12 2nd: weeks 13–27 3rd: week 28+ 

Add tests for:

- due date minus 280 days
- week/day calculation
- days remaining
- trimester
- due-date-passed behavior

---

# Size Comparison Data

Create a simple local mapping in pregnancyService or separate file:

const SIZE_BY_WEEK = {
  6: { sizeLabel: 'sweet pea', developmentFact: 'Tiny facial features are starting to form.' },
  7: { sizeLabel: 'blueberry', developmentFact: 'Tiny arm and leg buds are growing.' },
  8: { sizeLabel: 'raspberry', developmentFact: 'Little fingers and toes are beginning to form.' },
  9: { sizeLabel: 'grape', developmentFact: 'Tiny muscles are starting to develop.' },
  10: { sizeLabel: 'strawberry', developmentFact: 'Little joints are forming.' },
  11: { sizeLabel: 'fig', developmentFact: 'The baby is starting to look more recognizably baby-like.' },
  12: { sizeLabel: 'lime', developmentFact: 'Reflexes are beginning to develop.' },
  13: { sizeLabel: 'lemon', developmentFact: 'Tiny fingerprints may be forming.' },
  14: { sizeLabel: 'peach', developmentFact: 'The baby is growing more coordinated.' },
  15: { sizeLabel: 'apple', developmentFact: 'The baby may be practicing little movements.' },
  16: { sizeLabel: 'avocado', developmentFact: 'Tiny facial expressions may be developing.' }
}

For missing weeks, return a safe fallback.

No medical/scary wording.

---

# Card Service

Implement:

txt server/src/services/cardService.js 

Functions:

getTodayCard()
getOrCreateCardForDate(date)
getHistory()
createFallbackCard(date)

If no card exists for today, create fallback card with:

txt Hi mom. I am growing a little more today. Dad says I am already extremely impressive. 

Never let /api/today fail just because AI is missing.

---

# Public API

Base path:

txt /api 

## GET /api/today

Returns today’s card and pregnancy status.

## GET /api/history

Returns saved cards newest-first.

## GET /api/memories

Returns memories newest-first.

## POST /api/push/register

Stub in Phase 1 if push not implemented yet. Return:

json { "ok": true, "message": "Push registration not implemented yet" } 

---

# Admin Auth

Use simple password auth.

For MVP, require header:

txt x-admin-password: <ADMIN_PASSWORD> 

Admin middleware should reject missing/wrong password.

Do not build sessions yet.

---

# Admin API

## GET /api/admin/settings

Return settings.

## PUT /api/admin/settings

Update:

{
  "babyNickname": "Tiny Bean",
  "dueDate": "2026-12-01",
  "pregnancyStartDate": null,
  "timezone": "Europe/Vilnius",
  "personality": "Tiny Viking",
  "tone": "funny, warm, loving"
}

## POST /api/admin/cards/generate-today

For Phase 1, create/regenerate fallback card only.

## GET /api/admin/schedules

Return schedules.

## POST /api/admin/schedules

Create schedule.

Can be basic in Phase 1.

## GET /api/admin/devices

Return push devices.

Can be empty in Phase 1.

---

# Frontend Requirements

Use React Router.

Routes:

/
 /history
 /memories
 /admin

## Home Page

Fetch /api/today.

Display:

- baby nickname
- current week/day
- trimester
- days remaining
- size label
- development fact
- title
- homepage message
- mood
- placeholder image/card visual

Make it cozy and pleasant, not clinical.

## History Page

Fetch /api/history.

Display saved cards in a timeline.

## Memories Page

Fetch /api/memories.

If empty, show nice empty state.

## Admin Page

Simple admin login:

- password input
- save password in memory/localStorage for dev convenience
- after login, fetch settings
- edit settings
- save settings
- button: “Generate Today’s Card”
- show response

Do not overbuild UI.

---

# PWA Requirements

Use vite-plugin-pwa.

Include manifest:

{
  "name": "Tiny Bean Updates",
  "short_name": "Tiny Bean",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fff7ed",
  "theme_color": "#f97316",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}

If icons are not available, create simple placeholder SVG/PNG icons.

Do not implement complex offline behavior yet.

---

# Styling Direction

Warm, soft, personal.

Suggested vibe:

- cream background
- rounded cards
- soft shadows
- warm orange/pink accents
- playful but readable typography
- mobile-first layout

Avoid sterile dashboard bullshit.

---

# Phase 1 Testing

At minimum:

txt server/src/tests/pregnancyService.test.js 

Test:

- due date to pregnancy start
- current week/day
- trimester
- days remaining
- fallback week data

Also include clear manual QA steps in README.

---

# README Requirements

README must include:

- project purpose
- setup instructions
- env setup
- frontend dev command
- backend dev command
- database initialization
- how to access admin
- what is implemented
- what is not implemented yet
- next steps

---

# Implementation Rules

Follow these strictly:

1. Do not implement everything at once.
2. First produce a runnable Phase 1.
3. Keep code boring and readable.
4. Do not call Gemini from frontend.
5. Do not expose secrets.
6. Do not make homepage depend on AI.
7. Do not generate images on page load.
8. Do not build native Android app.
9. Do not add complex authentication yet.
10. Use fallback content everywhere.
11. Make sure npm install and npm run dev work.
12. After implementation, provide exact commands to run.

---

# After Phase 1 Is Done

Stop and summarize:

- files created
- commands to run
- implemented features
- known limitations
- next recommended phase

Do not proceed to Phase 2 unless explicitly asked.

---

# Phase 2 Preview, Do Not Implement Yet

Later we will add:

- real push notification registration
- VAPID key generation
- service worker push handling
- test notification button
- scheduler
- Gemini text generation
- AI image generation
- Docker deployment
- DuckDNS HTTPS deployment

For now: stable skeleton first.