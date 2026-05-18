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
ARG PUBLIC_SENTRY_RELEASE
ARG PUBLIC_SENTRY_ENVIRONMENT
ARG HOSPEDA_GIT_SHA
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
RUN pnpm turbo run build --filter=hospeda-web

# ----- runner stage ----------------------------------------------------------
# Preserve the monorepo directory layout (/repo/...) so pnpm's relative
# symlinks resolve at runtime. See apps/api/Dockerfile runner stage for full
# rationale. Astro Node standalone still expects workspace deps to be
# resolvable from apps/web/node_modules, hence the full layout copy.
FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
# curl is required for Coolify/Traefik healthcheck probes inside the container.
RUN apk add --no-cache curl
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/web ./apps/web
WORKDIR /repo/apps/web
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
