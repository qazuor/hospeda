# syntax=docker/dockerfile:1.4
# Multi-stage build for hospeda-api.
# Built and run by Coolify on the VPS.

FROM node:22-alpine AS base
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ----- build stage -----------------------------------------------------------
# Install workspace deps, run the turbo build, and prune to a self-contained
# /prod/api in a single stage so we never duplicate the ~4 GB monorepo
# node_modules tree on the build host's disk. Previously this was split into
# `deps` + `build` + `pruned`, and the two intermediate `COPY --from=...
# /repo /repo` steps tripled the working set to ~12 GB, which exhausted disk
# on the Coolify VPS during the staging deploys on 2026-05-19 (exit code 255
# mid-build). The admin Dockerfile already uses this single-stage pattern;
# the api now matches.
#
# Docker still caches the install layer separately as long as the lockfile
# + workspace trees don't change.
#
# Full-tree COPY of apps/ and packages/ is intentional: listing every
# workspace package.json individually was tried first but missed transitive
# workspace deps (e.g. @repo/icons pulled in via @repo/feedback). This
# trades a bit of layer cache for correctness.
#
# HOSPEDA_SENTRY_RELEASE chain: SOURCE_COMMIT is auto-injected by Coolify
# as a build-arg when "Include Source Commit in Build" is enabled in the
# application's General settings. The api reads HOSPEDA_SENTRY_RELEASE at
# runtime via process.env (apps/api/src/lib/sentry.ts), so we propagate the
# resolved value to the runner stage via ENV.
FROM base AS build
ARG SOURCE_COMMIT
ARG HOSPEDA_GIT_SHA=${SOURCE_COMMIT}
ARG HOSPEDA_SENTRY_RELEASE=${HOSPEDA_GIT_SHA}
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY patches ./patches
COPY apps apps
COPY packages packages
RUN pnpm install --frozen-lockfile
# --concurrency=1: sequential package builds to cap memory peak on the 3.8 GB
# Coolify VPS (see apps/admin/Dockerfile for the 2026-06-06 incident rationale).
RUN echo "[build] Sentry release: ${HOSPEDA_SENTRY_RELEASE:-(empty, falling back to 'development' in code)}" && \
    pnpm turbo run build --filter=hospeda-api --concurrency=1
# `pnpm deploy` resolves workspace deps as real packages and ships only prod
# deps into a self-contained directory at /prod/api. This is the critical
# layer that keeps the runner image small (avoids shipping playwright +
# browser binaries, vitest, biome, drizzle-kit, tsx, turbo, msw, sharp, and
# every other dev tool that bloated the previous image).
#
# Note: tsup bundles all `@repo/*` workspace packages into dist/index.cjs via
# `noExternal: [/@repo\/.*/]` in apps/api/tsup.config.ts, so the workspace
# packages copied into node_modules by pnpm deploy are technically dead weight
# at runtime. Kept for now to avoid surgery on package.json deps declarations
# — they're small compared to dev-deps and Turbo needs them declared to
# compute the build graph.
RUN pnpm deploy --filter=hospeda-api --prod /prod/api

# ----- runner stage ----------------------------------------------------------
# Self-contained app at /app — package.json + dist/ + node_modules with only
# the prod deps the bundle still requires at runtime (the `external` list in
# tsup.config.ts: @sentry/profiling-node, cloudinary, file-type, image-size,
# react, react-dom, @react-email/*, resend, ioredis, node-cron).
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Propagate the resolved Sentry release / git SHA so process.env sees them at
# Node startup (apps/api/src/lib/sentry.ts reads both). They are not in the
# runtime container env unless we explicitly forward them from the build args.
ARG HOSPEDA_SENTRY_RELEASE
ARG HOSPEDA_GIT_SHA
ENV HOSPEDA_SENTRY_RELEASE=$HOSPEDA_SENTRY_RELEASE \
    HOSPEDA_GIT_SHA=$HOSPEDA_GIT_SHA
# curl is required for Coolify/Traefik healthcheck probes inside the container.
RUN apk add --no-cache curl
COPY --chown=node:node --from=build /prod/api ./
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
