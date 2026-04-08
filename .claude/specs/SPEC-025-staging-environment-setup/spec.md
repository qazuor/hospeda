---
spec-id: SPEC-025
title: Staging Environment Setup & Deployment Pipeline
type: infrastructure
complexity: high
status: draft
created: 2026-03-02T00:00:00.000Z
approved: 2026-03-08T00:00:00.000Z
---

## SPEC-025: Staging Environment Setup & Deployment Pipeline

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Configure a fully functional staging environment for the Hospeda platform that enables end-to-end testing of all three applications (API, Web, Admin) with real external services (Neon PostgreSQL, MercadoPago sandbox, Upstash Redis, Sentry) before deploying to production. This includes creating the `staging` branch, configuring all required GitHub secrets and Vercel environment variables, updating documentation, and validating the complete deployment pipeline.

#### Motivation

The Hospeda platform has mature CI/CD workflows (`cd-staging.yml`, `cd-production.yml`) and Vercel configs for all three apps, but no staging environment has ever been activated. The `staging` branch does not exist, GitHub secrets for Vercel deployment are not configured, and critical env vars for billing (MercadoPago), notifications (Resend), and caching (Redis) are missing from the staging Vercel projects. Without a working staging environment, the manual QA required by SPEC-021 T-038 (billing flows) and general pre-production validation cannot be performed.

Additionally, `SECRETS.md` only documents 4 of the ~15 required secrets, which will cause confusion during onboarding and deployment.

#### Success Metrics

- A `staging` branch exists and pushing to it triggers automated deployment of all 3 apps via `cd-staging.yml`
- All 3 Vercel projects (API, Web, Admin) exist and are linked to the GitHub repository
- API staging deployment serves `GET /health` with 200 OK
- Web staging deployment renders the homepage at `/{lang}/`
- Admin staging deployment loads the login page and authentication works
- MercadoPago sandbox payments work end-to-end on staging (create subscription, webhook callback)
- Cron jobs execute on schedule (trial-expiry, addon-expiry, notification-schedule, webhook-retry, exchange-rate-fetch, dunning)
- Sentry receives error events from all 3 apps on staging, tagged with `environment: production` and custom tag `deployment: staging`
- `SECRETS.md` documents ALL required secrets for CI and CD
- Database migrations run successfully on staging Neon database
- Redis connects on staging (required for rate limiting in production mode)

#### Target Users

- **Platform engineers** deploying the applications
- **QA engineers** testing billing flows on staging
- **Developers** validating features before production merge

---

### 2. User Stories & Acceptance Criteria

#### US-01: Staging Branch and Deployment Trigger

**As a** developer finishing a feature,
**I want** to push my code to a `staging` branch and have it automatically deploy to staging URLs,
**so that** I can validate the feature in a production-like environment before merging to `main`.

**Acceptance Criteria:**

- **Given** the `staging` branch exists,
  **When** I push a commit to it,
  **Then** GitHub Actions triggers `cd-staging.yml`, which invokes `ci.yml` as a reusable workflow (lint, typecheck, tests), then deploys all 3 apps to Vercel preview URLs.

- **Given** CI checks fail (lint, typecheck, or tests),
  **When** the staging pipeline runs,
  **Then** deployment is skipped and the developer is notified of the failure via GitHub Actions notification.

- **Given** I want to update staging with the latest code,
  **When** I merge `main` into `staging` (or rebase `staging` on `main`),
  **Then** pushing the result triggers a new deployment.

**Technical Note:** `ci.yml` is triggered by `push: [main]` and `pull_request: [main]`, but `cd-staging.yml` invokes it via `uses: ./.github/workflows/ci.yml` which works as a reusable workflow call and does NOT require `ci.yml` to have `staging` in its trigger branches. No changes to `ci.yml` are needed.

---

#### US-02: Vercel Project Configuration

**As a** platform engineer,
**I want** all 3 Vercel projects (API, Web, Admin) to be properly configured with environment variables,
**so that** deployments work without manual intervention.

**Acceptance Criteria:**

- **Given** the API Vercel project exists with all required env vars,
  **When** a staging deployment completes,
  **Then** the API serves `GET /health` with `{"status":"ok"}` and all 6 cron jobs are registered in the Vercel dashboard.

- **Given** the Web Vercel project exists with `PUBLIC_API_URL` pointing to the staging API,
  **When** a staging deployment completes,
  **Then** the homepage renders correctly at `/es/` with SSR data from the staging API.

- **Given** the Admin Vercel project exists with `VITE_API_URL` and `VITE_BETTER_AUTH_URL` configured,
  **When** a staging deployment completes,
  **Then** the login page renders and authentication against the staging API works.

---

#### US-03: Billing System on Staging

**As a** QA engineer testing billing,
**I want** MercadoPago sandbox payments to work on staging,
**so that** I can test the complete trial -> payment -> subscription lifecycle.

**Acceptance Criteria:**

- **Given** `MERCADO_PAGO_ACCESS_TOKEN` is set to a `TEST-` sandbox token on staging,
  **When** I create a subscription via the API,
  **Then** MercadoPago sandbox processes the payment and sends a webhook callback to `{STAGING_API_URL}/api/v1/webhooks/mercadopago`.

