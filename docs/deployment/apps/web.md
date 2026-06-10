# Web App Deployment Guide

Complete guide for deploying the Hospeda public-facing web app (`apps/web`) to Vercel.

**Last Updated**: 2026-04-30
**Target Platform**: Vercel
**Framework**: Astro 5 (SSR + ISR) with React islands
**Production Domain Pattern**: `hospeda.com.ar` (Argentina market)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [First-Time Deployment](#first-time-deployment)
4. [Required Environment Variables](#required-environment-variables)
5. [Deploy Commands](#deploy-commands)
6. [Preview Deployments](#preview-deployments)
7. [ISR and Cache Revalidation](#isr-and-cache-revalidation)
8. [Cron Jobs](#cron-jobs)
9. [Smoke Tests Post-Deploy](#smoke-tests-post-deploy)
10. [Rollback](#rollback)
11. [Common Deploy Errors](#common-deploy-errors)
12. [Monitoring](#monitoring)
13. [Performance](#performance)
14. [Cross-References](#cross-references)

---

## Overview

### What is the Web App?

`apps/web` is the public-facing site at `https://hospeda.com.ar`. It is the page tourists see when discovering accommodations, destinations, events, and blog posts in Concepcion del Uruguay and the Litoral region of Argentina.

It is intentionally separate from the admin panel (`apps/admin`) and the REST API (`apps/api`). The web app only consumes the public and protected tiers of the API. It never calls `/api/v1/admin/*`.

### Tech Stack

- **Framework**: Astro 5 with SSR (`output: 'server'`)
- **UI islands**: React 19 (only when interactivity is required)
- **Styling**: vanilla CSS + CSS Modules with design tokens (no Tailwind here. Tailwind is admin-only)
- **Forms**: native HTML + small custom hooks (no TanStack Form here. TanStack Form is admin-only)
- **i18n**: `@repo/i18n` with locales `es` (primary), `en`, `pt`
- **Auth**: Better Auth via `@repo/auth-ui` for the `/mi-cuenta/*` flow
- **Adapter**: `@astrojs/vercel` with ISR and image optimisation
- **Monitoring**: Sentry (`@sentry/astro`) and Vercel Analytics
- **Build output**: `dist/` (set in `apps/web/vercel.json`)

### Deployment Model

| Aspect | Detail |
|--------|--------|
| Platform | Vercel |
| Framework preset | `astro` (set in `vercel.json`) |
| Build command | `cd ../.. && pnpm turbo run build --filter=hospeda-web` |
| Output directory | `dist` |
| Install command | `pnpm install --frozen-lockfile` |
| Node version | 20 |
| Custom domain | `hospeda.com.ar` (production) |
| Root domain redirects | `/` -> `/es/` (configured in `vercel.json`) |
| Trailing slashes | Always (Astro `trailingSlash: 'always'`) |

### Render Strategy Per Page

The web app mixes rendering modes per page (set in `astro.config.mjs`):

| Strategy | Cache | Used by |
|----------|-------|---------|
| **SSR** (default) | Bypass cache | `/auth/*`, `/mi-cuenta/*`, `/busqueda/`, `/feedback/*` |
| **ISR** (default for content pages) | 24h, revalidated by API | `/alojamientos/*`, `/destinos/*`, `/eventos/*`, `/publicaciones/*` |
| **SSG** (`prerender = true`) | Forever (until rebuild) | `/nosotros/`, `/legal/*`, `/faq/`, `/contacto/` |
| **Server Islands** (`server:defer`) | Lazy-rendered fragment | Auth-aware widgets on cached pages |

ISR exclusion is configured in `astro.config.mjs` -> `adapter: vercel({ isr: { exclude: [...] } })`. Edit that array if you add new SSR-only routes.

---

## Prerequisites

Before deploying, you need:

### 1. Accounts

- **Vercel account** with access to the Hospeda team. Ask the project owner to invite you.
- **Neon Postgres** access (read-only is enough for the web app, but the API it talks to needs read/write). The web app does NOT have a direct DB connection in production. It only reads via the API.
- **Cloudinary account** for image hosting. The web app references `res.cloudinary.com` directly via Astro `<Image>`. No client credentials are required, but the API needs them.
- **Sentry project** for error tracking. The web project should be `hospeda-web` under the same org as `hospeda-api` and `hospeda-admin`.
- **GitHub access** to the `hospeda` repo. The CI/CD pipeline needs your PRs to flow through the protected branches.

### 2. Tools

```bash
# Vercel CLI (for manual deploys, env management, log inspection)
npm install -g vercel
vercel --version    # >= 32.0.0

# Login
vercel login

# Verify
vercel whoami
```

```bash
# Local toolchain for building and testing before deploy
node --version      # >= 20.10.0
pnpm --version      # >= 9.x
```

### 3. Repo Setup

```bash
git clone git@github.com:qazuor/hospeda.git
cd hospeda
pnpm install
```

Once linked, check that the web project is linked to Vercel:

```bash
cd apps/web
vercel link
# Follow prompts to link to the Vercel project "hospeda-web"
cat .vercel/project.json
# {"projectId":"prj_xxxx","orgId":"team_xxxx"}
```

### 4. Required Backing Services

Before the first deploy succeeds:

| Service | Used by web | Why |
|---------|-------------|-----|
| **API** (`apps/api`) | Yes | All data fetching: accommodations, destinations, events, posts, auth, billing |
| **Better Auth** | Yes | Session validation for `/mi-cuenta/*` |
| **Cloudinary** | Yes (read-only) | Image CDN for accommodation photos |
| **Sentry** | Optional | Error tracking. Disabled if `PUBLIC_SENTRY_DSN` is unset |
| **Vercel ISR cache** | Yes | Auto-provisioned. Just configure `HOSPEDA_REVALIDATION_SECRET` if you want on-demand revalidation |

The API must be deployed and reachable at the URL set in `PUBLIC_API_URL` BEFORE the web app is deployed. If the API is down, the web app builds fine but every page will fail at request time.

---

## First-Time Deployment

### Step 1. Import Project to Vercel

The web app is part of a monorepo. Vercel must be told the root directory and the build command.

#### Option A. Vercel Dashboard (recommended for first-time)

1. Go to <https://vercel.com/new>.
2. Import the `hospeda` GitHub repository.
3. **Project name**: `hospeda-web`.
4. **Framework preset**: `Astro`. Vercel detects this automatically because `vercel.json` declares `"framework": "astro"`.
5. **Root directory**: `apps/web`. Click "Edit" next to Root Directory and set this manually. Tick "Include source files outside of the Root Directory" so Vercel pulls workspace packages (`@repo/schemas`, `@repo/i18n`, etc.).
6. **Build command**: leave it as the value from `vercel.json` (`cd ../.. && pnpm turbo run build --filter=hospeda-web`). Vercel reads this automatically.
7. **Output directory**: `dist` (also from `vercel.json`).
8. **Install command**: `pnpm install --frozen-lockfile`.
9. **Node version**: 20 (set via project settings or repo `package.json` `engines.node`).
10. Add the required environment variables (see [Required Environment Variables](#required-environment-variables) below). Skip this step at your peril. The build will fail if `PUBLIC_API_URL` or `PUBLIC_SITE_URL` are missing.
11. Click "Deploy".

The first build takes ~3-5 minutes (workspace install + Turbo build pipeline).

#### Option B. Vercel CLI

```bash
cd apps/web
vercel
# Follow prompts. Answer Y to "link to existing project" if available.
# Otherwise let it create a new one and pick the team/scope.
```

This produces a preview deployment. Promote to production with `vercel --prod` once you have validated the preview.

### Step 2. Configure Custom Domain

1. Vercel assigns a default URL like `https://hospeda-web.vercel.app`. This works but is not the production domain.
2. In the Vercel project settings, go to **Domains** and add `hospeda.com.ar` and `www.hospeda.com.ar`.
3. Configure DNS at your registrar (Cloudflare, Namecheap, etc.):

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | `A` | `@` (apex) | `76.76.21.21` | Auto |
   | `CNAME` | `www` | `cname.vercel-dns.com` | Auto |

   Apex records on Vercel use an `A` record pointing to a Vercel anycast IP. The exact IP is shown in the Vercel domain configuration screen. If your registrar supports `ALIAS` or `ANAME` records (Cloudflare flattening, DNSimple ALIAS), use that to point `@` at `cname.vercel-dns.com`.

4. Wait for DNS propagation (5-60 minutes). Vercel polls the domain and shows "Valid Configuration" once the records resolve.
5. Decide which domain is canonical. Recommended: redirect `www.hospeda.com.ar` -> `hospeda.com.ar` in Vercel domain settings.

### Step 3. SSL/TLS

Vercel auto-provisions a Let's Encrypt certificate for every domain attached to the project. You do not need to do anything. HTTP requests are auto-redirected to HTTPS.

If the cert fails to issue, check that your DNS is fully propagated. Vercel cannot issue a cert until it can validate ownership of the domain.

### Step 4. Verify First Deployment

```bash
# Check the deployment URL
curl -I https://hospeda.com.ar
# HTTP/2 308   (redirect from / to /es/)

curl -I https://hospeda.com.ar/es/
# HTTP/2 200
```

If you get a 500 or a build failure, jump to [Common Deploy Errors](#common-deploy-errors).

---

## Required Environment Variables

The web app reads variables from two prefix families:

- **`PUBLIC_*`**: Astro convention. These are inlined into the client bundle at build time. Do NOT put secrets here.
- **`HOSPEDA_*`**: server-only. Read by the SSR Astro server (Vercel Function) and never shipped to the browser.

The full registry lives in `packages/config/src/env-registry.client.ts` (`PUBLIC_*` for web) and `packages/config/src/env-registry.hospeda.ts` (`HOSPEDA_*`). The CI workflow `.github/workflows/cd-production.yml` runs `pnpm env:check` before each deploy to validate against the registry.

For the canonical list across all apps, see [`docs/deployment/secrets.md`](../secrets.md). The web-specific subset is below.

### Required at Build Time

These must be present BEFORE the build runs. The `astro.config.mjs` reads them and inlines them via `vite.define`.

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `PUBLIC_API_URL` | URL | `https://api.hospeda.com.ar` | API base URL. Inlined into the browser bundle and used by `lib/api/client.ts`. |
| `PUBLIC_SITE_URL` | URL | `https://hospeda.com.ar` | Web app base URL. Used for canonical links, sitemap, og:url, JSON-LD. |

If either is missing at build time, the build fails fast at the top of `astro.config.mjs` with `[env] Missing required URL env vars`. There is no graceful fallback. This is intentional. A misconfigured site URL would poison every canonical tag and OG card on the live site.

### Required at Runtime (SSR)

These are read by the Vercel Function on every SSR/ISR request.

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `HOSPEDA_BETTER_AUTH_URL` | URL | `https://api.hospeda.com.ar/api/auth` | Server-side Better Auth endpoint. Used by middleware to validate sessions for `/mi-cuenta/*`. |

> Note: in dev, `HOSPEDA_API_URL` and `HOSPEDA_SITE_URL` may be set instead of the `PUBLIC_*` pair. The build script accepts either. In production, prefer `PUBLIC_*` so the values are inlined for the browser.

### Optional: ISR On-Demand Revalidation

| Variable | Type | Example | Purpose |
|----------|------|---------|---------|
| `HOSPEDA_REVALIDATION_SECRET` | string (min 32 chars) | `<openssl rand -base64 32>` | Bypass token for `@astrojs/vercel` ISR. Lets the API push a "this page has new content, evict the cache" request. Must match the value set in the API project. |

If unset, ISR still works on the natural expiration (24h, set via `isr.expiration: 86400` in `astro.config.mjs`), but you cannot trigger an immediate refresh. See [ISR and Cache Revalidation](#isr-and-cache-revalidation).

### Optional: Monitoring

| Variable | Type | Required | Example | Purpose |
|----------|------|----------|---------|---------|
| `PUBLIC_SENTRY_DSN` | URL | Optional but strongly recommended in prod | `https://xxxx@o0.ingest.sentry.io/xxxx` | Sentry DSN for client-side and SSR error tracking. If unset, Sentry is fully disabled. |
| `PUBLIC_SENTRY_RELEASE` | string | Optional | `1.0.0` or `$VERCEL_GIT_COMMIT_SHA` | Release identifier in Sentry. The build pre-fills this from `VERCEL_GIT_COMMIT_SHA` automatically. |
| `SENTRY_AUTH_TOKEN` | string (secret) | Required for source maps | `sntrys_xxxx` | Build-time only. Uploads sourcemaps so production stack traces are readable. Without it, stack traces are minified gibberish. |
| `SENTRY_ORG` | string | Required when token is set | `qazuor` | Sentry org slug. |
| `SENTRY_PROJECT` | string | Required when token is set | `hospeda-web` | Sentry project slug. |

### Optional: Feature Flags and Diagnostics

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `PUBLIC_ENABLE_LOGGING` | boolean | `false` | Enable verbose `console.log` from `lib/logger.ts`. Useful only for staging diagnostics. Always keep `false` in prod. |
| `PUBLIC_VERSION` | string | unset | App version string surfaced in the feedback widget. Set it to the deployed git SHA or release tag. |
| `PUBLIC_ADMIN_URL` | URL | unset | Admin app URL. Used to render "Open in admin" links from public listing pages. |

### Build-Time vs Runtime Cheatsheet

| Variable | Available at build? | Available at runtime SSR? | Available in browser? |
|----------|---------------------|---------------------------|------------------------|
| `PUBLIC_API_URL` | Yes (inlined) | Yes | Yes |
| `PUBLIC_SITE_URL` | Yes (inlined) | Yes | Yes |
| `PUBLIC_SENTRY_DSN` | Yes | Yes | Yes |
| `PUBLIC_SENTRY_RELEASE` | Yes | Yes | Yes |
| `HOSPEDA_BETTER_AUTH_URL` | Yes | Yes | NO |
| `HOSPEDA_REVALIDATION_SECRET` | Yes | Yes | NO |
| `SENTRY_AUTH_TOKEN` | Yes | NO (build-only) | NO |
| `SENTRY_ORG` | Yes | NO | NO |
| `SENTRY_PROJECT` | Yes | NO | NO |

If you change any `PUBLIC_*` variable, you MUST redeploy. They are inlined at build time. Editing them in Vercel without redeploying does nothing.

### Setting Variables

#### Via Vercel Dashboard

1. Open the `hospeda-web` project.
2. Settings -> Environment Variables.
3. Click "Add New".
4. Name, value, environments (Production, Preview, Development).
5. Save. Trigger a redeploy if it is a `PUBLIC_*` variable.

#### Via Vercel CLI

```bash
cd apps/web
vercel env add PUBLIC_API_URL production
# Paste: https://api.hospeda.com.ar

# Pull all env vars to a local file (gitignored)
vercel env pull .env.local
```

#### Via the Monorepo Helper

The repo has helper scripts in `packages/config`:

```bash
# Validate that local env matches the registry
pnpm env:check

# Pull env vars from Vercel into apps/web/.env.local
pnpm env:pull

# Push apps/web/.env.local back to Vercel
pnpm env:push
```

`pnpm env:check` is run automatically by both `cd-production.yml` and `cd-staging.yml`. If a required variable is missing, the deploy aborts before any build happens.

---

## Deploy Commands

### Automatic (Preferred)

The CI/CD pipelines run on push:

| Branch | Workflow | Vercel mode |
|--------|----------|-------------|
| `main` | `.github/workflows/cd-production.yml` | `vercel-args: '--prod'` |
| `staging` | `.github/workflows/cd-staging.yml` | preview |

Both workflows:

1. Run `ci.yml` (lint + typecheck + tests) as a quality gate.
2. Run `pnpm env:check` to validate env vars against the registry.
3. Deploy each app (api, web, admin) to Vercel via `amondnet/vercel-action@v25`.
4. On production, run `verify-production` which curls `${HOSPEDA_API_URL}/health/live` and `${HOSPEDA_SITE_URL}` to confirm both services respond.

You should never need to deploy manually under normal circumstances. Push to `main`, watch the GitHub Actions tab.

### Manual (Fallback)

When CI is broken or you need a hotfix push, deploy from your machine:

```bash
# From repo root
pnpm deploy:web
# Equivalent to: vercel deploy --prod --cwd apps/web
```

Or from the app directory:

```bash
cd apps/web

# Production
vercel --prod

# Preview (a unique URL, not aliased to the production domain)
vercel
```

The local manual deploy still uses the build command and env vars from the linked Vercel project. It does NOT bypass the quality gate. Run `pnpm test` and `pnpm typecheck` yourself before pushing.

There is also a "deploy everything" helper:

```bash
pnpm deploy:all
# Runs: deploy:api && deploy:web && deploy:admin
```

Use this only if you have already validated all three apps build cleanly. The order matters. API first, then web, then admin. If the API is down, web's runtime requests fail.

### Verifying a Manual Deploy

```bash
# List recent deployments
vercel ls hospeda-web

# Inspect a specific deployment URL
curl -I https://hospeda-web-<hash>.vercel.app/es/
```

---

## Preview Deployments

Every PR opened against `main` automatically gets a preview deployment.

### How They Work

1. You push a feature branch and open a PR.
2. Vercel's GitHub integration detects the push.
3. It builds and deploys to a unique URL like `https://hospeda-web-git-feature-name-qazuor.vercel.app`.
4. The PR gets a comment from the Vercel bot with the URL.
5. Each subsequent push updates the same preview URL.

### What Env Vars Apply

Preview deployments use any env var with the **Preview** scope in Vercel. Set staging-only values for these so you do not accidentally hit production data.

Recommended preview scope:

- `PUBLIC_API_URL=https://api.staging.hospeda.com.ar`
- `PUBLIC_SITE_URL=https://staging.hospeda.com.ar`
- `HOSPEDA_BETTER_AUTH_URL=https://api.staging.hospeda.com.ar/api/auth`

### Use Cases

- **PR review**: a reviewer can click the preview URL to see your changes live.
- **QA**: stage features in a production-like environment before merging.
- **Stakeholder demo**: share the preview URL with non-engineers for sign-off.

### Limits

- Free Vercel tier: previews are public. Lock down with deployment protection (Settings -> Deployment Protection -> Vercel Authentication) if needed.
- Previews share the production API by default unless you override `PUBLIC_API_URL` for the preview environment.

---

## ISR and Cache Revalidation

The web app uses Incremental Static Regeneration via `@astrojs/vercel`. This means content pages (`/alojamientos/*`, `/destinos/*`, etc.) are cached at the edge for 24h and re-rendered on the next request after expiry.

### Configuration

In `astro.config.mjs`:

```js
adapter: vercel({
  isr: {
    expiration: 86400,   // 24h
    bypassToken: process.env.HOSPEDA_REVALIDATION_SECRET,
    exclude: [/^(\/(?:en|pt))?\/(auth|mi-cuenta|busqueda|feedback)(\/.*)?$/]
  }
})
```

- **expiration**: 86400 seconds (24h). After a page is rendered, the cached HTML is served for 24h. The next request after that triggers a fresh SSR.
- **bypassToken**: when present, allows on-demand revalidation. The API can ping the page with this token in a header, and Vercel will evict the cache and re-render immediately.
- **exclude**: SSR-only routes that must always render fresh. Auth, user account, search, and feedback are never cached because they depend on session state.

### On-Demand Revalidation Flow

When content changes in the admin (e.g., an accommodation gets a new photo), the API can trigger a revalidation:

1. Admin user updates the accommodation.
2. API service finishes the DB write.
3. API calls Vercel's revalidation endpoint with `HOSPEDA_REVALIDATION_SECRET` in the bypass header.
4. Vercel evicts the cached page.
5. Next visitor triggers a fresh SSR with the new data.

This requires `HOSPEDA_REVALIDATION_SECRET` to be set with the SAME value in both the API and the web Vercel projects. If it does not match, revalidation requests are rejected and stale content stays in the cache for up to 24h.

> **TODO: verify with maintainer**. The exact API endpoint that triggers revalidation is not yet documented in this repo. Check `apps/api/src/services/revalidation` or grep for `HOSPEDA_REVALIDATION_SECRET` in the API codebase to confirm the call shape.

### Manual Revalidation

If you change a page and want to force the cache to refresh without waiting 24h:

```bash
# Replace <secret> and <path> with real values
curl -X POST "https://hospeda.com.ar/<path>" \
  -H "x-prerender-revalidate: <secret>"
```

> **TODO: verify with maintainer**. The exact header name used by the `@astrojs/vercel` ISR bypass is `x-prerender-revalidate` per Vercel's docs, but the implementation in the API may use a different header. Confirm before relying on this.

---

## Cron Jobs

The web app does NOT define any cron jobs.

`apps/web/vercel.json` contains only redirects and security headers. There is no `crons` array.

All cron jobs in the system run on the API project (`apps/api`). See `apps/api/vercel.json` and [`docs/deployment/apps/api.md`](./api.md) for the cron list.

If you need a scheduled task that does work via the web app (e.g., sitemap regeneration), the recommended pattern is:

1. Add the cron to `apps/api/vercel.json`.
2. Have the API call the relevant web endpoint (with `HOSPEDA_REVALIDATION_SECRET` if it needs to evict caches).

Do not add cron jobs to `apps/web/vercel.json` unless you have a strong reason. Keeping them centralised in the API simplifies operations and avoids two systems competing on the same secret.

---

## Smoke Tests Post-Deploy

Run these checks after every production deploy. They catch the 90% of deploy regressions that automated CI does not catch.

### Status Code Checks

```bash
SITE=https://hospeda.com.ar

# Apex redirect
curl -I "${SITE}"
# Expected: HTTP/2 308, Location: /es/

# Spanish homepage
curl -I "${SITE}/es/"
# Expected: HTTP/2 200, content-type: text/html

# English homepage
curl -I "${SITE}/en/"
# Expected: HTTP/2 200

# Portuguese homepage
curl -I "${SITE}/pt/"
# Expected: HTTP/2 200

# Listing pages (ISR)
curl -I "${SITE}/es/alojamientos/"
curl -I "${SITE}/es/destinos/"
curl -I "${SITE}/es/eventos/"
curl -I "${SITE}/es/publicaciones/"
# All expected: HTTP/2 200

# Auth (SSR, never cached)
curl -I "${SITE}/es/auth/sign-in/"
# Expected: HTTP/2 200, cache-control: no-store

# Static pages (SSG)
curl -I "${SITE}/es/contacto/"
curl -I "${SITE}/es/faq/"
# Expected: HTTP/2 200

# 404
curl -I "${SITE}/es/this-page-does-not-exist/"
# Expected: HTTP/2 404

# Sitemap
curl -I "${SITE}/sitemap-index.xml"
# Expected: HTTP/2 200, content-type: application/xml
```

### Functional Checks (Browser)

These need a real browser. Use Playwright, Chrome DevTools, or just clicking around:

- [ ] Homepage at `/es/` renders with hero, accommodation cards, and footer.
- [ ] Locale switcher works: navigate from `/es/` to `/en/` and back. The page does not flash unstyled content.
- [ ] An accommodation detail page like `/es/alojamientos/cabana-rio/` (replace with a real slug) shows photos via Cloudinary, price, amenities, and a "Reservar" button.
- [ ] Search at `/es/busqueda/?q=cabin` returns results.
- [ ] `/es/auth/sign-in/` shows the Better Auth form (no console errors).
- [ ] After signing in, `/es/mi-cuenta/` loads. Sign out works.
- [ ] Theme toggle (light/dark) persists across page reloads.
- [ ] No JavaScript errors in the console on any of the above pages.

### Sample Real URLs

The exact slugs depend on seeded data. Pick one of each from a recent admin export:

```text
${SITE}/es/alojamientos/<slug>/
${SITE}/es/destinos/<slug>/
${SITE}/es/eventos/<slug>/
${SITE}/es/publicaciones/<slug>/
```

If you do not know any real slugs, hit `/es/alojamientos/` and follow the first card.

---

## Rollback

If a deploy breaks production, roll back immediately. Investigate later.

### Vercel Dashboard (Fastest)

1. Open the `hospeda-web` project.
2. Click the **Deployments** tab.
3. Find the last known-good deployment (typically the previous green one).
4. Click the `...` menu -> **Promote to Production**.
5. Confirm.

The switch is instant (under a second). Vercel keeps every deployment URL alive, so promotion is just a routing change.

### Vercel CLI

```bash
cd apps/web

# List recent deployments
vercel ls hospeda-web

# Promote a specific URL
vercel promote https://hospeda-web-<hash>.vercel.app
```

Or use `vercel rollback` to roll back to the previous deployment:

```bash
vercel rollback
# Prompts to confirm. Rolls back to the deployment immediately before the current production.
```

### After Rollback

1. Verify with smoke tests above.
2. Open a Sentry issue or post-mortem if data may have been corrupted.
3. Identify the bad commit. Use `git log --oneline` and the deploy logs in Vercel.
4. Fix on a feature branch, merge a PR, let the CD pipeline redeploy.

NEVER `git revert` and force-push to `main` to "undo" a deploy. The CI/CD model is forward-only. Rolling back the deployment + fixing in a new commit keeps the audit trail clean.

---

## Common Deploy Errors

### Build OOM (Out of Memory)

**Symptom**: Build logs show `JavaScript heap out of memory` or the build is killed at ~90% completion.

**Cause**: Astro builds can be memory-hungry, especially with large image manifests or many MDX pages. Vercel's default build environment has 8GB.

**Fix**:

1. Check if the build is fetching too many images at build time. The web app uses Cloudinary remote images, but Astro still does some processing. Look for `<Image src="/image.jpg" />` references that should be `<img loading="lazy" />` instead.
2. Increase Node memory in the build command:

   ```json
   "buildCommand": "cd ../.. && NODE_OPTIONS=--max-old-space-size=4096 pnpm turbo run build --filter=hospeda-web"
   ```

3. If the issue persists, raise it with the maintainer. The Pro plan offers larger build environments. **TODO: verify with maintainer. The repo has not yet hit OOM in production, so this fix is preventative.**

### Missing `PUBLIC_*` Vars at Build Time

**Symptom**: Build fails with `[env] Missing required URL env vars. Set HOSPEDA_API_URL/PUBLIC_API_URL and HOSPEDA_SITE_URL/PUBLIC_SITE_URL.`

**Cause**: `astro.config.mjs` validates the URL pair at the top of the file and `process.exit(1)`s if either is missing. Vercel did not pass them through.

**Fix**:

1. Confirm the variables exist in Vercel project settings, scoped to **Production** AND **Preview** if you want previews to build.
2. Confirm the names are exact: `PUBLIC_API_URL` (not `PUBLIC_API` or `API_URL`).
3. Trigger a fresh deploy. `PUBLIC_*` vars are inlined at build time. Editing them in Vercel does NOT affect existing deployments. You must redeploy.

### Runtime Confusion: PUBLIC_vs HOSPEDA_

**Symptom**: Auth works in dev but not in prod, or `Better Auth URL is undefined` errors at runtime.

**Cause**: In dev you set `HOSPEDA_BETTER_AUTH_URL` in `.env.local`. In prod the same variable exists in the Vercel project, BUT a new SSR endpoint is reading `import.meta.env.PUBLIC_BETTER_AUTH_URL` because someone confused server-side and client-side conventions.

**Fix**:

1. Server-side endpoints (Astro `.astro` SSR or `pages/api/*`) read `process.env.HOSPEDA_*`.
2. Browser code reads `import.meta.env.PUBLIC_*`.
3. NEVER ship a `HOSPEDA_*` value into a browser bundle. It will be `undefined` at runtime.
4. Use `src/env.ts` (Zod-validated) to get a typed env. Do not call `import.meta.env` directly.

### i18n Locale Fallback Missing

**Symptom**: A page renders in English even when locale is `pt` (or vice versa), or a page crashes with `Cannot read property 'translate' of undefined`.

**Cause**: A locale file is missing a key. By design, `en` and `pt` fall back to `es` until translated. If a key is missing in `es` too, it crashes.

**Fix**:

1. Find the missing key. Check `packages/i18n/locales/es/*.json` for the namespace and key.
2. Add the missing entry. Run `pnpm test` to confirm i18n consistency tests pass.
3. If the page is high-priority and you cannot translate immediately, add the key in `es` only. The fallback chain `pt -> es` and `en -> es` handles the rest.

### Cloudinary Image 404 / Invalid Transformation

**Symptom**: Accommodation photos show as broken icons. DevTools shows 404 from `res.cloudinary.com`.

**Cause**:

1. `astro.config.mjs` `image.remotePatterns` does not include `res.cloudinary.com` (it should, per the current config).
2. The Cloudinary cloud name is wrong, so URLs point at a non-existent account.
3. The transformation string is malformed.

**Fix**:

1. Open the network tab and inspect the failing URL. Copy it into a new tab.
2. If it shows "resource not found", the cloud name is wrong or the image was never uploaded. Check the API service that uploads images to Cloudinary (the API owns this, not the web app).
3. If `astro.config.mjs` was modified and `res.cloudinary.com` was removed from `image.remotePatterns`, restore it. The build will fail at runtime when Astro tries to optimise an unauthorised remote.
4. The web app source must NOT import `@repo/media/server`. That package contains the Cloudinary SDK and is Node-only. Biome's `noRestrictedImports` rule enforces this. If you see a build error mentioning `cloudinary` in a browser chunk, somebody imported `@repo/media/server` from a `.client.tsx` file. Move it to a server endpoint or to a `.astro` file.

### SSR vs SSG Misconfiguration

**Symptom**: A page that should be cached (e.g., `/es/legal/privacidad/`) is being SSR'd on every request, increasing function invocations.

**Cause**: The page is missing `export const prerender = true;` at the top of its frontmatter.

**Fix**:

1. Add `export const prerender = true;` to any static page that does not need fresh data.
2. Audit existing pages in `src/pages/[lang]/` to confirm the right strategy. See the [Render Strategy table](#render-strategy-per-page) above.
3. Conversely, if a page that needs fresh data (e.g., `/es/busqueda/`) is being statically prerendered and shows stale results, remove `export const prerender = true;` and confirm the route is in the `isr.exclude` regex in `astro.config.mjs`.

### Vercel Function Timeout (10-60s)

**Symptom**: A page returns a 504 after 10-60 seconds.

**Cause**: An SSR page is making a slow API call (or a chain of calls). Vercel's default function timeout is 10s on Hobby, 60s on Pro.

**Fix**:

1. Identify the slow page in Vercel function logs.
2. Profile the API call. Is the API itself slow? Are you making N+1 requests in the loader?
3. Remove unneeded data from the page render path. Move auth-only or expensive sections to Server Islands (`server:defer`).
4. If a single fast call is timing out, the API is the bottleneck. Investigate there.

### Sentry Source Maps Are Minified

**Symptom**: Sentry shows stack traces full of `t.x.something` instead of real function names.

**Cause**: `SENTRY_AUTH_TOKEN` is missing in the build environment, so source maps were not uploaded.

**Fix**:

1. Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` in Vercel project env vars (Production scope, build phase).
2. Redeploy. The Astro Sentry integration (`@sentry/astro`) auto-uploads source maps when the token is present, per `astro.config.mjs`:

   ```js
   sourceMapsUploadOptions: {
     enabled: Boolean(process.env.SENTRY_AUTH_TOKEN)
   }
   ```

3. Confirm in Sentry: Settings -> Source Maps. The latest release should show uploaded artifacts.

### Workspace Dependency Not Resolved

**Symptom**: Build fails with `Cannot find module '@repo/schemas'` or similar.

**Cause**: Vercel Root Directory is set but "Include source files outside of Root Directory" is OFF, so workspace packages are not included in the build.

**Fix**:

1. Vercel project Settings -> General -> Root Directory.
2. Tick "Include source files outside of the Root Directory".
3. Redeploy.

---

## Monitoring

### Sentry

The Sentry project for the web app is `hospeda-web` under the org `qazuor` (Sentry URL: `https://qazuor.sentry.io/projects/hospeda-web/`).

Two Sentry SDKs are wired in:

- **Client-side** (`apps/web/sentry.client.config.ts`): captures browser errors, traces, and session replays. Only active when the user has consented to analytics cookies (`getConsent().analytics === true`).
- **Server-side** (`apps/web/sentry.server.config.ts`): captures errors from SSR Astro endpoints.

Both read `PUBLIC_SENTRY_DSN`. If unset, Sentry is fully disabled.

What to watch in Sentry:

- **Issues**: any new error spike. Sentry groups by stack trace, so duplicates aggregate.
- **Performance**: trace samples (10% sampled in prod). Look for slow page transactions or slow API calls.
- **Session Replay**: replays for crashes (100% sampling on error, 10% otherwise).

### Vercel Logs

Function logs and edge logs are at:

```text
https://vercel.com/<org>/hospeda-web/logs
```

Or via CLI:

```bash
cd apps/web
vercel logs --prod              # latest production deploy
vercel logs <deployment-url>    # specific deployment
vercel logs --prod --follow     # tail
```

### Vercel Analytics

Vercel project Settings -> Analytics. Tracks page views, top pages, top referrers, and Core Web Vitals from real users. Free tier has limits. Upgrade to Pro if you need historical data beyond 24h.

### Alerts

> **TODO: verify with maintainer**. The repo does not currently document Sentry alert rules for the web project. Confirm with the project owner whether email/Slack alerts are configured for:
>
> - New issue spike (>10 events in 5 minutes).
> - High error rate (>1% of requests failing).
> - Performance regression (p95 latency above threshold).
>
> If unset, configure them in Sentry: Project -> Alerts -> Create Alert Rule.

---

## Performance

### Targets

| Metric | Target | Where to check |
|--------|--------|----------------|
| Lighthouse Performance | >= 80 | `pnpm lighthouse` (uses `apps/web/lighthouserc.json`) |
| Lighthouse Accessibility | >= 80 | Same |
| Lighthouse Best Practices | >= 80 | Same |
| Lighthouse SEO | >= 80 | Same |
| LCP (Core Web Vitals) | < 2.5s | Vercel Analytics, Sentry traces |
| FID / INP | < 200ms | Vercel Analytics |
| CLS | < 0.1 | Vercel Analytics |
| Total bundle size (initial) | < 200KB gzip | Build output, Astro preview |

These targets come from `apps/web/lighthouserc.json` (asserted at 0.8 minScore on all four categories) and from Web Vitals industry guidelines.

### Bundle Size

Astro ships zero JS by default. React islands add JS only for the components they wrap. Keep an eye on:

- Large React libraries imported into islands. `embla-carousel-react`, `react-day-picker`, and `glightbox` are intentional but heavy. Audit their use.
- Importing server-only utilities into islands. The Cloudinary SDK is the most common offender.
- Lazy-loading discipline. Use `client:visible` and `client:idle` instead of `client:load` whenever possible.

Inspect the bundle locally:

```bash
pnpm build
# Output is in apps/web/dist/
ls -lh apps/web/dist/_astro/
```

### Lighthouse Audit

```bash
cd apps/web
pnpm lighthouse
```

This runs against the dev server URLs in `lighthouserc.json` (`/es/`, `/es/alojamientos/`, `/es/mi-cuenta/`, `/es/contacto/`) and uploads results to Lighthouse CI temporary storage. CI does NOT fail on Lighthouse regressions today. **TODO: verify with maintainer**. Adding Lighthouse to the CI pipeline as a non-blocking informational check is a likely future improvement.

### Real User Monitoring

Vercel Analytics tracks Core Web Vitals from real visitors. It is more reliable than synthetic Lighthouse runs because it reflects actual network conditions and devices.

Use Sentry Performance for distributed tracing across web -> API. Look at the slowest transactions of the day and trace down to the API call.

---

## Cross-References

### Inside This Repo

- [`docs/deployment/secrets.md`](../secrets.md) — full env var reference for all apps.
- [`docs/deployment/README.md`](../README.md) — deployment overview and architecture.
- [`docs/deployment/ci-cd.md`](../ci-cd.md) — CI/CD pipeline details.
- [`docs/deployment/environments.md`](../environments.md) — staging vs production env config.
- [`docs/deployment/checklist.md`](../checklist.md) — pre/post-deploy checklist for all apps.
- [`docs/runbooks/rollback.md`](../../runbooks/rollback.md) — full rollback procedures.
- [`docs/runbooks/monitoring.md`](../../runbooks/monitoring.md) — monitoring and alerting setup.
- [`docs/runbooks/sentry-setup.md`](../../runbooks/sentry-setup.md) — Sentry org/project setup.
- [`docs/runbooks/cloudinary-incidents.md`](../../runbooks/cloudinary-incidents.md) — Cloudinary outage playbook.
- [`docs/deployment/apps/api.md`](./api.md) — API deployment (the web app's primary dependency).
- [`docs/deployment/apps/admin.md`](./admin.md) — admin app deployment.
- [`apps/web/CLAUDE.md`](../../../apps/web/CLAUDE.md) — web app conventions and patterns.
- [`apps/web/STYLE_GUIDE.md`](../../../apps/web/STYLE_GUIDE.md) — design tokens and component patterns.

### External References

- [Astro Vercel adapter docs](https://docs.astro.build/en/guides/integrations-guide/vercel/) — ISR, image service, edge config.
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) — official reference for env var scoping.
- [Vercel ISR](https://vercel.com/docs/incremental-static-regeneration) — how on-demand revalidation works on Vercel.
- [Better Auth docs](https://www.better-auth.com/docs) — auth flow and session validation.
- [Sentry for Astro](https://docs.sentry.io/platforms/javascript/guides/astro/) — SDK integration.

---

## Quick Reference Card

```bash
# Local
cd apps/web
pnpm dev               # http://localhost:4321
pnpm build             # produces dist/
pnpm preview           # serve dist/ locally
pnpm test              # run tests
pnpm lighthouse        # local Lighthouse audit

# Deploy
pnpm deploy:web        # from repo root, --prod
vercel --prod          # from apps/web/, --prod
vercel                 # from apps/web/, preview

# Logs and rollback
vercel ls hospeda-web
vercel logs --prod --follow
vercel rollback
vercel promote <deployment-url>

# Env management
pnpm env:check         # validate against registry
pnpm env:pull          # pull from Vercel
pnpm env:push          # push local to Vercel
vercel env add PUBLIC_API_URL production
vercel env pull .env.local
```
