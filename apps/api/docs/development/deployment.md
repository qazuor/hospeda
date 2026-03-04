# API Deployment Guide - Vercel

Complete guide for deploying the Hospeda Hono API to Vercel serverless.

**Last Updated**: 2026-03-01
**Target Platform**: Vercel (serverless functions)
**Framework**: Hono (Node.js) via `@hono/node-server` + Vercel adapter
**Version**: 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Vercel Configuration](#vercel-configuration)
4. [Environment Variables](#environment-variables)
5. [Deployment Process](#deployment-process)
6. [Monitoring and Logs](#monitoring-and-logs)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

---

## Overview

### Architecture

```text
+--------------+
|   Client     | (Web/Admin Apps on Vercel)
+------+-------+
       | HTTPS
       v
+-------------------------+
|  Vercel Edge Network    | (Global CDN + SSL termination)
+------------+------------+
             |
             v
+-------------------------+
|  Vercel Serverless Fn   | (Hono app - Node.js runtime)
|  apps/api/              |
+------------+------------+
             |
             +---> Neon PostgreSQL (Database)
             +---> Better Auth (Authentication)
             +---> Mercado Pago (Payments)
             +---> Sentry (Error Tracking)
```

### Key Specifications

- **Runtime**: Node.js 20.x
- **Entry point**: `apps/api/api/index.ts` (Vercel handler)
- **Health Check**: `GET /health` (call manually or via uptime monitor)
- **Max function duration**: configurable in `vercel.json` (default 10s Hobby, 60s Pro)
- **Memory**: configurable in `vercel.json` (default 1024MB)

---

## Prerequisites

### Required Accounts

- **Vercel**: [vercel.com](https://vercel.com) - linked to the GitHub repository
- **Neon**: PostgreSQL database (serverless-compatible pooled connection string)
- **Sentry**: Error tracking project `hospeda-api`

### Required Tools

```bash
# Vercel CLI
npm install -g vercel

# Verify login
vercel whoami
```

---

## Vercel Configuration

The API is configured via `apps/api/vercel.json`. Key settings:

```json
{
  "version": 2,
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=api",
  "outputDirectory": "dist",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": null,
  "nodeVersion": "20"
}
```

The monorepo root `turbo.json` coordinates the build pipeline so that workspace packages
(`@repo/schemas`, `@repo/service-core`, etc.) are built before the API.

---

## Environment Variables

Set all variables in **Vercel Project Settings > Environment Variables** for the `api` project.
Target the appropriate environments (Production, Preview, Development).

### Required Variables

```bash
# Database (use Neon pooled connection string for serverless)
HOSPEDA_DATABASE_URL=postgresql://user:pass@ep-xxx.pooler.neon.tech/hospeda?sslmode=require

# Authentication (Better Auth)
HOSPEDA_BETTER_AUTH_SECRET=<min-32-char-secret>
HOSPEDA_BETTER_AUTH_URL=https://api.hospeda.com.ar

# CORS
API_CORS_ORIGINS=https://hospeda.com.ar,https://www.hospeda.com.ar,https://admin.hospeda.com.ar
API_CORS_ALLOW_CREDENTIALS=true

# Rate limiting (trust Vercel proxy headers)
API_RATE_LIMIT_TRUST_PROXY=true

# Sentry
SENTRY_DSN=https://xxx@o4508855548313600.ingest.us.sentry.io/xxx
SENTRY_ENVIRONMENT=production
```

### Setting Variables via CLI

```bash
# Add a single variable interactively
vercel env add HOSPEDA_DATABASE_URL production

# Pull current variables to .env.local for local dev
vercel env pull .env.local
```

---

## Deployment Process

### Automatic (CI/CD)

The GitHub Actions workflow (`.github/workflows/ci.yml`) triggers on pushes to `main` and
automatically deploys to Vercel via the Vercel GitHub integration.

### Manual Deployment

```bash
# Deploy to production
vercel --prod

# Deploy preview (non-production)
vercel

# Check deployment status
vercel ls
```

### Build Verification

```bash
# Build locally before deploying
cd /path/to/hospeda
pnpm turbo run build --filter=api

# Verify the output
ls apps/api/dist/
```

---

## Monitoring and Logs

### Vercel Dashboard

- **Deployments**: [vercel.com/dashboard](https://vercel.com/dashboard) > hospeda-api
- **Function logs**: Deployment > Functions tab
- **Analytics**: Vercel Analytics for request volume and performance

### Vercel CLI

```bash
# View logs for the latest production deployment
vercel logs --prod

# Stream logs in real time
vercel logs <deployment-url> --follow
```

### Health Check

There is no automatic health check polling on Vercel serverless. Set up an external uptime
monitor (e.g. UptimeRobot, Better Uptime) pointing to:

```
GET https://api.hospeda.com.ar/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-01T12:00:00.000Z",
  "version": "1.0.0",
  "database": "connected"
}
```

### Sentry

All API errors are reported to Sentry project `hospeda-api`. See
`docs/monitoring-troubleshooting.md` for Sentry dashboard links and alert configuration.

---

## Troubleshooting

### Function Fails to Start

**Symptoms**: 500 errors immediately after deploy

1. **Missing env variable** - Check Vercel Project Settings > Environment Variables
2. **Database unreachable** - Verify Neon pooled connection string (not direct connection)
3. **Bundle too large** - Run `vercel build` locally to inspect output size (max 50MB compressed)

### Function Timeouts

**Symptoms**: Requests return 504 after 10-60 seconds

1. Identify slow queries via Sentry Performance or Neon dashboard
2. Increase `maxDuration` in `apps/api/vercel.json` if legitimately needed:

   ```json
   { "functions": { "api/index.ts": { "maxDuration": 30 } } }
   ```

### CORS Errors

**Symptoms**: Browser console shows CORS blocked

1. Verify `API_CORS_ORIGINS` includes the exact frontend URL (scheme + domain, no trailing slash)
2. Verify `API_CORS_ALLOW_CREDENTIALS=true`
3. See `apps/api/docs/cors-configuration.md` for full CORS reference

### Cold Start Latency

Vercel serverless functions may have cold starts of 200-800ms on first invocation.

- Minimize top-level `await` and heavy initialization in module scope
- Use Vercel's Edge Runtime only if the API does not require Node.js APIs (currently not used)
- Consider warming strategies for latency-sensitive endpoints

---

## Rollback Procedures

### Via Vercel Dashboard

1. Open the Vercel dashboard for `hospeda-api`
2. Go to **Deployments** tab
3. Find the last known-good deployment
4. Click **...** > **Promote to Production**

### Via CLI

```bash
# List recent deployments
vercel ls hospeda-api

# Promote a specific deployment to production
vercel promote <deployment-url>
```

---

## Key File References

| File | Purpose |
|------|---------|
| `apps/api/vercel.json` | Vercel deployment configuration |
| `apps/api/api/index.ts` | Vercel function entry point (Hono handler) |
| `apps/api/src/index.ts` | API server entry point (used for local dev) |
| `apps/api/docs/cors-configuration.md` | CORS environment variables reference |
| `.github/workflows/ci.yml` | CI/CD pipeline triggering Vercel deploy |

---

Back to [Development Guide](README.md)
