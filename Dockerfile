# MorphoGenix bench — static web build of the Expo app, served by Caddy.
#
# Two stages:
#   1. builder: install ALL deps (incl. dev), run `expo export --platform web`,
#      producing a fully static site at /app/dist.
#   2. runtime: a tiny Caddy image that serves /app/dist on :8080. No Node at runtime.
#
# This is intentionally NOT `expo start`. `expo start` is a dev server and
# does not belong on Fly. We want the same static bundle the production
# landing page uses — predictable, fast, immune to Metro bundler quirks.

# ---------- Stage 1: build ----------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build-time deps (some Expo plugins need python/build tools)
RUN apt-get update \
 && apt-get install -y --no-install-recommends git python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Cache npm install layer
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copy the rest of the project and export the web bundle.
COPY . .

# Honor app.json's experiments.baseUrl ("/demo") so URL paths match production.
RUN npx expo export --platform web --output-dir dist

# ---------- Stage 2: serve ----------
FROM caddy:2-alpine AS runtime

WORKDIR /srv

# Pull just the static output from the builder.
COPY --from=builder /app/dist /srv/dist

# Caddy config: listen on :8080 (Fly's expected internal port), serve /srv/dist,
# fall back to index.html for client-side routing, and tag bench responses
# with a noindex header so search engines skip it.
COPY fly/Caddyfile /etc/caddy/Caddyfile

EXPOSE 8080

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
