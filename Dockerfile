# Multi-stage build: build the client, then run the Express server which serves the
# built client + API from one port. Compiles better-sqlite3 natively (works on arm64/Pi).

# --- Stage 1: build the React client ---
FROM node:22-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- Stage 2: server runtime ---
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/server

# Build toolchain for better-sqlite3's native addon, removed after install to keep the image lean.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev \
  && apt-get purge -y python3 make g++ && apt-get autoremove -y

COPY server/ ./
# Place the built client where the server expects it (../client/dist).
COPY --from=client-build /app/client/dist /app/client/dist

# The .env is NOT baked in; env comes from the container runtime (compose).
ENV DATABASE_PATH=/app/server/data/app.sqlite
EXPOSE 3000
CMD ["node", "src/index.js"]
