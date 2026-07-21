# syntax=docker/dockerfile:1.4
# Multi-stage build for hospeda-web (Astro Node standalone).
# Built and run by Coolify on the VPS.

FROM node:22-alpine AS base
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ----- deps stage ------------------------------------------------------------
# Install ALL workspace deps. See apps/api/Dockerfile for the rationale on
# copying full trees instead of individual package.json files.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY apps apps
COPY packages packages
# BuildKit cache mount for the pnpm content-addressable store. PNPM_HOME=/pnpm
# (set in the base stage) puts the store at /pnpm/store, so caching that path
# lets repeat builds skip re-downloading + re-extracting the workspace packages.
# Matches the official pnpm Docker guide.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ----- build stage -----------------------------------------------------------
# Astro/Vite bake URL env vars into the bundle at build time, so they MUST be
# present when `astro build` runs. Coolify injects the real values via
# --build-arg from the project's build-time env config. The defaults below
# are placeholders that satisfy the Zod validator during local `docker build`
# but are overridden in any real deploy.
FROM base AS build
ARG HOSPEDA_API_URL=https://api.placeholder.local
ARG HOSPEDA_SITE_URL=https://placeholder.local
ARG HOSPEDA_ADMIN_URL=https://admin.placeholder.local
ARG PUBLIC_API_URL=https://api.placeholder.local
ARG PUBLIC_SITE_URL=https://placeholder.local
ARG PUBLIC_ADMIN_URL=https://admin.placeholder.local
# Client-baked vars: Astro inlines `import.meta.env.PUBLIC_*` into the browser
# bundle at build time, so each MUST be declared here. Coolify only forwards a
# --build-arg for ARGs the Dockerfile declares; an undeclared one is silently
# dropped and the value bakes EMPTY. That is exactly what disabled PostHog and
# client-side Sentry in prod (both were set in Coolify but never declared here).
# No placeholder defaults: these are optional / production-scoped, and the build
# stage does not set NODE_ENV=production, so an empty local `docker build` still
# passes the Zod validator; Coolify overrides with real values.
ARG PUBLIC_SENTRY_DSN
ARG PUBLIC_SENTRY_TUNNEL
ARG PUBLIC_SENTRY_TRACES_SAMPLE_RATE
ARG PUBLIC_SENTRY_CSP_REPORT_URI
ARG PUBLIC_POSTHOG_KEY
ARG PUBLIC_POSTHOG_HOST
ARG PUBLIC_VERSION
ARG PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL
ARG PUBLIC_ENABLE_LOGGING
ARG PUBLIC_TURNSTILE_SITE_KEY
ARG PUBLIC_FEEDBACK_ENABLED
# HOSPEDA_GIT_SHA + PUBLIC_SENTRY_RELEASE drive the Sentry release tag baked
# into the client bundle. The default-value chain points back to SOURCE_COMMIT,
# which Coolify auto-injects as a build-arg ONLY when the application has
# "Include Source Commit in Build" enabled in its General settings. With that
# toggle on, every deploy gets a unique Sentry release; with it off, all of
# these resolve to empty and the downstream `|| 'development'` chain in
# apps/web/sentry.client.config.ts takes over.
# See https://coolify.io/docs/applications/build-packs/dockerfile (SOURCE_COMMIT
# section) for the rationale on why the toggle is off by default (Docker build
# cache invalidation on every commit).
ARG SOURCE_COMMIT
ARG HOSPEDA_GIT_SHA=${SOURCE_COMMIT}
ARG PUBLIC_SENTRY_RELEASE=${HOSPEDA_GIT_SHA}
ARG PUBLIC_SENTRY_ENVIRONMENT
# SPEC-180 BETA-66: SENTRY_AUTH_TOKEN is a build-time secret used by the
# @sentry/astro plugin to upload source maps during `astro build`. It must
# NOT be forwarded to the runner stage — it is only needed at build time.
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV HOSPEDA_API_URL=$HOSPEDA_API_URL \
    HOSPEDA_SITE_URL=$HOSPEDA_SITE_URL \
    HOSPEDA_ADMIN_URL=$HOSPEDA_ADMIN_URL \
    PUBLIC_API_URL=$PUBLIC_API_URL \
    PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    PUBLIC_ADMIN_URL=$PUBLIC_ADMIN_URL \
    PUBLIC_SENTRY_RELEASE=$PUBLIC_SENTRY_RELEASE \
    PUBLIC_SENTRY_ENVIRONMENT=$PUBLIC_SENTRY_ENVIRONMENT \
    HOSPEDA_GIT_SHA=$HOSPEDA_GIT_SHA \
    PUBLIC_SENTRY_DSN=$PUBLIC_SENTRY_DSN \
    PUBLIC_SENTRY_TUNNEL=$PUBLIC_SENTRY_TUNNEL \
    PUBLIC_SENTRY_TRACES_SAMPLE_RATE=$PUBLIC_SENTRY_TRACES_SAMPLE_RATE \
    PUBLIC_SENTRY_CSP_REPORT_URI=$PUBLIC_SENTRY_CSP_REPORT_URI \
    PUBLIC_POSTHOG_KEY=$PUBLIC_POSTHOG_KEY \
    PUBLIC_POSTHOG_HOST=$PUBLIC_POSTHOG_HOST \
    PUBLIC_VERSION=$PUBLIC_VERSION \
    PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL=$PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL \
    PUBLIC_ENABLE_LOGGING=$PUBLIC_ENABLE_LOGGING \
    PUBLIC_TURNSTILE_SITE_KEY=$PUBLIC_TURNSTILE_SITE_KEY \
    PUBLIC_FEEDBACK_ENABLED=$PUBLIC_FEEDBACK_ENABLED
