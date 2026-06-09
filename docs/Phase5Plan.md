# Baby Growth PWA — Phase 5 Plan (size coverage + AI funny twists)

## Context

Two findings/requests from production use:

1. The size label + development fact change **per gestational week** (by design), but
   `SIZE_BY_WEEK` only covered **weeks 6–16** — from week 17 the app would show the generic
   "mažo daigelio" fallback for the rest of the pregnancy.
2. The daily AI message should include a **randomized funny addition**, woven into the
   message itself (confirmed choice): a real fun fact about the week's fruit, a fun fact about
   the baby's development that week (the **LLM provides the fact from its own knowledge** —
   cute and funny but factual, e.g. "I caught wifi here and Google says I'll start kicking
   soon — buy me a football!"), a dad joke, a womb-news observation, a cheeky promise, or a
   pun — picked at random per generation and voiced to match the personality + tones.

## Changes

### `server/src/services/pregnancyService.js`
- Extend `SIZE_BY_WEEK` to cover **weeks 4–42** (Lithuanian genitive size labels +
  warm one-line development facts). The fallback stays for anything outside that range.
- Facts remain weekly and serve the fallback card and as a *hint* to the AI; the AI is told
  to use its own knowledge of week-N development for the woven-in fact.

### `server/src/services/aiTextService.js`
- Export `FUN_TWISTS`: ~6 twist styles (fruit fun fact, week-development fun fact, dad joke,
  womb-news report, cheeky promise/warning about what's coming, fruit/size pun).
- `buildPrompt` (now exported for tests) gains:
  - `Funny twist for today: <picked twist>` in the context block;
  - rules: weave EXACTLY ONE such twist naturally into `homepageMessage`, in the baby's
    voice, matching the personality and tones; anything stated as fact must be true for
    this gestational week (no invented medical claims, never scary);
  - the provided development fact is a hint — the model should use its own knowledge;
  - `homepageMessage` becomes 3–6 sentences to make room.

### `server/src/services/cardService.js`
- `buildAiTextContext` picks one random twist per generation (same pattern as tones) and
  passes it as `ctx.funTwist`; logged at debug alongside personality/tones.

## Tests
- `pregnancyService.test.js`: weeks 4–42 all resolve to real entries (no fallback);
  week 40 has a real label now; out-of-range (43+, 0–3) still falls back safely.
- `aiTextService.test.js`: `buildPrompt` includes the twist + key rules; `FUN_TWISTS`
  has ≥ 5 distinct entries.

## Verification
`cd server && npm test` green; `cd client && npm run build` (unchanged client) green;
redeploy, regenerate tomorrow's card in /admin and check the message includes a woven-in
funny bit that differs between regenerations.

## Out of scope (later)
Special events (F11), delivery-day mode (F12), multi-image galleries.
