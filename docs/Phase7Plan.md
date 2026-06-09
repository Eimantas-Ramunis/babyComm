# Baby Growth PWA — Phase 7 Plan (mom answers the baby + kick counter)

Second roadmap phase: the app becomes two-way. Mom (no password needed — public endpoints,
same trust model as push subscribe) can reply to the daily message and count kicks; the AI
sees both and reacts in later messages.

## Feature 1 — Replies (mama answers)

### Data model (`migrations.js`, CREATE TABLE IF NOT EXISTS)
- `replies (id PK, card_date TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)`,
  index on `card_date`. Multiple replies per day allowed (it's a conversation).

### Service (`server/src/services/replyService.js`)
- `addReply(cardDate, body)`, `getRepliesForDate(date)`, `getRepliesGroupedByDate()`,
  `getRecentReplies(limit = 5)` (newest first, for the AI context), `deleteReply(id)`.

### API
- **POST `/api/replies`** (public, rate-limited ~20/min): `{ body, cardDate? }` — body
  required, trimmed, ≤ 1000 chars; `cardDate` optional valid date ≤ today (defaults to today,
  server timezone). Returns the saved reply + the date's full reply list.
- **GET `/api/today`**: gains `replies: [...]` for today's card (arrived mode unaffected).
- **GET `/api/history`**: each card gains its `replies` array (one grouped query).
- **DELETE `/api/admin/replies/:id`** (admin): typo/moderation cleanup.

### AI context
- `cardService.buildAiTextContext` passes `momReplies` (up to 5 recent reply bodies).
- `aiTextService.buildPrompt`: a "Recent replies from mom" block + rule — when present, the
  baby MAY warmly acknowledge or react to one of them, naturally (never robotic quoting,
  never every sentence). This closes the loop: she answers, he answers back tomorrow.

## Feature 2 — Kick counter

### Data model
- `kicks (id PK, kick_date TEXT NOT NULL UNIQUE, count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL)` — one aggregate row per local date.

### Service (`server/src/services/kickService.js`)
- `incrementKicks(date)` (upsert `count = count + 1`), `getKicksForDate(date)`,
  `getLatestKicks()` (most recent non-zero day, for the AI).

### API
- **POST `/api/kicks`** (public, rate-limited ~120/min — kick sessions are bursty):
  increments today's count, returns `{ date, count }`.
- **GET `/api/today`**: gains `kicks: { date, count }` for today.

### AI context
- `buildAiTextContext` passes `kicks` = latest non-zero day `{ date, count }`;
  prompt mentions it ("mom counted N kicks on <date>") with a rule to reference it
  playfully when it fits.

## Frontend

- `api.js`: `sendReply(body)`, `addKick()`.
- New `components/ReplyBox.jsx` (Lithuanian): under the daily message — today's replies as
  little "Mama:" bubbles + textarea + "Siųsti 💌" button; optimistic refresh from the POST
  response. Hidden in arrived mode.
- New `components/KickCounter.jsx`: a card with today's count and a big **"Spyrė! ⚽"**
  button (press animation). Shown from gestational week ≥ 18 (movement is commonly felt
  18–22 w; week prop comes from `/api/today`).
- `Timeline.jsx` (History): renders each card's replies as conversation bubbles.
- `styles.css`: reply bubbles + kick button styles, reduced-motion respected.

## Tests (`api.test.js`)
- POST /api/replies: 400 on empty/too-long body; saved reply appears in /api/today.replies
  and on the matching /api/history card; admin DELETE removes it (and requires auth).
- POST /api/kicks: increments twice → count 2; /api/today.kicks matches.
- All existing tests stay green.

## Verification
1. `cd server && npm test`; `cd client && npm run build`.
2. Manual: send a reply on Home → bubble appears; visible under the card in Istorija.
   Tap "Spyrė!" → counter increments. With a Gemini key, regenerate tomorrow's card after
   replying → the message references mom's reply.

## Out of scope (later phases)
Special events (Phase 8), bump-photo ritual (Phase 8), reply push-notification to dad,
per-kick timestamps/charts.
