# Baby Growth PWA — Feature Roadmap (Phases 6–10)

Phases 1–5 delivered the full working app (engine, push, AI text+image, admin lists, memories,
polish, size coverage, funny twists). This roadmap plots the agreed next features, ordered by
emotional value and dependency. Each phase gets its own `PhaseNPlan.md` before implementation.

## Phase 6 — The ending + the insurance policy  ✅ planned: [Phase6Plan.md](Phase6Plan.md)

- **Delivery-day mode (F12).** Around the due date the tone shifts to "awaiting arrival";
  when the admin flips *baby has arrived* (with birth date/time/weight/name), the homepage
  becomes a reveal screen: «Labas, mama. Atvykau. ❤️». Notifications and pre-generation stop
  gracefully. This is the app's finale — built well before it's needed.
- **Automated backups.** A tiny sidecar container writes a nightly tarball of the `app-data`
  volume (DB + all images) to a host folder with rotation; docs cover pointing it at a USB
  drive / network mount and syncing off the Pi. Everything precious lives on one SD card today.

## Phase 7 — Two-way: mom answers the baby  ✅ planned: [Phase7Plan.md](Phase7Plan.md)

- **Replies.** A reply box under the daily message; replies stored per card and shown in
  History as a conversation. Recent replies are fed into the AI context so the baby can
  react to what mom said ("you promised me a football, mama!").
- **Kick counter.** From ~week 20: a big "spyrė! ⚽" button on Home, daily counts stored,
  yesterday's count fed to the AI ("11 kicks — I'm in training").

## Phase 8 — Occasions + rituals

- **Special events (F11).** `special_events` table (admin CRUD): birthdays, Kūčios/Kalėdos,
  Mother's Day, baby shower, due date, custom dates. On an event day the AI prompt gets the
  occasion and writes a unique message for it.
- **Weekly bump photo.** A gentle weekly push ("photo time, mama 📸") + a quick-upload flow
  into Memories tagged with the gestational week — a week-by-week time-lapse by December.

## Phase 9 — Visual continuity + sharing

- **Consistent baby avatar.** Feed the previous card's image into Gemini image generation as
  a reference so "the baby" is one recognizable character that grows, instead of a new face
  every day.
- **Share a card.** Export any card as a single image (canvas render) so grandparents can get
  the lime update without admin access.

## Phase 10 — Life after birth

- **Post-birth mode.** After delivery-day mode flips, the engine switches from gestation to
  age (days → weeks → months), the baby sends monthly "letters", and milestones (first smile,
  first tooth) reuse the memories system. Turns a 6-month app into a multi-year one.

## Standing rules

Per-phase: plan doc first → implement → tests green (`server: npm test`, `client: npm run
build`) → code review → docs (README/Architecture/Maintenance) → commit + push.
