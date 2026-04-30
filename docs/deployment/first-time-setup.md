# First-Time Production Setup

The "from zero to deployed" runbook for the Hospeda monorepo. This guide is for a developer who has just been given access to the repository and needs to provision production infrastructure for the first time.

This document is **glue**. It does not duplicate per-secret onboarding flows, per-app deployment details, or rotation procedures. Each phase links to the canonical doc that owns the detail. Read those linked docs in full as you reach each step.

**Last Updated**: 2026-04-30

---

## Table of Contents

1. [How to use this guide](#how-to-use-this-guide)
2. [Phase 0: Prerequisites and local repo](#phase-0-prerequisites-and-local-repo)
3. [Phase 1: External service accounts](#phase-1-external-service-accounts)
4. [Phase 2: Domains and DNS](#phase-2-domains-and-dns)
5. [Phase 3: Vercel environment variables](#phase-3-vercel-environment-variables)
6. [Phase 4: Database initialization](#phase-4-database-initialization)
7. [Phase 5: GitHub Actions secrets](#phase-5-github-actions-secrets)
8. [Phase 6: First deploy](#phase-6-first-deploy)
9. [Phase 7: Post-deploy validation](#phase-7-post-deploy-validation)
10. [Phase 8: Monitoring and alerts](#phase-8-monitoring-and-alerts)
11. [Phase 9: Onboarding the next developer](#phase-9-onboarding-the-next-developer)
12. [Troubleshooting](#troubleshooting)
13. [Cross-references](#cross-references)

---

## How to use this guide

- **Estimated time**: ~6-8 hours total. Splitting across multiple days is fine. DNS propagation, Resend domain verification, and OAuth review can stretch the calendar to several days.
- **Prerequisites**: a laptop with Node 18+, pnpm 9.x, git, Docker Desktop, and a credit card. Most providers offer free tiers but production-grade plans require billing on Vercel, Neon, Sentry (Team), Resend (Pro), and Cloudinary (Plus).
- **One-time runbook**. After the initial production setup, day-to-day deploys follow [`docs/deployment/checklist.md`](./checklist.md). Use this guide only when bootstrapping a fresh environment.
- **Validate every phase**. Each phase ends with an explicit validation step. Do not skip them. A missed validation in Phase 1 will surface as a hard failure in Phase 6.
- **Order matters**. The phases follow the dependency chain: provider accounts produce secrets, secrets feed Vercel and GitHub, the database must be schema-current before traffic arrives, and the deploy workflow must succeed before any post-deploy smoke test makes sense.

---

## Phase 0: Prerequisites and local repo

### Prerequisites

- Node.js 18 or higher (`node --version`)
- pnpm 9.x (`pnpm --version`). Install with `corepack enable && corepack prepare pnpm@9 --activate`
- Docker Desktop running locally
- Git configured with the email used in the GitHub repository
- Vercel CLI: `npm install -g vercel`
- (Optional) `psql` and `redis-cli` for connectivity testing

### Steps

1. Clone the repo.

    ```bash
    git clone git@github.com:qazuor/hospeda.git
    cd hospeda
    ```

2. Install dependencies.

    ```bash
    pnpm install
    ```

3. Start the local Postgres and Redis containers.

    ```bash
    pnpm db:start
    ```

4. Copy the per-app `.env.example` files into `.env.local`. Refer to [`secrets.md §5`](./secrets.md#5-local-development-envlocal) for the minimum required variables per app.

    ```bash
    cp apps/api/.env.example apps/api/.env.local
    cp apps/web/.env.example apps/web/.env.local
    cp apps/admin/.env.example apps/admin/.env.local
    cp .env.example .env
    ```

5. Apply the local schema and seed data.

    ```bash
    pnpm db:fresh-dev
    bash packages/db/scripts/apply-postgres-extras.sh
    ```

### Validation

Run these three checks. All must pass before continuing.

```bash
pnpm typecheck
pnpm lint
pnpm test
```

If any fail, do not move forward. Fix the local environment first. A common cause is a stale local `.env.local` missing newly-added required variables. Run `pnpm env:check` to surface missing keys.

---

## Phase 1: External service accounts

This phase provisions every external service that produces an API key, secret, or token. Do **not** put any value into Vercel or GitHub yet. Just create the accounts, generate the keys, and stash them in a password manager. Phases 3 and 5 will paste them into Vercel and GitHub.

For each service below, the deep link points at the corresponding `§11.x` sub-section of [`secrets.md`](./secrets.md). That document is the authoritative reference for dashboard navigation, scopes, gotchas, and per-environment redirect URIs. Do not re-create that content here. Read it in full when you reach each step.

### Order of operations

The order matters because of dependencies between services.

| # | Service | Why this order | Time |
|---|---------|---------------|------|
| 1 | Vercel team and 3 projects | Every other secret eventually lands here | 30 min |
| 2 | Neon PostgreSQL | API cannot run without it | 20 min |
| 3 | Better Auth signing secret | API + sessions depend on it | 5 min |
| 4 | Sentry org + 3 projects | Observability before code goes live | 30 min |
| 5 | Cloudinary | Media uploads | 20 min |
| 6 | Resend | DNS propagation can take 24-48h, start early | 30 min + DNS wait |
| 7 | MercadoPago | Billing. Start in sandbox | 45 min |
| 8 | Google OAuth | Social login | 30 min |
| 9 | Facebook OAuth | Social login | 30 min |
| 10 | Linear (optional) | Issue tracker for feedback form | 10 min |
| 11 | Upstash Redis | Required in production for rate limiting | 15 min |
| 12 | ExchangeRate-API | Currency conversion | 10 min |

### 1.1 Vercel team and projects

**What it is**. Hosting platform for all three apps (API, Web, Admin).

Follow [`secrets.md §11.2`](./secrets.md#112-vercel) for full setup. Highlights:

- Use a **Team** account (Pro plan). Hobby has 10s function timeout that breaks billing flows.
- Create three projects: `hospeda-api`, `hospeda-web`, `hospeda-admin`.
- Run `vercel link` inside each app directory to capture `projectId` and `orgId`.
- Use a dedicated bot account for `VERCEL_TOKEN`, never your personal account.

Env vars produced (stash in your password manager):

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_API`
- `VERCEL_PROJECT_ID_WEB`
- `VERCEL_PROJECT_ID_ADMIN`

**Validation**.

```bash
vercel whoami
vercel projects ls
```

You should see all three projects under the same team.

### 1.2 Neon PostgreSQL

**What it is**. Serverless Postgres database for production.

Follow [`secrets.md §11.1`](./secrets.md#111-neon-postgresql) for full setup. Highlights:

- One project per environment is safer than branching prod off staging.
- Production needs the **Launch** plan or higher for autoscaling and PITR.
- Capture **two** URLs: pooled (with `?pgbouncer=true`) for runtime, direct for migrations.

Env vars produced:

- `HOSPEDA_DATABASE_URL` (pooled URL)
- A separate direct URL kept locally for `drizzle-kit push` operations

**Validation**.

```bash
psql "$HOSPEDA_DATABASE_URL" -c "SELECT version();"
```

Expect a Postgres 15+ banner.

### 1.3 Better Auth signing secret

**What it is**. The signing secret used by Better Auth for session cookies and JWTs. Self-hosted, no external dashboard.

Follow [`secrets.md §11.3`](./secrets.md#113-better-auth) for full setup.

Env vars produced:

- `HOSPEDA_BETTER_AUTH_SECRET` (generated with `openssl rand -base64 32`)
- `HOSPEDA_BETTER_AUTH_URL` (e.g., `https://api.hospeda.ar/api/auth`)

**Validation**. Skip until Phase 7 (the secret cannot be tested without a deployed API).

### 1.4 Sentry organization and projects

**What it is**. Error tracking and performance monitoring.

Follow [`secrets.md §11.6`](./secrets.md#116-sentry) for full setup. Highlights:

- One organization (typically `hospeda`).
- Three projects: `hospeda-api` (Node.js), `hospeda-web` (Astro), `hospeda-admin` (React).
- One auth token shared across all build pipelines, scoped to `project:read`, `project:releases`, `org:read`.
- The free Developer plan does not support source map uploads. Production needs the **Team** plan.

Env vars produced:

- `HOSPEDA_SENTRY_DSN`, `PUBLIC_SENTRY_DSN`, `VITE_SENTRY_DSN` (one per app)
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` (build-time for source maps)

**Validation**. Source map upload only works at build time. Validate in Phase 7 by triggering a test event.

### 1.5 Cloudinary

**What it is**. Image CDN, transformations, and signed uploads for accommodations and other media.

Follow [`secrets.md §11.5`](./secrets.md#115-cloudinary) for full setup. Highlights:

- Free tier (25 GB) covers staging. Production needs **Plus** ($89/mo).
- Cloud names are globally unique and cannot be renamed.
- Create the `hospeda-signed` upload preset with **Signed** mode.
- Production safety: `HOSPEDA_ALLOW_PROD_CLEANUP` must remain unset except in audited maintenance windows.

Env vars produced:

- `HOSPEDA_CLOUDINARY_CLOUD_NAME`
- `HOSPEDA_CLOUDINARY_API_KEY`
- `HOSPEDA_CLOUDINARY_API_SECRET`

**Validation**.

```bash
curl "https://api.cloudinary.com/v1_1/$HOSPEDA_CLOUDINARY_CLOUD_NAME/resources/image" \
  -u "$HOSPEDA_CLOUDINARY_API_KEY:$HOSPEDA_CLOUDINARY_API_SECRET"
```

Expect a 200 response with a `resources` array.

### 1.6 Resend

**What it is**. Transactional email API for welcome emails, password resets, booking confirmations.

Follow [`secrets.md §11.7`](./secrets.md#117-resend) for full setup. Highlights:

- Add `hospeda.ar` as a Resend domain immediately. DNS propagation can take up to 48 hours.
- Add three DNS records (SPF, DKIM, DMARC) at the registrar in Phase 2.
- Use a no-reply alias as the from address: `noreply@hospeda.ar`.

Env vars produced:

- `HOSPEDA_RESEND_API_KEY`
- `HOSPEDA_RESEND_FROM_EMAIL`
- `HOSPEDA_RESEND_FROM_NAME` (optional)

**Validation**. Cannot complete until Phase 2 DNS propagates. Run the curl command in `§11.7` step 7 once the domain shows as verified in the Resend dashboard.

### 1.7 MercadoPago

**What it is**. Argentina-region payment processor for billing.

Follow [`secrets.md §11.4`](./secrets.md#114-mercadopago) for full setup. Highlights:

- Business account (CUIT required) for ARS payouts.
- One application per environment. Generate **Test** credentials first; production credentials only after the rest is wired up.
- Webhook URL must be publicly reachable. For Phase 7 validation, the production URL is `https://api.hospeda.ar/api/v1/webhooks/mercado-pago`.

Env vars produced:

- `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` (use `TEST-*` until production smoke test passes)
- `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`
- `HOSPEDA_MERCADO_PAGO_SANDBOX` (set `false` in production only)

**Validation**.

```bash
curl -X POST https://api.mercadopago.com/checkout/preferences \
  -H "Authorization: Bearer $HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"title":"test","quantity":1,"unit_price":100}]}'
```

Expect a 201 response with an `init_point` URL.

### 1.8 Google OAuth

**What it is**. Google as an OAuth 2.0 identity provider for Better Auth.

Follow [`secrets.md §11.8`](./secrets.md#118-google-oauth) for full setup. Highlights:

- Configure the OAuth consent screen with `hospeda.ar` as an authorized domain.
- Add **all** redirect URIs (dev, staging, prod) up front to avoid round-trips.
- Submit app verification only when leaving Testing mode (4-6 week review).

Env vars produced:

- `HOSPEDA_GOOGLE_CLIENT_ID`
- `HOSPEDA_GOOGLE_CLIENT_SECRET`

**Validation**. Deferred to Phase 7 (requires the API to be deployed).

### 1.9 Facebook OAuth

**What it is**. Facebook as an OAuth 2.0 identity provider.

Follow [`secrets.md §11.9`](./secrets.md#119-facebook-oauth) for full setup. Highlights:

- App must be in **Live** mode to allow non-tester users. Requires privacy policy URL, terms URL, and an app icon.
- Facebook requires HTTPS for live redirect URIs (localhost is exempt).

Env vars produced:

- `HOSPEDA_FACEBOOK_CLIENT_ID` (App ID)
- `HOSPEDA_FACEBOOK_CLIENT_SECRET` (App Secret)

**Validation**. Deferred to Phase 7.

### 1.10 Linear (optional)

**What it is**. Issue tracker. The API auto-creates bug reports from the in-app feedback form when configured.

Follow [`secrets.md §11.10`](./secrets.md#1110-linear) for full setup. Skip if your team uses a different issue tracker; the API falls back to email notifications.

Env vars produced:

- `HOSPEDA_LINEAR_API_KEY`
- `HOSPEDA_LINEAR_TEAM_ID`

**Validation**.

```bash
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: $HOSPEDA_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { id email } }"}'
```

### 1.11 Upstash Redis

**What it is**. Serverless Redis. Used by the API for distributed rate limiting and the cache layer.

Follow [`secrets.md §11.12`](./secrets.md#1112-redis-upstash) for full setup. Highlights:

- The API **refuses to start in production without `HOSPEDA_REDIS_URL`**.
- Set the eviction policy to `allkeys-lru` (default `noeviction` breaks the rate limiter).
- Use the TCP form (`redis://...`), not the REST form.

Env vars produced:

- `HOSPEDA_REDIS_URL`
- `HOSPEDA_RATE_LIMIT_BACKEND=redis` (set explicitly in production)

**Validation**.

```bash
redis-cli -u "$HOSPEDA_REDIS_URL" PING
```

Expect `PONG`.

### 1.12 ExchangeRate-API

**What it is**. Multi-currency conversion rates (USD, EUR, etc.) used by the billing layer.

Follow [`secrets.md §11.11`](./secrets.md#1111-exchangerate-api) for full setup.

Env vars produced:

- `HOSPEDA_EXCHANGE_RATE_API_KEY`
- `HOSPEDA_EXCHANGE_RATE_API_BASE_URL`
- `HOSPEDA_DOLAR_API_BASE_URL` (separate, free, no key)

### Phase 1 validation

By the end of this phase, your password manager should hold every value listed in [`secrets.md §1`-`§4`](./secrets.md#1-github-actions-secrets) and you should have run the per-service curl validations against each provider. Do not proceed until each provider returns the expected response.

---

## Phase 2: Domains and DNS

Hospeda's production domain pattern is `.ar` (Argentina market). The three apps share the apex.

| App | Production hostname |
|-----|---------------------|
| Web | `hospeda.ar` (and `www.hospeda.ar`) |
| API | `api.hospeda.ar` |
| Admin | `admin.hospeda.ar` |

Staging mirrors the production naming pattern under the `staging.hospeda.ar` zone (nested subdomain pattern):

| App | Staging hostname |
|-----|------------------|
| Web | `staging.hospeda.ar` |
| API | `api.staging.hospeda.ar` |
| Admin | `admin.staging.hospeda.ar` |

A single wildcard certificate (`*.staging.hospeda.ar`) covers all three. See [`environments.md → Domain Pattern`](environments.md#domain-pattern) for the full DNS record list and rationale.

### Steps

1. **Acquire the apex domain**. Register `hospeda.ar` through a NIC.ar accredited registrar. Country-code `.ar` requires Argentine CUIT/CUIL or local representation. Allow 24-48h for delegation.

2. **Configure DNS at the registrar**. Use one of:
    - **Vercel-managed nameservers** (recommended): set the registrar's nameservers to the four addresses Vercel provides under Project → Settings → Domains.
    - **Registrar-managed records**: add `A`/`CNAME` records pointing at Vercel's IP and `cname.vercel-dns.com`.

3. **Add the domains to each Vercel project**. In the Vercel dashboard:
    - `hospeda-api` → add `api.hospeda.ar` and `api.staging.hospeda.ar`
    - `hospeda-web` → add `hospeda.ar`, `www.hospeda.ar` (with the `www → apex` redirect Vercel offers automatically), and `staging.hospeda.ar`
    - `hospeda-admin` → add `admin.hospeda.ar` and `admin.staging.hospeda.ar`

    Production domains are scoped to the **Production** environment; staging domains to **Preview** (Vercel calls staging "preview" in their environment model). Vercel auto-provisions Let's Encrypt SSL certificates, including the `*.staging.hospeda.ar` wildcard. No manual cert work.

4. **Add the Resend DNS records** from Phase 1.6. SPF, DKIM, and DMARC must all show as `Verified` in the Resend dashboard before transactional email works.

5. **Update Better Auth `trustedOrigins`**. The list lives in `apps/api/src/lib/auth.ts`. Confirm production hostnames are present. The runtime `HOSPEDA_API_URL`, `HOSPEDA_SITE_URL`, and `HOSPEDA_ADMIN_URL` env vars are also consumed by the CORS and CSRF middleware.

6. **Update OAuth redirect URIs**. Add the production callback URLs to:
    - Google Cloud Console → OAuth 2.0 client → Authorized redirect URIs: `https://api.hospeda.ar/api/auth/callback/google`. Per [`secrets.md §11.8`](./secrets.md#118-google-oauth).
    - Meta for Developers → Facebook Login → Settings: `https://api.hospeda.ar/api/auth/callback/facebook`. Per [`secrets.md §11.9`](./secrets.md#119-facebook-oauth).

### Validation

```bash
# DNS resolves
dig +short hospeda.ar
dig +short api.hospeda.ar
dig +short admin.hospeda.ar

# SSL is provisioned (after Vercel finishes — usually within 5 minutes of adding the domain)
curl -I https://hospeda.ar
curl -I https://api.hospeda.ar
curl -I https://admin.hospeda.ar

# Resend records resolve
dig +short TXT hospeda.ar | grep "v=spf1"
dig +short CNAME resend._domainkey.hospeda.ar
dig +short TXT _dmarc.hospeda.ar
```

Each should return non-empty. If DNS is not propagated after 1 hour, double-check the registrar nameservers.

---

## Phase 3: Vercel environment variables

Now paste the values stashed in Phase 1 into each Vercel project. The full per-app variable inventory lives in [`secrets.md §2`](./secrets.md#2-vercel-environment-variables--api-appsapi) (API), [`§3`](./secrets.md#3-vercel-environment-variables--web-appsweb) (Web), and [`§4`](./secrets.md#4-vercel-environment-variables--admin-appsadmin) (Admin). Do not duplicate that list here.

### Two ways to set the variables

**Option A: dashboard (recommended for the first-time setup).**

1. Open each Vercel project → Settings → Environment Variables.
2. For each variable in `secrets.md §2`-`§4`, click **Add New**, enter the name verbatim, paste the value, and select the target environments (`Production` and `Preview` for most). The "Env" column in `secrets.md` indicates the correct scope.
3. Save.

**Option B: `pnpm env:push`.**

If your local `.env.local` files already hold every required value, push them in bulk:

```bash
cd apps/api && vercel link
cd apps/api && pnpm env:push
# repeat for apps/web and apps/admin
```

`pnpm env:push` shows a per-variable diff and asks for confirmation. Reference: [`docs/deployment/environments.md §Workflow`](environments.md#workflow-envcheck-envpull-envpush).

### Critical variables to double-check

These are the variables most often missed or set incorrectly. Cross-reference each against `secrets.md` before continuing.

- `HOSPEDA_REVALIDATION_SECRET` must be **identical** between the API project and the Web project. Min 32 chars. Without parity, ISR cache invalidation silently no-ops.
- `HOSPEDA_CRON_SECRET` must be set on the API project. Without it, all six Vercel cron jobs silently fail.
- `HOSPEDA_REDIS_URL` must be set on the API project. Without it, the API refuses to start.
- `API_RATE_LIMIT_TRUST_PROXY=true` on the API project. Without it, the rate limiter sees Vercel's internal IP and effectively disables per-IP rate limiting.
- `HOSPEDA_MERCADO_PAGO_SANDBOX=false` on the API project for production (and the token must be `APP_USR-*`).
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` on each app project's **build-time** environment for source map uploads.

### Validation

After all values are saved, validate sync from your local machine:

```bash
cd apps/api && vercel env pull .env.vercel.production --environment=production
cd apps/api && pnpm env:check --ci
cd apps/web && pnpm env:check --ci
cd apps/admin && pnpm env:check --ci
```

`pnpm env:check --ci` exits non-zero on any missing required var. The CD workflows run this same check before every deploy (per `cd-production.yml` lines 43-44).

---

## Phase 4: Database initialization

Hospeda uses `drizzle-kit push` (no migration files) plus a manual SQL extras script for triggers, materialized views, and JSONB CHECK constraints. See [`docs/decisions/ADR-017-postgres-specific-features.md`](../decisions/ADR-017-postgres-specific-features.md) for the rationale.

For full reference of the seed system (CLI flags, manifests, step IDs, idempotency rules), see [`packages/seed/CLAUDE.md`](../../packages/seed/CLAUDE.md).

### Why the default `pnpm db:seed` is NOT safe for production

The root-level `pnpm db:seed` script resolves to:

```bash
pnpm --filter @repo/seed seed --reset --required --example
```

That command is wrong for a production database for three independent reasons:

1. **`--reset` wipes the database**. It drops every table before reseeding. Running it against a live Neon project destroys data unrecoverably.
2. **`--example` loads demo content**. Faker-generated accommodations, posts, events, reviews, and bookmarks land in the public site. Acceptable in dev, never in prod.
3. **`--required` includes a hardcoded `users` step**. The `users` step in [`packages/seed/src/manifest-required.json`](../../packages/seed/src/manifest-required.json) seeds [`packages/seed/src/data/user/required/admin-user.json`](../../packages/seed/src/data/user/required/admin-user.json) and `super-admin-user.json`, both with the well-known email `admin@hospeda.com`. Loading these on prod creates an admin account with predictable credentials that an attacker can impersonate via OAuth or password reset.

The day-1 production seed must therefore be a curated `--required` run that **excludes the `users` step**, and the first real admin must be created through the normal Better Auth signup flow and then promoted manually.

### Steps

1. Export the **direct** Neon URL (not the pooled URL) into your shell so Drizzle can use prepared statements.

    ```bash
    export HOSPEDA_DATABASE_URL='postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/hospeda?sslmode=require'
    ```

2. Apply the schema.

    ```bash
    pnpm db:migrate
    ```

3. Apply the manual Postgres extras (triggers, materialized views, JSONB CHECK constraints). This script is idempotent.

    ```bash
    bash packages/db/scripts/apply-postgres-extras.sh
    ```

    The full triggers manifest lives in [`packages/db/docs/triggers-manifest.md`](../../packages/db/docs/triggers-manifest.md).

4. Seed the curated production-safe required data. This runs every required step **except `users`** so no hardcoded admin credentials are loaded.

    ```bash
    pnpm --filter @repo/seed seed --required --exclude=users
    ```

    Notes on the flags:
    - **No `--reset`**: leaves any existing data untouched. Required for any rerun against a live database.
    - **No `--example`**: skips Faker-generated demo data (accommodations, posts, reviews, bookmarks).
    - **`--exclude=users`**: skips the hardcoded `admin@hospeda.com` and `super-admin@hospeda.com` records. Step IDs accepted by `--exclude=` are the keys in [`packages/seed/src/manifest-required.json`](../../packages/seed/src/manifest-required.json) (e.g., `users`, `attractions`, `destinations`).

    What this DOES seed in prod:
    - System user, INTERNAL tags, SYSTEM tags, post tags
    - Role permissions
    - Amenities, features, attractions, destinations
    - Sponsorship levels and packages
    - Billing entitlements, limits, plans, add-ons, promo codes
    - Exchange rate config and initial rates
    - Revalidation config

    What this does NOT seed (and how to add it manually): see step 5.

5. Create the first admin user through Better Auth signup, then promote.

    a. Visit `https://hospeda.ar/auth/sign-up` (or the staging URL during dry-runs) and complete the signup flow with the **real** admin email address. Use Google OAuth or email/password — both flows produce a row in `users` with `role = 'USER'`.

    b. Promote that user to `SUPER_ADMIN` directly in the database. There is no admin UI for this until at least one admin already exists, so the bootstrap promotion has to be a manual SQL update against the production DB:

    ```bash
    psql "$HOSPEDA_DATABASE_URL" -c "UPDATE users SET role = 'SUPER_ADMIN' WHERE email = '<your-admin-email>';"
    ```

    Replace `<your-admin-email>` with the address used in step 5.a. Verify exactly one row is reported as updated. After this point, every subsequent role change must go through `UserService.assignRole` (see [`packages/service-core/CLAUDE.md`](../../packages/service-core/CLAUDE.md)) — never via raw SQL.

    c. Sign out and sign back in so the session cookie picks up the new role. Visit `https://admin.hospeda.ar` and confirm the admin panel loads.

6. Switch your shell back to the **pooled** URL (`?pgbouncer=true`) so future connections from the API use pgbouncer.

### Validation

```bash
psql "$HOSPEDA_DATABASE_URL" -c "\dt"
psql "$HOSPEDA_DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
psql "$HOSPEDA_DATABASE_URL" -c "SELECT email, role FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN');"
psql "$HOSPEDA_DATABASE_URL" -c "SELECT matviewname FROM pg_matviews;"
```

Expect tables to exist, the `users` count to equal the number of accounts you created via signup in step 5 (typically 1), exactly one of those users to have role `SUPER_ADMIN`, and the `search_index` materialized view to be present.

Or use `pnpm db:studio` and inspect visually.

---

## Phase 5: GitHub Actions secrets

The CD workflows ([`cd-production.yml`](../../.github/workflows/cd-production.yml), [`cd-staging.yml`](../../.github/workflows/cd-staging.yml)) and the CI workflow ([`ci.yml`](../../.github/workflows/ci.yml)) consume a small set of secrets from the GitHub repository.

### Steps

1. Open the repository → Settings → Secrets and variables → Actions.

2. Add **repository-level** secrets (visible to all workflows). Refer to [`secrets.md §1`](./secrets.md#1-github-actions-secrets) for the full table:

    - `VERCEL_TOKEN`
    - `VERCEL_ORG_ID`
    - `VERCEL_PROJECT_ID_API`
    - `VERCEL_PROJECT_ID_WEB`
    - `VERCEL_PROJECT_ID_ADMIN`
    - `HOSPEDA_DATABASE_URL` (CI test database, separate from prod)
    - `HOSPEDA_BETTER_AUTH_SECRET` (CI may use a throwaway 32-char value)
    - `HOSPEDA_API_URL`
    - `HOSPEDA_SITE_URL`

3. Create two **GitHub Environments** for environment-scoped secrets and variables.

    - Settings → Environments → **New environment** → name: `production`. Add required reviewers if you want manual approval before each prod deploy.
    - Repeat for `staging`.

4. Add **environment-scoped variables** (used by `cd-production.yml` for the smoke test step):

    - In `production` environment → **Variables** → add `HOSPEDA_API_URL=https://api.hospeda.ar` and `HOSPEDA_SITE_URL=https://hospeda.ar`.
    - In `staging` environment → add `HOSPEDA_API_URL=https://api.staging.hospeda.ar` and `HOSPEDA_SITE_URL=https://staging.hospeda.ar`.

5. Add **environment-scoped secrets** if any value differs between staging and production (typically `HOSPEDA_DATABASE_URL`).

### Validation

Trigger a manual workflow run to confirm the secrets are wired up:

```bash
gh workflow run ci.yml
gh run watch
```

The CI workflow should succeed. If it fails on environment validation (`pnpm env:check`), one of the required secrets is missing or misnamed.

---

## Phase 6: First deploy

The first production deploy is just a push to `main`. The workflow runs the CI checks, validates env vars, and deploys all three apps in parallel.

### Steps

1. Confirm the working tree is clean.

    ```bash
    git status
    ```

2. Push to `main` (or trigger the workflow manually if you prefer).

    ```bash
    git push origin main
    # or
    gh workflow run cd-production.yml --ref main
    ```

3. Watch the workflow.

    ```bash
    gh run watch
    ```

    The pipeline runs:
    - `ci` (full quality check, reusable from `ci.yml`)
    - `deploy-api`, `deploy-web`, `deploy-admin` (parallel, each runs `pnpm env:check` first)
    - `verify-production` (curls `/health/live` on the API and the web root)

4. If a deploy job fails on `pnpm env:check`, the missing variable name appears in the log. Add it in Vercel (Phase 3) and re-run the workflow.

5. If a deploy job fails on the Vercel action with `unauthorized`, one of the GitHub secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, or `VERCEL_PROJECT_ID_*`) is incorrect. Re-run `vercel link` in the affected app dir and copy `projectId`/`orgId` from `.vercel/project.json` into GitHub.

### Validation

The `verify-production` job at the end of the workflow exits 0 only if `https://api.hospeda.ar/health/live` and `https://hospeda.ar` both return HTTP 200. If it fails, see the [Troubleshooting](#troubleshooting) section.

---

## Phase 7: Post-deploy validation

This is the manual smoke test. Run every check below. If any fails, it represents a real production issue and must be fixed before opening the platform to users.

### URL reachability

```bash
curl -I https://hospeda.ar
curl -I https://api.hospeda.ar/health/live
curl -I https://admin.hospeda.ar
```

All three return `HTTP/2 200`.

### Sentry

1. Trigger a test event from the API:

    ```bash
    curl -X POST https://api.hospeda.ar/api/v1/debug/sentry-test \
      -H "Authorization: Bearer <admin-jwt>"
    ```

    The endpoint is admin-gated. Generate a JWT with the seeded super-admin user via the auth flow.

2. Open the Sentry `hospeda-api` project. The test event must be present **with a readable stack trace** (not minified). If the trace is minified, `SENTRY_AUTH_TOKEN` was missing during the build — re-run the deploy after fixing it.

3. Repeat from the Web app (visit a page that throws a deliberate error in dev) and the Admin app.

### Logs

Open each Vercel project → **Logs**. Confirm requests are arriving and there are no startup errors. The API on cold start logs:

```
ISR revalidation enabled
Cron adapter: vercel
Rate limit backend: redis
```

Any of those lines saying `DISABLED` indicates a missing env var. Match against [`secrets.md §2.2`](./secrets.md#22-infrastructure-required-in-production).

### Authentication

1. Visit `https://hospeda.ar` and click **Sign in with Google**. The flow must redirect to `accounts.google.com`, prompt for consent, and redirect back to `https://api.hospeda.ar/api/auth/callback/google` then to the web app.
2. Repeat with **Sign in with Facebook**.
3. If you see `redirect_uri_mismatch`, the OAuth dashboard does not have the production callback URL. Fix in Phase 1.8/1.9.

### Billing

Run a sandbox MercadoPago checkout. Per [`secrets.md §11.4`](./secrets.md#114-mercadopago):

```bash
# Create a test buyer with the MercadoPago MCP tool or the dashboard
# Then complete a checkout flow against the production preference endpoint
```

Verify in the Vercel API logs that the webhook fires and the signature passes verification. If the webhook never arrives, the webhook URL or the signing secret is wrong.

### Cron jobs

The API has six Vercel cron jobs configured in `apps/api/vercel.json`. Trigger one manually from the Vercel dashboard → Cron Jobs → **Run Now**. Confirm it logs `Cron job authorized` (not `Unauthorized — missing HOSPEDA_CRON_SECRET`).

### ISR revalidation

Hit the revalidation endpoint from the API to invalidate a Web page:

```bash
curl -X POST "https://api.hospeda.ar/api/v1/admin/revalidate?path=/" \
  -H "Authorization: Bearer <admin-jwt>"
```

The response must include `revalidated: true`. If the API logs `ISR revalidation DISABLED`, the `HOSPEDA_REVALIDATION_SECRET` is missing on the API project. If the Web side ignores the call, the secret on the Web project does not match the API.

### Final env-check sweep

```bash
pnpm env:check --ci
```

Must exit 0 for all three apps.

---

## Phase 8: Monitoring and alerts

### Sentry alert rules

Configure alert rules per [`docs/runbooks/sentry-setup.md`](../runbooks/sentry-setup.md). Minimum:

- New issue → email and Slack channel
- Error rate spike (>10x baseline in 5 min) → page on-call
- Performance regression (p95 above SLO) → email

### Uptime monitoring (BetterStack)

The platform uses [BetterStack](https://betterstack.com) (formerly BetterUptime) for uptime monitoring. The free tier covers **10 monitors with 3-minute checks**, which is enough for the three apps plus auth, billing, search, and cron health probes. Full provider onboarding lives in [`secrets.md §11.13`](./secrets.md#1113-betterstack-uptime-monitoring).

#### Setup steps

1. Create a workspace at [betterstack.com](https://betterstack.com) → name it `Hospeda`.
2. Dashboard → **Monitors → Create monitor** → paste each URL → set **Check frequency** to `3 minutes` → expect HTTP 200.
3. Configure the on-call rota under **On-call** for email and SMS alerts.
4. Repeat for the five initial monitors below.

#### Initial monitors

| Monitor | URL | Why |
|---------|-----|-----|
| Web homepage | `https://hospeda.ar` | Public site reachability |
| API health check | `https://api.hospeda.ar/health` | API liveness |
| Admin login page | `https://admin.hospeda.ar` | Admin panel reachability |
| Auth flow | `https://hospeda.ar/api/auth/sign-in` | Better Auth endpoint reachable |
| Public API smoke | `https://api.hospeda.ar/api/v1/public/accommodations?limit=1` | DB + serialization works end-to-end |

#### Status page

Free tier exposes a status page on a `betterstacktatus.com` subdomain. A custom subdomain (`status.hospeda.ar`) requires the paid tier. TODO: provision `status.hospeda.ar` as a future subdomain once the paid tier is acquired.

### Dashboards to bookmark

| Service | URL |
|---------|-----|
| Vercel | `https://vercel.com/<team>/hospeda-api`, `hospeda-web`, `hospeda-admin` |
| Neon | `https://console.neon.tech/app/projects/<project-id>` |
| Sentry | `https://hospeda.sentry.io` |
| MercadoPago | `https://www.mercadopago.com.ar/developers/panel` |
| Cloudinary | `https://console.cloudinary.com/console/<cloud-name>` |
| Resend | `https://resend.com/domains` |
| Upstash | `https://console.upstash.com/redis` |

---

## Phase 9: Onboarding the next developer

Add new team members to each provider so they can deploy and debug.

| Provider | Where to add |
|----------|-------------|
| GitHub | Repository → Settings → Collaborators (or org-level access) |
| Vercel | Team → Members. Use **Developer** or **Member** role, not **Owner** |
| Sentry | Organization → Members |
| Neon | Project → Sharing |
| Cloudinary | Settings → Users |
| MercadoPago | Developer panel → Team |
| Resend | Settings → Team |
| Upstash | Team → Members |

Document **who owns what** in your team's wiki or Notion. Each provider should have a primary owner and a backup. Rotation responsibility lives in [`docs/deployment/rotation-schedule.md`](rotation-schedule.md).

---

## Troubleshooting

For provider-level issues during onboarding, see the per-service common gotchas in [`secrets.md §11`](./secrets.md#11-per-service-onboarding). For runtime issues after going live, see [`secrets.md §10`](./secrets.md#10-troubleshooting). The table below is a quick-reference for first-time-setup-specific failures.

| Symptom | Likely cause | Where to fix |
|---------|--------------|--------------|
| Vercel deploy fails with `unauthorized` | `VERCEL_TOKEN` or project IDs wrong in GitHub | Phase 5. Re-run `vercel link` and copy `.vercel/project.json` |
| Vercel deploy fails on `pnpm env:check` | Missing required env var on the Vercel project | Phase 3. Compare against `secrets.md §2`-`§4` |
| `https://hospeda.ar` returns "Not found" | DNS not propagated or domain not added to Vercel | Phase 2. `dig +short hospeda.ar` and Vercel → Settings → Domains |
| OAuth sign-in returns `redirect_uri_mismatch` | Production callback URL not on the OAuth client | Phase 1.8 or 1.9. Add the URL in the provider dashboard |
| Sentry events have minified stack traces | `SENTRY_AUTH_TOKEN` was missing at build time | Phase 3. Set the build-time env var on each Vercel project, then redeploy |
| MercadoPago webhook never arrives | Webhook URL wrong, secret wrong, or app in test mode | Phase 1.7 + Phase 7. Verify the URL in the MP developer panel and check API logs for signature errors |
| ISR revalidation logs `DISABLED` | `HOSPEDA_REVALIDATION_SECRET` missing on API | Phase 3. Set the secret on **both** API and Web projects with identical values |
| API logs `Cron job unauthorized` | `HOSPEDA_CRON_SECRET` missing or mismatch | Phase 3. Set on API project. Vercel cron headers carry the secret automatically |
| Resend domain shows `Pending` after 24h | Wrong DNS records at registrar | Phase 2. Re-check SPF, DKIM, DMARC records at the registrar |
| API returns 503 on cold start | `HOSPEDA_REDIS_URL` missing in production | Phase 3. Set the URL on the API Vercel project |
| Rate limit applies to all requests at once | `API_RATE_LIMIT_TRUST_PROXY` not `true` | Phase 3. Set on API project |
| `https://hospeda.ar` works but `https://api.hospeda.ar` is 404 | API project domain not configured or wrong project linked | Phase 2 + Phase 1.1. Confirm `apps/api/.vercel/project.json` `projectId` matches the project that owns `api.hospeda.ar` |

For deeper incident response, see the runbooks in [`docs/runbooks/`](../runbooks/README.md): rollback, backup-recovery, billing-incidents, cloudinary-incidents, monitoring, sentry-setup, scaling, production-bugs.

---

## Cross-references

| Need | Document |
|------|---------|
| Day-to-day deploy checklist | [`docs/deployment/checklist.md`](./checklist.md) |
| Per-app deployment deep dives | [`apps/api.md`](./apps/api.md), [`apps/web.md`](./apps/web.md), [`apps/admin.md`](./apps/admin.md) |
| Per-secret reference and provider onboarding | [`secrets.md`](./secrets.md) (full file) and [`§11`](./secrets.md#11-per-service-onboarding) (provider-specific) |
| Secret rotation schedule and runbook | [`docs/deployment/rotation-schedule.md`](rotation-schedule.md) |
| Environment configuration policy | [`docs/deployment/environments.md`](environments.md) |
| Environment variable management guide | [`docs/guides/environment-variables.md`](../guides/environment-variables.md) |
| CI/CD detailed walkthrough | [`docs/deployment/ci-cd.md`](ci-cd.md) |
| Incident response runbooks | [`docs/runbooks/README.md`](../runbooks/README.md) |
| Database extras script | [`packages/db/scripts/apply-postgres-extras.sh`](../../packages/db/scripts/apply-postgres-extras.sh), [`packages/db/docs/triggers-manifest.md`](../../packages/db/docs/triggers-manifest.md) |
| Postgres-specific features rationale | [`docs/decisions/ADR-017-postgres-specific-features.md`](../decisions/ADR-017-postgres-specific-features.md) |
| Production seeding policy | [`packages/seed/CLAUDE.md`](../../packages/seed/CLAUDE.md) |

---

## Open items

These items are referenced above as `TODO: confirm` and should be tracked as separate tasks before the platform is opened to public traffic.

1. **Custom status page subdomain**. BetterStack free tier exposes the status page on a `betterstacktatus.com` subdomain. Provisioning `status.hospeda.ar` requires upgrading to the paid tier. Decide and provision before public launch.
