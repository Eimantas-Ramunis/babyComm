# Baby Growth PWA — Phase 4 Plan (spec "Phase 7 — Polish" leftovers)

## Context

Phases 1–3 delivered the full working app. The spec's Phase 7 ("Polish") still had two open
items: **richer animations** and an **install prompt**. Delivery-day mode (F12) and special
events (F11) remain out of scope for this phase.

## Richer animations (CSS-first, no animation library)

All in `client/src/styles.css`, following the existing idiom (keyframes at the bottom,
`glow-in` + `--delay` staggering) and all disabled under `prefers-reduced-motion`.

- **Page transitions** — `App.jsx` wraps the routed page in a container keyed by
  `location.pathname`, so every navigation remounts it and plays a gentle fade/slide-in.
- **Staggered timelines** — History cards and Memories entries enter one after another
  (`glow-in` with a per-index `--delay`, capped so long lists don't take forever).
- **Hero "Ken Burns"** — the AI image gets a very slow alternating zoom on top of the existing
  float, so the homepage feels alive even while idle.
- **Badge heartbeat** — the week badge pops in (existing) and then pulses softly, forever.
- **Swaying floaties** — the rising hearts/sparkles also sway sideways and a 4th one is added.
- **Shimmering mood chip** — the gradient mood chip slowly shifts its gradient.
- **Title + footer life** — the 🌱 in the header wiggles gently; the 💛 in the footer beats.
- **Micro-interactions** — nav pills, buttons and cards get hover-lift / press-down transitions.

## Install prompt (`client/src/components/InstallPrompt.jsx`)

Mom-facing (Lithuanian), shown on **Home** under the subscribe card, only when not already
installed (`display-mode: standalone` / iOS `navigator.standalone`):

- **Chromium**: capture `beforeinstallprompt`, show a dismissible card with an
  "Įdiegti programėlę 🌱" button that calls `prompt()`; hide on `appinstalled`.
- **iOS Safari** (no `beforeinstallprompt`): show a dismissible hint explaining
  Share → "Add to Home Screen" (Lithuanian).
- Dismissal is remembered in `localStorage` so mom is never nagged.

## Verification

1. `cd client && npm run build` succeeds; `cd server && npm test` stays green.
2. Manual: navigate between pages (transition plays), History/Memories stagger in, hero zooms,
   badge pulses; with system "reduce motion" on, everything is static.
3. Install prompt appears in Chrome (desktop/Android) when uninstalled; iOS hint shows in
   Safari; dismissing persists across reloads.

## Out of scope (later)

Special events (F11), delivery-day mode (F12), multi-image galleries.
