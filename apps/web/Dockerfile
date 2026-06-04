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
COPY patches ./patches
COPY apps apps
COPY packages packages
RUN pnpm install --frozen-lockfile

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
ENV HOSPEDA_API_URL=$HOSPEDA_API_URL \
    HOSPEDA_SITE_URL=$HOSPEDA_SITE_URL \
    HOSPEDA_ADMIN_URL=$HOSPEDA_ADMIN_URL \
    PUBLIC_API_URL=$PUBLIC_API_URL \
    PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    PUBLIC_ADMIN_URL=$PUBLIC_ADMIN_URL \
    PUBLIC_SENTRY_RELEASE=$PUBLIC_SENTRY_RELEASE \
    PUBLIC_SENTRY_ENVIRONMENT=$PUBLIC_SENTRY_ENVIRONMENT \
    HOSPEDA_GIT_SHA=$HOSPEDA_GIT_SHA
COPY --from=deps /repo /repo
RUN echo "[build] Sentry release: ${PUBLIC_SENTRY_RELEASE:-(empty, falling back to 'development' in code)}" && \
    pnpm turbo run build --filter=hospeda-web

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
