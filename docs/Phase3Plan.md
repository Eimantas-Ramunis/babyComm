# Baby Growth PWA — Phase 3 Plan (polish + features)

## Context

Phases 1–2 delivered the full working app (pregnancy engine, push, scheduler, Gemini text+image,
daily pre-generation, Docker/Caddy/DuckDNS, Lithuanian). Phase 3 adds two requested features:

1. **Personality & Tone randomization** — personalities become an admin-managed list with a
   randomize toggle (random per card, or pin one); tones become an admin-managed list (seeded
   with 30–90 options) from which **3 random tones are chosen per card generation**.
2. **Memory capsule editing** — on the Prisiminimai page (admin-gated), add/edit/delete memories
   with **one image upload + caption + an editable date-time timestamp**.

**Confirmed decisions:** personality = toggle (random/pinned) · tones = admin-editable list,
3 random per card · memory controls live on the Prisiminimai page, shown only when the admin
password is present · one image per memory.

---

## Feature 1 — Personalities & Tones

### Data model (`server/src/db/migrations.js`)
- New table `personalities (id PK, name TEXT NOT NULL UNIQUE, created_at)`. Seed the 7 presets
  (Sweet Bean, Tiny Viking, Chaos Goblin, Little CEO, Future Supervillain, Soft Poet,
  Dad Joke Machine) if empty.
- New table `tones (id PK, label TEXT NOT NULL UNIQUE, created_at)`. Seed ~50 warm/funny/safe
  tones if empty (warm, funny, loving, cheeky, playful, tender, silly, witty, gentle, cozy,
  heartfelt, goofy, sweet, mischievous, proud, curious, optimistic, dreamy, affectionate,
  whimsical, sincere, cuddly, upbeat, charming, hopeful, grateful, adventurous, sleepy,
  theatrical, poetic, cheerful, soft, reassuring, excited, giggly, content, snuggly, wholesome,
  joyful, mellow, comforting, encouraging, lighthearted, devoted, radiant, smitten, bubbly,
  dramatic-but-never-mean, …). All safe per the spec (no scary/medical wording).
- `settings`: add `randomize_personality INTEGER DEFAULT 1` (idempotent `addColumnIfMissing`).

### Services
- New `server/src/services/lookupService.js`: `listPersonalities/addPersonality/deletePersonality`,
  `listTones/addTone/deleteTone` (dedupe by unique name/label; ignore/return existing on conflict),
  plus pure-ish helpers `randomPersonality(list)` and `randomTones(list, n=3)` (returns up to n
  distinct labels). Uses `Math.random` (normal server code — fine).
- `cardService.buildAiTextContext` (existing) changes:
  - `personality`: `settings.randomize_personality` → `randomPersonality(listPersonalities())`
    (fallback to `settings.personality` or `'Sweet Bean'` if list empty); else `settings.personality`.
  - `tone`: join `randomTones(listTones(), 3)` with `, ` (fallback to `settings.tone` if list empty).
  - Log the chosen personality + tones at `debug`.
- `aiTextService.buildPrompt` already accepts `personality` + `tone` — no change there.

### Routes (`server/src/routes/adminRoutes.js`, behind `adminAuth`)
- `GET/POST /api/admin/personalities`, `DELETE /api/admin/personalities/:id`.
- `GET/POST /api/admin/tones`, `DELETE /api/admin/tones/:id`.
- `PUT /settings` also accepts `randomizePersonality` (boolean); `serializeSettings` exposes it.
- Validation: non-empty string name/label; reuse the `Number.isInteger(id)` id-check pattern.

### Frontend
- `services/api.js`: add personalities + tones list/add/delete calls; `updateSettings` already
  carries arbitrary settings fields.
- New `components/ListManager.jsx` (generic: title, items, add input, delete) reused for both
  Personalities and Tones (keeps it DRY).
- `AdminSettingsForm.jsx`: replace the hardcoded personality `<select>` options with the fetched
  personalities list; add a **"Randomize personality"** toggle (when on, the pinned select still
  saves but is visually marked as the fallback); **remove the freeform tone input**, replaced by a
  note ("3 random tones are picked per card from your tone list").
- `Admin.jsx`: fetch personalities + tones; render two `ListManager`s; pass personalities to the
  settings form. Wire add/delete through `handleResult`.

---

## Feature 2 — Memory capsule editing (image + caption + timestamp)

