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

## Automated backups

The `backup` service in `docker-compose.yml` (plain alpine, no build) runs alongside the app and
writes a tarball of the whole `app-data` volume **once a day**:

- Tarballs land in `BACKUP_DIR` on the host (default `./backups` next to the compose file) as
  `babycomm-<timestamp>.tgz`.
- Rotation: only the newest `BACKUP_KEEP` files are kept (default 14); older ones are deleted.
- The volume is mounted **read-only**, and the DB + its `-wal`/`-shm` files are tarred together —
  consistent with the WAL rule in "Backup & restore" above.

**Strongly recommended:** point `BACKUP_DIR` at a USB drive or network mount (e.g.
`BACKUP_DIR=/mnt/usb/babycomm-backups` in the stack `.env`). Backups written to the Pi's own SD
card die with the SD card — which is exactly the failure they exist for. For copies on another
machine, see the Syncthing section below (no cloud involved).

**Restore:** pick a tarball and run the restore command from "Backup & restore" above, pointing
it at the chosen `babycomm-<timestamp>.tgz`.

## Off-Pi backups to a Windows machine (Syncthing)

The stack includes a `syncthing` service that replicates the `BACKUP_DIR` tarballs to any other
machine on your LAN — peer-to-peer and encrypted, **no cloud**. The model: the Pi is the
always-on *buffer* (newest `BACKUP_KEEP` tarballs), the Windows box is the long-term *archive*.
Because the Pi keeps ~2 weeks, the Windows machine only needs to be on occasionally to catch up.

### One-time setup — Pi side (already in the stack)

1. Redeploy the stack (the `syncthing` service starts automatically).
2. Open `http://<pi>:8384` → **Settings → GUI** → set a GUI user + password (do this first).
3. **Settings → Connections**: untick *Global Discovery* and *Enable Relaying* — traffic then
   never leaves your LAN.
4. **Add Folder**: path `/var/syncthing/backups`, label `babycomm-backups`, Folder Type
   **Send Only**.

### One-time setup — Windows side (Docker Desktop)

1. Start Syncthing (PowerShell):

   ```powershell
   docker run -d --name syncthing --restart unless-stopped `
     -p 8384:8384 -p 22000:22000/tcp -p 22000:22000/udp -p 21027:21027/udp `
     -v D:\Backups\babycomm:/var/syncthing/backups `
     -v syncthing-config:/var/syncthing/config `
     syncthing/syncthing:1
   ```

   (Pick any folder you like instead of `D:\Backups\babycomm`. `--restart unless-stopped` +
   Docker Desktop starting at boot = it is always running when the machine is on.)
2. Open `http://localhost:8384`, set a GUI password here too.
3. Pair the devices: on each GUI, **Add Remote Device** with the other side's Device ID
   (**Actions → Show ID**). If they don't auto-discover each other, edit the remote device and
   set *Addresses* to `tcp://<pi-ip>:22000` (Windows side) / `tcp://<windows-ip>:22000` (Pi side).
4. On the Pi GUI, share the `babycomm-backups` folder with the Windows device; accept the
   incoming folder on Windows with path `/var/syncthing/backups` and Folder Type
   **Receive Only**.
5. **Retention (important):** on the Windows folder → **Edit → File Versioning → Staggered**,
   *Maximum Age* ≈ 365 days. When the Pi's rotation deletes a 15-day-old tarball, the deletion
   syncs — but Windows moves its copy into the folder's `.stversions/` archive instead of
   deleting it. Pi = rolling 14 days; Windows = a year of history.

### Disaster drill — restore & VIEW everything on Windows

A tarball is the complete app state (every message, photo, memory, setting), but it is data,
not a viewable page — to browse it you run the app against it. Do this once to prove the
backup works, and again for real if the Pi ever dies:

```powershell
git clone https://github.com/Eimantas-Ramunis/babyComm.git; cd babyComm
# Minimal .env — DOMAIN is only used for CORS, any value works locally:
"DOMAIN=localhost`nADMIN_PASSWORD=drill" | Out-File -Encoding ascii .env
docker compose up -d --build app      # just the app, no Caddy/HTTPS needed
docker compose stop app
# Restore the newest synced tarball into the app's volume:
docker run --rm -v babycomm_app-data:/data -v D:\Backups\babycomm:/backup alpine `
  sh -c "rm -rf /data/* && tar xzf /backup/babycomm-<timestamp>.tgz -C /data"
docker compose start app
```

Open `http://localhost:3001` — the full app with all history, photos, and memories.
(Volume name is `<folder>_app-data`; check `docker volume ls`. Push notifications won't work
locally — they need the HTTPS domain — everything else does. A backup you've never restored
is a hypothesis, not a backup.)

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
- **Tomorrow's card preview:** /admin → **"Tomorrow's card"** panel shows whether tonight's
  pre-generation already ran, plus the exact notification text, homepage message, and image the
  next day will use. "Generate tomorrow's card now" prepares/regenerates it on the spot.
- **Did a notification actually go out?** /admin → each schedule shows a **"Last sent"**
  timestamp and each device shows **"Last push OK / last failure"**. Schedules fire at-or-after
  their time (3-hour same-day catch-up window), at most once per day — a restart or a slow
  pre-generation run no longer makes the day's message silently skip.
- **Personalities & tones:** /admin → manage the **Personalities** and **Tones** lists (add/remove).
  Toggle **"Randomize personality"** to pick a random one per card (or pin one). The generator
  always picks **3 random tones** per card from the tone list. Newly added entries are included
  automatically.
- **Memories:** on the **Prisiminimai** page (while logged in as admin) add/edit/delete memories
  with an image, caption, and an editable date-time. Images are stored under
  `data/uploads/memories/` on the `app-data` volume (covered by the backup above).
- **Delivery-day mode:** /admin → **Delivery day 🎉** → tick *Baby has arrived* and fill in the
  birth name/date/time/weight. The homepage becomes the celebratory reveal screen, no more
  pregnancy cards are generated, and scheduled notifications + nightly pre-generation stop.
  Unticking the checkbox restores the normal app.
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
| Scheduler not firing | Master switch off, or time/timezone mismatch | Verify schedule time vs `settings.timezone`; check the schedule's "Last sent" in /admin |
| Notification arrives hours late | App was down at the scheduled time; catch-up sent it on recovery | Expected (3 h window); check container uptime |

## Updating the app

- **Portainer build:** Stacks → your stack → **Pull and redeploy** (or **Re-pull image** for
  the GHCR option). The `app-data` volume persists across redeploys.
- Migrations are idempotent and upgrade-safe (`addColumnIfMissing`), so existing databases
  upgrade automatically on boot.

## Health check

`GET /api/health` → `{ "ok": true }` (useful for uptime monitors / container healthchecks).