- **Given** a trial is started for a new HOST user on staging,
  **When** 14 days pass (or the trial is manually expired via admin),
  **Then** the trial-expiry cron blocks the subscription and the user sees the grace period banner.

---

#### US-04: Database Migrations on Staging

**As a** developer with schema changes,
**I want** a documented process to run database migrations on the staging database,
**so that** schema changes are applied before deploying new code that depends on them.

**Acceptance Criteria:**

- **Given** a new migration file exists in `packages/db/src/migrations/`,
  **When** I run `HOSPEDA_DATABASE_URL="<staging-neon-url>" pnpm db:migrate`,
  **Then** the migration is applied to the staging database without affecting production.

- **Given** the staging database is empty,
  **When** I run the staging DB setup script,
  **Then** all migrations are applied and seed data is loaded.

---

#### US-05: Monitoring on Staging

**As a** platform engineer,
**I want** Sentry to capture errors from all 3 apps on staging,
**so that** I can debug issues in a production-like environment.

**Acceptance Criteria:**

- **Given** Sentry DSNs are configured for staging,
  **When** an unhandled error occurs in any of the 3 apps,
  **Then** the error appears in the Sentry dashboard. Since staging uses `NODE_ENV=production`, the Sentry `environment` tag will be `production`. Use the custom tag `deployment: staging` (configured via `SENTRY_ENVIRONMENT=staging` or equivalent) to distinguish from real production errors.

**Important:** See Section 4.1 for the `NODE_ENV` decision and how Sentry environment tagging works.

---

#### US-06: Documentation Completeness

**As a** new developer onboarding to the project,
**I want** complete and accurate documentation of all secrets and environment variables,
**so that** I can set up my development environment and understand the deployment pipeline without guessing.

**Acceptance Criteria:**

- **Given** `SECRETS.md` is updated,
  **When** I read it,
  **Then** it documents ALL secrets required for CI (build) and CD (deployment), including Vercel tokens, Vercel project IDs, billing keys, cron secrets, Redis, Resend, and Sentry DSNs.

- **Given** the root `.env.example` is updated,
  **When** I read it,
  **Then** it contains `HOSPEDA_ADMIN_URL` with a comment explaining its purpose (used in API CORS configuration).

---

### 3. Scope

#### In Scope

- Create and configure the `staging` branch
- Document complete Vercel project setup steps (3 projects) with step-by-step instructions
- Document and validate all GitHub secrets and environments
- Update `SECRETS.md` with complete secret inventory (currently only documents 4 of ~15)
- Add `HOSPEDA_ADMIN_URL` to root `.env.example`
- Add `SENTRY_ENVIRONMENT` to root `.env.example` and API env schema
- Create a staging database migration runbook
- Validate cron job registration on Vercel staging
- Configure webhook URLs for MercadoPago staging
- Create a staging smoke test script that validates deployment health
- Update `turbo.json` `globalEnv` with missing critical variables
- Document the Vercel Pro requirement for cron jobs

#### Out of Scope

- DNS and custom domain configuration (uses Vercel preview URLs for now)
- Production environment setup (separate effort after staging validation)
- Feature development (no new code features)
- Performance optimization
- Load testing infrastructure
- Social OAuth configuration (Google, Facebook) for staging

---

## Part 2 - Technical Analysis

### 4. Architecture Overview

The deployment architecture is:

```
GitHub (main branch)
  |
  +-- cd-production.yml --> Vercel (3 projects, --prod flag)
  |
GitHub (staging branch)
  |
  +-- cd-staging.yml --> ci.yml (reusable workflow) --> Vercel (3 projects, preview mode)
```

All 3 apps deploy to Vercel as serverless functions:

- **API** (`apps/api`): Hono on Vercel serverless via `dist/vercel.js`
- **Web** (`apps/web`): Astro SSR with `@astrojs/vercel` adapter
- **Admin** (`apps/admin`): TanStack Start, output to `.output/public`

External services per environment:

| Service | Development | Staging | Production |
|---------|------------|---------|------------|
| Database | Local PostgreSQL (Docker) | Neon (staging branch) | Neon (main branch) |
| Payments | MercadoPago sandbox | MercadoPago sandbox | MercadoPago production |
| Redis | Local Redis (Docker) | Upstash (free tier) | Upstash (paid tier) |
| Email | Resend (test mode) | Resend (test mode) | Resend (production) |
| Monitoring | None | Sentry (`SENTRY_ENVIRONMENT=staging`) | Sentry (`SENTRY_ENVIRONMENT=production`) |
| Auth | Better Auth (local DB) | Better Auth (staging Neon DB) | Better Auth (production Neon DB) |

#### 4.1. NODE_ENV Decision

**Problem:** All Zod environment schemas in the project (`apps/api/src/utils/env.ts`, `apps/web/src/env.ts`, `apps/admin/src/env.ts`) validate `NODE_ENV` as `z.enum(['development', 'production', 'test'])`. The value `staging` is NOT in any of them. Setting `NODE_ENV=staging` would **crash all 3 apps** at startup with a Zod validation error.

