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

# ----- runner stage ----------------------------------------------------------
# Preserve the monorepo directory layout (/repo/...) so pnpm's relative
# symlinks (e.g. apps/api/node_modules/X -> ../../node_modules/.pnpm/X@.../...)
# resolve correctly at runtime. Flattening into a single /app dir would break
# any direct dep of the app whose symlink lives in apps/api/node_modules.
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
# curl is required for Coolify/Traefik healthcheck probes inside the container.
RUN apk add --no-cache curl
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