COPY --from=deps /repo /repo
# SKIP_PACKAGE_DTS=true skips .d.ts generation for the @repo/* workspace packages
# during the deploy build. Astro/Vite consumes @repo/* JS, never the .d.ts (the
# build does not typecheck — that's a separate `astro check` in dev/CI), so the
# tsup DTS worker (schemas' .d.ts alone is ~4.7 MB / ~47s, the same class that
# OOM'd the api/admin deploys) is pure waste here. Unset in dev/CI so typecheck
# and library consumers still get declarations.
ENV SKIP_PACKAGE_DTS=true
# --concurrency=1: sequential package builds to cap memory peak on the 3.8 GB
# Coolify VPS (see apps/admin/Dockerfile for the 2026-06-06 incident rationale).
RUN echo "[build] Sentry release: ${PUBLIC_SENTRY_RELEASE:-(empty, falling back to 'development' in code)}" && \
    pnpm turbo run build --filter=hospeda-web --concurrency=1

# ----- prune stage -----------------------------------------------------------
# `pnpm deploy` resolves workspace deps as real packages and ships only prod
# deps into a self-contained directory at /prod/web. Unlike the API (which
# bundles everything into dist/index.cjs via tsup), Astro Node standalone
# keeps most deps external and resolves them from node_modules at runtime, so
# this stage is what determines the runner image size for the web app.
#
# See apps/api/Dockerfile for the broader rationale (and the staging incident
# on 2026-05-19 that motivated the switch).
FROM base AS pruned
COPY --from=build /repo /repo
RUN pnpm deploy --filter=hospeda-web --prod /prod/web

# ----- runner stage ----------------------------------------------------------
# Self-contained app at /app. Astro Node standalone reads dist/client/ for
# static assets and dist/server/entry.mjs is the SSR entry — both shipped by
# pnpm deploy as part of the app's files.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
# curl is required for Coolify/Traefik healthcheck probes inside the container.
RUN apk add --no-cache curl
COPY --chown=node:node --from=pruned /prod/web ./
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
