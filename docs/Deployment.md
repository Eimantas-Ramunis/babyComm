# Deployment (Raspberry Pi 4 + Portainer + HTTPS)

The app ships as a single Docker image (Express server serving the built client + API). The
`docker-compose.yml` stack adds **Caddy** for automatic HTTPS. DDNS (keeping your domain pointed
at your home IP) is handled either by **your router** (e.g. TP-Link) or by the optional DuckDNS
updater container.

## Prerequisites

- A Raspberry Pi (arm64) running Docker (Raspberry Pi OS 64-bit).
- A dynamic-DNS hostname that resolves to your home IP. Two supported options:
  - **TP-Link DDNS** (e.g. `baby.tplinkdns.com`) — managed by your TP-Link router. Recommended
    if you have a TP-Link router; no extra container needed.
  - **DuckDNS** (e.g. `tinybean.duckdns.org`) — uses the optional `duckdns` updater service.
- Ports **80** and **443** forwarded from your router to the Pi (Caddy needs them for the
  Let's Encrypt ACME challenge). If you cannot open port 80, see *DNS challenge* below.

## DDNS setup

### Option A — TP-Link router DDNS (e.g. baby.tplinkdns.com)

You said you already registered `baby.tplinkdns.com`. In the **TP-Link router admin**:

1. **Advanced → Network → Dynamic DNS** → provider **TP-Link DDNS** → sign in → confirm the
   domain `baby.tplinkdns.com` is registered and **bound/online** (it should show your current
   WAN IP). The router keeps this updated automatically — that's why no updater container is needed.
2. **Advanced → NAT Forwarding → Port Forwarding (Virtual Servers)** → add two rules pointing to
   the Pi's LAN IP:
   - External **80** → Pi `80` (TCP)
   - External **443** → Pi `443` (TCP)
3. Make sure the Pi has a **static LAN IP** (DHCP reservation) so the forwards don't break.

Note: this only works if your ISP gives you a public (non-CGNAT) IP. If `baby.tplinkdns.com`
resolves to a `100.64.x.x`/shared address, port forwarding won't work — see *DNS challenge* below.

### Option B — DuckDNS

Create a subdomain + token at https://www.duckdns.org, set `DUCKDNS_SUBDOMAIN`/`DUCKDNS_TOKEN`
in `.env`, and start the stack with `--profile duckdns` (below).

## 1. Configure the stack env

Copy the example and fill it in (this file lives next to `docker-compose.yml`):

```bash
cp .env.compose.example .env
```

```
DOMAIN=baby.tplinkdns.com          # the hostname HTTPS is issued for
ADMIN_PASSWORD=choose-a-strong-password
VAPID_SUBJECT=mailto:you@example.com
TZ=Europe/Vilnius
# Optional: pin VAPID keys so push subscriptions survive a data reset (npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
# DuckDNS only (leave blank for TP-Link):
DUCKDNS_SUBDOMAIN=
DUCKDNS_TOKEN=
```

## 2A. Deploy via Portainer (build on the Pi) — recommended

1. In Portainer: **Stacks → Add stack → Repository**.
2. Repository URL: your Git repo; compose path: `docker-compose.yml`.
3. Add the environment variables from your `.env` (or upload it).
4. **Deploy the stack.** Portainer builds the arm64 image on the Pi and starts `app` + `caddy`
   (TP-Link). For DuckDNS, also enable the `duckdns` profile in the stack's advanced options, or
   deploy from CLI with `docker compose --profile duckdns up -d`.

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

The default `Caddyfile` uses the HTTP/TLS-ALPN challenge (needs ports 80/443 inbound).

**TP-Link DDNS note:** there is no Caddy DNS plugin for `tplinkdns.com`, so the DNS-challenge
workaround below is **DuckDNS-only**. With a TP-Link domain you must forward ports 80/443 (HTTP
challenge). If your ISP uses CGNAT (no public IP), neither HTTP nor a TP-Link DNS challenge will
work — you'd need a public IP, a VPS reverse-tunnel (e.g. Tailscale Funnel / Cloudflare Tunnel),
or to switch to DuckDNS for a DNS challenge.

For a DuckDNS DNS challenge, build a Caddy image with the DuckDNS plugin and use a `tls` block:

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
