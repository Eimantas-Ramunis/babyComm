# Baby Growth PWA — Phase 0 Implementation Documentation

## 1. Product Summary

Build a private Progressive Web App for a husband to surprise his wife during pregnancy.

The app presents daily/weekly baby growth updates in a funny, warm, personal way. The baby appears to “speak” to mom through homepage messages and push notifications. The app should feel like a private emotional gift, not a generic pregnancy tracker.

## 2. Product Goal

Create a small, stable, private PWA that:

- Tracks current pregnancy week/day.
- Displays the baby’s current approximate size.
- Shows a funny/sweet AI-generated message from the baby.
- Displays a visual illustration for the current stage.
- Sends scheduled push notifications to mom’s Android phone.
- Lets dad configure everything through an admin page.
- Saves generated updates into history.

## 3. Non-Goals

Do not build:

- Native Android app.
- Play Store app.
- Medical advice platform.
- Public user registration.
- Multi-family SaaS product.
- Social sharing.
- Complex analytics.
- Payment system.
- Real-time chat.

This is a private app for one family.

## 4. Recommended Stack

### Frontend

- React
- Vite
- React Router
- PWA manifest
- Service worker
- CSS modules / Tailwind / plain CSS

### Backend

- Node.js
- Express
- SQLite for MVP
- node-cron or equivalent scheduler
- Web Push or Firebase Cloud Messaging

### AI

- Gemini API for text generation.
- Gemini/Nano Banana image generation later.

Gemini currently supports native image generation through Nano Banana models in the Gemini API. (Google AI for Developers)

### Hosting

- Raspberry Pi
- Docker recommended
- DuckDNS domain
- HTTPS reverse proxy, ideally Traefik or Caddy

Push notifications require a service worker and push subscription. The Push API stores endpoint/key data needed by the server to send messages. (MDN Web Docs) Firebase Cloud Messaging for web also requires a service worker such as firebase-messaging-sw.js. (Firebase)

---

# 5. Main Features

## F1. Pregnancy Tracking Engine

### Purpose

Calculate current pregnancy status from a configured due date or pregnancy start date.

### Inputs

- Baby nickname
- Due date
- Pregnancy start date, optional
- Timezone

### Outputs

- Current gestational week
- Current gestational day
- Trimester
- Days remaining
- Current size comparison
- Current milestone/development fact

### Rules

If due date is provided, estimate pregnancy start as:

txt dueDate - 280 days 

Gestational age:

txt today - pregnancyStartDate 

Week calculation:

txt week = floor(daysPregnant / 7) dayOfWeek = daysPregnant % 7 

Use Europe/Vilnius timezone by default.

---

## F2. Homepage Dashboard

### Purpose

Main emotional screen for mom.

### Display

- Baby nickname
- Current week/day
- Size comparison
- Today’s baby message
- Today’s image
- Development fact
- Days until due date
- Button/link to history

### Example

txt Tiny Chaos Bean Week 13 + 4 days  Today I am roughly the size of a lemon. I have fingerprints now, which feels suspiciously official.  "Hi mom. I am busy becoming adorable. Please continue snacks." 

---

## F3. History Page

### Purpose

Allow mom/dad to browse previous updates.

### Display

Timeline grouped by week/day:

- Date
- Week/day
- Message
- Image
- Size comparison
- Development fact
- Favorite flag, optional

### Requirements

Every generated daily card must be saved. Do not regenerate old cards unless admin explicitly requests regeneration.

---

## F4. Admin Panel

### Purpose

Private configuration area for dad.

### Admin features

- Set baby nickname.
- Set due date.
- Set notification schedule.
- Set AI personality.
- Generate today’s card.
- Generate tomorrow’s card.
- Regenerate message.
- Regenerate image.
- Send test notification.
- View registered devices.
- Disable/enable notifications.

### Access

For MVP, use a simple admin password from environment variable.

Example:

env ADMIN_PASSWORD=some-secure-password 

Do not overbuild authentication.

---

## F5. Push Notifications

### Purpose

Send scheduled messages to mom’s Android phone.

### Requirements

- PWA must request notification permission.
- Device must register push subscription.
- Backend must store subscription.
- Admin can send test notification.
- Scheduler can send automatic notification.
- Failed subscriptions should be marked inactive.

### Notification examples

txt Hey mom, today I am 13 weeks old! Love you 💛 

txt Good morning mom. I grew a tiny bit overnight. Very professional of me. 

### Notification click behavior

Clicking the notification opens the homepage or the relevant daily card.

---

## F6. AI Message Generation

### Purpose

Generate funny, warm messages from the baby.

### AI Input

- Baby nickname
- Gestational week/day
- Size comparison
- Development fact
- Personality
- Tone
- Occasion, optional
- Recent previous messages to avoid repetition

### AI Output