**Decision:** Use `NODE_ENV=production` for the staging environment. This is the industry standard (Next.js, Vercel, AWS all treat staging as production mode). To distinguish staging from real production, introduce a new variable `SENTRY_ENVIRONMENT`:

- `SENTRY_ENVIRONMENT=staging` .. used by Sentry for environment tagging
- `NODE_ENV=production` .. used by all app code, Zod schemas, and build tools

**Impact on existing code:**
- `apps/api/src/lib/sentry.ts` already reads `process.env.NODE_ENV` as default for `environment`. We need to modify it to prefer `SENTRY_ENVIRONMENT` over `NODE_ENV` (one-line change).
- `apps/api/src/utils/env.ts` superRefine requires `CRON_SECRET` and `HOSPEDA_REDIS_URL` when `NODE_ENV=production`. This means **Redis is REQUIRED** for staging, not optional.

**Code change required in `apps/api/src/lib/sentry.ts`:**
```typescript
// Before:
environment: process.env.NODE_ENV || 'development',

// After:
environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
```

**Code change required in `apps/api/src/utils/env.ts`:**
Add `SENTRY_ENVIRONMENT` to the schema:
```typescript
SENTRY_ENVIRONMENT: z.string().optional(),
```

### 5. Environment Variables Inventory

#### 5.1. API App - Complete Variable List for Staging

**REQUIRED (deployment will crash without these):**

| Variable | Value for Staging | Where to Set | Why Required |
|----------|------------------|--------------|--------------|
| `NODE_ENV` | `production` | Vercel env vars | Zod schema only allows development/production/test |
| `HOSPEDA_DATABASE_URL` | Neon staging pooler URL (see Section 9.2) | Vercel env vars | DB access |
| `HOSPEDA_BETTER_AUTH_SECRET` | Generate: `openssl rand -base64 32` | Vercel env vars | Auth session signing |
| `HOSPEDA_API_URL` | The staging API Vercel URL (e.g., `https://hospeda-api-staging.vercel.app`) | Vercel env vars | Self-reference, CORS, webhook URLs |
| `HOSPEDA_SITE_URL` | The staging Web Vercel URL (e.g., `https://hospeda-web-staging.vercel.app`) | Vercel env vars | CORS, auth redirects |
| `HOSPEDA_ADMIN_URL` | The staging Admin Vercel URL (e.g., `https://hospeda-admin-staging.vercel.app`) | Vercel env vars | CORS configuration |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` | Vercel env vars | Required when NODE_ENV=production (superRefine check) |
| `HOSPEDA_REDIS_URL` | Upstash Redis URL: `rediss://...` (see Section 9.3) | Vercel env vars | Required when NODE_ENV=production (superRefine check) |
| `API_CORS_ORIGINS` | `{HOSPEDA_SITE_URL},{HOSPEDA_ADMIN_URL}` (both staging URLs, comma-separated) | Vercel env vars | Allow cross-origin requests from web and admin |
| `API_RATE_LIMIT_TRUST_PROXY` | `true` | Vercel env vars | Behind Vercel reverse proxy, must read x-forwarded-for for real client IPs |

**REQUIRED for billing (without these, billing features are disabled but app runs):**

| Variable | Value for Staging | Where to Set | How to Obtain |
|----------|------------------|--------------|---------------|
| `MERCADO_PAGO_ACCESS_TOKEN` | `TEST-xxx` (sandbox token) | Vercel env vars | See Section 9.5 |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Webhook secret from MP dashboard | Vercel env vars | See Section 9.5 |
| `MERCADO_PAGO_SANDBOX` | `true` | Vercel env vars | Always true for staging |

**RECOMMENDED (features degrade without these):**

| Variable | Value for Staging | Where to Set | Impact if Missing |
|----------|------------------|--------------|-------------------|
| `SENTRY_DSN` | Sentry API project DSN | Vercel env vars | No error tracking for API |
| `SENTRY_ENVIRONMENT` | `staging` | Vercel env vars | Errors tagged as "production" instead of "staging" |
| `RESEND_API_KEY` | Resend API key (test mode) | Vercel env vars | No email notifications |
| `HOSPEDA_EXCHANGE_RATE_API_KEY` | ExchangeRate-API key | Vercel env vars | exchange-rate-fetch cron fails for ExchangeRate-API source (DolarAPI source still works) |

**Note:** `MERCADO_PAGO_*` and `RESEND_API_KEY` are NOT in the API Zod env schema (`ApiEnvSchema`). They are read directly by `@repo/billing` and the notification helper. The app will start without them but those features won't work.

#### 5.2. Web App - Complete Variable List for Staging

| Variable | Value for Staging | Where to Set | Required? |
|----------|------------------|--------------|-----------|
| `PUBLIC_API_URL` | Staging API URL (same as `HOSPEDA_API_URL`) | Vercel env vars | YES .. Zod refine requires either this or HOSPEDA_API_URL |
| `PUBLIC_SITE_URL` | Staging Web URL (same as `HOSPEDA_SITE_URL`) | Vercel env vars | YES .. Zod refine requires either this or HOSPEDA_SITE_URL |
| `PUBLIC_SENTRY_DSN` | Sentry web project DSN | Vercel env vars | No .. Sentry integration skipped if missing |
| `NODE_ENV` | `production` | Vercel env vars (auto-set by Vercel) | YES |

