# GitHub Secrets & Environment Variables

Complete reference for every secret and environment variable required to run Hospeda in staging and production.

**Important:** You only need to configure GitHub Secrets for the CI/CD pipeline. The CI workflow automatically maps them to the formats needed by each app (`VITE_*` for admin, `PUBLIC_*` for web).

---

## Table of Contents

1. [GitHub Actions Secrets](#1-github-actions-secrets)
2. [Vercel Environment Variables — API](#2-vercel-environment-variables--api-appsapi)
3. [Vercel Environment Variables — Web](#3-vercel-environment-variables--web-appsweb)
4. [Vercel Environment Variables — Admin](#4-vercel-environment-variables--admin-appsadmin)
5. [Local Development (.env.local)](#5-local-development-envlocal)
6. [Docker Compose (.env at root)](#6-docker-compose-env-at-root)
7. [How to Configure GitHub Secrets](#7-how-to-configure-github-secrets)
8. [How to Configure Vercel Environment Variables](#8-how-to-configure-vercel-environment-variables)
9. [Security Notes](#9-security-notes)
10. [Troubleshooting](#10-troubleshooting)
11. [Per-Service Onboarding](#11-per-service-onboarding)

> **Last updated:** 2026-04-30

---

## 1. GitHub Actions Secrets

These secrets must be set in **Settings → Secrets and variables → Actions** on the GitHub repository. They are used by the CI workflow (`ci.yml`) and the CD workflows (`cd-production.yml`, `cd-staging.yml`).

### 1.1 CI/CD Infrastructure

| Secret | Description | Required | How to obtain |
|--------|-------------|----------|---------------|
| `VERCEL_TOKEN` | Personal Vercel API token used by `amondnet/vercel-action` to deploy | **Required** | Vercel dashboard → Account Settings → Tokens → Create token |
| `VERCEL_ORG_ID` | Vercel team/org ID. Shown in team Settings → General | **Required** | `vercel link` inside any app dir, then inspect `.vercel/project.json` → `orgId`; or Vercel dashboard → Settings |
| `VERCEL_PROJECT_ID_API` | Vercel project ID for `apps/api` | **Required** | `cd apps/api && vercel link`, then read `.vercel/project.json` → `projectId` |
| `VERCEL_PROJECT_ID_WEB` | Vercel project ID for `apps/web` | **Required** | `cd apps/web && vercel link`, then read `.vercel/project.json` → `projectId` |
| `VERCEL_PROJECT_ID_ADMIN` | Vercel project ID for `apps/admin` | **Required** | `cd apps/admin && vercel link`, then read `.vercel/project.json` → `projectId` |

### 1.2 Database

| Secret | Description | Required | Example |
|--------|-------------|----------|---------|
| `HOSPEDA_DATABASE_URL` | PostgreSQL connection string used by CI test suite and `refresh-search.yml` | **Required** | `postgresql://hospeda_user:pass@host:5432/hospeda_ci` |

### 1.3 Authentication

| Secret | Description | Required | How to generate |
|--------|-------------|----------|-----------------|
| `HOSPEDA_BETTER_AUTH_SECRET` | Better Auth session signing secret. Minimum 32 characters | **Required** | `openssl rand -base64 32` |

### 1.4 Application URLs

| Secret | Description | Required | Example |
|--------|-------------|----------|---------|
| `HOSPEDA_API_URL` | Public URL of the API. Mapped to `VITE_API_URL` and `PUBLIC_API_URL` by CI | **Required** | `https://api.hospeda.com.ar` |
| `HOSPEDA_SITE_URL` | Public URL of the web app. Mapped to `PUBLIC_SITE_URL` by CI | **Required** | `https://hospeda.com.ar` |

---

## 2. Vercel Environment Variables — API (`apps/api`)

Set these in the Vercel project dashboard for the API under **Settings → Environment Variables**. Apply to `Production` and `Preview` as indicated.

### 2.1 Core (Required)

| Variable | Description | Env | Example |
|----------|-------------|-----|---------|
| `HOSPEDA_DATABASE_URL` | PostgreSQL connection string | Prod + Preview | `postgresql://user:pass@host:5432/hospeda` |
| `HOSPEDA_BETTER_AUTH_SECRET` | Better Auth signing secret (min 32 chars) | Prod + Preview | `openssl rand -base64 32` |
| `HOSPEDA_BETTER_AUTH_URL` | Better Auth endpoint URL. **Without it the API refuses to start** (`ApiEnvBaseSchema` rejects undefined). Must point at the `/api/auth` mount of this server | Prod + Preview | `https://api.hospeda.com.ar/api/auth` |
| `HOSPEDA_LOCATION_SALT` | Server-only salt (>= 32 chars) used to generate deterministic, irreversible offsets for accommodation location obfuscation. **Without it the API refuses to start.** **Must NEVER be rotated after production goes live** — rotating it changes every approximate location ever shown to public visitors. Generate per environment with `openssl rand -base64 48` | Prod + Preview | `openssl rand -base64 48` |
| `HOSPEDA_API_URL` | Public API URL (own URL) | Prod + Preview | `https://api.hospeda.com.ar` |
| `HOSPEDA_SITE_URL` | Web app public URL (for CORS) | Prod + Preview | `https://hospeda.com.ar` |
| `HOSPEDA_ADMIN_URL` | Admin app public URL (for CORS) | Prod + Preview | `https://admin.hospeda.com.ar` |

### 2.2 Infrastructure (Required in Production)

| Variable | Description | Env | Example |
|----------|-------------|-----|---------|
| `HOSPEDA_REDIS_URL` | Redis URL for distributed rate limiting. **Required in production** — without it the API refuses to start | Prod | `redis://user:pass@host:6379` |
| `HOSPEDA_CRON_SECRET` | Shared secret for authenticating Vercel cron HTTP requests. **Required in production** (min 32 chars). Without it ALL 6 cron jobs silently fail | Prod | `openssl rand -base64 32` |
| `HOSPEDA_REVALIDATION_SECRET` | Shared secret for ISR (Incremental Static Regeneration) bypass token used by the API to invalidate cached pages on the Astro web app. Min 32 characters. Must match exactly between API and web. Without it the API logs `ISR revalidation DISABLED: missing HOSPEDA_REVALIDATION_SECRET` and falls back to a no-op revalidator. Set on **both** the API and the web Vercel projects | Prod + Preview | `openssl rand -hex 32` |

### 2.3 Billing

| Variable | Description | Env | Required | Example |
|----------|-------------|-----|----------|---------|
| `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` | MercadoPago API token. Production = `APP_USR-*` prefix, Sandbox = `TEST-*` prefix | Prod + Preview | **Required for billing** | `APP_USR-xxxx-xxxx-xxxx` |
| `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` | MercadoPago webhook signature secret for verifying incoming notifications | Prod | **Required for webhooks** | `whsec_xxxx` |
| `HOSPEDA_MERCADO_PAGO_SANDBOX` | Enable sandbox mode. Set `false` in production | Prod | Optional | `false` |
| `HOSPEDA_MERCADO_PAGO_TIMEOUT` | MercadoPago request timeout in ms | Prod | Optional | `5000` |
| `HOSPEDA_MERCADO_PAGO_PLATFORM_ID` | MercadoPago platform ID for marketplace tracking | Prod | Optional | `MP-PLATFORM-ID` |
| `HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID` | MercadoPago integrator ID | Prod | Optional | `MP-INTEGRATOR-ID` |

### 2.4 Email / Notifications

| Variable | Description | Env | Required | Example |
|----------|-------------|-----|----------|---------|
| `HOSPEDA_RESEND_API_KEY` | Resend email API key. Without it transactional emails (welcome, password reset, booking confirmations) silently fail | Prod + Preview | **Required for email** | `re_xxxxxxxxxxxx` |
| `HOSPEDA_RESEND_FROM_EMAIL` | Sender address | Prod + Preview | Optional | `noreply@hospeda.com.ar` |
| `HOSPEDA_RESEND_FROM_NAME` | Sender display name | Prod + Preview | Optional | `Hospeda` |
| `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` | Comma-separated admin emails for dispute/webhook alerts | Prod | Optional | `admin@hospeda.com.ar` |

### 2.5 Monitoring (Sentry)

| Variable | Description | Env | Required | Example |
|----------|-------------|-----|----------|---------|
| `HOSPEDA_SENTRY_DSN` | Sentry DSN for API server-side error tracking | Prod + Preview | Optional | `https://xxxx@o0.ingest.sentry.io/xxxx` |
| `HOSPEDA_SENTRY_RELEASE` | Release identifier. Set to `$VERCEL_GIT_COMMIT_SHA` | Prod | Optional | `1.0.0` |
| `HOSPEDA_SENTRY_PROJECT` | Sentry project name | Prod | Optional | `hospeda-api` |

### 2.6 OAuth Providers

| Variable | Description | Env | Required | How to obtain |
|----------|-------------|-----|----------|---------------|
| `HOSPEDA_GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID | Prod + Preview | Optional (required when Google login is enabled) | [Google Cloud Console](https://console.cloud.google.com/) → APIs → Credentials |
| `HOSPEDA_GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret | Prod + Preview | Required when client ID is set | Google Cloud Console |
| `HOSPEDA_FACEBOOK_CLIENT_ID` | Facebook app ID | Prod + Preview | Optional | [Meta for Developers](https://developers.facebook.com/) |
| `HOSPEDA_FACEBOOK_CLIENT_SECRET` | Facebook app secret | Prod + Preview | Required when client ID is set | Meta for Developers |

### 2.7 Integrations

| Variable | Description | Env | Required | How to obtain |
|----------|-------------|-----|----------|---------------|
| `HOSPEDA_LINEAR_API_KEY` | Linear API key for automatic bug report creation from feedback form | Prod | Optional | Linear → Settings → API → Personal API keys |
| `HOSPEDA_EXCHANGE_RATE_API_KEY` | ExchangeRate-API key for multi-currency rates | Prod | Optional | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| `HOSPEDA_DOLAR_API_BASE_URL` | DolarAPI base URL for ARS exchange rates | Prod | Optional | `https://dolarapi.com/v1` |
| `HOSPEDA_EXCHANGE_RATE_API_BASE_URL` | ExchangeRate-API base URL | Prod | Optional | `https://v6.exchangerate-api.com/v6` |

### 2.8 Auth / Security

| Variable | Description | Env | Required | Example |
|----------|-------------|-----|----------|---------|
| `API_CORS_ORIGINS` | Comma-separated allowed CORS origins | Prod | Optional | `https://hospeda.com.ar,https://admin.hospeda.com.ar` |
| `API_SECURITY_CSRF_ORIGINS` | Comma-separated CSRF trusted origins | Prod | Optional | `https://hospeda.com.ar,https://admin.hospeda.com.ar` |
| `API_RATE_LIMIT_TRUST_PROXY` | Must be `true` on Vercel — without it rate limiting sees Vercel's internal IP instead of the real client IP, effectively disabling per-IP rate limiting | Prod | **Recommended** | `true` |

### 2.9 Server Config (Optional Overrides)

| Variable | Default | Description | Env |
|----------|---------|-------------|-----|
| `NODE_ENV` | `production` | Runtime environment | Prod |
| `API_PORT` | `3001` | Port (ignored by Vercel serverless) | Prod |
| `API_LOG_LEVEL` | `info` | Log level (`debug`/`info`/`warn`/`error`) | Prod |
| `API_LOG_USE_COLORS` | `true` | Disable for structured log aggregators | Prod |
| `HOSPEDA_DB_POOL_MAX_CONNECTIONS` | `10` | DB connection pool size | Prod |
| `HOSPEDA_CRON_ADAPTER` | `manual` | Set to `vercel` when deployed on Vercel | Prod |
| `HOSPEDA_FEEDBACK_ENABLED` | `true` | Set to `false` to disable feedback endpoint | Prod |
| `HOSPEDA_AUTH_LOCKOUT_MAX_ATTEMPTS` | `5` | Max failed logins before lockout | Prod |
| `HOSPEDA_AUTH_LOCKOUT_WINDOW_MS` | `900000` | Lockout window in ms (15 min) | Prod |

---

## 3. Vercel Environment Variables — Web (`apps/web`)

Set in the Vercel project for the web app under **Settings → Environment Variables**.

### 3.1 Core (Required)

| Variable | Description | Env | Example |
|----------|-------------|-----|---------|
| `PUBLIC_API_URL` | API base URL exposed to the browser | Prod + Preview | `https://api.hospeda.com.ar` |
| `PUBLIC_SITE_URL` | Web app base URL | Prod + Preview | `https://hospeda.com.ar` |
| `HOSPEDA_BETTER_AUTH_URL` | Better Auth endpoint (for SSR auth) | Prod + Preview | `https://api.hospeda.com.ar/api/auth` |
| `HOSPEDA_REVALIDATION_SECRET` | ISR bypass token consumed by `astro.config.mjs` (`bypassToken`). Must be **identical** to the value set on the API project. Min 32 characters | Prod + Preview | `openssl rand -hex 32` |

### 3.2 Monitoring

| Variable | Description | Env | Required | Example |
|----------|-------------|-----|----------|---------|
| `PUBLIC_SENTRY_DSN` | Sentry DSN for client-side browser error tracking | Prod + Preview | Optional | `https://xxxx@o0.ingest.sentry.io/xxxx` |
| `PUBLIC_SENTRY_RELEASE` | Sentry release identifier | Prod | Optional | `1.0.0` |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps upload at build time. Without it, source maps are not uploaded and production stack traces will be minified/unreadable. **Required for readable stack traces in production** | Prod (build time) | **Required for source maps** | Sentry → Settings → Account → API → Auth Tokens |
| `SENTRY_ORG` | Sentry organization slug. Must match the org that owns `PUBLIC_SENTRY_DSN` | Prod (build time) | Required when `SENTRY_AUTH_TOKEN` is set | Sentry → Organization settings |
| `SENTRY_PROJECT` | Sentry project slug for `apps/web` | Prod (build time) | Required when `SENTRY_AUTH_TOKEN` is set | Sentry → Project settings |

### 3.3 Optional / Feature Flags

| Variable | Default | Description | Env |
|----------|---------|-------------|-----|
| `PUBLIC_ENABLE_LOGGING` | `false` | Enable client-side console logging | Prod |
| `PUBLIC_VERSION` | — | App version string for feedback auto-collection | Prod |

---

## 4. Vercel Environment Variables — Admin (`apps/admin`)

Set in the Vercel project for the admin app under **Settings → Environment Variables**.

### 4.1 Core (Required)

| Variable | Description | Env | Example |
|----------|-------------|-----|---------|
| `VITE_API_URL` | API endpoint for the admin dashboard | Prod + Preview | `https://api.hospeda.com.ar` |
| `VITE_BETTER_AUTH_URL` | Better Auth endpoint for the admin dashboard | Prod + Preview | `https://api.hospeda.com.ar/api/auth` |

### 4.2 Monitoring

| Variable | Description | Env | Required | Example |
|----------|-------------|-----|----------|---------|
| `VITE_SENTRY_DSN` | Sentry DSN for admin dashboard error tracking | Prod + Preview | Optional | `https://xxxx@o0.ingest.sentry.io/xxxx` |
| `VITE_SENTRY_RELEASE` | Sentry release identifier | Prod | Optional | `1.0.0` |
| `VITE_SENTRY_PROJECT` | Sentry project name | Prod | Optional | `hospeda-admin` |

### 4.3 App Configuration (Optional)

| Variable | Default | Description | Env |
|----------|---------|-------------|-----|
| `VITE_APP_NAME` | `Hospeda Admin` | Display name shown in the UI | Prod |
| `VITE_APP_VERSION` | — | Version string shown in admin UI | Prod |
| `VITE_APP_DESCRIPTION` | `Admin panel for Hospeda platform` | Short description | Prod |
| `VITE_DEFAULT_PAGE_SIZE` | `25` | Default rows per page in data tables | Prod |
| `VITE_MAX_PAGE_SIZE` | `100` | Maximum rows per page | Prod |
| `VITE_ENABLE_LOGGING` | `false` | Enable client-side console logging | Prod |
| `VITE_LOG_LEVEL` | `INFO` | Client-side log level | Prod |
| `VITE_SUPPORTED_LOCALES` | `es,en` | Supported locale codes | Prod |
| `VITE_DEFAULT_LOCALE` | `es` | Default locale | Prod |

---

## 5. Local Development (.env.local)

Create a `.env.local` file in each app directory (they are gitignored). Minimum required variables per app:

### apps/api/.env.local

```bash
# Server
NODE_ENV=development
API_PORT=3001
API_HOST=localhost

# Database (matches docker-compose.yml defaults)
HOSPEDA_DATABASE_URL=postgresql://hospeda:hospeda@localhost:5432/hospeda

# Auth
HOSPEDA_BETTER_AUTH_SECRET=your-dev-secret-minimum-32-characters-long-here
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# Location obfuscation salt (>= 32 chars) — see §2.1
# In dev any random value works; in production NEVER rotate after first deploy.
HOSPEDA_LOCATION_SALT=replace-with-output-of-openssl-rand-base64-48

# URLs
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4321
HOSPEDA_ADMIN_URL=http://localhost:3000

# CORS
API_CORS_ORIGINS=http://localhost:3000,http://localhost:4321
API_SECURITY_CSRF_ORIGINS=http://localhost:3000,http://localhost:4321

# Redis (optional in dev, required in prod)
# HOSPEDA_REDIS_URL=redis://localhost:6379

# Billing (use TEST- prefix tokens for sandbox)
# HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-xxxx-xxxx
# HOSPEDA_MERCADO_PAGO_SANDBOX=true

# Email (optional in dev)
# HOSPEDA_RESEND_API_KEY=re_xxxx
# HOSPEDA_RESEND_FROM_EMAIL=noreply@hospeda.com.ar

# Cron (optional in dev)
# HOSPEDA_CRON_SECRET=your-cron-secret-minimum-32-characters

# Sentry (optional in dev)
# HOSPEDA_SENTRY_DSN=https://xxxx@sentry.io/xxxx
```

### apps/web/.env.local

```bash
PUBLIC_API_URL=http://localhost:3001
PUBLIC_SITE_URL=http://localhost:4321
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# Sentry (optional)
# PUBLIC_SENTRY_DSN=https://xxxx@sentry.io/xxxx
```

### apps/admin/.env.local

```bash
VITE_API_URL=http://localhost:3001
VITE_BETTER_AUTH_URL=http://localhost:3001/api/auth
VITE_APP_NAME=Hospeda Admin
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_QUERY_DEVTOOLS=true
VITE_ENABLE_ROUTER_DEVTOOLS=true

# Sentry (optional)
# VITE_SENTRY_DSN=https://xxxx@sentry.io/xxxx
```

---

## 6. Docker Compose (.env at root)

Used only for local development database and Redis containers. Create a `.env` file at the project root:

```bash
# PostgreSQL
POSTGRES_USER=hospeda
POSTGRES_PASSWORD=hospeda
POSTGRES_DB=hospeda
POSTGRES_PORT=5432

# Redis
REDIS_PORT=6379
```

> These values must match the `HOSPEDA_DATABASE_URL` and `HOSPEDA_REDIS_URL` in your `apps/api/.env.local`.

---

## 7. How to Configure GitHub Secrets

### Step 1: Open repository secrets

1. Go to the GitHub repository
2. Click **Settings** tab
3. In the left sidebar: **Secrets and variables** → **Actions**

### Step 2: Add each secret

1. Click **New repository secret**
2. Enter the exact name from the tables above (case-sensitive)
3. Enter the value
4. Click **Add secret**

### Step 3: Environment-scoped secrets (for staging/production)

The CD workflows use GitHub Environments (`staging` and `production`). To set different values per environment:

1. Go to **Settings → Environments**
2. Create environments named `staging` and `production`
3. Add environment-specific secrets within each environment (e.g., different `HOSPEDA_DATABASE_URL` for staging vs production)

### Minimum secrets for CI to pass

```
HOSPEDA_DATABASE_URL
HOSPEDA_BETTER_AUTH_SECRET
HOSPEDA_API_URL
HOSPEDA_SITE_URL
```

### Minimum secrets for CD to deploy

Everything above, plus:

```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID_API
VERCEL_PROJECT_ID_WEB
VERCEL_PROJECT_ID_ADMIN
```

### Minimum secrets for full production operation

Everything above, plus:

```
HOSPEDA_REDIS_URL            (rate limiting across instances)
HOSPEDA_CRON_SECRET          (all 6 background jobs)
HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN   (billing)
HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET (webhook verification)
HOSPEDA_RESEND_API_KEY       (transactional email)
HOSPEDA_SENTRY_DSN           (error monitoring — set in Vercel, not GitHub)
PUBLIC_SENTRY_DSN            (web client monitoring — set in Vercel)
VITE_SENTRY_DSN              (admin client monitoring — set in Vercel)
```

---

## 8. How to Configure Vercel Environment Variables

### Using the Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) → your team/account
2. Select the project (API, Web, or Admin)
3. Go to **Settings → Environment Variables**
4. For each variable: enter name, value, and select environments (`Production`, `Preview`, `Development`)
5. Click **Save**

### Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link a project
cd apps/api && vercel link

# Add a secret
vercel env add HOSPEDA_DATABASE_URL production

# List current env vars
vercel env ls
```

### Finding Vercel Project IDs

```bash
# After linking a project, inspect the generated file
cat apps/api/.vercel/project.json
# {"projectId":"prj_xxxx","orgId":"team_xxxx"}
```

---

## 9. Security Notes

### Server-side vs. client-side variables

| Prefix | Visible to browser | Used by |
|--------|--------------------|---------|
| `HOSPEDA_*` | No (server only) | API |
| `API_*` | No (server only) | API |
| `PUBLIC_*` | **Yes** (Astro SSR + browser) | Web |
| `VITE_*` | **Yes** (bundled by Vite) | Admin |

**Never put secrets (API keys, DB passwords, tokens) in `PUBLIC_*` or `VITE_*` variables.**

### Critical rules

1. **Never commit secrets.** `.env.local` and `.env` are gitignored. Use GitHub Secrets or Vercel env vars for deployed environments.
2. **Rotate secrets regularly.** Change `HOSPEDA_BETTER_AUTH_SECRET`, `HOSPEDA_CRON_SECRET`, `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` periodically and update in all environments.
3. **Use different values per environment.** Do not reuse production secrets in staging or CI.
4. **Minimum 32 chars for secrets.** `HOSPEDA_BETTER_AUTH_SECRET` and `HOSPEDA_CRON_SECRET` require at least 32 characters. Use `openssl rand -base64 32` to generate.
5. **MercadoPago tokens.** Production tokens start with `APP_USR-`. Test tokens start with `TEST-`. Never use a production token in staging.
6. **Vercel tokens.** `VERCEL_TOKEN` is a personal access token. Use a bot/service account token for CI, not your personal account.

---

## 10. Troubleshooting

### Build fails with "environment validation FAILED"

**Cause.** A required variable is missing or has an invalid format.

**Solution.**

1. Check all required variables are set in GitHub Secrets
2. Names are case-sensitive — verify they match exactly
3. Validate URL variables are proper URLs (including protocol)
4. Verify `HOSPEDA_BETTER_AUTH_SECRET` is at least 32 characters

### API fails to start with "HOSPEDA_REDIS_URL is required in production"

**Cause.** `HOSPEDA_REDIS_URL` is required in production for rate limiting to work across instances.

**Solution.** Add `HOSPEDA_REDIS_URL` in the Vercel API project environment variables for Production.

### All cron jobs silently fail

**Cause.** `HOSPEDA_CRON_SECRET` is missing in production. The API validates this at startup and rejects unauthenticated cron requests.

**Solution.** Generate a 32+ char secret with `openssl rand -base64 32` and set `HOSPEDA_CRON_SECRET` in the Vercel API project.

### Billing payments return 500

**Cause.** `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` is not configured or is using a test token in production.

**Solution.** Set `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` with a production `APP_USR-` prefixed token. Ensure `HOSPEDA_MERCADO_PAGO_SANDBOX=false`.

### Transactional emails are not sent

**Cause.** `HOSPEDA_RESEND_API_KEY` is missing.

**Solution.** Obtain an API key from [resend.com](https://resend.com) and set it in the Vercel API project.

### CD workflow fails with "unauthorized"

**Cause.** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, or one of the `VERCEL_PROJECT_ID_*` secrets is missing or incorrect.

**Solution.** Run `vercel link` in each app directory to obtain the correct `projectId` and `orgId` from `.vercel/project.json`.

### Rate limiting not working on Vercel (all requests from same IP)

**Cause.** `API_RATE_LIMIT_TRUST_PROXY` is not set to `true`. Vercel routes all requests through its edge network — without this flag, the rate limiter sees Vercel's internal IP as the client.

**Solution.** Set `API_RATE_LIMIT_TRUST_PROXY=true` in the Vercel API project environment variables.

---

## 11. Per-Service Onboarding

This section walks through every external service that requires API keys for Hospeda. Each entry covers account creation, where to find keys in the dashboard, required scopes, and per-environment redirect URIs. Production hostnames use the `.ar` domain pattern as deployed by `cd-production.yml` (`hospeda.com.ar`, `api.hospeda.com.ar`, `admin.hospeda.com.ar`).

> Troubleshooting for production-blocking issues lives in [§10](#10-troubleshooting). This section is for the *initial* onboarding flow only.

---

### 11.1 Neon (PostgreSQL)

**Provider.** [Neon](https://console.neon.tech) — serverless Postgres with branching.

1. **Account creation.** Sign up with GitHub or business email. The free tier covers dev + staging. Production requires the **Launch** plan or higher for autoscaling and point-in-time recovery beyond 7 days.
2. **What to create.**
    - One **project** per deployment target (recommended): `hospeda-prod`, `hospeda-staging`. Or one project with **branches** (`main`, `staging`, `dev`) — cheaper but riskier (a branch reset can delete prod data).
    - Database name: `hospeda`. Role: `hospeda_user`.
3. **Where to find the connection string.** Project dashboard → **Connection Details** → toggle **Pooled connection** → copy the URL.
4. **Pooled vs direct URL.**
    - Pooled URL (port `5432` with `?pgbouncer=true`): use for serverless functions (Vercel API). Required for Drizzle in production.
    - Direct URL (port `5432` without pgbouncer): use for migrations (`drizzle-kit push`) and `pnpm db:fresh-dev`. Pgbouncer breaks prepared statements.
5. **Connection limits.** Free tier: 100 connections. Set `HOSPEDA_DB_POOL_MAX_CONNECTIONS=10` per Vercel function instance to stay under quota.
6. **Env vars produced.**
    - `HOSPEDA_DATABASE_URL` (pooled URL for runtime).
    - For migrations only: a separate direct URL exported as `HOSPEDA_DATABASE_URL` in your local shell.
7. **Verification.**

    ```bash
    psql "$HOSPEDA_DATABASE_URL" -c "SELECT version();"
    # or via the monorepo:
    pnpm db:studio
    ```

8. **Common gotchas.**
    - Drizzle `push` against the pooled URL fails with "prepared statement does not exist". Use the direct URL for schema changes.
    - Branches share storage but NOT computation — each branch has its own connection limit.
    - The `apply-postgres-extras.sh` script (triggers, materialized views) must be re-run after every `db:fresh-dev`. See `packages/db/CLAUDE.md`.

---

### 11.2 Vercel

**Provider.** [Vercel](https://vercel.com) — hosting platform for all three apps.

1. **Account creation.** Sign up with GitHub. Use a **Team** account (Pro plan recommended) so multiple developers and CI can deploy. Personal Hobby accounts have stricter function limits (10s vs 60s) and no concurrent builds.
2. **What to create.** Three projects under the same team:
    - `hospeda-api` → root: `apps/api`, framework preset: **Other**.
    - `hospeda-web` → root: `apps/web`, framework preset: **Astro**.
    - `hospeda-admin` → root: `apps/admin`, framework preset: **Vite**.
3. **Where to find the IDs.** After running `vercel link` inside each app dir:

    ```bash
    cd apps/api && vercel link
    cat .vercel/project.json
    # {"projectId":"prj_xxxx","orgId":"team_xxxx"}
    ```

    `orgId` is shared across all three projects. `projectId` is unique per app.
4. **Required scopes (for `VERCEL_TOKEN`).** Token authored in **Account Settings → Tokens**. Scope to a single team for least privilege. No granular per-action scopes — the token gets full team permissions.
5. **Env vars produced.**
    - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_API`, `VERCEL_PROJECT_ID_WEB`, `VERCEL_PROJECT_ID_ADMIN`.
6. **Domain configuration.**
    - `hospeda-api` → `api.hospeda.com.ar`.
    - `hospeda-web` → `hospeda.com.ar` and `www.hospeda.com.ar`.
    - `hospeda-admin` → `admin.hospeda.com.ar`.
7. **Verification.**

    ```bash
    vercel whoami
    vercel projects ls
    ```

8. **Common gotchas.**
    - Functions on Hobby plan timeout at 10s; bookings and billing can exceed this. Use Pro.
    - File upload above 4.5 MB requires Pro. See `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB`.
    - Use a **dedicated bot/service-account token** for `VERCEL_TOKEN`, not your personal account.

**Junior dev shortcut.** Run `vercel link` in each app directory once. The IDs in `.vercel/project.json` are exactly what go into GitHub Secrets.

---

### 11.3 Better Auth

**Provider.** Self-hosted via [`better-auth`](https://www.better-auth.com/) NPM library — no external dashboard.

1. **Account creation.** None. Better Auth is a library bundled inside `apps/api`.
2. **What to create.** A 32+ character signing secret used to sign session cookies and JWTs.
3. **How to generate.**

    ```bash
    openssl rand -base64 32
    ```

4. **Env vars produced.**
    - `HOSPEDA_BETTER_AUTH_SECRET` (the secret itself).
    - `HOSPEDA_BETTER_AUTH_URL` (the public URL of the auth endpoint, e.g. `https://api.hospeda.com.ar/api/auth`).
5. **Per-environment URLs.**
    - Dev: `http://localhost:3001/api/auth`.
    - Staging: `https://api.staging.hospeda.com.ar/api/auth`.
    - Prod: `https://api.hospeda.com.ar/api/auth`.
6. **Verification.**

    ```bash
    curl https://api.hospeda.com.ar/api/auth/session
    # Expected: { "session": null } when unauthenticated
    ```

7. **Common gotchas.**
    - Rotating `HOSPEDA_BETTER_AUTH_SECRET` invalidates ALL existing sessions — every user must log in again.
    - The secret MUST be exactly the same on every API instance and on the seed package (for the super-admin user).

---

### 11.4 MercadoPago

**Provider.** [MercadoPago Developers](https://www.mercadopago.com.ar/developers/panel) — Argentina payment processor.

1. **Account creation.** Personal MercadoPago account → upgrade to a **business account** (CUIT required for ARS payouts in production). Free.
2. **What to create.**
    - One **application** per environment in the developer panel: `hospeda-prod`, `hospeda-staging`.
    - Inside each application, generate two credential sets: **Production** (`APP_USR-` prefix) and **Test** (`TEST-` prefix).
3. **Where to find the keys.** Developer panel → **Your integrations** → select app → **Credentials**. Both **Public Key** and **Access Token** are shown for production and test.
4. **Webhook configuration.** Developer panel → **Notifications** → **Webhooks** → add per environment:
    - Dev: use [ngrok](https://ngrok.com) tunnel pointed at `http://localhost:3001/api/v1/webhooks/mercado-pago`.
    - Staging: `https://api.staging.hospeda.com.ar/api/v1/webhooks/mercado-pago`.
    - Prod: `https://api.hospeda.com.ar/api/v1/webhooks/mercado-pago`.

    Subscribe to: `payment.created`, `payment.updated`, `subscription_preapproval.updated`, `subscription_authorized_payment.created`. Copy the **Signing Secret** shown after saving.
5. **Env vars produced.**
    - `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` (`APP_USR-*` in prod, `TEST-*` elsewhere).
    - `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` (the signing secret from the webhook config).
    - `HOSPEDA_MERCADO_PAGO_SANDBOX` (set `false` only in production).
6. **Verification.**

    ```bash
    curl -X POST https://api.mercadopago.com/checkout/preferences \
      -H "Authorization: Bearer $HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"items":[{"title":"test","quantity":1,"unit_price":100}]}'
    # Expected: 201 Created with init_point URL
    ```

7. **Common gotchas.**
    - **NEVER** use a production `APP_USR-` token in staging or dev — real charges will go through.
    - `HOSPEDA_MERCADO_PAGO_SANDBOX=false` AND production token AND `livemode=true` must all align. A mismatch gives confusing 4xx errors.
    - Webhook signature verification is **required** in production. Without `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` the API rejects all webhooks.
    - Argentina-only: payouts require CUIT validation. Allow 5 business days for the first payout.

**Junior dev shortcut.** For local dev, copy a `TEST-` token from the panel and set `HOSPEDA_MERCADO_PAGO_SANDBOX=true`. You can use the `mcp__mercadopago__create_test_user` tool to create test buyers.

---

### 11.5 Cloudinary

**Provider.** [Cloudinary](https://cloudinary.com/console) — image CDN and transformations.

1. **Account creation.** Free tier (25 GB storage + 25 GB bandwidth/month) covers staging. Production should use **Plus** plan ($89/mo) for higher quotas and webhook signing.
2. **What to create.**
    - One **environment** per deployment target via Account dashboard → **Environments** (a feature on paid plans). On free tier, use a single cloud and prefix all assets with `hospeda/prod/` vs `hospeda/staging/`.
    - **Cloud name**: must be globally unique (e.g. `hospeda` or `hospeda-prod`).
3. **Where to find the keys.** Console → **Dashboard** (top of page) → **Account Details** card shows: `Cloud name`, `API Key`, `API Secret` (click to reveal).
4. **Upload presets.** Settings → **Upload** → **Upload presets** → create one named `hospeda-signed` with **Signing Mode: Signed** and folder `hospeda/`. The API uses signed uploads only.
5. **Transformations.** Used at request time via URL — no presets required for read access.
6. **Env vars produced.**
    - `HOSPEDA_CLOUDINARY_CLOUD_NAME`
    - `HOSPEDA_CLOUDINARY_API_KEY`
    - `HOSPEDA_CLOUDINARY_API_SECRET`
7. **Verification.**

    ```bash
    curl "https://api.cloudinary.com/v1_1/$HOSPEDA_CLOUDINARY_CLOUD_NAME/resources/image" \
      -u "$HOSPEDA_CLOUDINARY_API_KEY:$HOSPEDA_CLOUDINARY_API_SECRET"
    # Expected: 200 with resources array
    ```

8. **Common gotchas.**
    - File size limit: Vercel Hobby = 4.5 MB. Set `HOSPEDA_MEDIA_MAX_FILE_SIZE_MB` accordingly. Anything above requires Vercel Pro.
    - The seed package can call destructive `clean-images` operations. **Production protection:** `HOSPEDA_ALLOW_PROD_CLEANUP=true` is required. Never set this outside of audited maintenance windows.
    - Free tier cloud names cannot be renamed or transferred.

---

### 11.6 Sentry

**Provider.** [Sentry](https://sentry.io) — error tracking and performance monitoring.

1. **Account creation.** Free **Developer** plan includes 5K events/month. The **Team** plan ($26/mo) is needed for source map uploads and longer retention.
2. **What to create.**
    - One **organization** (typically `hospeda`).
    - Three **projects**, one per app:
        - `hospeda-api` → platform: **Node.js**.
        - `hospeda-web` → platform: **Astro** (or **JavaScript/Browser**).
        - `hospeda-admin` → platform: **React**.
3. **Where to find the DSN.** Project → **Settings** → **Client Keys (DSN)** → copy the public DSN (one per project).
4. **Auth token (for source map uploads).** Organization Settings → **Auth Tokens** → **Create New Token** with scopes:
    - `project:read`
    - `project:releases`
    - `org:read`

    These are the minimum scopes for `@sentry/cli` to upload source maps and create releases.
5. **Env vars produced.**
    - API: `HOSPEDA_SENTRY_DSN`, `HOSPEDA_SENTRY_RELEASE`, `HOSPEDA_SENTRY_PROJECT=hospeda-api`.
    - Web: `PUBLIC_SENTRY_DSN`, `PUBLIC_SENTRY_RELEASE`, plus build-time `SENTRY_AUTH_TOKEN`, `SENTRY_ORG=hospeda`, `SENTRY_PROJECT=hospeda-web`.
    - Admin: `VITE_SENTRY_DSN`, `VITE_SENTRY_RELEASE`, `VITE_SENTRY_PROJECT=hospeda-admin`.
6. **Release configuration.** Set the release identifier to the Vercel commit SHA: `HOSPEDA_SENTRY_RELEASE=$VERCEL_GIT_COMMIT_SHA`. The build process uploads source maps tagged with this release.
7. **Verification.**

    ```bash
    # API: trigger a test error
    curl -X POST https://api.hospeda.com.ar/api/v1/debug/sentry-test
    # then check the Sentry project for the new event
    ```

8. **Common gotchas.**
    - Without `SENTRY_AUTH_TOKEN` at build time, source maps are NOT uploaded — production stack traces are minified gibberish.
    - Each project's DSN must match the org slug encoded inside it. Mixing DSNs across orgs silently sends events to the wrong project.
    - Free tier: only 30-day retention.

**Junior dev shortcut.** Three projects, three DSNs, one auth token. The auth token is shared across all build pipelines; the DSNs are NOT.

---

### 11.7 Resend

**Provider.** [Resend](https://resend.com) — transactional email API.

1. **Account creation.** Free tier (3K emails/month, 100/day) covers staging. Production: **Pro** ($20/mo, 50K emails). Sign up with the email you'll use to send from.
2. **What to create.** One **domain**: `hospeda.com.ar` — added via Dashboard → **Domains** → **Add Domain**.
3. **DNS records.** After adding the domain, Resend shows three required records to add to your DNS provider:
    - SPF: `TXT` record on root: `v=spf1 include:_spf.resend.com ~all`.
    - DKIM: `CNAME` record on `resend._domainkey.hospeda.com.ar`.
    - DMARC: `TXT` record on `_dmarc.hospeda.com.ar`: `v=DMARC1; p=none;`.

    Verification is automatic once DNS propagates (up to 48 hours).
4. **Where to find the key.** Dashboard → **API Keys** → **Create API Key** → name `hospeda-prod` → **Sending access** scope → copy `re_xxxxxxxxxx`.
5. **From-email rules.** The address in `HOSPEDA_RESEND_FROM_EMAIL` MUST be on a verified domain. Use a no-reply alias: `noreply@hospeda.com.ar`. Reply-to can be different.
6. **Env vars produced.**
    - `HOSPEDA_RESEND_API_KEY`
    - `HOSPEDA_RESEND_FROM_EMAIL`
    - `HOSPEDA_RESEND_FROM_NAME` (optional)
7. **Verification.**

    ```bash
    curl -X POST 'https://api.resend.com/emails' \
      -H "Authorization: Bearer $HOSPEDA_RESEND_API_KEY" \
      -H 'Content-Type: application/json' \
      -d '{"from":"noreply@hospeda.com.ar","to":"you@example.com","subject":"test","text":"hi"}'
    # Expected: 200 with id
    ```

8. **Common gotchas.**
    - Sending from an unverified domain returns 403. Free Resend domains (`onboarding@resend.dev`) work for sandbox testing only.
    - DKIM failures are silent — emails go to spam. Verify with [mxtoolbox.com](https://mxtoolbox.com).
    - Production should use a dedicated subdomain (`mail.hospeda.com.ar`) for IP reputation isolation.

---

### 11.8 Google OAuth

**Provider.** [Google Cloud Console](https://console.cloud.google.com) — OAuth 2.0 identity provider.

1. **Account creation.** Free Google Workspace or personal account.
2. **What to create.**
    - One **GCP project** (e.g. `hospeda-auth`).
    - Inside it: **APIs & Services → OAuth consent screen** → User type: **External**, app name: `Hospeda`, support email, app logo, authorized domain `hospeda.com.ar`.
    - Then: **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Web application**.
3. **Required scopes.** On the OAuth consent screen, add scopes:
    - `openid`
    - `https://www.googleapis.com/auth/userinfo.email`
    - `https://www.googleapis.com/auth/userinfo.profile`

    Better Auth uses these three to populate the user profile.
4. **Authorized redirect URIs (per environment).** Add ALL of these to the same OAuth client (or one client per env for stricter isolation):
    - Dev: `http://localhost:3001/api/auth/callback/google`
    - Staging: `https://api.staging.hospeda.com.ar/api/auth/callback/google`
    - Prod: `https://api.hospeda.com.ar/api/auth/callback/google`

    The path `/api/auth/callback/google` is the Better Auth default.
5. **Authorized JavaScript origins.** Same hostnames without the path: `http://localhost:3001`, `https://api.hospeda.com.ar`.
6. **App verification.** Required only when you exit "Testing" mode and want to support more than 100 users. Submit logo, privacy policy URL (`https://hospeda.com.ar/privacy`), terms URL. Approval takes 4–6 weeks.
7. **Env vars produced.**
    - `HOSPEDA_GOOGLE_CLIENT_ID`
    - `HOSPEDA_GOOGLE_CLIENT_SECRET`
8. **Verification.**

    ```bash
    # Visit in browser to start the OAuth flow:
    open https://api.hospeda.com.ar/api/auth/sign-in/google
    # Should redirect to accounts.google.com → consent → back to /api/auth/callback/google
    ```

9. **Common gotchas.**
    - `redirect_uri_mismatch` error: the callback URL on the API must match EXACTLY one of the authorized URIs (including trailing slashes and `http` vs `https`).
    - "App not verified" warning shown to users until verification is approved. Acceptable for staging.
    - Test mode allows max 100 users by Google email. Prod requires verification.

---

### 11.9 Facebook OAuth

**Provider.** [Meta for Developers](https://developers.facebook.com).

1. **Account creation.** Personal Facebook account → enroll as developer (free, requires phone verification).
2. **What to create.**
    - **My Apps → Create App → Use case: Authenticate and request data from users with Facebook Login**.
    - App name: `Hospeda`. Contact email: business email.
3. **Configure Facebook Login product.** App dashboard → **Add product → Facebook Login → Set up** → **Web** platform.
4. **Required permissions.** Default `public_profile` and `email`. No app review required for these. Anything beyond (e.g. `user_friends`) needs Meta App Review (multi-week process).
5. **Valid OAuth Redirect URIs.** App dashboard → **Facebook Login → Settings** → add per environment:
    - Dev: `http://localhost:3001/api/auth/callback/facebook`
    - Staging: `https://api.staging.hospeda.com.ar/api/auth/callback/facebook`
    - Prod: `https://api.hospeda.com.ar/api/auth/callback/facebook`
6. **App Mode.** Apps start in **Development** mode (only admins/testers can log in). To go to **Live** mode, you need: privacy policy URL, terms URL, app icon (1024×1024), category, and you must complete the **Data Use Checkup**.
7. **Where to find the keys.** Settings → **Basic** → `App ID` and `App Secret` (click **Show** and re-enter your password).
8. **Env vars produced.**
    - `HOSPEDA_FACEBOOK_CLIENT_ID` (this is the App ID).
    - `HOSPEDA_FACEBOOK_CLIENT_SECRET` (this is the App Secret).
9. **Verification.**

    ```bash
    open https://api.hospeda.com.ar/api/auth/sign-in/facebook
    ```

10. **Common gotchas.**
    - In Development mode, only listed test users can log in — others get an opaque error.
    - Facebook requires HTTPS for live redirect URIs (localhost is exempt).
    - The "App Secret" is regenerable but doing so invalidates active sessions immediately.

---

### 11.10 Linear

**Provider.** [Linear](https://linear.app/settings/api) — issue tracker, used by the API to auto-create bug reports from the feedback form.

1. **Account creation.** Linear workspace already exists for the team (free tier covers up to 10 users + 250 issues).
2. **What to create.** A **Personal API key** scoped to the user who owns the integration. OAuth is also supported but unnecessary for a server-to-server integration.
3. **Where to find the key.** Linear → **Settings → API → Personal API keys → Create key**. Label it `hospeda-feedback-bot`. Copy `lin_api_xxx`.
4. **Required scopes.** Personal API keys inherit the user's permissions. Use a dedicated bot user with **Member** role on the target team only. No granular scopes available.
5. **Where to find the team ID.** Open the team in Linear → **Settings → General → ID** (the slug-like value, e.g. `team_abcd1234`). Or via API: `curl -H "Authorization: $HOSPEDA_LINEAR_API_KEY" https://api.linear.app/graphql -d '{"query":"{ teams { nodes { id name } } }"}'`.
6. **Env vars produced.**
    - `HOSPEDA_LINEAR_API_KEY`
7. **Verification.**

    ```bash
    curl -X POST https://api.linear.app/graphql \
      -H "Authorization: $HOSPEDA_LINEAR_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{"query":"{ viewer { id email } }"}'
    # Expected: 200 with viewer info
    ```

8. **Common gotchas.**
    - Personal API keys do not expire but are revoked when the owning user leaves the workspace. Use a dedicated bot account.
    - When `HOSPEDA_LINEAR_API_KEY` is missing, the API falls back to email notifications (`HOSPEDA_FEEDBACK_FALLBACK_EMAIL`). Set both for redundancy.

---

### 11.11 ExchangeRate-API

**Provider.** [exchangerate-api.com](https://app.exchangerate-api.com/) — multi-currency conversion rates.

1. **Account creation.** Free tier: 1,500 requests/month, 24-hour update interval. Pro: $10/mo for 100K req and hourly updates.
2. **What to create.** Just an account — there's no project structure. The free key is generated on signup.
3. **Where to find the key.** Dashboard root page shows the API key. Click **Get a New Key** to rotate.
4. **Base URL.** `https://v6.exchangerate-api.com/v6/` (set as `HOSPEDA_EXCHANGE_RATE_API_BASE_URL`). Free tier supports the same endpoint as paid.
5. **Env vars produced.**
    - `HOSPEDA_EXCHANGE_RATE_API_KEY`
    - `HOSPEDA_EXCHANGE_RATE_API_BASE_URL` (defaults to the v6 URL).
    - `HOSPEDA_DOLAR_API_BASE_URL` (separate service for ARS rates: `https://dolarapi.com/v1`, no key required).
6. **Verification.**

    ```bash
    curl "https://v6.exchangerate-api.com/v6/$HOSPEDA_EXCHANGE_RATE_API_KEY/latest/USD"
    # Expected: 200 with conversion_rates object
    ```

7. **Common gotchas.**
    - Free tier rate-limits are sliding window — running a load test can lock the key out for the day.
    - DolarAPI is a separate, free, unauthenticated service for Argentine peso informal rates. It has no key and is used in parallel.

---

### 11.12 Redis (Upstash)

**Provider.** [Upstash](https://console.upstash.com) — serverless Redis. Recommended for production because it offers REST-over-HTTPS (compatible with Vercel serverless cold starts) and pay-per-request pricing. For local dev, `docker-compose` runs a Redis container.

1. **Account creation.** Free tier: 10K commands/day, 256 MB storage, 1 region. Sufficient for staging. Pay-as-you-go: $0.20 per 100K commands.
2. **What to create.** One **database** per environment in the Upstash console. Region: **us-east-1** (closest to Vercel `iad1` default region) or `sa-east-1` for Argentina latency.
3. **Eviction policy.** Set to `allkeys-lru` (Database settings) so rate-limit keys are evicted under pressure. Default is `noeviction` which causes writes to fail when memory is full.
4. **Max memory.** Free tier hard cap = 256 MB. Set TTLs on rate-limit keys (default 15 min) so memory usage stays bounded.
5. **Where to find the URL.** Database dashboard → **Details** card. Two formats:
    - **Redis URL (TCP)**: `redis://default:password@hostname:port` — used by the standard `redis` client. Hospeda's API uses this.
    - **REST URL**: `https://...upstash.io` with separate token. NOT used by Hospeda (the rate limiter expects the TCP protocol).
6. **Env vars produced.**
    - `HOSPEDA_REDIS_URL` (TCP form).
    - `HOSPEDA_RATE_LIMIT_BACKEND=redis` (set explicitly in production; falls back to `memory` if Redis is unreachable).
7. **Verification.**

    ```bash
    redis-cli -u "$HOSPEDA_REDIS_URL" PING
    # Expected: PONG
    ```

8. **Common gotchas.**
    - Without `HOSPEDA_REDIS_URL` in production, the API **refuses to start** (see [§10](#10-troubleshooting)).
    - `eviction-policy: noeviction` (the default on Upstash free tier) breaks the sliding-window rate limiter. Always change to `allkeys-lru`.
    - TLS is enforced on Upstash. The `redis://` URL must use port 6379 (with TLS auto-upgrade) or `rediss://` explicitly.

---

### 11.13 BetterStack (uptime monitoring)

**Provider.** [BetterStack](https://betterstack.com) (formerly BetterUptime) — uptime monitoring with public status pages.

1. **Account creation.** Sign up at [betterstack.com](https://betterstack.com). Free tier covers **10 monitors with 3-minute checks**, which is enough for the three Hospeda apps plus the auth, billing, search, and cron health probes.
2. **What to create.** One **workspace** named `Hospeda`. Inside it, add the monitors listed below.
3. **Initial monitor set.**

    | Monitor | URL | Purpose |
    |---------|-----|---------|
    | Web homepage | `https://hospeda.com.ar` | Public site reachability |
    | API health check | `https://api.hospeda.com.ar/health` | API liveness |
    | Admin login page | `https://admin.hospeda.com.ar` | Admin panel reachability |
    | Auth flow | `https://hospeda.com.ar/api/auth/sign-in` | Better Auth endpoint reachable |
    | Public API smoke | `https://api.hospeda.com.ar/api/v1/public/accommodations?limit=1` | DB + serialization works end-to-end |

4. **Setup steps.**
    1. Create the workspace via dashboard sign-up.
    2. Dashboard → **Monitors → Create monitor** → paste the URL → set **Check frequency** to `3 minutes` → expect HTTP 200.
    3. Add the team's email and a phone number under **On-call** for SMS alerts.
    4. Repeat for each of the five monitors above.
5. **Where to find keys.** Dashboard → **API tokens**. Only required if integrating with the BetterStack API for programmatic monitor management. Plain HTTP probes do not need a key.
6. **Env vars produced.** None. Uptime checks are external HTTP probes; they do not run inside the apps and do not need any app-side configuration.
7. **Verification.** Open the BetterStack dashboard. All five monitors should show green within ~6 minutes (two consecutive successful 3-minute checks). The status page preview should render with all services up.
8. **Status page.** Free tier exposes a status page on a `betterstacktatus.com` subdomain. A custom subdomain (`status.hospeda.com.ar`) requires the paid tier; deferred until the team commits to it. TODO: provision `status.hospeda.com.ar` once the paid tier is acquired.
9. **Common gotchas.**
    - Free tier hard cap: **10 monitors**. Adding the 11th requires paid plan.
    - Free tier does not support custom status page subdomains (paid tier does).
    - HEAD-only checks miss app-server bugs that only surface on GET. Use GET for the public API smoke probe.
    - Email-only alerts arrive within ~1 minute. SMS alerts (free tier) require explicit on-call configuration.

---

### 11.14 Other configured services

The following services are referenced in the env registry but require minimal onboarding:

- **DolarAPI** — `HOSPEDA_DOLAR_API_BASE_URL=https://dolarapi.com/v1`. No account, no key, no rate limit documented. Used for ARS informal exchange rates. If the service is unreachable, the API falls back to ExchangeRate-API.
- **Vercel Cron** — Configured automatically via `vercel.json` in `apps/api`. No external account; uses Vercel's scheduling. Authenticated via `HOSPEDA_CRON_SECRET` (see [§2.2](#22-infrastructure-required-in-production)).

---

## External References

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [MercadoPago API Credentials](https://www.mercadopago.com.ar/developers/en/docs/getting-started)
- [Resend API Keys](https://resend.com/api-keys)
- [Sentry DSN Setup](https://docs.sentry.io/product/sentry-basics/dsn-explainer/)
- [Linear API Keys](https://linear.app/settings/api)
