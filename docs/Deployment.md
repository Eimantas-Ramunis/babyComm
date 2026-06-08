# Deployment (Raspberry Pi 4 + Portainer + HTTPS)

The app ships as a single Docker image (Express server serving the built client + API). The
`docker-compose.yml` stack adds **Caddy** for automatic HTTPS and a **DuckDNS** updater.

## Prerequisites

- A Raspberry Pi (arm64) running Docker (Raspberry Pi OS 64-bit).
- A DuckDNS subdomain + token (https://www.duckdns.org).
- Ports **80** and **443** forwarded from your router to the Pi (Caddy needs them for the
  Let's Encrypt ACME challenge). If you cannot open port 80, see *DNS challenge* below.

## 1. Configure the stack env

Copy the example and fill it in (this file lives next to `docker-compose.yml`):

```bash
cp .env.compose.example .env
```

```
DOMAIN=tinybean.duckdns.org
DUCKDNS_SUBDOMAIN=tinybean
DUCKDNS_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ADMIN_PASSWORD=choose-a-strong-password
VAPID_SUBJECT=mailto:you@example.com
TZ=Europe/Vilnius
# Optional: pin VAPID keys so push subscriptions survive a data reset (npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## 2A. Deploy via Portainer (build on the Pi) — recommended

1. In Portainer: **Stacks → Add stack → Repository**.
2. Repository URL: your Git repo; compose path: `docker-compose.yml`.
3. Add the environment variables from your `.env` (or upload it).
4. **Deploy the stack.** Portainer builds the arm64 image on the Pi and starts
   `app` + `caddy` + `duckdns`.

You can also build locally on the Pi: `docker compose build && docker compose up -d`.

## 2B. Prebuilt multi-arch image (GHCR) — optional

Build once on a dev machine and push, then have Portainer pull by tag instead of building:

```bash
docker buildx create --use   # first time
docker buildx build \
  --platform linux/arm64,linux/amd64 \
  -t ghcr.io/<you>/baby-growth-pwa:latest \
  --push .
```

Then in `docker-compose.yml` replace the `app.build` block with
`image: ghcr.io/<you>/baby-growth-pwa:latest` and `docker compose pull && up -d`.

## 3. Verify

- `https://<DOMAIN>` loads the app (Caddy obtains a certificate automatically on first hit).
- Install the PWA on the phone, enable notifications on Home, then **/admin → Send test
  notification**.
- Set the Gemini key in **/admin** and generate a card.

## DNS challenge (if you can't forward port 80)

The default `Caddyfile` uses the HTTP/TLS-ALPN challenge (needs ports 80/443 inbound). For a
DNS challenge instead, build a Caddy image with the DuckDNS plugin and use a `tls` block:

```dockerfile
# Caddy.duckdns.Dockerfile
FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/caddy-dns/duckdns
FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

```caddyfile
{$DOMAIN} {
	tls { dns duckdns {$DUCKDNS_TOKEN} }
	reverse_proxy app:3000
}
```

Point the `caddy` service at that built image and pass `DUCKDNS_TOKEN` to it.

## Data & volumes

- `app-data` → `/app/server/data` holds `app.sqlite` and `uploads/` (generated images).
- `caddy-data` / `caddy-config` hold TLS certificates and Caddy state.

Back these up — see [`Maintenance.md`](Maintenance.md).