**Note:** `apps/web/astro.config.mjs` dynamically extracts the hostname from `HOSPEDA_API_URL`/`PUBLIC_API_URL` and adds it to `image.remotePatterns`. No manual image domain configuration is needed as long as the API URL is correctly set.

#### 5.3. Admin App - Complete Variable List for Staging

| Variable | Value for Staging | Where to Set | Required? |
|----------|------------------|--------------|-----------|
| `VITE_API_URL` | Staging API URL | Vercel env vars | YES .. no default, validation fails without it |
| `VITE_BETTER_AUTH_URL` | `{STAGING_API_URL}/api/auth` (e.g., `https://hospeda-api-staging.vercel.app/api/auth`) | Vercel env vars | YES .. no default, validation fails without it |
| `VITE_SENTRY_DSN` | Sentry admin project DSN | Vercel env vars | No .. optional in schema |
| `VITE_APP_NAME` | `Hospeda Admin (Staging)` | Vercel env vars | No .. defaults to "Hospeda Admin" |
| `NODE_ENV` | `production` | Vercel env vars (auto-set by Vercel) | YES |

**CRITICAL:** The previous spec omitted `VITE_BETTER_AUTH_URL`. Without this variable, the Admin app crashes at startup with `VITE_BETTER_AUTH_URL: Required` Zod error.

#### 5.4. GitHub Secrets (Repository Level)

These are used by `ci.yml` and by the deployment workflows:

| Secret | Purpose | Used By | How to Obtain |
|--------|---------|---------|---------------|
| `VERCEL_TOKEN` | Vercel API authentication | cd-staging.yml, cd-production.yml | Vercel dashboard > Settings > Tokens > Create |
| `VERCEL_ORG_ID` | Vercel organization identifier | cd-staging.yml, cd-production.yml | Vercel dashboard > Settings > General > "Vercel ID" |
| `VERCEL_PROJECT_ID_API` | API Vercel project ID | cd-staging.yml, cd-production.yml | See Section 9.1 step 7 |
| `VERCEL_PROJECT_ID_WEB` | Web Vercel project ID | cd-staging.yml, cd-production.yml | See Section 9.1 step 7 |
| `VERCEL_PROJECT_ID_ADMIN` | Admin Vercel project ID | cd-staging.yml, cd-production.yml | See Section 9.1 step 7 |
| `HOSPEDA_DATABASE_URL` | DB connection for CI test builds | ci.yml | Can use a test/dev Neon database or dummy URL for build-only |
| `HOSPEDA_BETTER_AUTH_SECRET` | Auth secret for CI builds | ci.yml | Any 32+ char string for CI |
| `HOSPEDA_API_URL` | API URL for CI builds | ci.yml | Can be `http://localhost:3001` for CI |
| `HOSPEDA_SITE_URL` | Site URL for CI builds | ci.yml | Can be `http://localhost:4321` for CI |

#### 5.5. GitHub Environments

| Environment | Branch Protection | Purpose |
|-------------|-------------------|---------|
| `staging` | `staging` branch only | Preview deployments, staging env vars |
| `production` | `main` branch only | Production deployments, production env vars |

**How to create GitHub Environments:**
1. Go to repository Settings > Environments
2. Click "New environment"
3. Name it `staging` (or `production`)
4. Under "Deployment branches", select "Selected branches" and add `staging` (or `main`)
5. Optionally add environment-specific secrets (not needed if using Vercel env vars for app config)

### 6. Files to Modify

| File | Change | Why |
|------|--------|-----|
| `.github/SECRETS.md` | Rewrite with complete secret inventory (see Section 5.4) | Currently only documents 4 of ~15 required secrets. Missing Vercel project IDs, CRON_SECRET, billing, Redis, Sentry, Resend |
| `.env.example` (root) | Add `HOSPEDA_ADMIN_URL` and `SENTRY_ENVIRONMENT` entries | `HOSPEDA_ADMIN_URL` used by API for CORS. `SENTRY_ENVIRONMENT` to distinguish staging from production |
| `apps/api/src/utils/env.ts` | Add `SENTRY_ENVIRONMENT: z.string().optional()` to `ApiEnvSchema` | New variable for Sentry environment tagging |
| `apps/api/src/lib/sentry.ts` | Change default environment to prefer `SENTRY_ENVIRONMENT` env var | Allow staging to report as "staging" in Sentry while using NODE_ENV=production |
| `turbo.json` | Add to `globalEnv`: `HOSPEDA_ADMIN_URL`, `HOSPEDA_REDIS_URL`, `CRON_SECRET`, `SENTRY_DSN`, `PUBLIC_SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_ENVIRONMENT` | Missing env vars can cause stale turbo cache when values change between environments |
| `docs/deployment-checklist.md` | Add staging-specific pre-deployment section referencing this spec | Currently generic, missing staging-specific checks |

### 7. New Files to Create

| File | Purpose | Detailed Spec |
|------|---------|---------------|
| `scripts/staging-smoke-test.sh` | Automated health check after staging deployment | See Section 10.1 |
| `scripts/staging-db-setup.sh` | Database migration + seed for staging | See Section 10.2 |