Return strict JSON:

{
  "title": "Week 13: Lemon Operations",
  "shortNotification": "Hey mom, today I am lemon-sized and extremely busy being cute.",
  "homepageMessage": "Hi mom. Today I am roughly the size of a lemon. I am growing fingerprints, which means I am basically ready to sign documents. Love you.",
  "mood": "tiny CEO",
  "tags": ["funny", "sweet", "week-13"]
}

### Rules

- No medical advice.
- No scary content.
- No references to miscarriage, illness, defects, or complications.
- Keep messages warm, funny, and safe.
- Avoid repeating yesterday’s joke.
- Keep notification under 120 characters if possible.
- Homepage message can be 2–5 sentences.

---

## F7. AI Image Generation

### MVP Recommendation

Start with manually curated weekly images or static placeholders.

### Later Upgrade

Generate images in advance, not live on page load.

### Image generation rules

- Generate once per day or once per week.
- Store generated image.
- Reuse stored image on homepage/history.
- Never block homepage loading while waiting for image generation.
- Admin can regenerate image manually.

### Safe prompt style

txt Cute warm storybook illustration of a tiny cheerful baby character represented symbolically as a lemon-sized little explorer, sitting in a lemon spaceship, pastel colors, cozy, funny, wholesome, no text, no medical realism, no scary details. 

### Avoid

- Realistic fetus imagery.
- Medical-looking womb visuals.
- Creepy anatomy.
- Text inside generated image.
- Anything horror-like.

---

## F8. Device Management

### Purpose

Manage push notification targets.

### Data stored

- Device name
- Push subscription
- Browser/user agent
- Created date
- Last successful push date
- Active/inactive status

### Admin features

- View devices
- Send test notification
- Remove device
- Disable device

---

## F9. Memory Capsule

### Purpose

Dad can manually save personal memories.

### Examples

- First ultrasound
- First time hearing heartbeat
- Funny pregnancy craving
- Mom’s funny quote
- Personal photo

### Fields

- Title
- Date
- Week/day
- Text note
- Optional image
- Visibility on history page

---

## F10. Baby Personality System

### Purpose

Make generated messages consistent.

### Personality presets

- Sweet Bean
- Tiny Viking
- Chaos Goblin
- Little CEO
- Future Supervillain
- Soft Poet
- Dad Joke Machine

### Admin setting

{
  "personality": "Tiny Viking",
  "tone": "funny, loving, slightly dramatic, never mean"
}

---

## F11. Special Event System

### Purpose

Generate unique messages for special days.

### Events

- Mother’s birthday
- Father’s birthday
- Christmas
- New Year
- Mother’s Day
- Baby shower
- Gender reveal
- Due date
- Custom admin-added date

### Example

txt Dear Mom, happy birthday. I could not buy you a gift because I currently have no pockets. But I am working on becoming your favorite present. 

---

## F12. Delivery Day Mode

### Purpose

The app changes tone around the due date and after birth.

### Before due date

txt Awaiting arrival... 

### After birth

Admin can set:

txt Baby has arrived: true Birth date Birth time Birth weight Birth name 

Homepage transforms into:

txt Hello Mom. I made it. ❤️ 

This should be a special final/reveal screen.

---

# 6. Database Schema

Use SQLite for MVP.

## settings

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  baby_nickname TEXT NOT NULL,
  due_date TEXT NOT NULL,
  pregnancy_start_date TEXT,
  timezone TEXT DEFAULT 'Europe/Vilnius',
  personality TEXT DEFAULT 'Sweet Bean',
  tone TEXT DEFAULT 'funny, warm, loving',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
); 

## daily_cards

CREATE TABLE daily_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_date TEXT NOT NULL UNIQUE,
  gestational_week INTEGER NOT NULL,
  gestational_day INTEGER NOT NULL,
  size_label TEXT,
  development_fact TEXT,
  title TEXT,
  short_notification TEXT,
  homepage_message TEXT,
  mood TEXT,
  image_url TEXT,
  image_prompt TEXT,
  generation_status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

## notification_schedules

CREATE TABLE notification_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  type TEXT NOT NULL,
  time_of_day TEXT NOT NULL,
  days_of_week TEXT,
  send_on_new_week INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

## push_devices

CREATE TABLE push_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_name TEXT,
  subscription_json TEXT NOT NULL,
  user_agent TEXT,
  active INTEGER DEFAULT 1,
  last_success_at TEXT,
  last_failure_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

## memories

CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_date TEXT NOT NULL,
  gestational_week INTEGER,
  gestational_day INTEGER,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

## special_events

CREATE TABLE special_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt_context TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

---

# 7. Backend API Contract

Base path:

txt /api 

## Public/frontend endpoints

### GET /api/today

Returns current card.

