# Baby Growth PWA — Phase 6 Plan (delivery-day mode + automated backups)

First phase of the [Roadmap](Roadmap.md): the app's finale (F12) and the insurance policy.

## Feature 1 — Delivery-day mode (F12)

### Data model (`server/src/db/migrations.js`, idempotent `addColumnIfMissing`)
- `settings`: `baby_arrived INTEGER DEFAULT 0`, `birth_date TEXT`, `birth_time TEXT`,
  `birth_weight TEXT`, `birth_name TEXT`.

### Behavior
Three states, driven by settings + due date:
1. **Normal** (today ≤ due date, not arrived): unchanged.
2. **Awaiting arrival** (due date passed, not arrived): `/api/today` reports
   `awaitingArrival: true`; Home shows a gentle "any moment now" banner; the AI prompt gets an
   *awaiting* line (joyful anticipation, never scary); the fallback card's messages switch to
   an "I'm packing my bags" variant.
3. **Arrived** (`baby_arrived = 1`): `/api/today` returns early with
   `{ babyArrived: true, birth: { name, date, time, weight }, babyNickname }` — no more
   pregnancy cards are created. Home renders the **reveal screen**: «Labas, mama. Atvykau. ❤️»
   with the birth details. The scheduler stops firing notification schedules and the nightly
   pre-generation stops (both report a `baby_arrived` skip). History and Memories keep working.

### Server changes
- `settingsService.updateSettings` + `serializeSettings`: the five new fields
  (`babyArrived` boolean, `birthDate`, `birthTime`, `birthWeight`, `birthName`).
- `adminRoutes` PUT /settings validation: `babyArrived` boolean; `birthDate` a valid
  YYYY-MM-DD or null; `birthTime` HH:mm or null; weight/name strings or null.
- `publicRoutes` /today: early-return arrived payload; add `awaitingArrival` flag otherwise.
- `schedulerService`: `runDueSchedules` and `shouldPregenerate` skip when `baby_arrived`.
- `cardService.buildFallbackContent`: overdue variant of the canned messages;
  `buildAiTextContext` passes `awaitingArrival`.
- `aiTextService.buildPrompt`: when `ctx.awaitingArrival`, instruct the model that the due
  date has passed and the baby may arrive any moment — excited anticipation, never scary.

### Frontend
- `pages/Home.jsx`: if `babyArrived` → render `ArrivalScreen`; if `awaitingArrival` → show an
  "any moment now" banner above the hero.
- New `components/ArrivalScreen.jsx` (Lithuanian): celebratory reveal — floating hearts, big
  beating ❤️, «Labas, mama. Atvykau.», the birth name (falls back to the nickname), and pills
  for birth date / time / weight (each rendered only when set).
- `AdminSettingsForm.jsx`: new **"Delivery day 🎉"** fieldset — *Baby has arrived* checkbox +
  name/date/time/weight inputs, included in the save payload.
- `styles.css`: arrival-screen styles reusing the existing animation idiom
  (reduced-motion respected).

## Feature 2 — Automated backups

- New `backup` service in `docker-compose.yml` (alpine, no build): once a day tars the
  `app-data` volume (read-only mount) into `${BACKUP_DIR:-./backups}` as
  `babycomm-<date>.tgz` and prunes to the newest `${BACKUP_KEEP:-14}` files. WAL-safe per the
  existing runbook rule (DB + -wal + -shm are tarred together).
- `docs/Maintenance.md`: new "Automated backups" section — where the tarballs land, pointing
  `BACKUP_DIR` at a USB drive / NFS mount for off-SD safety, an `rclone`/`scp` cron example
  for true off-Pi copies, and restore steps (reuses the existing restore command).

## Tests
- `api.test.js`: PUT settings round-trips the birth fields; with `babyArrived: true`,
  GET /api/today returns the arrival payload (and no card); reset afterwards.
- `schedulerService.test.js`: `shouldPregenerate` returns false when `baby_arrived` is set.
- All existing tests stay green.

## Verification
1. `cd server && npm test`; `cd client && npm run build`.
2. Admin: tick *Baby has arrived* + fill birth details → Home shows the reveal screen;
   untick → normal homepage returns. Set due date to yesterday → awaiting banner + awaiting
   fallback text.
3. `docker compose up -d` on the Pi → next morning a `babycomm-*.tgz` appears in `BACKUP_DIR`.

## Out of scope (later phases)
Replies/kick counter (Phase 7), special events (Phase 8), post-birth mode (Phase 10 — the
reveal screen is the hinge it will build on).