### 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Staging DB gets corrupted by seed/test data | Medium | Medium | Use Neon branching so staging can be reset from production snapshot. Document reset procedure |
| MercadoPago sandbox rate limits | Low | Low | Sandbox has generous limits. Only real risk is during automated load tests (out of scope) |
| Vercel cron job limits on free plan | High | High | Vercel free plan allows only 2 cron jobs. The API has 6 crons. **Vercel Pro plan ($20/mo) is required**. See Section 9.1 |
| Secrets accidentally committed | High | Low | Use Vercel env vars and GitHub secrets exclusively. Never put real secrets in `.env.example` files. All `.env.local` and `.env.sandbox` are in `.gitignore` |
| Staging URL changes on each deploy (Vercel preview) | Medium | High | Use Vercel CLI aliases or configure stable preview URLs via Vercel dashboard. Document how to find current staging URLs |
| Install command inconsistency in vercel.json | Low | Medium | `apps/api/vercel.json` uses `cd ../.. && pnpm install` while web/admin use `pnpm install`. Both work because Vercel sets the root directory per project config. No change needed but document this |

### 9. Detailed Setup Procedures

#### 9.1. Vercel Projects Setup (Step-by-Step)

**Prerequisites:**
- Vercel account (Pro plan required for 6 cron jobs, $20/month)
- GitHub repository linked to Vercel

**For EACH of the 3 apps (API, Web, Admin), repeat these steps:**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository" and select the `hospeda` repository
3. Set the **Project Name**:
   - API: `hospeda-api` (or `hospeda-api-staging`)
   - Web: `hospeda-web` (or `hospeda-web-staging`)
   - Admin: `hospeda-admin` (or `hospeda-admin-staging`)
4. Set the **Root Directory** (CRITICAL):
   - API: `apps/api`
   - Web: `apps/web`
   - Admin: `apps/admin`
5. Set **Framework Preset**:
   - API: `Other` (Hono is not a recognized framework)
   - Web: `Astro`
   - Admin: `Other` (TanStack Start is not a recognized framework)
