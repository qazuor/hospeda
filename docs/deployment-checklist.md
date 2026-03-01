# Deployment Checklist

Comprehensive deployment checklist for the Hospeda monorepo. Covers all three applications: API (Vercel), Web (Vercel), and Admin (Vercel).

**Last Updated**: 2026-02-28

---

## Table of Contents

1. [Pre-Deployment Checks](#pre-deployment-checks)
2. [API Deployment (Vercel)](#api-deployment-vercel)
3. [Web Deployment (Vercel)](#web-deployment-vercel)
4. [Admin Deployment (Vercel)](#admin-deployment-vercel)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [CI/CD Pipeline Reference](#cicd-pipeline-reference)

---

## Pre-Deployment Checks

### Code Quality

- [ ] All tests pass: `pnpm test`
- [ ] TypeScript compiles without errors: `pnpm typecheck`
- [ ] Biome linting passes: `pnpm lint`
- [ ] Build succeeds locally: `pnpm build`
- [ ] No `any` types in codebase (TypeScript strict mode enforced)

### Environment Variables and Secrets

- [ ] All required env vars are set in Vercel for the API app:
  - `HOSPEDA_DATABASE_URL` .. PostgreSQL connection string (Neon pooler URL)
  - `HOSPEDA_BETTER_AUTH_SECRET` .. Better Auth JWT secret
  - `HOSPEDA_API_URL` .. Public API URL
  - `HOSPEDA_SITE_URL` .. Public web URL
  - `HOSPEDA_ADMIN_URL` .. Admin panel URL
  - `CRON_SECRET` .. Secret for Vercel Cron authentication
  - `SENTRY_DSN` .. Sentry error tracking DSN
- [ ] All required env vars are set in Vercel for Web app:
  - `PUBLIC_API_URL`
  - `PUBLIC_SITE_URL`
  - Sentry DSN (`PUBLIC_SENTRY_DSN`)
- [ ] All required env vars are set in Vercel for Admin app:
  - `VITE_SENTRY_DSN`
  - API URL configuration
- [ ] GitHub Actions secrets are configured:
  - `VERCEL_TOKEN` .. Vercel deployment token
  - `VERCEL_ORG_ID` .. Vercel organization ID
  - `VERCEL_PROJECT_ID_API` .. Vercel project ID for the API app
  - `VERCEL_PROJECT_ID_WEB` .. Vercel project ID for web app
  - `VERCEL_PROJECT_ID_ADMIN` .. Vercel project ID for admin app

### Database

- [ ] Database migrations are up to date: `pnpm db:migrate`
- [ ] Migration files are committed and pushed
- [ ] No pending schema changes: `pnpm db:generate` produces no new files
- [ ] Database backup is recent (check Neon dashboard or run manual backup)
- [ ] Connection string points to correct environment (staging vs production)

### Dependencies

- [ ] `pnpm-lock.yaml` is up to date and committed
- [ ] No security vulnerabilities in critical dependencies
- [ ] All workspace packages build successfully: `pnpm build`

---

## API Deployment (Vercel)

### Configuration Reference (`apps/api/vercel.json`)

| Setting | Value |
|---------|-------|
| Framework | `null` (Hono serverless) |
| Build command | `cd ../.. && pnpm turbo run build --filter=hospeda-api` |
| Output directory | `dist` |
| Install command | `pnpm install --frozen-lockfile` |
| Node version | `20` |
| Function max duration | `30s` |
| Function memory | `512MB` |

### Serverless Considerations

- DB pool defaults to **3 connections** (Neon pooler limit per serverless instance)
- Body size limit is **4.5MB** (Vercel payload limit)
- LRU user cache is **disabled** (ephemeral instances)
- Sentry profiling is **disabled** (native bindings unsupported)
- Rate limiter uses in-memory Map (per-instance, best-effort)

### Cron Jobs (Vercel Cron)

Defined in `apps/api/vercel.json`. Vercel sends `POST` requests with `CRON_SECRET` header.

| Job | Schedule | Description |
|-----|----------|-------------|
| `trial-expiry` | `0 2 * * *` | Expire trials daily at 2 AM UTC |
| `addon-expiry` | `0 5 * * *` | Expire add-ons daily at 5 AM UTC |
| `notification-schedule` | `0 8 * * *` | Schedule notifications daily at 8 AM UTC |
| `webhook-retry` | `0 */1 * * *` | Retry failed webhooks every hour |
| `exchange-rate-fetch` | `*/15 * * * *` | Fetch exchange rates every 15 minutes |

### Deploy Phase

- [ ] **Staging**: Push to `staging` branch triggers preview deployment
- [ ] **Production**: Push to `main` branch triggers production deployment (`--prod` flag)
- [ ] Verify deployment URL is accessible
- [ ] Manually test health endpoint: `curl https://<api-domain>/health`

---

## Web Deployment (Vercel)

### Configuration Reference (`apps/web/vercel.json`)

| Setting | Value |
|---------|-------|
| Framework | `astro` |
| Build command | `cd ../.. && pnpm turbo run build --filter=web` |
| Output directory | `dist` |
| Install command | `pnpm install --frozen-lockfile` |
| Node version | `20` |

### Security Headers (automatic via `vercel.json`)

All responses include:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

Auth and account pages (`/[lang]/auth/*`, `/[lang]/mi-cuenta/*`) include `X-Robots-Tag: noindex, nofollow`.

### Deploy Phase

- [ ] **Staging**: Push to `staging` branch triggers preview deployment (no `--prod` flag)
- [ ] **Production**: Push to `main` branch triggers production deployment (`--prod` flag)
- [ ] Verify deployment URL is accessible
- [ ] Verify SSR is working (check dynamic content renders)

### DNS and Domain

- [ ] Custom domain is configured in Vercel dashboard
- [ ] SSL certificate is valid and auto-renewed
- [ ] DNS records point to Vercel

---

## Admin Deployment (Vercel)

### Configuration Reference (`apps/admin/vercel.json`)

| Setting | Value |
|---------|-------|
| Framework | `null` (TanStack Start) |
| Build command | `cd ../.. && pnpm turbo run build --filter=admin` |
| Output directory | `.output/public` |
| Install command | `pnpm install --frozen-lockfile` |
| Node version | `20` |

### Security Headers (automatic via `vercel.json`)

Same security headers as the Web app. Additionally, static assets under `/assets/*` get:

- `Cache-Control: public, max-age=31536000, immutable`

### Deploy Phase

- [ ] **Staging**: Push to `staging` branch triggers preview deployment
- [ ] **Production**: Push to `main` branch triggers production deployment (`--prod` flag)
- [ ] Verify admin dashboard loads
- [ ] Verify authentication flow works (Better Auth)
- [ ] Verify API connectivity from admin panel

---

## Post-Deployment Verification

### Smoke Tests

- [ ] **API**: `GET /health` returns 200 with healthy status
- [ ] **API**: `GET /api/v1/public/accommodations` returns data
- [ ] **API**: Authentication endpoints respond correctly
- [ ] **Web**: Homepage loads (`/es/`)
- [ ] **Web**: Accommodation listing page loads (`/es/alojamientos/`)
- [ ] **Web**: Destination listing page loads (`/es/destinos/`)
- [ ] **Web**: i18n works (switch between `/es/`, `/en/`, `/pt/`)
- [ ] **Admin**: Login page loads
- [ ] **Admin**: Dashboard loads after authentication
- [ ] **Admin**: Can list entities (accommodations, users, etc.)

### Monitoring Verification

- [ ] Sentry is receiving events (check [qazuor.sentry.io](https://qazuor.sentry.io))
  - API project: `hospeda-api`
  - Web project: `hospeda-web`
  - Admin project: `hospeda-admin`
- [ ] Vercel function metrics show healthy invocation times
- [ ] Vercel analytics are recording page views
- [ ] No elevated error rates in any app

### Database Verification

- [ ] Migrations applied successfully
- [ ] Database connections are stable (check pool usage)
- [ ] No slow queries in monitoring

---

## Rollback Procedures

### API/Web/Admin Rollback (Vercel)

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback

# Rollback to specific deployment URL
vercel rollback <deployment-url>
```

Alternatively, use the Vercel dashboard to promote a previous deployment to production.

### Database Migration Rollback

```bash
# Rollback last migration
pnpm db:rollback

# For emergencies, restore from Neon point-in-time recovery
# Access Neon dashboard and select recovery point
```

### Emergency Rollback Checklist

- [ ] Identify the issue (check Sentry, Fly.io logs, Vercel logs)
- [ ] Determine which app(s) need rollback
- [ ] Roll back the affected app(s) using commands above
- [ ] If database migration caused the issue, roll back migration first, then app
- [ ] Verify health checks pass after rollback
- [ ] Notify the team about the rollback and root cause
- [ ] Create a post-mortem document

---

## CI/CD Pipeline Reference

### Staging Pipeline (`.github/workflows/cd-staging.yml`)

**Trigger**: Push to `staging` branch

**Flow**:

1. **Quality Check** (CI job) .. runs linting, typecheck, tests
2. **Deploy API** .. deploys to Vercel (preview mode)
3. **Deploy Web** .. deploys to Vercel (preview mode)
4. **Deploy Admin** .. deploys to Vercel (preview mode)

**Concurrency**: `staging-deploy` group, cancel-in-progress enabled.

### Production Pipeline (`.github/workflows/cd-production.yml`)

**Trigger**: Push to `main` branch

**Flow**:

1. **Quality Check** (CI job) .. same as staging
2. **Deploy API** .. deploys to Vercel with `--prod` flag
3. **Deploy Web** .. deploys to Vercel with `--prod` flag
4. **Deploy Admin** .. deploys to Vercel with `--prod` flag

**Concurrency**: `production-deploy` group, cancel-in-progress **disabled** (never cancel a production deploy mid-flight).

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel organization identifier |
| `VERCEL_PROJECT_ID_API` | Vercel project ID for the API app |
| `VERCEL_PROJECT_ID_WEB` | Vercel project ID for the web app |
| `VERCEL_PROJECT_ID_ADMIN` | Vercel project ID for the admin app |

### GitHub Actions Used

| Action | Version | Purpose |
|--------|---------|---------|
| `actions/checkout` | `v4` | Clone repository |
| `actions/setup-node` | `v4` | Install Node.js 20 |
| `pnpm/action-setup` | `v4` | Install pnpm |
| `amondnet/vercel-action` | `v25` | Deploy to Vercel |

---

## Quick Reference: Deployment Commands

```bash
# Full manual deployment (all apps)
pnpm install --frozen-lockfile
pnpm build

# Vercel deployment (usually handled by CI/CD)
# API: vercel --prod (from apps/api/)
# Web: vercel --prod (from apps/web/)
# Admin: vercel --prod (from apps/admin/)

# List Vercel deployments
vercel ls

# Rollback to previous deployment
vercel rollback
```
