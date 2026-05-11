# syntax=docker/dockerfile:1.4
# Multi-stage build for hospeda-landing (Astro static + nginx).
# Built and run by Coolify on the VPS. Pure static output, served by nginx.

FROM node:22-alpine AS base
WORKDIR /repo
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ----- deps stage ------------------------------------------------------------
# Install ALL workspace deps. The landing app has minimal runtime deps but
# pnpm needs the whole workspace to resolve symlinks.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY patches ./patches
COPY apps apps
COPY packages packages
RUN pnpm install --frozen-lockfile

# ----- build stage -----------------------------------------------------------
# Astro static build. The site URL is baked into canonical/OG tags at build
# time; Coolify injects HOSPEDA_LANDING_SITE_URL via --build-arg.
FROM base AS build
ARG HOSPEDA_LANDING_SITE_URL=https://hospeda.com.ar
ENV HOSPEDA_LANDING_SITE_URL=$HOSPEDA_LANDING_SITE_URL
COPY --from=deps /repo /repo
RUN pnpm turbo run build --filter=hospeda-landing

# ----- runner stage ----------------------------------------------------------
# nginx alpine serves the static output. Tiny image (~25 MB) compared to a
# Node runtime. Healthcheck via curl on / for Coolify/Traefik probes.
FROM nginx:1.27-alpine AS runner
RUN apk add --no-cache curl
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1/ > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
