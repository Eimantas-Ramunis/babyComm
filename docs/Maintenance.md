# Maintenance runbook

Operating the Baby Growth PWA after it's deployed.

## Where data lives

- **SQLite DB:** `app.sqlite` on the `app-data` volume (`/app/server/data` in the container;
  `server/data/` in local dev). Holds settings, cards, schedules, devices, memories, and the
  `app_config` VAPID keypair.
- **Generated images:** `data/uploads/cards/<date>.png` on the same volume, served at
  `/uploads/cards/<date>.png`.
- **TLS certs:** the `caddy-data` volume.

## Backup & restore

The DB uses WAL mode, so copy all three files together (or stop the app first for a clean copy).

```bash
# Backup (host)
docker run --rm -v babycomm_app-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/babycomm-backup.tgz -C /data .

# Restore
docker compose down
docker run --rm -v babycomm_app-data:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/babycomm-backup.tgz -C /data"
docker compose up -d
```

(Volume name is `<project>_app-data`; check with `docker volume ls`.)

## Routine tasks

- **Rotate the Gemini API key:** /admin → AI (Gemini) → paste a new key → Save. The old key is
  overwritten. Leaving the field blank on save keeps the current key; submitting clears it only
  via an explicit empty value through the API.
- **Update model names:** Gemini model names change. If generation starts failing with 4xx,
  update the text/image model in /admin (e.g. a newer `gemini-*-flash`). Until then the app
  falls back to the canned message.
- **Daily card pre-generation:** /admin → "Auto-generate tomorrow's card daily" + a time
  (default 20:00). Each evening the next day's AI card (text + image) is prepared in advance so
  notifications/homepage show the AI content, not the fallback. Needs a Gemini key; if a run
  falls back it retries a few times, then keeps the fallback for that day. To prepare a card
  immediately, use "Generate today's card".
- **Personalities & tones:** /admin → manage the **Personalities** and **Tones** lists (add/remove).
  Toggle **"Randomize personality"** to pick a random one per card (or pin one). The generator
  always picks **3 random tones** per card from the tone list. Newly added entries are included
  automatically.
- **Memories:** on the **Prisiminimai** page (while logged in as admin) add/edit/delete memories
  with an image, caption, and an editable date-time. Images are stored under
  `data/uploads/memories/` on the `app-data` volume (covered by the backup above).
- **Pause all notifications:** /admin → turn off the **notifications master switch**. Schedules
  remain but won't fire.
- **Disable a specific schedule/device:** /admin → Schedules / Devices → Disable.

## VAPID keys

Auto-generated and stored in `app_config` on first boot. **Regenerating them invalidates all
existing push subscriptions** — every device must re-subscribe. To keep keys stable across a
data reset, set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` in the stack `.env` (generate with
`npx web-push generate-vapid-keys`); env values take priority over the stored pair.

## Logs

```bash
docker compose logs -f app     # server: scheduler ticks, push results, AI fallbacks
docker compose logs -f caddy   # TLS issuance / proxy errors
docker compose logs -f duckdns # DNS update status
```

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Card shows fallback text despite a key | Gemini call failed (bad key / model / quota) | Check `app` logs; verify key + model in /admin |
| No image on the card | Image gen failed or no key | Regenerate image in /admin; check logs; image is optional |
| Push test reports `0/N sent` | Subscriptions expired (410) → auto-deactivated | Re-subscribe devices on Home |
| Notifications never arrive on phone | Not served over HTTPS, or master switch off | Confirm `https://<DOMAIN>`, master switch on |
| HTTPS not working | Ports 80/443 not forwarded / DuckDNS IP stale | Check router forwarding + `duckdns` logs |
| Scheduler not firing | Master switch off, or time/timezone mismatch | Verify schedule time vs `settings.timezone` |

## Updating the app

- **Portainer build:** Stacks → your stack → **Pull and redeploy** (or **Re-pull image** for
  the GHCR option). The `app-data` volume persists across redeploys.
- Migrations are idempotent and upgrade-safe (`addColumnIfMissing`), so existing databases
  upgrade automatically on boot.

## Health check

`GET /api/health` → `{ "ok": true }` (useful for uptime monitors / container healthchecks).