### Data model (`server/src/db/migrations.js`)
- `memories`: add `memory_at TEXT` (ISO date-time; the editable timestamp). Existing
  `memory_date`, `title`, `body`, `image_url`, `gestational_week/day` stay. `memory_at` is the
  canonical sort/display timestamp; backfill legacy rows lazily (fallback to `memory_date` when null).

### Image upload (`multer` dependency)
- `server/src/utils/paths.js`: add `memoriesUploadDir` (= `<data>/uploads/memories`). Served by
  the existing `/uploads` static mount.
- multer **memoryStorage**, 5 MB limit, **image/* only** (reject others 400). Filename derived from
  the memory id + mimetype extension (never the user filename → no path traversal).

### Service (`server/src/services/memoryService.js`)
- `createMemory(input)` (now sets `memory_at`, defaults to now; derives `memory_date` + gestational
  week/day from the date via `pregnancyService`), `updateMemory(id, input)`, `setMemoryImage(id,url)`,
  `deleteMemory(id)` → also return the stored `image_url` so the route can delete the file.
- `getMemories()` orders by `memory_at DESC` (fallback `memory_date`).

### Routes (`server/src/routes/adminRoutes.js`)
- `POST /api/admin/memories` and `PUT /api/admin/memories/:id` become **multipart** (multer single
  `image`): create/update row, and if a file is present write it to `memoriesUploadDir` as
  `memory-<id>.<ext>` and store `image_url`; on replace, delete the old file.
- `DELETE /api/admin/memories/:id`: delete row + image file.
- Validation: `memoryAt` is a valid date-time; require a non-empty `title` (the caption); `body`
  optional (longer note).
- `serializeMemory` adds `memoryAt`.

### Frontend
- `services/api.js`: add a `requestForm` helper (FormData body, no `Content-Type` so the browser sets
  the multipart boundary; attaches `x-admin-password`). `createMemory/updateMemory` send FormData;
  `deleteMemory` stays JSON.
- `pages/Memories.jsx`: if `getStoredPassword()` is set, show an **"Add memory"** form (caption,
  optional note, `datetime-local` defaulting to now, image file input) and per-memory **Edit/Delete**
  controls; otherwise the current clean read-only view. Render the image, caption, note, and the
  formatted timestamp. Edit uses an inline form pre-filled (incl. `datetime-local` from `memoryAt`).
- Show the image via `card-images`-style `<img>`; lazy-load.

---

## Tests (`server/src/tests/`)
- `lookupService.test.js`: add/list/dedupe personalities & tones; `randomTones` returns `min(n,len)`
  distinct items all drawn from the list; `randomPersonality` returns a member; tone seed ≥ 30.
- `memoryService.test.js`: `createMemory` sets `memory_at` + derives gestational fields; update
  preserves/replaces correctly; `deleteMemory` returns the old image_url.
- Extend `api.test.js`: a memory create **with image** via supertest `.field().attach()` → image_url
  set + file exists; personalities/tones admin endpoints require auth and round-trip.
- Keep `node --test`. All existing 45 tests must stay green (the personality/tone generation change
  must not break AI-less fallback paths).

## Docs
- `README.md`: document personality/tone management + memory editing.
- `docs/Architecture.md`: new tables (`personalities`, `tones`, `memories.memory_at`), the
  per-generation random selection, memory upload flow + storage path.
- `docs/Maintenance.md`: managing personalities/tones; memory images live on the `app-data` volume
  (already covered by backup).

## Verification
1. `cd server && npm test` → all unit + integration tests pass.
2. Admin: add a personality + a tone; toggle randomize; `GET /api/admin/settings` shows
   `randomizePersonality`. With a Gemini key, generate a card and confirm (debug log) a random
   personality + 3 random tones were used; without a key, fallback still works.
3. Prisiminimai (admin password set): add a memory with an image + caption + custom date-time →
   appears with image and timestamp; edit the timestamp/caption; delete removes it and its file.
   Mom view (no password) is read-only.
4. `cd client && npm run build` succeeds.

## Out of scope (later)
Special events (F11), delivery-day mode (F12), multi-image galleries, animations.

## Post-implementation
Run the **code-review** skill; fix findings; re-review until clean. Persist this plan to
`docs/Phase3Plan.md`, commit on the `phase-2` branch (or a new `phase-3` branch), and summarize.
