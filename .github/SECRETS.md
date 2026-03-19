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
| `HOSPEDA_API_URL` | Public URL of the API. Mapped to `VITE_API_URL` and `PUBLIC_API_URL` by CI | **Required** | `https://api.hospeda.ar` |
| `HOSPEDA_SITE_URL` | Public URL of the web app. Mapped to `PUBLIC_SITE_URL` by CI | **Required** | `https://hospeda.ar` |

---

## 2. Vercel Environment Variables — API (`apps/api`)

Set these in the Vercel project dashboard for the API under **Settings → Environment Variables**. Apply to `Production` and `Preview` as indicated.

### 2.1 Core (Required)

| Variable | Description | Env | Example |
|----------|-------------|-----|---------|
| `HOSPEDA_DATABASE_URL` | PostgreSQL connection string | Prod + Preview | `postgresql://user:pass@host:5432/hospeda` |
| `HOSPEDA_BETTER_AUTH_SECRET` | Better Auth signing secret (min 32 chars) | Prod + Preview | `openssl rand -base64 32` |
| `HOSPEDA_API_URL` | Public API URL (own URL) | Prod + Preview | `https://api.hospeda.ar` |
| `HOSPEDA_SITE_URL` | Web app public URL (for CORS) | Prod + Preview | `https://hospeda.ar` |
| `HOSPEDA_ADMIN_URL` | Admin app public URL (for CORS) | Prod + Preview | `https://admin.hospeda.ar` |

### 2.2 Infrastructure (Required in Production)

| Variable | Description | Env | Example |
|----------|-------------|-----|---------|
| `HOSPEDA_REDIS_URL` | Redis URL for distributed rate limiting. **Required in production** — without it the API refuses to start | Prod | `redis://user:pass@host:6379` |
| `HOSPEDA_CRON_SECRET` | Shared secret for authenticating Vercel cron HTTP requests. **Required in production** (min 32 chars). Without it ALL 6 cron jobs silently fail | Prod | `openssl rand -base64 32` |

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
| `HOSPEDA_RESEND_FROM_EMAIL` | Sender address | Prod + Preview | Optional | `noreply@hospeda.ar` |
| `HOSPEDA_RESEND_FROM_NAME` | Sender display name | Prod + Preview | Optional | `Hospeda` |
| `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` | Comma-separated admin emails for dispute/webhook alerts | Prod | Optional | `admin@hospeda.ar` |

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
| `HOSPEDA_LINEAR_TEAM_ID` | Linear team ID where issues will be created | Prod | Optional | Linear → Team settings → General |
| `HOSPEDA_EXCHANGE_RATE_API_KEY` | ExchangeRate-API key for multi-currency rates | Prod | Optional | [exchangerate-api.com](https://www.exchangerate-api.com/) |
| `HOSPEDA_DOLAR_API_BASE_URL` | DolarAPI base URL for ARS exchange rates | Prod | Optional | `https://dolarapi.com/v1` |
| `HOSPEDA_EXCHANGE_RATE_API_BASE_URL` | ExchangeRate-API base URL | Prod | Optional | `https://v6.exchangerate-api.com/v6` |

### 2.8 Auth / Security

| Variable | Description | Env | Required | Example |
|----------|-------------|-----|----------|---------|
| `HOSPEDA_BETTER_AUTH_URL` | Better Auth endpoint URL | Prod + Preview | Optional | `https://api.hospeda.ar/api/auth` |
| `API_CORS_ORIGINS` | Comma-separated allowed CORS origins | Prod | Optional | `https://hospeda.ar,https://admin.hospeda.ar` |
| `API_SECURITY_CSRF_ORIGINS` | Comma-separated CSRF trusted origins | Prod | Optional | `https://hospeda.ar,https://admin.hospeda.ar` |
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
| `PUBLIC_API_URL` | API base URL exposed to the browser | Prod + Preview | `https://api.hospeda.ar` |
| `PUBLIC_SITE_URL` | Web app base URL | Prod + Preview | `https://hospeda.ar` |
| `HOSPEDA_BETTER_AUTH_URL` | Better Auth endpoint (for SSR auth) | Prod + Preview | `https://api.hospeda.ar/api/auth` |

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
| `VITE_API_URL` | API endpoint for the admin dashboard | Prod + Preview | `https://api.hospeda.ar` |
| `VITE_BETTER_AUTH_URL` | Better Auth endpoint for the admin dashboard | Prod + Preview | `https://api.hospeda.ar/api/auth` |

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
# HOSPEDA_RESEND_FROM_EMAIL=noreply@hospeda.ar

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

## External References

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [MercadoPago API Credentials](https://www.mercadopago.com.ar/developers/en/docs/getting-started)
- [Resend API Keys](https://resend.com/api-keys)
- [Sentry DSN Setup](https://docs.sentry.io/product/sentry-basics/dsn-explainer/)
- [Linear API Keys](https://linear.app/settings/api)
