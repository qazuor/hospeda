# Secret Rotation Schedule

A practical, junior-friendly runbook for rotating every secret used by the Hospeda platform. Read this end-to-end before performing your first rotation.

**Last Updated**: 2026-04-30
**Maintained By**: DevOps / Platform team
**Review Frequency**: Quarterly (review the cadence table and the audit log)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Rotation Cadence Table](#2-rotation-cadence-table)
3. [Pre-Rotation Checklist](#3-pre-rotation-checklist)
4. [Rotation Conventions](#4-rotation-conventions)
5. [Per-Service Rotation Procedures](#5-per-service-rotation-procedures)
   - 5.1 [Better Auth signing secret](#51-better-auth-signing-secret)
   - 5.2 [MercadoPago access token](#52-mercadopago-access-token)
   - 5.3 [MercadoPago webhook secret](#53-mercadopago-webhook-secret)
   - 5.4 [Cloudinary API key and secret](#54-cloudinary-api-key-and-secret)
   - 5.5 [Sentry auth token (source maps)](#55-sentry-auth-token-source-maps)
   - 5.6 [Resend API key](#56-resend-api-key)
   - 5.7 [Google OAuth client secret](#57-google-oauth-client-secret)
   - 5.8 [Facebook OAuth client secret](#58-facebook-oauth-client-secret)
   - 5.9 [Linear API key](#59-linear-api-key)
   - 5.10 [Cron secret](#510-cron-secret)
   - 5.11 [Revalidation secret](#511-revalidation-secret)
   - 5.12 [Database password (Neon)](#512-database-password-neon)
   - 5.13 [Redis password](#513-redis-password)
   - 5.14 [Vercel API token](#514-vercel-api-token)
   - 5.15 [Exchange rate API key](#515-exchange-rate-api-key)
   - 5.16 [Location salt (DO NOT rotate)](#516-location-salt-do-not-rotate)
6. [Incident-Driven Rotation](#6-incident-driven-rotation)
7. [Troubleshooting](#7-troubleshooting)
8. [Audit Log](#8-audit-log)
9. [Cross-References](#9-cross-references)

---

## 1. Overview

### Why we rotate

Secret rotation is the practice of replacing credentials (API keys, tokens, passwords, signing secrets) on a schedule, even when no compromise is suspected. Rotation reduces the impact of unknown leaks: an attacker who quietly captured a key six months ago loses access the moment we rotate.

Concretely, rotation defends against:

- Accidental commits of secrets to public branches that nobody noticed
- Stolen developer laptops and backup tapes
- Compromised provider dashboards (an attacker exporting tokens)
- Insider risk (an offboarded contractor still holding a key)
- Long-lived bot tokens in CI logs that get cached forever

### What triggers a rotation

There are exactly two flavors:

1. **Scheduled rotation** — Calendar-driven. Follow the cadence in section 2.
2. **Incident-driven rotation** — Triggered by a leak, suspected compromise, or staff offboarding. Follow section 6 (faster, prioritized, no maintenance window).

If you are unsure whether a leak occurred, treat it as an incident. The cost of an unnecessary rotation is one hour of work; the cost of leaving a leaked key is unbounded.

### What this document is NOT

- It is not a list of secrets. The canonical inventory lives in [`secrets.md`](./secrets.md) and the env registry in [`packages/config/src/env-registry.hospeda.ts`](../../packages/config/src/env-registry.hospeda.ts).
- It is not a deployment guide. See [`checklist.md`](./checklist.md) for that.

---

## 2. Rotation Cadence Table

| Secret | Cadence | Justification |
|--------|---------|---------------|
| `HOSPEDA_BETTER_AUTH_SECRET` | 90 days | Session-signing key. Rotation invalidates active sessions, so balance security against UX. |
| `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` | 90 days | Payment provider token. High blast radius if leaked. |
| `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` | 90 days | Webhook verifier. Rotate alongside access token when convenient. |
| `HOSPEDA_CLOUDINARY_API_KEY` | 180 days | Pair (key + secret). Rotate together. Lower blast radius (image storage), but still credentials. |
| `HOSPEDA_CLOUDINARY_API_SECRET` | 180 days | Same pair as above. |
| `SENTRY_AUTH_TOKEN` | 365 days | Build-time only. Rotate annually unless a build agent is suspected of compromise. |
| `HOSPEDA_RESEND_API_KEY` | 90 days | Transactional email. If leaked, attacker can send mail as our domain. |
| `HOSPEDA_GOOGLE_CLIENT_SECRET` | 365 days | OAuth client secret. Google rotates rarely; long-lived by convention. |
| `HOSPEDA_FACEBOOK_CLIENT_SECRET` | 365 days | Same convention as Google. |
| `HOSPEDA_LINEAR_API_KEY` | 180 days | Internal tooling. Rotate when an engineer with access leaves the team. |
| `HOSPEDA_CRON_SECRET` | 90 days | Vercel cron auth. Without it cron jobs silently fail, so rotate during low-traffic windows. |
| `HOSPEDA_REVALIDATION_SECRET` | 90 days | ISR revalidation. Same risk profile as cron secret. |
| `HOSPEDA_DATABASE_URL` (Neon password) | 180 days | Neon recommends 6 months. Rotation requires a coordinated cutover (dev, staging, prod, seed jobs). |
| `HOSPEDA_REDIS_URL` (Redis password) | 180 days | Same cadence as DB. Rate limiter falls back to in-memory if Redis is unreachable, so rotation is safe but disruptive to global rate limits. |
| `VERCEL_TOKEN` (GitHub Actions) | 180 days | CI/CD bot token. Rotate when changing CI ownership or every 6 months. |
| `HOSPEDA_EXCHANGE_RATE_API_KEY` | 365 days | Read-only third-party API. Low blast radius. Rotate annually with the other low-risk keys. |
| `HOSPEDA_SEED_SUPER_ADMIN_PASSWORD` | On every prod seed run | Used only at bootstrap. Treat as one-time-use; never reuse. |
| `HOSPEDA_LOCATION_SALT` | **Never** (after first prod deploy) | Generates deterministic offsets for accommodation location obfuscation. Rotating it invalidates every approximate location ever shown to public visitors. Treat as immutable in production. See [§5.16](#516-location-salt-do-not-rotate). |

### Notes on the cadence

- **90 days** is the default for anything that touches money, sessions, or transactional email.
- **180 days** is used for paired credentials (key + secret) and infra credentials where rotation is more disruptive.
- **365 days** is reserved for OAuth client secrets and read-only third-party keys where the provider does not encourage rotation.
- **Never** is used only for `HOSPEDA_LOCATION_SALT` and is documented separately in §5.16.
- Any time a team member with access offboards, treat their last working day as a rotation trigger for every secret they could read.

---

## 3. Pre-Rotation Checklist

Run through this list **before** touching any secret. Skipping it is how outages happen.

- [ ] **Confirm the rotation reason**: scheduled (date in calendar) or incident (link to the report).
- [ ] **Identify the blast radius**: which apps, which environments, which third parties read this secret? Cross-check against the env registry.
- [ ] **Schedule a maintenance window** if the secret is on the critical path (DB, Better Auth, MercadoPago). Off-peak hours in Argentina = 03:00 to 06:00 ART.
- [ ] **Notify the team**: post in the team channel with the start time, expected duration, and the affected secret name. Use the format below.
- [ ] **Verify rollback path**: confirm you know how to put the old secret back in Vercel within 5 minutes if smoke tests fail.
- [ ] **Pull current env state** as a snapshot:

  ```bash
  cd apps/api && vercel env pull .env.production.before-rotation
  cd apps/web && vercel env pull .env.production.before-rotation
  cd apps/admin && vercel env pull .env.production.before-rotation
  ```

  Keep these files locally for the duration of the rotation, then delete them.

- [ ] **Open the rotation audit log** in section 8 of this file in your editor so you can fill it in as you go.

### Team notification template

```
[ROTATION] Starting rotation of <SECRET_NAME>
Start: <YYYY-MM-DD HH:MM ART>
Window: ~<N> minutes
Affected: <api|web|admin|cron|all>
Owner: <your name>
Rollback contact: <name>
Audit ID: rotation-<YYYY-MM-DD>-<short-name>
```

---

## 4. Rotation Conventions

These rules apply to every procedure in section 5.

### Order of environments

Always rotate in this order: **dev -> staging -> prod**. Never rotate prod first. The reason is simple: if the new value breaks something, you find out in dev where nobody is watching, not in prod where customers are.

### Vercel env staging convention

Vercel exposes three scopes: `Development`, `Preview`, and `Production`. We map them as follows:

- `Development` = local development. Set via `.env.local` files; Vercel Development is rarely used directly.
- `Preview` = staging. The preview environment is the destination for `staging` branch deploys.
- `Production` = prod. Reserved for the `main` branch.

When the procedures below say "stage in Vercel preview", it means add the new value to the `Preview` scope only. After smoke tests pass, promote it to `Production`.

### Generating high-entropy secrets

Whenever a procedure says "generate a new secret", use:

```bash
openssl rand -base64 32
```

This produces a 32-byte random string. For secrets that must be URL-safe, use:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

Never invent a secret manually. Never reuse a secret across services.

### Validation command

After every rotation, validate the env registry is consistent:

```bash
pnpm env:check
```

This runs the canonical env validator from [`packages/config`](../../packages/config/src/env.ts) against your local pulled env file. Failures here mean you missed an environment.

### Monitoring window

After promoting any secret to prod, watch Sentry, Vercel logs, and the relevant provider dashboard for at least **15 minutes**. Most failures (signature mismatches, cached old secret) appear within the first 5 minutes.

```bash
# Tail Vercel API logs during the rotation window
vercel logs --prod --follow

# Sentry: open https://qazuor.sentry.io/issues/ filtered by env=production, last 15 min
```

---

## 5. Per-Service Rotation Procedures

Each procedure follows the same template:

- **Service**, **Frequency**, **Affected env vars**, **Affected environments**, **Steps**, **Rollback**, **Validation command**.

If a step is unclear, stop and ask. Do not improvise on prod secrets.

---

### 5.1 Better Auth signing secret

- **Service**: Better Auth (session JWT signer)
- **Frequency**: 90 days
- **Affected env vars**: `HOSPEDA_BETTER_AUTH_SECRET`
- **Affected environments**: dev -> staging -> prod
- **Side effect**: rotating this **invalidates every active session**. All users will be forced to log in again. Schedule during low-traffic hours.

#### Steps

1. Generate the new secret:

   ```bash
   openssl rand -base64 32
   ```

2. Update local dev: write the new value into `apps/api/.env.local`. Restart `pnpm dev:api` and confirm login flow works locally.
3. Stage in Vercel preview (staging):

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_BETTER_AUTH_SECRET preview
   vercel env add HOSPEDA_BETTER_AUTH_SECRET preview
   # paste new value when prompted
   ```

4. Push to the `staging` branch (or trigger a redeploy of the latest staging commit) so the preview env picks up the new secret.
5. Smoke test on staging: log in via the staging UI. If login succeeds and a fresh session cookie is issued, proceed.
6. Promote to prod:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_BETTER_AUTH_SECRET production
   vercel env add HOSPEDA_BETTER_AUTH_SECRET production
   ```

7. Trigger a prod redeploy: push to `main` or run `vercel --prod` from `apps/api/`.
8. Update GitHub Actions secret as well (CI uses it for tests):
   - GitHub repo -> Settings -> Secrets and variables -> Actions -> update `HOSPEDA_BETTER_AUTH_SECRET`.
9. Run validation:

   ```bash
   pnpm env:check
   ```

10. Monitor Sentry and `/api/v1/public/auth/me` error rate for 15 minutes. Expected behavior: 401 spike as old sessions die, then normalization as users re-authenticate.

#### Rollback

Re-add the previous secret value (you saved it in `.env.production.before-rotation`) using the same `vercel env rm/add` flow. Trigger a redeploy. Old sessions will continue to work because they were signed with that key.

#### Validation command

```bash
# After the rotation, request a fresh login and verify the cookie is set.
curl -i -X POST https://api.hospeda.com.ar/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"<test_user>","password":"<test_pass>"}'
# Expect: HTTP/2 200 with a Set-Cookie: better-auth.session_token=...
```

---

### 5.2 MercadoPago access token

- **Service**: MercadoPago payments
- **Frequency**: 90 days
- **Affected env vars**: `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`
- **Affected environments**: dev (sandbox token) -> staging (sandbox or prod-test) -> prod (production token)
- **Side effect**: in-flight payment intents that were created with the old token will continue to work; new payment intents will use the new token.

#### Steps

1. Sign in to the MercadoPago developers dashboard (`https://www.mercadopago.com.ar/developers/`).
2. TODO: confirm dashboard path. As of 2026-04 it is roughly: Your integrations -> select the Hospeda app -> Production credentials -> "Renew access token". The button generates a new `APP_USR-*` token and **immediately invalidates the previous one** (no overlap window).
3. Because there is no overlap, treat this as a near-zero-downtime cutover:
   - Have the new token ready in your terminal buffer.
   - Update Vercel `Preview` env first.
   - Trigger a staging redeploy and smoke-test a sandbox payment.
4. Update Vercel `Production`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN production
   vercel env add HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN production
   ```

5. Trigger a prod redeploy. Watch the Sentry tag `event_type:payment_failure` for 15 minutes.
6. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

You cannot reuse the previous MercadoPago token (it was revoked at issuance time). If the new token does not work, generate yet another fresh token and try again. Do not attempt to roll back to the old value.

#### Validation command

```bash
# Hit a billing read endpoint that exercises the MercadoPago client.
curl -i https://api.hospeda.com.ar/api/v1/protected/billing/plans \
  -H "Cookie: better-auth.session_token=<valid_session>"
# Expect: HTTP 200 with a JSON list of plans.
```

---

### 5.3 MercadoPago webhook secret

- **Service**: MercadoPago webhook signature verifier
- **Frequency**: 90 days (recommended to rotate alongside the access token in the same window)
- **Affected env vars**: `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`
- **Affected environments**: staging -> prod (no local dev impact unless you proxy webhooks)

#### Steps

1. MercadoPago dashboard -> your app -> Notifications / Webhooks -> regenerate webhook signing secret.
2. TODO: confirm dashboard path.
3. Update Vercel `Preview`, redeploy staging, and trigger a sandbox webhook (MercadoPago dashboard has a "Send test notification" button).
4. Confirm the webhook is delivered AND the API logs show `webhook_signature_valid: true`.
5. Update Vercel `Production` and redeploy prod.
6. Watch Sentry tag `event_type:webhook_failure` for 15 minutes.
7. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

Set the previous secret back in Vercel and redeploy. MercadoPago lets you keep the previous secret active for a short overlap window if you re-enter it manually; otherwise generate a fresh one.

#### Validation command

```bash
# Trigger a sandbox webhook from the MercadoPago dashboard, then check API logs.
vercel logs --prod --follow | grep -i webhook
# Expect lines with: webhook_signature_valid=true
```

---

### 5.4 Cloudinary API key and secret

- **Service**: Cloudinary (image storage and CDN)
- **Frequency**: 180 days
- **Affected env vars**: `HOSPEDA_CLOUDINARY_API_KEY`, `HOSPEDA_CLOUDINARY_API_SECRET`
- **Affected environments**: dev -> staging -> prod (also seed jobs)

#### Steps

1. Cloudinary Console (`https://console.cloudinary.com/`) -> Settings -> Security -> "Reset API Secret". This rotates the secret while keeping the same API key.
2. TODO: confirm dashboard path. If the goal is to also rotate the key, generate a new key pair (provisional keys feature) and revoke the old one after cutover.
3. Stage the new pair in Vercel `Preview` for both `apps/api` and `apps/seed` (seed reads them too):

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_CLOUDINARY_API_SECRET preview
   vercel env add HOSPEDA_CLOUDINARY_API_SECRET preview
   ```

4. Redeploy staging. Smoke test by uploading a test image through the admin UI staging URL.
5. Promote to `Production` for both projects.
6. Update local dev `.env.local` files for any developers who hit Cloudinary directly.
7. Run validation:

   ```bash
   pnpm env:check
   ```

8. Monitor Sentry for upload failures for 15 minutes.

#### Rollback

Cloudinary keeps the previous secret active for ~24 hours during the rotation grace period (verify in dashboard). If smoke tests fail, restore the previous value in Vercel and redeploy.

#### Validation command

```bash
# Use the seed package smoke test that uploads a 1x1 png.
pnpm --filter @repo/seed run smoke:cloudinary
# Or call the admin endpoint directly:
curl -i https://api.hospeda.com.ar/api/v1/admin/media/health \
  -H "Cookie: better-auth.session_token=<admin_session>"
```

---

### 5.5 Sentry auth token (source maps)

- **Service**: Sentry CLI for source map uploads at build time
- **Frequency**: 365 days
- **Affected env vars**: `SENTRY_AUTH_TOKEN`
- **Affected environments**: build environments only (Vercel build step + GitHub Actions if used)
- **Side effect**: stale token causes source map upload to silently fail, leaving prod stack traces minified. Not a runtime outage, but a debugging regression.

#### Steps

1. Sentry dashboard -> Settings -> Account -> API -> Auth Tokens -> Create New Token.
2. Required scopes: `project:releases`, `project:write`. Use a scoped token, not an org-level one.
3. Copy the token (Sentry shows it only once).
4. Stage in Vercel `Preview` for `apps/web` and `apps/admin`:

   ```bash
   cd apps/web
   vercel env rm SENTRY_AUTH_TOKEN preview
   vercel env add SENTRY_AUTH_TOKEN preview
   ```

5. Trigger a preview build and confirm the build log shows `Sentry sourcemaps upload: success`.
6. Promote to `Production`.
7. Trigger a prod build (push to `main` or `vercel --prod`) and confirm the upload happened.
8. Revoke the old token in Sentry dashboard.

#### Rollback

The old token works until you revoke it. If the new token causes build failures, leave the old token enabled and re-investigate.

#### Validation command

```bash
# Use sentry-cli to verify the token is accepted.
SENTRY_AUTH_TOKEN=<new_token> sentry-cli organizations list
# Expect: a JSON list including "qazuor".
```

---

### 5.6 Resend API key

- **Service**: Resend (transactional email)
- **Frequency**: 90 days
- **Affected env vars**: `HOSPEDA_RESEND_API_KEY`
- **Affected environments**: staging -> prod (dev usually disabled)

#### Steps

1. Resend dashboard (`https://resend.com/api-keys`) -> Create API Key. Give it the same scope as the existing key (typically `Sending Access`).
2. Stage in Vercel `Preview`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_RESEND_API_KEY preview
   vercel env add HOSPEDA_RESEND_API_KEY preview
   ```

3. Redeploy staging. Trigger a welcome email via signup on the staging environment and confirm delivery.
4. Promote to `Production` and redeploy.
5. Revoke the old key in Resend dashboard (you can keep it active for ~24h as a grace window if you want a rollback option).
6. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

Restore the old key in Vercel and redeploy (only works if you have not yet revoked it on Resend's side).

#### Validation command

```bash
# Use the API to send a test transactional email.
curl -i -X POST https://api.hospeda.com.ar/api/v1/admin/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<admin_session>" \
  -d '{"to":"<your_email>"}'
# Expect: HTTP 200, and the email arrives in your inbox within 60s.
```

---

### 5.7 Google OAuth client secret

- **Service**: Google OAuth 2.0 (login with Google)
- **Frequency**: 365 days
- **Affected env vars**: `HOSPEDA_GOOGLE_CLIENT_SECRET`
- **Affected environments**: staging -> prod
- **Side effect**: rotation does not invalidate existing user sessions; only new OAuth flows use the new secret.

#### Steps

1. Google Cloud Console (`https://console.cloud.google.com/`) -> APIs and Services -> Credentials -> select the Hospeda OAuth 2.0 Client.
2. TODO: confirm dashboard path. As of 2026-04 Google supports adding a second client secret while the old one remains active. This is the safe rotation pattern.
3. Click "Add secret" to mint a new client secret. The old one stays active until you delete it.
4. Stage the new secret in Vercel `Preview`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_GOOGLE_CLIENT_SECRET preview
   vercel env add HOSPEDA_GOOGLE_CLIENT_SECRET preview
   ```

5. Redeploy staging and run a Google login flow end-to-end on the staging URL.
6. Promote to `Production` and redeploy.
7. After 24-48 hours of stable operation, return to Google Cloud Console and **delete the old secret**.
8. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

Because both secrets are valid simultaneously, simply revert the env var in Vercel to the previous value and redeploy. No Google-side action needed.

#### Validation command

```bash
# Manual check: open the staging or prod login page, click "Sign in with Google".
# Successful redirect back to the app and a working session cookie = passed.
```

---

### 5.8 Facebook OAuth client secret

- **Service**: Facebook Login
- **Frequency**: 365 days
- **Affected env vars**: `HOSPEDA_FACEBOOK_CLIENT_SECRET`
- **Affected environments**: staging -> prod

#### Steps

1. Meta for Developers dashboard (`https://developers.facebook.com/`) -> select the Hospeda app -> Settings -> Basic -> "Reset App Secret".
2. TODO: confirm dashboard path. Meta does **not** support overlapping secrets; rotation is a hard cutover.
3. Because cutover is hard, schedule it for a low-traffic window and have the new secret ready.
4. Update Vercel `Preview` first, redeploy staging, smoke-test Facebook login.
5. Update Vercel `Production`, redeploy.
6. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

You cannot reuse the previous Facebook secret. If the new one fails, generate yet another.

#### Validation command

Manual: open the prod login page, click "Sign in with Facebook", confirm the round trip succeeds.

---

### 5.9 Linear API key

- **Service**: Linear (issue tracker, used for feedback bug reports)
- **Frequency**: 180 days, or immediately when an engineer with key access leaves
- **Affected env vars**: `HOSPEDA_LINEAR_API_KEY`
- **Affected environments**: prod only (the feedback feature is gated behind `HOSPEDA_FEEDBACK_ENABLED=true`)

#### Steps

1. Linear -> Settings -> API -> Personal API keys -> Create key.
2. Important: API keys in Linear are tied to a user. Use a dedicated bot user, not a real engineer.
3. TODO: confirm bot user setup. If a bot user does not exist yet, create one before rotating.
4. Stage in Vercel `Preview`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_LINEAR_API_KEY preview
   vercel env add HOSPEDA_LINEAR_API_KEY preview
   ```

5. Redeploy staging. Submit a test feedback report through the staging UI and confirm a Linear issue is created.
6. Promote to `Production` and redeploy.
7. Revoke the old key in Linear.

#### Rollback

Restore the previous key in Vercel and redeploy (works if you have not yet revoked it on Linear's side).

#### Validation command

```bash
# Submit a feedback through the API.
curl -i -X POST https://api.hospeda.com.ar/api/v1/public/feedback \
  -H "Content-Type: application/json" \
  -d '{"type":"bug","message":"rotation smoke test","email":"<your_email>"}'
# Expect: HTTP 200. Then check the Hospeda Linear team for a new issue.
```

---

### 5.10 Cron secret

- **Service**: Vercel Cron authentication for `apps/api`
- **Frequency**: 90 days
- **Affected env vars**: `HOSPEDA_CRON_SECRET`
- **Affected environments**: prod only (cron jobs do not run in dev or preview by default)
- **Side effect**: the API rejects cron HTTP requests that do not present this secret. While both old and new secrets exist in different envs, **the prod cron jobs always use the value in Vercel `Production`**. The risk window is 0 if you redeploy promptly after the env var change.

#### Steps

1. Generate:

   ```bash
   openssl rand -base64 32
   ```

2. Stage in Vercel `Preview`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_CRON_SECRET preview
   vercel env add HOSPEDA_CRON_SECRET preview
   ```

3. Redeploy staging. Manually invoke a cron endpoint with the new secret to confirm:

   ```bash
   curl -i -X POST https://api.staging.hospeda.com.ar/api/v1/cron/exchange-rate-fetch \
     -H "Authorization: Bearer <new_secret>"
   # Expect: HTTP 200
   ```

4. Promote to `Production`:

   ```bash
   vercel env rm HOSPEDA_CRON_SECRET production
   vercel env add HOSPEDA_CRON_SECRET production
   ```

5. Trigger a prod redeploy. Within ~1 hour, observe at least one cron invocation in the Vercel Functions logs. The expected log line includes `cron_auth_ok=true`.
6. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

If cron starts failing after rotation, restore the previous secret in Vercel and redeploy. The cron schedule will resume on its next tick.

#### Validation command

```bash
# Manual cron invocation against prod (use with care).
curl -i -X POST https://api.hospeda.com.ar/api/v1/cron/exchange-rate-fetch \
  -H "Authorization: Bearer $HOSPEDA_CRON_SECRET"
# Expect: HTTP 200. Check Vercel logs for the corresponding cron run.
```

---

### 5.11 Revalidation secret

- **Service**: ISR (Incremental Static Regeneration) revalidation for `apps/web`
- **Frequency**: 90 days
- **Affected env vars**: `HOSPEDA_REVALIDATION_SECRET`
- **Affected environments**: api + web (this secret is shared between the API caller and the web receiver)

#### Steps

1. Generate:

   ```bash
   openssl rand -base64 32
   ```

2. Stage the new value in Vercel `Preview` for **both** `apps/api` and `apps/web`. Keeping them in sync is mandatory; if they drift, every revalidation request 401s.
3. Redeploy both staging deployments. Trigger a revalidation by editing a piece of content in the admin UI and confirming the public page refreshes within the configured TTL.
4. Promote to `Production` for both projects in lockstep. Do not deploy api-only or web-only.
5. Trigger a prod revalidation and confirm.
6. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

Restore the previous value in both `apps/api` and `apps/web` Vercel envs and redeploy both. The shared-secret invariant must hold; do not skip either side.

#### Validation command

```bash
# After rotation, trigger an admin revalidation request and check the response.
curl -i -X POST https://hospeda.com.ar/api/revalidate \
  -H "Authorization: Bearer $HOSPEDA_REVALIDATION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"path":"/es"}'
# Expect: HTTP 200 with a {"revalidated": true} body.
```

---

### 5.12 Database password (Neon)

- **Service**: Neon serverless PostgreSQL
- **Frequency**: 180 days
- **Affected env vars**: `HOSPEDA_DATABASE_URL` (in api + seed packages, GitHub Actions, and any local `.env.local`)
- **Affected environments**: dev (Neon dev branch) -> staging (Neon staging branch) -> prod (Neon main branch)
- **Side effect**: the password lives inside the connection string. Rotation requires updating the password in Neon, then propagating the new connection string everywhere it is read.

#### Steps

1. Open Neon Console (`https://console.neon.tech/`) -> Hospeda project -> Roles.
2. TODO: confirm dashboard path. Generally: select the role used by the application -> "Reset password" -> copy the new password and the new connection string.
3. Compose the new `HOSPEDA_DATABASE_URL` (the pooler URL, not the direct URL).
4. Update local dev: rotate first against the Neon **dev branch** (a different role/branch) so devs are not blocked. Update each developer's `.env.local` out-of-band (post in team channel: "Rotated dev DB password, pull new value from 1Password").
5. Update staging: rotate the staging-branch role password, then update Vercel `Preview` env for `apps/api` and `apps/seed`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_DATABASE_URL preview
   vercel env add HOSPEDA_DATABASE_URL preview
   cd ../seed
   vercel env rm HOSPEDA_DATABASE_URL preview
   vercel env add HOSPEDA_DATABASE_URL preview
   ```

6. Redeploy staging API. Smoke test: hit `/health/ready` (DB connectivity check).
7. Update production: rotate the prod-branch role password in Neon, then update Vercel `Production`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_DATABASE_URL production
   vercel env add HOSPEDA_DATABASE_URL production
   ```

8. Update GitHub Actions: repo Settings -> Secrets -> update `HOSPEDA_DATABASE_URL` (used by CI test suite and `refresh-search.yml`).
9. Trigger a prod redeploy. **The previous serverless instances will continue running with the old connection string until they are recycled.** Watch for `password authentication failed` errors in Sentry.
10. Run validation:

    ```bash
    pnpm env:check
    ```

#### Rollback

Neon does not retain the old password after reset. To roll back, reset the password again to a new value, restore that new value in Vercel, and redeploy. There is no time-machine option; plan ahead.

#### Validation command

```bash
# Connect with the new connection string from your shell.
psql "$HOSPEDA_DATABASE_URL" -c "SELECT 1;"
# Expect: a single row "1".

# And via the API health endpoint:
curl -i https://api.hospeda.com.ar/health/ready
# Expect: HTTP 200 with {"status":"ready","db":"healthy",...}
```

---

### 5.13 Redis password

- **Service**: Redis (rate limiter and ephemeral cache)
- **Frequency**: 180 days
- **Affected env vars**: `HOSPEDA_REDIS_URL`
- **Affected environments**: prod (and any preview env that has Redis enabled)
- **Side effect**: while the env propagates, in-flight requests may hit "AUTH failed" briefly. The API falls back to in-memory rate limiting on Redis errors, so global rate limits become per-instance for the duration. Schedule during low traffic.

#### Steps

1. Open the Redis provider dashboard (Upstash, Vercel KV, or wherever the Redis instance lives). TODO: confirm the actual provider currently in use for Hospeda prod.
2. Reset the password / regenerate the connection string. Most providers expose a "rotate password" or "regenerate connection URL" button.
3. Stage the new `HOSPEDA_REDIS_URL` in Vercel `Preview` for `apps/api`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_REDIS_URL preview
   vercel env add HOSPEDA_REDIS_URL preview
   ```

4. Redeploy staging. Confirm the API logs show `redis_connected=true` after boot.
5. Promote to `Production` and redeploy. Watch the Sentry tag `redis_fallback=true` count; it should remain at zero or spike very briefly during instance recycling.
6. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

Most Redis providers do not retain the previous password. To roll back, regenerate again and update Vercel + redeploy.

#### Validation command

```bash
# Use redis-cli locally with the new URL to confirm auth works.
redis-cli -u "$HOSPEDA_REDIS_URL" PING
# Expect: PONG.

# Via API:
curl -i https://api.hospeda.com.ar/health/ready
# Expect: {"redis":"healthy",...}
```

---

### 5.14 Vercel API token

- **Service**: Vercel deployment token used by GitHub Actions
- **Frequency**: 180 days, or whenever the owning account changes
- **Affected env vars**: `VERCEL_TOKEN` (GitHub Actions secret only; not in any app)
- **Affected environments**: CI/CD pipeline (no runtime impact)

#### Steps

1. Vercel -> Account Settings -> Tokens (`https://vercel.com/account/tokens`) -> Create Token.
2. Use a scope tight enough to deploy only Hospeda projects. If the org allows, prefer a service-account token over a personal token.
3. GitHub repo -> Settings -> Secrets and variables -> Actions -> update `VERCEL_TOKEN`.
4. Trigger a CI run on a throwaway branch to verify the token works:

   ```bash
   git checkout -b ops/verify-vercel-token
   git commit --allow-empty -m "ci: verify rotated VERCEL_TOKEN"
   git push origin ops/verify-vercel-token
   ```

5. Open a draft PR. Confirm the preview deployment succeeds.
6. Once verified, delete the old token in Vercel.

#### Rollback

The old token still works until you delete it in Vercel. If the new token has insufficient scope, restore the old GitHub Actions secret value and re-trigger CI.

#### Validation command

```bash
# Use vercel CLI authenticated via the new token to list projects.
VERCEL_TOKEN=<new_token> vercel projects ls
# Expect: a list including hospeda-api, hospeda-web, hospeda-admin.
```

---

### 5.15 Exchange rate API key

- **Service**: ExchangeRate-API (multi-currency conversion)
- **Frequency**: 365 days
- **Affected env vars**: `HOSPEDA_EXCHANGE_RATE_API_KEY`
- **Affected environments**: prod
- **Side effect**: the cron job `exchange-rate-fetch` runs every 15 minutes. If the key is invalid, the cron logs an error and the API falls back to the last cached rate. No customer-facing failure, but rates go stale.

#### Steps

1. ExchangeRate-API dashboard (`https://www.exchangerate-api.com/`) -> Account -> regenerate API key.
2. TODO: confirm dashboard path.
3. Stage in Vercel `Preview`:

   ```bash
   cd apps/api
   vercel env rm HOSPEDA_EXCHANGE_RATE_API_KEY preview
   vercel env add HOSPEDA_EXCHANGE_RATE_API_KEY preview
   ```

4. Redeploy staging. Manually invoke the exchange-rate cron and confirm new rates are fetched.
5. Promote to `Production` and redeploy.
6. Run validation:

   ```bash
   pnpm env:check
   ```

#### Rollback

Restore the previous key in Vercel and redeploy (works only if not yet revoked on the provider side).

#### Validation command

```bash
# Manually trigger the exchange rate cron.
curl -i -X POST https://api.hospeda.com.ar/api/v1/cron/exchange-rate-fetch \
  -H "Authorization: Bearer $HOSPEDA_CRON_SECRET"
# Expect: HTTP 200, log line "exchange_rate_fetch_ok=true".
```

---

### 5.16 Location salt (DO NOT rotate)

- **Service**: in-house (privacy-aware accommodation map). Introduced in SPEC-097.
- **Frequency**: **Never** after the first production deploy.
- **Affected env vars**: `HOSPEDA_LOCATION_SALT`
- **Affected environments**: dev, preview, prod (each with its own value).

#### Why this is special

`HOSPEDA_LOCATION_SALT` feeds an HMAC that turns each accommodation's exact coordinates into a deterministic, irreversible offset shown to non-authenticated public visitors. The same salt + same exact coordinates always produce the same approximate coordinates. That property is the whole point: a returning visitor sees the same blurred pin as last time, search engines and CDNs can cache the marker, and the offset cannot be undone to recover the real address.

If you rotate the salt, every approximate coordinate ever rendered to the public changes. Cached map tiles, OpenGraph snapshots, structured data crawled by Google, and any third-party that cached our public listings will diverge from the new values. There is no way to "re-key" old cached output.

#### Allowed exceptions

You may rotate **only** in these scenarios, and only with a written incident report:

1. **Confirmed compromise of the salt itself** — for example, the value was committed to a public repo or leaked in logs that left the platform. In that case the privacy guarantee is already broken; rotating is the lesser of two evils.
2. **Pre-launch reset** — before the first time `hospeda.com.ar` serves traffic to real users, the salt can be regenerated freely. After that, treat it as immutable.

If you are reading this and considering a routine rotation, **stop**. There is no schedule for this secret.

#### Per-environment values

Generate one salt per environment with `openssl rand -base64 48`. Store the production value in a password manager in addition to Vercel — losing it (and having to regenerate) is exactly the failure mode this section warns about.

| Environment | Vercel scope | Notes |
|-------------|--------------|-------|
| Development | `Development` | Pulled into `.env.local` by `vercel env pull`. Working solo, the salt can be any value. With a team sharing the same Neon DB, use the same salt across devs. |
| Staging | `Preview` | Independent random value. May be rotated freely while the staging URL is not indexed by search engines. |
| Production | `Production` | Set once at first prod deploy. **Never rotate** thereafter. Keep a backup outside Vercel. |

#### What to do if you accidentally rotated production

1. Restore the old value from your password manager / Vercel rollback if available.
2. If the old value is unrecoverable, accept the divergence: cached public maps and any external caches will eventually re-fetch the new approximate coordinates over the next CDN TTL. There is no clean fix.
3. File an incident report and update the [runbooks](../runbooks/README.md) with the lesson learned.

#### Validation command

```bash
# After setting the salt in Vercel, confirm the API starts.
cd apps/api
pnpm dev
# Expect: server starts without "HOSPEDA_LOCATION_SALT must be at least 32 characters" or "expected string, received undefined".
```

---

## 6. Incident-Driven Rotation

When you suspect a leak, ignore the schedule and follow this faster flow.

### Definition of "incident"

Any of:

- A secret was committed to git (even if force-pushed away, assume it is compromised).
- A secret appeared in a screenshot, log file shared externally, Sentry breadcrumbs, or a third-party tool.
- A laptop with `.env.local` was lost or stolen.
- An engineer or contractor with access offboards (planned or emergency).
- An anomaly in provider dashboards (unexpected API calls, unfamiliar IPs).

### Faster flow (no maintenance window)

1. **Triage** (5 minutes): identify exactly which secret leaked. Check git history with:

   ```bash
   git log --all -S '<leaked_value>' --oneline
   ```

   If you find it, do not rewrite history (force pushes are not reliable for secret remediation; the secret must be considered compromised regardless).

2. **Prioritize** by blast radius. Rotate in this order:
   1. `HOSPEDA_DATABASE_URL` (full data access)
   2. `HOSPEDA_BETTER_AUTH_SECRET` (impersonation)
   3. `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` and `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` (financial)
   4. `HOSPEDA_CRON_SECRET` and `HOSPEDA_REVALIDATION_SECRET` (operational disruption)
   5. `HOSPEDA_RESEND_API_KEY` (phishing risk)
   6. `HOSPEDA_CLOUDINARY_API_SECRET` (asset abuse)
   7. Other API keys (Linear, Sentry token, exchange rate, OAuth) by descending blast radius.

3. **Rotate to prod immediately**. Skip the dev->staging->prod ordering for the highest-priority secret. The reasoning: a 30-minute staging dance lets the attacker keep using the leaked key. Bring up the new secret in prod, then mirror to staging and dev afterwards.

4. **Revoke** the old secret on the provider side. Do this even if you replaced it; some providers do not auto-revoke on rotation.

5. **Audit**:
   - Provider dashboard: check usage logs of the leaked key for the suspect window.
   - DB: check `audit_log` for unexpected admin actions.
   - MercadoPago: check for unexpected refunds or payments.
   - Cloudinary: check for unexpected uploads.

6. **Document** the incident in this file's audit log (section 8) AND in a separate post-mortem under `docs/runbooks/`.

7. **Notify** stakeholders (team lead, security contact, customers if PII was exposed). Argentina has data-breach notification rules under Ley 25.326; consult counsel if customer data may have been accessed.

---

## 7. Troubleshooting

Common errors during or after rotation, and how to diagnose them.

### "Old secret still cached"

**Symptom**: After updating Vercel and redeploying, some requests still fail with auth errors as if the old secret were still active.

**Cause**: Vercel runs multiple serverless instances. Older instances may continue running until they idle out (~15 minutes by default). They may also be invoked from CDN-cached responses.

**Fix**: Wait 15 minutes, or force-recycle by triggering a fresh deploy:

```bash
cd apps/api
vercel --prod --force
```

### "Webhook signature mismatch"

**Symptom**: After rotating `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`, incoming webhooks return HTTP 401 with `signature_invalid` in logs.

**Cause**: The secret in MercadoPago dashboard does not match the secret in Vercel.

**Fix**: Re-copy the secret from the MercadoPago dashboard, paste it into Vercel exactly (no leading or trailing whitespace), redeploy. Test with the dashboard's "Send test notification" button.

### `pnpm env:check` reports drift between environments

**Symptom**: Validation step in `cd-production.yml` fails with "missing required env var".

**Cause**: One environment (preview vs production) was updated and the other was not.

**Fix**: Pull both env files and diff:

```bash
cd apps/api
vercel env pull .env.preview --environment=preview
vercel env pull .env.production --environment=production
diff .env.preview .env.production
```

Add the missing variable to the lagging environment.

### Sessions all 401 after Better Auth rotation

**Symptom**: Every authenticated request returns 401 right after rotating `HOSPEDA_BETTER_AUTH_SECRET`.

**Cause**: This is **expected**. Rotating the signing secret invalidates all sessions signed with the old key. Users re-authenticate and a new wave of valid sessions is issued.

**Fix**: No fix needed; verify the spike returns to baseline within 30 minutes. If it does not, the new secret was not picked up by the API; redeploy.

### CI fails with "Vercel deployment forbidden"

**Symptom**: `cd-production.yml` fails at the `amondnet/vercel-action` step with a 403.

**Cause**: `VERCEL_TOKEN` was rotated but GitHub Actions secret was not updated, or the new token has insufficient scope.

**Fix**: Update the `VERCEL_TOKEN` GitHub Actions secret. Verify token scope includes deploy on the relevant project.

### DB password rotation broke the seed job

**Symptom**: `apps/seed` deployments fail at runtime with `password authentication failed for user`.

**Cause**: The seed package reads `HOSPEDA_DATABASE_URL` from its **own** Vercel project. You only updated `apps/api`.

**Fix**: Update `HOSPEDA_DATABASE_URL` in the seed Vercel project too:

```bash
cd packages/seed
vercel env rm HOSPEDA_DATABASE_URL production
vercel env add HOSPEDA_DATABASE_URL production
```

### Cron jobs silently stop after rotation

**Symptom**: After rotating `HOSPEDA_CRON_SECRET`, expected cron runs do not appear in Vercel logs.

**Cause**: Vercel's cron config caches the request body but the API rejects the auth header. The job is logged as "completed" by Vercel even though the API returned 401.

**Fix**: Watch the API logs (not the cron logs) for `cron_auth_failed` lines. If present, verify the secret matches in Vercel `Production`. Redeploy.

### `redis_fallback=true` count climbs after Redis rotation

**Symptom**: Sentry shows a sustained increase in the `redis_fallback` tag.

**Cause**: The new Redis URL is unreachable from Vercel (firewall or wrong region) or has a typo.

**Fix**: Test the URL from your shell with `redis-cli -u "$HOSPEDA_REDIS_URL" PING`. If it fails locally, fix the URL. If it works locally but not from Vercel, check the Redis provider's IP allowlist.

---

## 8. Audit Log

Append-only log of every rotation. Add a new row at the **top** (most recent first). Do not edit historical entries.

| Date (YYYY-MM-DD) | Service / Env Var | Trigger | Operator | Notes |
|-------------------|-------------------|---------|----------|-------|
| _none yet_ | _none_ | _none_ | _none_ | Initial creation of this runbook on 2026-04-29. First rotation will be logged here. |

### How to add an entry

When you finish a rotation, add a row at the top. Example:

```
| 2026-05-15 | HOSPEDA_BETTER_AUTH_SECRET | scheduled (90d) | qazuor | Smooth rotation. Session 401 spike normalized in 22 min. |
| 2026-05-10 | HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN | incident (leaked in PR #1234) | qazuor | Rotated to prod first; staging caught up at 14:30 ART. Audit on MP dashboard showed no anomalous calls. |
```

Required columns:

- **Date** in `YYYY-MM-DD` (use ART date).
- **Service / Env Var**: the canonical env var name.
- **Trigger**: `scheduled (<cadence>)` or `incident (<short reason>)`.
- **Operator**: who performed the rotation.
- **Notes**: anything notable. Outages, observations, follow-ups.

---

## 9. Cross-References

### Internal documentation

- [`docs/deployment/secrets.md`](./secrets.md) — Canonical inventory of every secret and which environments need it.
- [`packages/config/src/env-registry.hospeda.ts`](../../packages/config/src/env-registry.hospeda.ts) — Source of truth for `HOSPEDA_*` env var schemas. The `secret: true` flag identifies sensitive vars.
- [docs/deployment/README.md](./README.md) — Overall deployment strategy and pipeline overview.
- [docs/deployment/checklist.md](./checklist.md) — Pre-deployment checks that must pass before any release.
- [docs/deployment/environments.md](./environments.md) — Environment-tier configuration.
- [docs/deployment/ci-cd.md](./ci-cd.md) — CI/CD pipeline detail (gates, concurrency, env validation step).
- [docs/runbooks/sentry-setup.md](../runbooks/sentry-setup.md) — Sentry alert and dashboard setup. Use these alerts to monitor the post-rotation window.
- [docs/runbooks/rollback.md](../runbooks/rollback.md) — Application rollback procedures (use when a rotation breaks prod).
- [docs/runbooks/billing-incidents.md](../runbooks/billing-incidents.md) — Use when a MercadoPago rotation triggers payment-side fallout.
- [docs/runbooks/cloudinary-incidents.md](../runbooks/cloudinary-incidents.md) — Same for Cloudinary.
- [docs/runbooks/backup-recovery.md](../runbooks/backup-recovery.md) — Database backup and recovery (relevant during DB password rotation).
- [docs/runbooks/monitoring.md](../runbooks/monitoring.md) — Where to watch metrics during the post-rotation window.

### External references

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Neon: Reset role passwords](https://neon.tech/docs/manage/roles)
- [MercadoPago: Manage credentials](https://www.mercadopago.com.ar/developers/en/docs/getting-started)
- [Sentry: Auth tokens](https://docs.sentry.io/api/auth/)
- [Resend: API keys](https://resend.com/api-keys)
- [Cloudinary: Reset API secret](https://support.cloudinary.com/hc/en-us/articles/202521522)
- [Google Cloud: Rotate OAuth client secret](https://cloud.google.com/support/docs/oauth-secret-rotation)
- [Linear: Personal API keys](https://linear.app/settings/api)

---

## Maintainer TODOs

The following items were flagged as `TODO` during the writing of this runbook. They should be confirmed by an operator with current dashboard access and updated in place.

- 5.2: confirm MercadoPago "Renew access token" path in the developers dashboard.
- 5.3: confirm MercadoPago webhook secret regeneration path.
- 5.4: confirm Cloudinary "Reset API Secret" path and provisional-key flow.
- 5.7: confirm Google Cloud Console path for adding a second client secret.
- 5.8: confirm Meta for Developers "Reset App Secret" path.
- 5.9: confirm whether a Linear bot user already exists and document its name here.
- 5.13: confirm the actual Redis provider currently used in prod (Upstash, Vercel KV, or other) and link to its rotation docs.
- 5.15: confirm ExchangeRate-API key regeneration path.
- Audit log: log first real rotation to validate the table format.