{
  "date": "2026-06-07",
  "babyNickname": "Tiny Bean",
  "gestationalWeek": 13,
  "gestationalDay": 4,
  "trimester": 2,
  "daysRemaining": 187,
  "sizeLabel": "lemon",
  "developmentFact": "Tiny fingerprints are forming.",
  "title": "Lemon Operations",
  "homepageMessage": "Hi mom...",
  "imageUrl": "/uploads/cards/2026-06-07.png",
  "mood": "tiny CEO"
}

### GET /api/history

Returns all saved cards.

### GET /api/memories

Returns memory capsule entries.

### POST /api/push/register

Registers device push subscription.

Body:

{
  "deviceName": "Mom's phone",
  "subscription": {},
  "userAgent": "..."
}

---

## Admin endpoints

All admin endpoints require admin auth.

### GET /api/admin/settings

Returns app settings.

### PUT /api/admin/settings

Updates app settings.

### POST /api/admin/cards/generate-today

Generates today’s card.

### POST /api/admin/cards/:date/regenerate-message

Regenerates text only.

### POST /api/admin/cards/:date/regenerate-image

Regenerates image only.

### POST /api/admin/notifications/test

Sends test push.

### GET /api/admin/devices

Lists push devices.

### DELETE /api/admin/devices/:id

Removes device.

### GET /api/admin/schedules

Lists schedules.

### POST /api/admin/schedules

Creates schedule.

### PUT /api/admin/schedules/:id

Updates schedule.

### DELETE /api/admin/schedules/:id

Deletes schedule.

### POST /api/admin/memories

Creates memory.

### PUT /api/admin/memories/:id

Updates memory.

### DELETE /api/admin/memories/:id

Deletes memory.

---

# 8. Scheduler Logic

Use backend cron.

Run every minute.

Pseudo logic:

everyMinute(() => {
  const now = getNowInTimezone(settings.timezone)

  const schedules = getEnabledSchedules()

  for each schedule:
    if shouldRun(schedule, now):
      card = getOrCreateTodayCard()
      sendPushToAllActiveDevices(card.shortNotification)
      markScheduleRun(schedule, now)
})

Important:

- Avoid duplicate sends.
- Store last run timestamp.
- Do not send the same schedule twice in one day unless manually triggered.
- If AI generation fails, use fallback message.
- If push fails for a device repeatedly, mark device inactive.

---

# 9. AI Generation Prompt

Use this as the core message generation prompt.

You are generating a private pregnancy update from an unborn baby to his/her mother.

Tone:
- Warm
- Funny
- Loving
- Slightly cheeky
- Never scary
- Never medical-advice-like
- Never mention miscarriage, defects, danger, illness, death, or complications

Context:
Baby nickname: {{babyNickname}}
Gestational age: week {{week}}, day {{day}}
Current size comparison: {{sizeLabel}}
Development fact: {{developmentFact}}
Personality: {{personality}}
Previous recent messages: {{recentMessages}}

Return ONLY valid JSON with this structure:
{
  "title": string,
  "shortNotification": string,
  "homepageMessage": string,
  "mood": string,
  "tags": string[]
}

Rules:
- shortNotification max 120 characters.
- homepageMessage should be 2-5 sentences.
- Write as if the baby is speaking directly to mom.
- Do not include markdown.
- Do not include emojis unless they fit naturally.
- Keep it personal, cozy, and memorable.

---

# 10. Image Prompt Template

txt Create a cute, wholesome, warm storybook-style illustration for a private pregnancy tracker app.  Theme: Baby is approximately the size of {{sizeLabel}}.  Personality: {{personality}}  Scene: {{visualScene}}  Style: soft pastel colors, cozy, funny, charming, simple composition, high quality children’s book illustration, no text in image, no medical realism, no scary anatomy, no realistic fetus, no horror elements. 

---

# 11. Frontend Pages

## / — Homepage

Components:

- TodayCard
- BabyAgeBadge
- SizeComparisonCard
- BabyMessageCard
- ImageCard
- DaysRemaining
- NavigationLinks

## /history

Components:

- Timeline
- HistoryCard
- WeekGroup

## /memories

Components:

- MemoryTimeline
- MemoryCard

## /admin

Components:

- AdminLogin
- SettingsForm
- ScheduleManager
- CardGenerator
- DeviceManager
- MemoryManager
- TestNotificationButton

---

# 12. PWA Requirements

Frontend must include:

- manifest.webmanifest
- app name
- app icons
- theme color
- service worker
- installability
- offline fallback page, optional
- notification permission flow

Manifest example:

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

---

# 13. Environment Variables

PORT=3000
NODE_ENV=production

APP_BASE_URL=https://your-domain.duckdns.org
ADMIN_PASSWORD=change-me

DATABASE_PATH=./data/app.sqlite

