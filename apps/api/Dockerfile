# syntax=docker/dockerfile:1.4
# Multi-stage build for hospeda-api.
# Built and run by Coolify on the VPS.

FROM node:22-alpine AS base
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ----- deps stage ------------------------------------------------------------
# Install ALL workspace deps. We copy the entire `packages/` and `apps/` trees
# (not just package.json files) so pnpm has every workspace member visible at
# install time and creates each per-package node_modules. Listing every
# package.json individually was tried first but missed transitive workspace
# deps (e.g. @repo/icons pulled in via @repo/feedback). This trades a bit of
# layer cache for correctness.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY patches ./patches
COPY apps apps
COPY packages packages
RUN pnpm install --frozen-lockfile

# ----- build stage -----------------------------------------------------------
FROM base AS build
COPY --from=deps /repo /repo
RUN pnpm turbo run build --filter=hospeda-api

# ----- prune stage -----------------------------------------------------------
# `pnpm deploy` resolves workspace deps as real packages and ships only prod
# deps into a self-contained directory at /prod/api. This is the critical
# layer that keeps the runner image small.
#
# Why we need this: copying the full monorepo node_modules into the runner
# (the previous approach) shipped ~1748 packages including playwright + browser
# binaries, vitest, biome, drizzle-kit, tsx, turbo, msw, sharp, and every dev
# tool. That exhausted disk/RAM on the Coolify build host and broke the
# staging deploy on 2026-05-19.
#
# Note: tsup bundles all `@repo/*` workspace packages into dist/index.cjs via
# `noExternal: [/@repo\/.*/]` in apps/api/tsup.config.ts, so the workspace
# packages copied into node_modules by pnpm deploy are technically dead weight
# at runtime. Kept for now to avoid surgery on package.json deps declarations
# — they're small compared to dev-deps and Turbo needs them declared to
# compute the build graph.
FROM base AS pruned
COPY --from=build /repo /repo
RUN pnpm deploy --filter=hospeda-api --prod /prod/api

# ----- runner stage ----------------------------------------------------------
# Self-contained app at /app — package.json + dist/ + node_modules with only
# the prod deps the bundle still requires at runtime (the `external` list in
# tsup.config.ts: @sentry/profiling-node, cloudinary, file-type, image-size,
# react, react-dom, @react-email/*, resend, ioredis, node-cron).
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# curl is required for Coolify/Traefik healthcheck probes inside the container.
RUN apk add --no-cache curl
COPY --from=pruned /prod/api ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
