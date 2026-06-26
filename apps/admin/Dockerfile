# syntax=docker/dockerfile:1.4
# Multi-stage build for admin (TanStack Start, Nitro node-server preset).
# Preset is selected by the NITRO_PRESET=node-server env var.

FROM node:22-alpine AS base
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ----- build stage -----------------------------------------------------------
# Install workspace deps AND run the turbo build in a single stage so we never
# duplicate the ~4 GB monorepo node_modules tree on the build host's disk.
# Previously this was split into `deps` + `build` and the `COPY --from=deps
# /repo /repo` step doubled the working set to ~8 GB, which exhausted disk on
# the Coolify VPS during the staging deploy on 2026-05-19 (exit code 255 mid
# COPY). Docker still caches the install layer separately as long as the
# lockfile + workspace trees don't change.
#
# Vite bakes VITE_*/HOSPEDA_API_URL into the admin bundle at build time.
# Coolify injects the real values via --build-arg from the project's
# build-time env config. The defaults are placeholders so local
# `docker build` validation passes the Zod check; real values override.
#
# Full-tree COPY of apps/ and packages/ is intentional: listing every
# workspace package.json individually was tried first but missed transitive
# workspace deps (e.g. @repo/icons pulled in via @repo/feedback). This
# trades a bit of layer cache for correctness.
FROM base AS build
ARG HOSPEDA_API_URL=https://api.placeholder.local
ARG VITE_API_URL=https://api.placeholder.local
ARG VITE_SITE_URL=https://placeholder.local
ARG VITE_BETTER_AUTH_URL=https://api.placeholder.local/api/auth
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT
# SPEC-180 BETA-66: SENTRY_AUTH_TOKEN is a build-time secret used by the
# Sentry Vite plugin to upload source maps during `vite build`. It must
# NOT be forwarded to the runner stage — it is only needed at build time.
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
# HOSPEDA_GIT_SHA + VITE_SENTRY_RELEASE drive the Sentry release tag baked
# into the admin client bundle. The default-value chain points back to
# SOURCE_COMMIT, which Coolify auto-injects as a build-arg ONLY when the
# application has "Include Source Commit in Build" enabled in its General
# settings. With that toggle on, every deploy gets a unique Sentry release;
# with it off, all of these resolve to empty and the downstream
# `|| 'development'` chain in apps/admin/src/lib/sentry/sentry.config.ts
# takes over.
# See https://coolify.io/docs/applications/build-packs/dockerfile
# (SOURCE_COMMIT section) for the rationale on why the toggle is off by
# default (Docker build cache invalidation on every commit).
ARG SOURCE_COMMIT
ARG HOSPEDA_GIT_SHA=${SOURCE_COMMIT}
ARG VITE_SENTRY_RELEASE=${HOSPEDA_GIT_SHA}
ENV HOSPEDA_API_URL=$HOSPEDA_API_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_BETTER_AUTH_URL=$VITE_BETTER_AUTH_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_POSTHOG_KEY=$VITE_POSTHOG_KEY \
    VITE_POSTHOG_HOST=$VITE_POSTHOG_HOST \
    HOSPEDA_GIT_SHA=$HOSPEDA_GIT_SHA \
    NITRO_PRESET=node-server
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY patches ./patches
COPY apps apps
COPY packages packages
RUN pnpm install --frozen-lockfile
# --concurrency=1 builds workspace packages sequentially. The Coolify VPS has
# 3.8 GB of RAM shared with the running prod/staging containers; parallel tsup
# DTS builds (4 at a time, each loading the full type graph) caused enough
# memory pressure on 2026-06-06 to kill the deploy's control channel (exit 255
# mid-build with no compiler error, right at @repo/schemas DTS). Sequential
# builds are slower but keep the peak well under the box's headroom.
RUN echo "[build] Sentry release: ${VITE_SENTRY_RELEASE:-(empty, falling back to 'development' in code)}" && \
    pnpm turbo run build --filter=admin --concurrency=1

# ----- runner stage ----------------------------------------------------------
# Nitro's node-server preset bundles its own runtime deps inside .output/,
# so we don't need to copy node_modules here.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
# curl is required for Coolify/Traefik healthcheck probes inside the container.
RUN apk add --no-cache curl
COPY --chown=node:node --from=build /repo/apps/admin/.output ./.output
USER node
EXPOSE 3000
# Probe the cheap /healthz server-entry route (SPEC-209), NOT `GET /`. Probing `/`
# server-renders the whole React root on every 30s probe, constructing a fresh
# QZPayBilling instance per request — the memory leak this spec fixes. /healthz
# returns a tiny JSON body without touching React SSR or billing.
#
# OPERATOR NOTE: Coolify may ALSO define a healthcheck in the admin resource UI
# (Health Checks tab). That override takes precedence over this instruction at
# runtime — it MUST be repointed to /healthz too, or the container silently keeps
# probing `GET /` and the leak persists. See SPEC-209 T-003 / risk table.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:3000/healthz || exit 1
CMD ["node", ".output/server/index.mjs"]
