# syntax=docker/dockerfile:1.4
# Multi-stage build for admin (TanStack Start, Nitro node-server preset).
# Preset is selected by the NITRO_PRESET=node-server env var.

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
# Vite bakes VITE_*/HOSPEDA_API_URL into the admin bundle at build time.
# Coolify injects the real values via --build-arg from the project's
# build-time env config. The defaults are placeholders so local
# `docker build` validation passes the Zod check; real values override.
FROM base AS build
ARG HOSPEDA_API_URL=https://api.placeholder.local
ARG VITE_API_URL=https://api.placeholder.local
ARG VITE_SITE_URL=https://placeholder.local
ARG VITE_BETTER_AUTH_URL=https://api.placeholder.local/api/auth
ARG VITE_SENTRY_RELEASE
ARG HOSPEDA_GIT_SHA
ENV HOSPEDA_API_URL=$HOSPEDA_API_URL \
    VITE_API_URL=$VITE_API_URL \
    VITE_SITE_URL=$VITE_SITE_URL \
    VITE_BETTER_AUTH_URL=$VITE_BETTER_AUTH_URL \
    VITE_SENTRY_RELEASE=$VITE_SENTRY_RELEASE \
    HOSPEDA_GIT_SHA=$HOSPEDA_GIT_SHA \
    NITRO_PRESET=node-server
COPY --from=deps /repo /repo
RUN pnpm turbo run build --filter=admin

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
COPY --from=build /repo/apps/admin/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