GEMINI_API_KEY=your-key
GEMINI_TEXT_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image

VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your-email@example.com

Model names may change. Check Gemini API docs before implementation.

---

# 14. Error Handling Rules

The app must not break if AI fails.

Fallback behavior:

- If AI text generation fails, use static fallback message.
- If image generation fails, use weekly placeholder.
- If push send fails, log failure and continue.
- If database write fails, show admin error.
- If homepage has no generated card, generate or create fallback card.

Fallback message:

txt Hi mom. I am growing a little more today. Dad says I am already extremely impressive. 

---

# 15. Security Rules

- Admin page must require password.
- Never expose Gemini API key to frontend.
- Never expose VAPID private key to frontend.
- Store secrets in .env.
- Use HTTPS in production.
- Do not allow public write endpoints.
- Validate all admin inputs.
- Sanitize memory text before rendering.
- Rate-limit admin generation endpoints lightly.

---

# 16. Testing Checklist

## Pregnancy calculation tests

- Correct week/day from due date.
- Correct week/day around midnight.
- Correct days remaining.
- Due date passed behavior.
- Delivery mode behavior.

## AI tests

- Gemini response parses as JSON.
- Invalid Gemini response handled.
- Empty response handled.
- Safety fallback used when needed.

## Push tests

- Device registration works.
- Test notification sends.
- Disabled device does not receive push.
- Failed subscription is handled.
- Notification click opens correct URL.

## Scheduler tests

- Daily schedule sends once.
- Weekly schedule sends once.
- Manual trigger works.
- Disabled schedule does not run.
- Duplicate sends are prevented.

## Frontend tests

- Homepage loads with card.
- History page loads saved cards.
- Admin login works.
- Settings update works.
- PWA manifest is valid.
- Service worker registers.

---

# 17. Build Phases

## Phase 0 — Documentation

Produce:

- Product requirements
- Data model
- API contract
- AI prompt templates
- Testing checklist
- Deployment notes

## Phase 1 — Static MVP

Build:

- React app
- Homepage
- History page
- Admin page shell
- Static fake data
- PWA manifest

No backend yet.

## Phase 2 — Backend MVP

Build:

- Express server
- SQLite database
- Settings endpoint
- Today endpoint
- History endpoint
- Pregnancy calculation logic

## Phase 3 — Admin Functionality

Build:

- Admin password login
- Settings editing
- Manual card generation
- Memory capsule CRUD

## Phase 4 — Push Notifications

Build:

- Service worker
- Push subscription registration
- Device management
- Test notification
- Scheduled notification

## Phase 5 — Gemini Text

Build:

- AI text generation
- JSON validation
- Fallback handling
- Store generated cards

## Phase 6 — Images

Build:

- Static image mapping first
- AI image generation later
- Image caching
- Admin regeneration

## Phase 7 — Polish

Build:

- Better visuals
- Animations
- Install prompt
- Delivery day mode
- Special events

---

# 18. AI Agent Implementation Instructions

When implementing, follow these rules:

1. Build small vertical slices.
2. Do not implement all features at once.
3. Keep frontend and backend separated.
4. Use SQLite first.
5. Add tests for calculation and scheduler logic.
6. Never call AI directly from frontend.
7. Never generate images on page load.
8. Cache all generated content.
9. Make push notification setup testable from admin.
10. Prefer boring stable code over clever abstractions.

Recommended first implementation order:

txt 1. Create project structure. 2. Build static React UI. 3. Add Express backend. 4. Add SQLite. 5. Add pregnancy calculation. 6. Connect homepage to /api/today. 7. Add admin settings. 8. Add history storage. 9. Add push registration. 10. Add test notification. 11. Add scheduler. 12. Add Gemini text. 13. Add image handling. 

---

# 19. Suggested Project Structure

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
    public/
      manifest.webmanifest
      icons/
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
        aiTextService.js
        aiImageService.js
        pushService.js
        schedulerService.js
        cardService.js
      middleware/
        adminAuth.js
      utils/
        dateUtils.js
    data/
      app.sqlite
  docker-compose.yml
  .env.example
  README.md

---

# 20. Definition of Done for MVP

MVP is done when:

- App opens on phone browser.
- App can be installed as PWA.
- Homepage shows current pregnancy status.
- Admin can set due date and baby nickname.
- History saves generated cards.
- Mom’s Android device can register for notifications.
- Admin can send test notification.
- Scheduled notification sends automatically.
- Gemini can generate today’s message.
- App still works if Gemini fails.
- App is accessible via HTTPS DuckDNS domain.

---

# 21. Final Product Direction

This app should feel:

- personal
- private
- funny
- cozy
- emotionally meaningful
- simple

Do not let it become a generic pregnancy dashboard.

The emotional core is:

txt The baby is already part of the family, sending little love notes before arriving. 