6. Leave Build & Output settings as defaults (they come from each app's `vercel.json`)
7. Click "Deploy" (it will fail the first time because env vars are missing.. that's expected)
8. After creation, go to **Project Settings > General** and copy the **Project ID** (a long string like `prj_xxxxxxxxxxxx`). This is what you set as `VERCEL_PROJECT_ID_API` / `_WEB` / `_ADMIN` in GitHub secrets
9. Go to **Project Settings > Environment Variables** and add ALL the variables listed in Sections 5.1, 5.2, or 5.3 (depending on which app)
10. For each variable, set the **Environment** scope to "Preview" (staging deployments are preview deployments)

**To find the Vercel Org ID:**
1. Go to Vercel dashboard > Settings (top-right gear icon)
2. Under "General", find "Vercel ID" .. this is the Org ID

**To create a Vercel API Token:**
1. Go to Vercel dashboard > Settings > Tokens
2. Click "Create Token"
3. Name it `github-actions-deploy`
4. Set scope to "Full Account" (needed for deploying to all 3 projects)
5. Copy the token immediately (it won't be shown again)

#### 9.2. Neon Staging Database Setup (Step-by-Step)

1. Go to [console.neon.tech](https://console.neon.tech)
2. **Option A (Recommended): Create a branch from the existing project**
   - Open your Hospeda Neon project
   - Go to "Branches" in the left sidebar
   - Click "Create Branch"
   - Name it `staging`
   - Select "from main" (or the default branch)
   - This creates an isolated copy of the production schema and data
3. **Option B: Create a new project**
   - Click "New Project"
   - Name it `hospeda-staging`
   - Region: same as production (ideally `us-east-1` for low latency with Vercel)
   - PostgreSQL version: same as production
4. **Get the connection string:**
   - Go to the branch/project dashboard
   - Click "Connection Details"
   - Select "Pooled connection" (CRITICAL for serverless .. the URL will contain `-pooler` in the hostname)
   - Copy the full `postgresql://...` URL
   - This is your `HOSPEDA_DATABASE_URL` for staging
5. **Run migrations:**
   ```bash
   HOSPEDA_DATABASE_URL="postgresql://...(staging pooler URL)..." pnpm db:migrate
   ```
6. **Seed the database (optional, for test data):**
   ```bash
   HOSPEDA_DATABASE_URL="postgresql://...(staging pooler URL)..." pnpm db:seed
   ```

**Important:** Always use the **pooled** connection URL (contains `-pooler` in hostname). Non-pooled connections will exhaust Neon's connection limit quickly with serverless functions. The API `getDatabasePoolConfig()` auto-detects Vercel and limits to 3 connections, but pooling is still required.

#### 9.3. Upstash Redis Setup (Step-by-Step)

1. Go to [console.upstash.com](https://console.upstash.com)
2. Click "Create Database"
3. Name: `hospeda-staging`
4. Type: Regional
5. Region: `us-east-1` (same region as Vercel for lowest latency)
6. Enable TLS (should be on by default)
7. Click "Create"
8. In the database details page, find "REST URL" and "REST Token"
9. The **Redis URL** is in format: `rediss://default:TOKEN@ENDPOINT:PORT`
   - Copy this as your `HOSPEDA_REDIS_URL`
   - Note the double `s` in `rediss://` (TLS)
10. Free tier limits: 10,000 commands/day, 256MB storage (sufficient for staging)

#### 9.4. Sentry Setup (Step-by-Step)

The project uses **3 separate Sentry DSNs** for the 3 apps:

| Sentry Project | Variable | App |
|----------------|----------|-----|
| `hospeda-api` | `SENTRY_DSN` | API |
| `hospeda-web` | `PUBLIC_SENTRY_DSN` | Web |
| `hospeda-admin` | `VITE_SENTRY_DSN` | Admin |

**For each project:**
1. Go to [sentry.io](https://sentry.io) (or your self-hosted instance at `qazuor.sentry.io`)
2. If the projects already exist, go to Project Settings > Client Keys (DSN) and copy the DSN
3. If not, create a new project:
   - Platform: Node.js (API), JavaScript/Astro (Web), JavaScript/React (Admin)
   - Name: `hospeda-api`, `hospeda-web`, `hospeda-admin`
4. Copy the DSN (looks like `https://xxxx@oXXXX.ingest.sentry.io/YYYY`)
5. No need to create a separate staging Sentry project. The `SENTRY_ENVIRONMENT` variable distinguishes staging from production in the same project.

**Why 3 DSNs?** Each app is a separate Sentry project so errors are organized by app, with independent alert rules and issue grouping. Using the same DSN for all 3 apps would mix API server errors with client-side JavaScript errors.

#### 9.5. MercadoPago Sandbox Setup (Step-by-Step)

1. Go to [mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers)
2. Log in or create a developer account
3. Go to "Your integrations" > "Create application"
   - Name: `Hospeda Staging`
   - Select the product: "Checkout Pro" or "Subscriptions" (depending on what's used)
4. Get **TEST credentials:**
   - Go to the application > "Test credentials"
   - Copy the **Access Token** (starts with `TEST-`)
   - This is your `MERCADO_PAGO_ACCESS_TOKEN`
5. Configure **Webhook:**
   - In the application settings, go to "Webhooks" or "IPN Notifications"
   - URL: `{STAGING_API_URL}/api/v1/webhooks/mercadopago` (e.g., `https://hospeda-api-staging.vercel.app/api/v1/webhooks/mercadopago`)
   - Events to subscribe: `payment`, `subscription_preapproval`, `invoice` (all billing-related events)
   - Click "Save"
   - Copy the **Webhook Secret** (if provided) .. this is `MERCADO_PAGO_WEBHOOK_SECRET`
6. **Create test users** (for simulating payments):
   - Use the MercadoPago API:
     ```bash
     curl -X POST \
       'https://api.mercadopago.com/users/test' \
       -H 'Content-Type: application/json' \
       -H 'Authorization: Bearer TEST-xxxx' \
       -d '{"site_id":"MLA","description":"Test buyer"}'
     ```
   - Create at least 2 test users: one as "seller" and one as "buyer"
   - Save the credentials of each test user

**Note:** After changing the staging API URL (e.g., after first deployment), you MUST update the webhook URL in the MercadoPago dashboard.

#### 9.6. Resend Setup

1. Go to [resend.com](https://resend.com)
2. Get your API key from Settings > API Keys
3. In test mode (no domain verification needed), emails are only sent to verified addresses
4. For staging, test mode is sufficient
5. Set `RESEND_API_KEY` in Vercel env vars for the API project

### 10. Script Specifications

#### 10.1. `scripts/staging-smoke-test.sh`

```bash
#!/usr/bin/env bash
# Staging Smoke Test Script
# Usage: ./scripts/staging-smoke-test.sh <API_URL> <WEB_URL> <ADMIN_URL>
#
# Validates that all 3 staging apps are healthy after deployment.
# Exit code 0 = all checks passed, non-zero = at least one check failed.
#
# Example:
#   ./scripts/staging-smoke-test.sh \
#     https://hospeda-api-staging.vercel.app \
#     https://hospeda-web-staging.vercel.app \
#     https://hospeda-admin-staging.vercel.app

set -euo pipefail

API_URL="${1:?Usage: $0 <API_URL> <WEB_URL> <ADMIN_URL>}"
WEB_URL="${2:?Usage: $0 <API_URL> <WEB_URL> <ADMIN_URL>}"
ADMIN_URL="${3:?Usage: $0 <API_URL> <WEB_URL> <ADMIN_URL>}"

FAILED=0

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local expected_body="${4:-}"

  local status
  local body
  body=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>&1) && status=$? || status=$?

  http_code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$url" 2>/dev/null || echo "000")

  if [ "$http_code" = "$expected_status" ]; then
    echo "PASS: $name ($url) -> HTTP $http_code"
  else
    echo "FAIL: $name ($url) -> HTTP $http_code (expected $expected_status)"
    FAILED=1
  fi

  if [ -n "$expected_body" ]; then
    local response_body
    response_body=$(curl -sS --max-time 15 "$url" 2>/dev/null || echo "")
    if echo "$response_body" | grep -q "$expected_body"; then
      echo "  PASS: Response contains '$expected_body'"
    else
      echo "  FAIL: Response does NOT contain '$expected_body'"
      FAILED=1
    fi
  fi
}

echo "========================================="
echo "Staging Smoke Tests"
echo "========================================="
echo ""

echo "--- API Checks ---"
check "API Health" "$API_URL/health" "200" '"status"'
check "API Public Accommodations" "$API_URL/api/v1/public/accommodations" "200"
check "API Auth Endpoint" "$API_URL/api/auth/session" "200"

echo ""
echo "--- Web Checks ---"
check "Web Homepage (es)" "$WEB_URL/es/" "200"
check "Web Homepage (en)" "$WEB_URL/en/" "200"
check "Web Accommodations" "$WEB_URL/es/alojamientos/" "200"

echo ""
echo "--- Admin Checks ---"
check "Admin Login Page" "$ADMIN_URL" "200"

echo ""
echo "========================================="
if [ $FAILED -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  exit 0
else
  echo "SOME CHECKS FAILED"
  exit 1
fi
```

#### 10.2. `scripts/staging-db-setup.sh`

```bash
#!/usr/bin/env bash
# Staging Database Setup Script
# Usage: ./scripts/staging-db-setup.sh <STAGING_DATABASE_URL>
#
# Runs all migrations and optionally seeds the staging database.
# WARNING: The seed command may overwrite existing data. Use with caution.
#
# Example:
#   ./scripts/staging-db-setup.sh "postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/hospeda?sslmode=require"

set -euo pipefail

DB_URL="${1:?Usage: $0 <STAGING_DATABASE_URL>}"

echo "========================================="
echo "Staging Database Setup"
echo "========================================="
echo ""
echo "Target: ${DB_URL%%@*}@****" # Mask password in output
echo ""

# Run migrations
echo "--- Running migrations ---"
HOSPEDA_DATABASE_URL="$DB_URL" pnpm db:migrate
echo "Migrations complete."

echo ""

# Prompt for seeding
read -p "Do you want to seed the database? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "--- Seeding database ---"
  HOSPEDA_DATABASE_URL="$DB_URL" pnpm db:seed
  echo "Seeding complete."
else
  echo "Skipping seed."
fi

echo ""
echo "========================================="
echo "Staging database setup complete."
echo "========================================="
```

### 11. Implementation Phases

#### Phase 1: Code Changes (can be done locally and committed)

**Estimated effort:** 2-3 hours

| Step | File | Change | Details |
|------|------|--------|---------|
| 1.1 | `apps/api/src/utils/env.ts` | Add `SENTRY_ENVIRONMENT: z.string().optional()` to `ApiEnvSchema` | Add after line 248 (before `.superRefine`) |
| 1.2 | `apps/api/src/lib/sentry.ts` | Change `environment` default | Replace `process.env.NODE_ENV \|\| 'development'` with `process.env.SENTRY_ENVIRONMENT \|\| process.env.NODE_ENV \|\| 'development'` |
| 1.3 | `.env.example` (root) | Add `HOSPEDA_ADMIN_URL` entry | Add `HOSPEDA_ADMIN_URL=http://localhost:3000` under the API & Site Configuration section, with comment explaining it's used for CORS |
| 1.4 | `.env.example` (root) | Add `SENTRY_ENVIRONMENT` entry | Add `SENTRY_ENVIRONMENT=development` under the Monitoring section |
| 1.5 | `turbo.json` | Add missing vars to `globalEnv` | Add: `HOSPEDA_ADMIN_URL`, `HOSPEDA_REDIS_URL`, `CRON_SECRET`, `SENTRY_DSN`, `PUBLIC_SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `VITE_BETTER_AUTH_URL` |
| 1.6 | `.github/SECRETS.md` | Complete rewrite | Include ALL secrets from Section 5.4, with "How to Obtain" instructions and per-environment values |
| 1.7 | `docs/deployment-checklist.md` | Add staging checklist section | Reference this spec's sections 9.1-9.6 for setup procedures |
| 1.8 | `scripts/staging-smoke-test.sh` | Create new file | Content from Section 10.1. Mark as executable: `chmod +x` |
| 1.9 | `scripts/staging-db-setup.sh` | Create new file | Content from Section 10.2. Mark as executable: `chmod +x` |

**Verification:** Run `pnpm typecheck && pnpm lint && pnpm test` to ensure code changes don't break anything.

#### Phase 2: External Service Setup (manual, documented steps)

**Estimated effort:** 1-2 hours

| Step | Service | Instructions | Output |
|------|---------|------------|--------|
| 2.1 | Vercel Projects | Follow Section 9.1 | 3 Project IDs, 1 Org ID, 1 API Token |
| 2.2 | Neon Staging DB | Follow Section 9.2 | 1 pooled connection URL |
| 2.3 | Upstash Redis | Follow Section 9.3 | 1 Redis URL |
| 2.4 | Sentry DSNs | Follow Section 9.4 | 3 DSN strings |
| 2.5 | MercadoPago Sandbox | Follow Section 9.5 | 1 access token, 1 webhook secret |
| 2.6 | Resend | Follow Section 9.6 | 1 API key |

**Checkpoint:** Write down all obtained values securely (password manager). You'll need them in Phase 3.

#### Phase 3: GitHub Configuration (manual)

**Estimated effort:** 30 minutes

| Step | Action | Details |
|------|--------|---------|
| 3.1 | Add repository secrets | Go to GitHub repo > Settings > Secrets and variables > Actions. Add ALL secrets from Section 5.4 |
| 3.2 | Create `staging` environment | Go to Settings > Environments > New environment. Name: `staging`. Deployment branches: `staging` only |
| 3.3 | Create `production` environment | Same as above. Name: `production`. Deployment branches: `main` only |
| 3.4 | Configure Vercel env vars | For EACH of the 3 Vercel projects, go to Settings > Environment Variables and add ALL variables from Sections 5.1, 5.2, 5.3. Set scope to "Preview" for staging |

#### Phase 4: Branch & First Deployment

**Estimated effort:** 30-60 minutes (mostly waiting for CI/CD)

| Step | Command / Action | Expected Result |
|------|------------------|-----------------|
| 4.1 | `git checkout main && git pull` | Ensure main is up to date |
| 4.2 | `git checkout -b staging` | Create staging branch from main |
| 4.3 | `git push -u origin staging` | Push branch, triggers `cd-staging.yml` |
| 4.4 | Watch GitHub Actions | CI should pass, then 3 deploy jobs run in parallel |
| 4.5 | If CI fails | Fix the issue on `main`, merge into `staging`, push again |
| 4.6 | Run staging DB setup | `./scripts/staging-db-setup.sh "<STAGING_DB_URL>"` |
| 4.7 | Update MercadoPago webhook URL | Now that you know the staging API URL, update the webhook in MP dashboard (Section 9.5 step 5) |
| 4.8 | Update Vercel env vars if needed | If staging URLs differ from what was initially set, update `HOSPEDA_API_URL`, `HOSPEDA_SITE_URL`, `HOSPEDA_ADMIN_URL`, and `API_CORS_ORIGINS` in Vercel, then redeploy |

**Note on Vercel Preview URLs:** After the first deploy, Vercel assigns a URL like `hospeda-api-xxxx.vercel.app`. You can create a stable alias via `vercel alias set <deployment-url> hospeda-api-staging.vercel.app` or configure it in the Vercel dashboard under Domains.

#### Phase 5: Validation & Smoke Tests

**Estimated effort:** 1-2 hours

| Step | Action | How to Verify |
|------|--------|---------------|
| 5.1 | Run smoke test script | `./scripts/staging-smoke-test.sh <API_URL> <WEB_URL> <ADMIN_URL>` .. all checks should pass |
| 5.2 | Verify Sentry | Trigger a test error on each app and check Sentry dashboard for events tagged `environment: staging` |
| 5.3 | Verify cron jobs | In Vercel dashboard > API project > Settings > Cron Jobs. Verify 6 crons are listed. Manually trigger one via `curl -H "Authorization: Bearer $CRON_SECRET" -X POST <API_URL>/api/v1/cron/exchange-rate-fetch` |
| 5.4 | Verify Redis | Check Upstash dashboard for connection activity after the API starts |
| 5.5 | Verify billing (optional) | Use MercadoPago test user to create a subscription. Verify webhook arrives at the staging API |
| 5.6 | Verify email (optional) | Trigger a notification action and check Resend dashboard for delivery |
| 5.7 | Verify admin auth | Log in to the Admin panel using staging credentials |

### 12. Staging Branch Maintenance

#### Keeping Staging Up to Date

The recommended workflow is:

1. Developer works on a feature branch based on `main`
2. Feature branch gets merged to `main` via PR
3. To deploy to staging:
   ```bash
   git checkout staging
   git merge main
   git push origin staging
   ```
4. This triggers `cd-staging.yml` and deploys the latest code

**Do NOT rebase `staging` on `main`** if other developers might have commits on staging. Use merge to avoid force-push.

#### When Staging Gets Stale

If staging is significantly behind main and needs a full reset:
```bash
git checkout staging
git reset --hard main
git push --force origin staging
```
**WARNING:** This is a destructive operation. Only do this when no one else has pending work on staging.

### 13. Vercel Plan Requirements

The API app defines 6 cron jobs in `apps/api/vercel.json`:

| Job | Schedule |
|-----|----------|
| `trial-expiry` | Daily at 2 AM UTC |
| `addon-expiry` | Daily at 5 AM UTC |
| `notification-schedule` | Daily at 8 AM UTC |
| `webhook-retry` | Every hour |
| `exchange-rate-fetch` | Every 15 minutes |
| `dunning` | Daily at 6 AM UTC |

**Vercel Free (Hobby) plan** allows only 2 cron jobs per project. **Vercel Pro plan** ($20/month) allows up to 40 cron jobs per project.

**Decision needed:** Either upgrade to Vercel Pro, or disable non-essential crons for staging by creating a separate `vercel.staging.json` with only 2 crons (e.g., `trial-expiry` and `webhook-retry`).
