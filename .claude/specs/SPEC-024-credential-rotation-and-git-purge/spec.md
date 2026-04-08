---
spec-id: SPEC-024
title: Credential Rotation & Git History Purge
type: security
complexity: medium
status: draft
created: 2026-03-01T00:00:00.000Z
approved: null
---

## SPEC-024: Credential Rotation & Git History Purge

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Remediate a credential exposure in the git history and perform a preventive rotation of all production credentials. The work has two distinct parts:

1. **Remediation** (urgent). Purge the `.env` file from git history, which contains Supabase credentials committed in early development
2. **Preventive rotation** (best practice). Rotate all current production credentials as a security hygiene measure, since the project is approaching production deployment

#### Motivation

On 2025-05-09, a `.env` file was committed to the repository (commit `33bd4124`) containing real Supabase credentials. It was removed on 2025-08-22 (commit `bacbf585`), but the values remain recoverable from git history by anyone with repository access.

**What was actually exposed (verified via `git log --all -S`):**

| Variable | Value pattern | Risk level |
|----------|--------------|------------|
| `VITE_SUPABASE_ANON_KEY` | JWT token (`eyJhbGci...`) for project `bxvzdcqqinjjctqjpmqc` | LOW. Supabase is no longer used (migrated to Neon/Better Auth). Anon keys are designed to be public but grant read access to public tables. |
| `VITE_SUPABASE_URL` | `https://bxvzdcqqinjjctqjpmqc.supabase.co` | LOW. Project URL, semi-public. |

**What was NOT exposed (verified.. these variables NEVER appeared in committed `.env` files with real values):**

- No MercadoPago tokens, no database passwords, no auth secrets, no API keys for Resend/Sentry/Google/Facebook/Linear were ever committed to git.
- `docker/.env.example` and `.env.example` files contain only placeholder values by design (e.g. `your-secret-key-here`, `hospeda_pass`) and are safe to remain in the repository.
- `.env.test` contains only test configuration values (e.g. `test-secret-key-for-testing`) and is safe.

**Why rotate everything anyway?** Even though only Supabase credentials were exposed, rotating all credentials proactively is a security best practice before going to production. This ensures no credential has been silently leaked through other vectors (screenshots, logs, shared messages, etc.).

#### Success Metrics

- Supabase project disabled or credentials revoked (even though deprecated)
- `.env` file purged from git history: `git log --all -- .env` returns zero results
- Supabase credential values no longer recoverable: `git log --all -S 'bxvzdcqqinjjctqjpmqc'` returns zero results
- All current production credentials rotated with new values
- All services verified working with rotated credentials
- `.gitignore` verified to include `.env` pattern (already the case)

### 2. Prerequisites

Before starting ANY work on this spec, the person executing it MUST verify they have:

#### 2.1 Access Checklist

The executor must have admin/owner access to the following services. Check each one BEFORE starting. If any access is missing, request it from the project owner first.

| # | Service | URL | What you need |
|---|---------|-----|---------------|
| 1 | GitHub (qazuor/hospeda) | https://github.com/qazuor/hospeda/settings | Admin access (for force push, secrets) |
| 2 | Vercel | https://vercel.com/dashboard | Owner access to all 3 projects (API, Web, Admin) |
| 3 | Supabase | https://supabase.com/dashboard | Owner access to project `bxvzdcqqinjjctqjpmqc` |
| 4 | Neon (PostgreSQL) | https://console.neon.tech | Owner access to the hospeda project |
| 5 | MercadoPago | https://www.mercadopago.com.ar/developers | Access to the hospeda application |
| 6 | Resend | https://resend.com/api-keys | Account with API key management |
| 7 | Sentry | https://sentry.io/settings | Access to hospeda-api, hospeda-web, hospeda-admin projects |
| 8 | Google Cloud Console | https://console.cloud.google.com/apis/credentials | Access to OAuth 2.0 credentials |
| 9 | Meta Developer | https://developers.facebook.com | Access to hospeda app settings |
| 10 | Linear | https://linear.app/settings/api | Personal API key management |
| 11 | ExchangeRate-API | https://www.exchangerate-api.com/docs/overview | Account with API key management |
| 12 | Redis provider | (depends on provider) | Password reset capability |

#### 2.2 Tool Requirements

```bash
# Verify git-filter-repo is installed (needed for Phase 4)
git filter-repo --version
# If not installed:
pip install git-filter-repo
# OR on Ubuntu/Debian:
sudo apt install git-filter-repo
# OR on macOS:
brew install git-filter-repo

# Verify openssl is available (needed for generating secrets)
openssl version

# Verify git version (filter-repo requires git >= 2.22)
git --version
```

#### 2.3 Preparation Checklist

- [ ] All access from 2.1 verified
- [ ] Tools from 2.2 installed
- [ ] Current `.env.local` file backed up to a secure location (password manager, encrypted drive). NOT in the repo, NOT in plain text on disk
- [ ] Maintenance window scheduled (recommended: low-traffic period, e.g. weekday 03:00-05:00 ART)
- [ ] All team members notified about upcoming git history rewrite (they will need to re-clone)

### 3. Credential Inventory

This section lists ALL credentials that will be rotated, organized by urgency. The "Exposed in git?" column clarifies which ones were actually committed vs. which are being rotated preventively.

#### 3.1 REMEDIATION (actually exposed in git history)

| # | Variable | Service | Exposed in git? | Current status | Action required |
|---|----------|---------|----------------|----------------|-----------------|
| 1 | `VITE_SUPABASE_ANON_KEY` | Supabase | YES (commit `33bd4124`) | Deprecated. Project migrated to Neon/Better Auth | Revoke in Supabase dashboard |
| 2 | `VITE_SUPABASE_URL` | Supabase | YES (commit `33bd4124`) | Deprecated | Disable or pause the Supabase project |

**Action for items 1-2:**

1. Go to https://supabase.com/dashboard
2. Select project `bxvzdcqqinjjctqjpmqc`
3. Go to **Settings** > **General**
4. If the project is still active: click **Pause project** (free tier) or **Delete project** (if you are sure it is no longer needed)
5. Alternatively, go to **Settings** > **API** and regenerate the anon key to invalidate the exposed one

#### 3.2 PREVENTIVE ROTATION - Critical (production payment/data access)

| # | Variable | Service | Exposed in git? | How to rotate | Impact during rotation |
|---|----------|---------|----------------|---------------|----------------------|
| 3 | `MERCADO_PAGO_ACCESS_TOKEN` | MercadoPago | NO | See Step-by-step 3a | Payment processing pauses until new token is deployed. Webhooks need the new token. |
| 4 | `HOSPEDA_DATABASE_URL` | PostgreSQL (Neon) | NO | See Step-by-step 3b | Closes all active DB connections. Brief downtime (seconds). |
| 5 | `HOSPEDA_BETTER_AUTH_SECRET` | Better Auth | NO | See Step-by-step 3c | **Invalidates ALL active user sessions.** Every logged-in user must re-login. |

**Step-by-step 3a: Rotate MercadoPago access token**

1. Go to https://www.mercadopago.com.ar/developers/panel/app
2. Click on the Hospeda application
3. Go to **Production credentials** (or **Test credentials** if in sandbox)
4. Click **Generate new access token** (or **Create new credential**)
5. Copy the new token. It starts with `APP_USR-` (production) or `TEST-` (sandbox)
6. **Important**: The old token is revoked immediately. Do NOT close this tab until the new token is deployed
7. Save the new token in your password manager
8. Proceed to Phase 2 (Deployment) to update the token in Vercel

**Step-by-step 3b: Rotate Neon database password**

1. Go to https://console.neon.tech
2. Select the hospeda project
3. Go to **Dashboard** or **Connection details**
4. Click **Reset password** (or go to **Branches** > select branch > **Roles** > reset password)
5. Copy the new connection string. Format: `postgresql://user:NEW_PASSWORD@host/database?sslmode=require`
6. **Important**: All active connections will be dropped. This causes a brief interruption (1-5 seconds)
7. Save the new connection string in your password manager
8. Proceed to Phase 2 (Deployment) to update in Vercel

**Step-by-step 3c: Rotate Better Auth secret**

1. Generate a new secret:
   ```bash
   openssl rand -base64 32
   ```
2. Copy the output (e.g. `aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA7bC=`)
3. **Important**: Changing this secret invalidates ALL active sessions. Every user currently logged in will be logged out. Plan this during a maintenance window
4. Save the new secret in your password manager
5. Proceed to Phase 2 (Deployment) to update in Vercel

#### 3.3 PREVENTIVE ROTATION - High (service access)

| # | Variable | Service | Exposed in git? | How to rotate | Impact during rotation |
|---|----------|---------|----------------|---------------|----------------------|
| 6 | `CRON_SECRET` | Cron auth | NO | See Step-by-step 4a | Cron jobs fail auth until new secret is deployed |
| 7 | `HOSPEDA_RESEND_API_KEY` | Resend (email) | NO | See Step-by-step 4b | Email delivery pauses between key deletion and deployment |
| 8 | `MERCADO_PAGO_WEBHOOK_SECRET` | MercadoPago webhooks | NO | See Step-by-step 4c | Webhook signature verification fails until deployed |
| 9 | `SENTRY_DSN` | Sentry (API) | NO | See Step-by-step 4d | Error tracking pauses briefly |
| 10 | `PUBLIC_SENTRY_DSN` | Sentry (Web) | NO | See Step-by-step 4d | Same as above, for web app |
| 11 | `VITE_SENTRY_DSN` | Sentry (Admin) | NO | See Step-by-step 4d | Same as above, for admin app |

**Step-by-step 4a: Rotate CRON_SECRET**

1. Generate a new secret:
   ```bash
   openssl rand -hex 32
   ```
2. Copy the output (e.g. `a1b2c3d4e5f6...64 hex characters`)
3. Save in your password manager
4. This secret must be updated in TWO places:
   - Vercel environment variables (for the API app)
   - Vercel Cron configuration (if using Vercel Cron) or the external cron scheduler
5. Both places must have the SAME value

**Step-by-step 4b: Rotate Resend API key**

1. Go to https://resend.com/api-keys
2. Click **Create API Key**
3. Name: `hospeda-production` (or similar descriptive name)
4. Permissions: **Sending access** with domain restriction to `hospeda.com.ar`
5. Copy the new key (starts with `re_`)
6. **Do NOT delete the old key yet**. Wait until the new key is deployed and verified working
7. After verification (Phase 3), return here and delete the old key

**Step-by-step 4c: Rotate MercadoPago webhook secret**

1. Go to https://www.mercadopago.com.ar/developers/panel/app
2. Click on the Hospeda application
3. Go to **Webhooks** (or **IPN** depending on the integration version)
4. Update the webhook secret (or regenerate it)
5. Copy the new secret
6. Save in your password manager

**Step-by-step 4d: Rotate Sentry DSNs (repeat for each project)**

Repeat these steps 3 times, once for each Sentry project:

| Sentry project | Env variable | Vercel project |
|---------------|-------------|----------------|
| hospeda-api | `SENTRY_DSN` | API |
| hospeda-web | `PUBLIC_SENTRY_DSN` | Web |
| hospeda-admin | `VITE_SENTRY_DSN` | Admin |

For each project:

1. Go to https://sentry.io/settings/
2. Navigate to **Projects** > select the project (e.g. `hospeda-api`)
3. Go to **Client Keys (DSN)**
4. Click **Generate New Key**
5. Copy the new DSN (format: `https://key@sentry.io/project-id`)
6. **Do NOT revoke the old key yet**. Wait until deployment is verified
7. After verification (Phase 3), return here and revoke the old key
8. Save the new DSN in your password manager

**Note**: Sentry DSNs are semi-public (they appear in client-side JavaScript). Rotation is still recommended as best practice.

#### 3.4 PREVENTIVE ROTATION - Medium (optional integrations)

These are optional.. rotate only if the integration is currently active in production.

| # | Variable | Service | Exposed in git? | How to rotate | Impact during rotation |
|---|----------|---------|----------------|---------------|----------------------|
| 12 | `HOSPEDA_GOOGLE_CLIENT_ID` + `HOSPEDA_GOOGLE_CLIENT_SECRET` | Google OAuth | NO | See Step-by-step 5a | Google sign-in breaks until redeployed |
| 13 | `HOSPEDA_FACEBOOK_CLIENT_ID` + `HOSPEDA_FACEBOOK_CLIENT_SECRET` | Facebook OAuth | NO | See Step-by-step 5b | Facebook sign-in breaks until redeployed |
| 14 | `HOSPEDA_LINEAR_API_KEY` | Linear | NO | See Step-by-step 5c | Bug report creation pauses |
| 15 | `HOSPEDA_EXCHANGE_RATE_API_KEY` | ExchangeRate-API | NO | See Step-by-step 5d | Exchange rate cron fails until updated |
| 16 | `HOSPEDA_REDIS_URL` | Redis | NO | See Step-by-step 5e | Rate limiter falls back to in-memory |
| 17 | `REPLICATE_API_TOKEN` | Replicate (AI images) | NO | See Step-by-step 5f | AI image generation pauses |

**Step-by-step 5a: Rotate Google OAuth credentials**

1. Go to https://console.cloud.google.com/apis/credentials
2. Under **OAuth 2.0 Client IDs**, click on the hospeda client
3. Click **Create new OAuth client ID** (or create a new one with the same redirect URIs)
4. Copy the new Client ID and Client Secret
5. Delete the old credentials AFTER verifying the new ones work
6. **Important**: Ensure the redirect URIs match exactly:
   - Production: `https://api.hospeda.com/api/auth/callback/google` (adjust to your actual URL)
   - Development: `http://localhost:3001/api/auth/callback/google`

**Step-by-step 5b: Rotate Facebook OAuth credentials**

1. Go to https://developers.facebook.com
2. Select the Hospeda app
3. Go to **Settings** > **Basic**
4. Click **Reset App Secret** (this immediately invalidates the old secret)
5. Copy the new App Secret
6. The App ID does not change
7. Save in your password manager

**Step-by-step 5c: Rotate Linear API key**

1. Go to https://linear.app/settings/api
2. Under **Personal API Keys**, click **Create key**
3. Name: `hospeda` (or similar)
4. Copy the new key (starts with `lin_api_`)
5. Delete the old key
6. Save in your password manager

**Step-by-step 5d: Rotate ExchangeRate-API key**

1. Go to the ExchangeRate-API dashboard (https://app.exchangerate-api.com/dashboard or similar)
2. Navigate to API key management
3. Generate a new key or regenerate the existing one (depends on provider)
4. Copy the new key
5. Save in your password manager

**Step-by-step 5e: Rotate Redis password**

This depends on your Redis provider:

- **Upstash**: Go to https://console.upstash.com > select database > **Reset password**
- **Redis Cloud**: Go to Redis Cloud console > database > **Security** > change password
- **Docker (local dev only)**: Update `docker/.env` (not committed to git) with a new password

After rotating, update the `HOSPEDA_REDIS_URL` connection string with the new password.

**Step-by-step 5f: Rotate Replicate API token**

1. Go to https://replicate.com/account/api-tokens
2. Click **Create token**
3. Copy the new token (starts with `r8_`)
4. Delete the old token
5. Save in your password manager

#### 3.5 CLEANUP - Deprecated credentials

| # | Variable | Service | Action |
|---|----------|---------|--------|
| 18 | `HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk (deprecated) | Revoke in Clerk dashboard if the account still exists. Clerk was migrated to Better Auth. |
| 19 | `HOSPEDA_CLERK_SECRET_KEY` | Clerk (deprecated) | Same as above |

**Steps to clean up Clerk:**

1. Go to https://dashboard.clerk.com
2. If the hospeda application still exists:
   a. Go to **API Keys**
   b. Revoke all keys
   c. Consider deleting the application entirely if it is no longer needed
3. If the account no longer exists, skip this step

### 4. Deployment Targets

After rotating credentials, the new values must be updated in ALL of these locations. Missing even one location will cause service failures.

#### 4.1 Vercel Environment Variables

| Vercel project | Environment | Variables to update |
|---------------|-------------|---------------------|
| hospeda-api | Production | `HOSPEDA_DATABASE_URL`, `HOSPEDA_BETTER_AUTH_SECRET`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `CRON_SECRET`, `HOSPEDA_RESEND_API_KEY`, `SENTRY_DSN`, `HOSPEDA_LINEAR_API_KEY`, `HOSPEDA_EXCHANGE_RATE_API_KEY`, `HOSPEDA_REDIS_URL`, `REPLICATE_API_TOKEN`, `HOSPEDA_GOOGLE_CLIENT_ID`, `HOSPEDA_GOOGLE_CLIENT_SECRET`, `HOSPEDA_FACEBOOK_CLIENT_ID`, `HOSPEDA_FACEBOOK_CLIENT_SECRET` |
| hospeda-api | Preview | Same as Production (or use test/sandbox values) |
| hospeda-web | Production | `PUBLIC_SENTRY_DSN`, `HOSPEDA_BETTER_AUTH_SECRET`, `HOSPEDA_DATABASE_URL` |
| hospeda-web | Preview | Same as Production (or use test values) |
| hospeda-admin | Production | `VITE_SENTRY_DSN` |
| hospeda-admin | Preview | Same as Production (or use test values) |

**How to update Vercel environment variables:**

1. Go to https://vercel.com/dashboard
2. Click on the project (e.g. `hospeda-api`)
3. Go to **Settings** > **Environment Variables**
4. For each variable:
   a. Find the variable in the list
   b. Click the **three dots** menu > **Edit**
   c. Paste the new value
   d. Click **Save**
5. **Important**: After updating ALL variables for a project, trigger a redeployment:
   a. Go to the **Deployments** tab
   b. Find the latest production deployment
   c. Click the **three dots** menu > **Redeploy**
   d. Check **Use existing Build Cache** for faster deployment
   e. Click **Redeploy**

#### 4.2 GitHub Actions Secrets

| Secret name | Used by |
|-------------|---------|
| `HOSPEDA_DATABASE_URL` | CI pipeline (test database connection) |
| `HOSPEDA_BETTER_AUTH_SECRET` | CI pipeline (auth in tests) |

**How to update GitHub secrets:**

1. Go to https://github.com/qazuor/hospeda/settings/secrets/actions
2. For each secret:
   a. Click on the secret name
   b. Click **Update secret**
   c. Paste the new value
   d. Click **Update secret**

#### 4.3 Local Development

Each developer must update their local `.env.local` file with the new values. The `.env.local` file is gitignored and never committed.

1. Open `.env.local` in the project root
2. Update each rotated variable with the new value
3. Restart the development server: `pnpm dev`

### 5. Git History Purge Procedure

This section removes the `.env` file from ALL commits in the repository history. This is a **destructive, irreversible operation** that rewrites git history.

#### 5.1 Prerequisites (verify ALL before proceeding)

- [ ] All credentials from Section 3.1 (remediation) have been revoked/disabled
- [ ] All credentials from Sections 3.2-3.4 have been rotated
- [ ] All deployment targets from Section 4 have been updated with new values
- [ ] All services verified working (Phase 3 complete)
- [ ] Old credential values backed up in a secure, offline location (password manager)
- [ ] All team members notified they will need to re-clone after the purge
- [ ] All in-progress branches pushed to remote (they will need to be re-based after re-clone)
- [ ] All open PRs are either merged or noted (they will need to be recreated)

#### 5.2 Backup

```bash
# Create a full mirror backup of the repository
# This backup preserves ALL branches, tags, and refs
# Store this backup in a safe location OUTSIDE the project directory
cd /tmp
git clone --mirror https://github.com/qazuor/hospeda.git hospeda-backup-$(date +%Y%m%d).git

# Verify the backup is complete
cd hospeda-backup-$(date +%Y%m%d).git
git log --oneline | wc -l
# Expected: ~2661 commits (or current count)

# Go back to your working directory
cd /path/to/your/hospeda
```

#### 5.3 Execute the purge

```bash
# IMPORTANT: Run these commands from a FRESH clone, not your working copy
# This avoids conflicts with uncommitted changes

cd /tmp
git clone https://github.com/qazuor/hospeda.git hospeda-purge
cd hospeda-purge

# Verify the .env file exists in history (should return commits)
git log --all --oneline -- .env
# Expected output:
#   bacbf585 del: remove obsolete files
#   33bd4124 Added .env

# Run the purge: removes .env from ALL commits in ALL branches
git filter-repo --path .env --invert-paths --force

# Verify the purge worked (should return NOTHING)
git log --all --oneline -- .env
# Expected: no output

# Verify the Supabase credentials are gone
git log --all -S 'bxvzdcqqinjjctqjpmqc'
# Expected: no output

git log --all -S 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI'
# Expected: no output

# NOTE: docker/.env was NEVER committed (only docker/.env.example exists)
# No need to purge docker/.env
```

#### 5.4 Force push

```bash
# Still in /tmp/hospeda-purge

# Re-add the remote (filter-repo removes remotes)
git remote add origin https://github.com/qazuor/hospeda.git

# Force push ALL branches
git push origin --force --all

# Force push ALL tags
git push origin --force --tags
```

**WARNING**: This force push rewrites the entire repository history. All commit hashes will change. This is expected and necessary.

#### 5.5 GitHub cache cleanup (recommended)

GitHub may cache the old objects on their servers. To request cleanup:

1. Go to https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository#fully-removing-the-data-from-github
2. Contact GitHub support at https://support.github.com/contact
3. Request removal of cached objects for `qazuor/hospeda`
4. Reference the `.env` file that was purged

This step is optional but recommended for complete removal.

#### 5.6 Post-purge: All contributors must re-clone

Every developer/contributor must:

```bash
# 1. Save any uncommitted work
cd hospeda
git stash  # or commit to a branch and push

# 2. Delete the old clone
cd ..
rm -rf hospeda

# 3. Clone fresh
git clone https://github.com/qazuor/hospeda.git
cd hospeda

# 4. Install dependencies
pnpm install

# 5. Set up local env
cp .env.example .env.local
# Edit .env.local with your credentials

# 6. Verify it works
pnpm dev
```

#### 5.7 Verification (run from a fresh clone)

```bash
# Clone to a temporary directory for verification
cd /tmp
git clone https://github.com/qazuor/hospeda.git hospeda-verify
cd hospeda-verify

# Test 1: .env should not appear in history
git log --all -- .env
# EXPECTED: no output. If any commits appear, the purge FAILED.

# Test 2: Supabase project ref should not appear
git log --all -S 'bxvzdcqqinjjctqjpmqc'
# EXPECTED: no output

# Test 3: Supabase JWT should not appear
git log --all -S 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSI'
# EXPECTED: no output

# Test 4: .gitignore should still contain .env
grep '^\.env$' .gitignore
# EXPECTED: .env

# Test 5: .env.example should still exist (it is NOT a secret)
test -f .env.example && echo "OK: .env.example exists" || echo "FAIL: .env.example missing"
# EXPECTED: OK: .env.example exists

# Test 6: docker/.env.example should still exist
test -f docker/.env.example && echo "OK: docker/.env.example exists" || echo "FAIL: docker/.env.example missing"
# EXPECTED: OK: docker/.env.example exists

# Clean up
cd /tmp
rm -rf hospeda-verify

echo "All verification tests passed. Purge successful."
```

### 6. Service Verification Checklist

After rotating credentials AND deploying new values, verify each service works. This checklist must be completed BEFORE marking the spec as done.

#### 6.1 Critical Services

| # | Service | How to verify | Expected result | Status |
|---|---------|--------------|-----------------|--------|
| 1 | Database | Open the deployed API health endpoint: `GET https://api.hospeda.com/health/db` | `{"status":"ok","database":"connected"}` | [ ] |
| 2 | Authentication | Go to the web app, sign in with email/password | Login succeeds, session is created | [ ] |
| 3 | MercadoPago | Create a test payment (sandbox mode) or verify the billing page loads in admin | No errors, payment flow works | [ ] |

#### 6.2 High Priority Services

| # | Service | How to verify | Expected result | Status |
|---|---------|--------------|-----------------|--------|
| 4 | Cron jobs | Trigger a cron job from admin panel or via API: `POST /api/v1/admin/cron/trigger` with the CRON_SECRET header | Cron executes successfully | [ ] |
| 5 | Email (Resend) | Trigger a test email (e.g. password reset, or use Resend dashboard "Send test email") | Email is received | [ ] |
| 6 | Webhooks | Check MercadoPago webhook logs in the dashboard, or create a test payment | Webhook received and processed | [ ] |
| 7 | Sentry (API) | Trigger an error in the API (e.g. visit a non-existent endpoint) and check Sentry dashboard | Error appears in Sentry | [ ] |
| 8 | Sentry (Web) | Visit the web app, check Sentry dashboard for the web project | No configuration errors | [ ] |
| 9 | Sentry (Admin) | Visit the admin app, check Sentry dashboard for the admin project | No configuration errors | [ ] |

#### 6.3 Medium Priority Services (verify only if active)

| # | Service | How to verify | Expected result | Status |
|---|---------|--------------|-----------------|--------|
| 10 | Google OAuth | Click "Sign in with Google" on the web app | Google OAuth flow completes | [ ] |
| 11 | Facebook OAuth | Click "Sign in with Facebook" on the web app | Facebook OAuth flow completes | [ ] |
| 12 | Linear | Trigger a bug report from the API (if the integration is active) | Issue created in Linear | [ ] |
| 13 | Exchange rates | Run the exchange rate cron job or wait for the next scheduled run | Exchange rates are updated | [ ] |
| 14 | Redis | Check rate limiting works on the API | Rate limit headers appear in responses | [ ] |
| 15 | Replicate | Trigger an AI image generation (if the feature is active) | Image is generated | [ ] |

#### 6.4 CI/CD Pipeline

| # | Check | How to verify | Expected result | Status |
|---|-------|--------------|-----------------|--------|
| 16 | GitHub Actions | Push a commit or manually trigger the CI workflow | CI pipeline passes (lint, typecheck, test) | [ ] |
| 17 | Vercel deployment | Check that the latest deployment succeeded for all 3 apps | All 3 deployments green | [ ] |

### 7. Post-rotation Cleanup

After ALL verifications pass:

1. **Delete old Resend API key**: Go to Resend dashboard and delete the old key (Step-by-step 4b, step 7)
2. **Revoke old Sentry DSNs**: Go to each Sentry project and revoke the old client keys (Step-by-step 4d, step 7)
3. **Delete old Google OAuth credentials**: If you created new ones instead of regenerating (Step-by-step 5a, step 5)
4. **Clean up temporary files**: Delete `/tmp/hospeda-purge`, `/tmp/hospeda-verify`, `/tmp/hospeda-backup-*.git`
5. **Update password manager**: Ensure ALL new values are saved. Delete old values after 30 days if no issues arise

---

## Part 2 - Technical Specification

### 8. Task Breakdown

| Task | Description | Complexity | Phase |
|------|-------------|------------|-------|
| T-001 | Verify all prerequisites (access, tools, backup) | 1 | Preparation |
| T-002 | Remediate exposed Supabase credentials (revoke/disable) | 1 | Remediation |
| T-003 | Rotate CRITICAL credentials (MercadoPago, DB, Auth secret) | 2 | Rotation |
| T-004 | Rotate HIGH priority credentials (Cron, Resend, Webhooks, Sentry) | 2 | Rotation |
| T-005 | Rotate MEDIUM priority credentials (OAuth, Linear, ExchangeRate, Redis, Replicate) | 2 | Rotation |
| T-006 | Clean up deprecated Clerk credentials | 1 | Rotation |
| T-007 | Update all Vercel environment variables and trigger redeployments | 2 | Deployment |
| T-008 | Update GitHub Actions secrets | 1 | Deployment |
| T-009 | Verify all services work with rotated credentials | 3 | Verification |
| T-010 | Execute git-filter-repo purge | 2 | Purge |
| T-011 | Force push and verify clean history | 2 | Purge |
| T-012 | All contributors re-clone repository | 1 | Purge |
| T-013 | Post-rotation cleanup (delete old keys, temp files) | 1 | Cleanup |
| T-014 | Document rotation in project records | 1 | Documentation |

### 9. Execution Order

```
Phase 0 - Preparation:     T-001
Phase 1 - Remediation:     T-002
Phase 2 - Rotation:        T-003 → T-004 → T-005 → T-006
Phase 3 - Deployment:      T-007 + T-008 (can run in parallel)
Phase 4 - Verification:    T-009 (MUST pass before continuing)
Phase 5 - Purge:           T-010 → T-011 → T-012
Phase 6 - Cleanup:         T-013
Phase 7 - Documentation:   T-014
```

**Important constraints:**

- T-003 through T-006 MUST complete before T-007 (you need all new values before deploying them)
- T-007 and T-008 MUST complete before T-009 (you cannot verify services that haven't been redeployed)
- T-009 MUST pass before T-010 (do NOT purge git history until services are verified working)
- T-010 MUST complete before T-011 (contributors cannot re-clone until force push is done)
- If T-009 fails for any service, STOP. Fix the issue before proceeding. The old credential values are still available in git history as a safety net until T-010 executes

### 10. Rollback Plan

#### Before the git purge (Phases 0-4):

If a rotated credential breaks a service:

1. The old credential value can still be retrieved from git history (the purge hasn't happened yet)
2. To retrieve an old value: `git log --all -p -- .env.example` or check your password manager backup
3. Revert the Vercel env var to the old value via Vercel dashboard
4. Trigger a redeployment
5. Investigate and fix before retrying rotation

#### After the git purge (Phase 5+):

- Old credentials can NO longer be recovered from git
- Recovery depends entirely on your secure backup (password manager)
- If you did not back up old values and a service is broken, you must generate new credentials from scratch via the service dashboard

### 11. Documentation Deliverables (T-014)

After completing all phases, create/update the following:

1. **Update `.github/SECRETS.md`**: Reflect the current list of required secrets and how to obtain them
2. **Create a rotation log entry**: Add a dated entry somewhere accessible (e.g. project wiki, ADR, or memory file) recording:
   - Date of rotation
   - Which credentials were rotated
   - Which services were verified
   - Any issues encountered and how they were resolved
3. **Set a calendar reminder**: Schedule the next credential rotation in 6 months (recommended cadence)

### 12. Dependencies

- No dependency on other specs. This is a standalone operational task
- Requires: owner/admin access to all services listed in Section 2.1
- Recommended: perform during low-traffic hours to minimize impact of session invalidation (T-003, item 5)

### 13. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Service outage during rotation | Medium | High | Rotate one credential at a time. Deploy and verify before rotating the next critical one |
| Lost credential (no backup) | Low | Critical | Mandatory backup step in T-001. Password manager required |
| Force push breaks contributor workflows | High | Low | Notify all contributors in advance (T-001 checklist). Re-clone is straightforward |
| Old credentials cached by GitHub | Low | Low | Contact GitHub support for cache cleanup (Section 5.5) |
| Open PRs lost after history rewrite | Medium | Medium | Document all open PRs before purge. They will need to be recreated |
| CI pipeline fails after secret rotation | Medium | Medium | Update GitHub secrets (T-008) BEFORE pushing any new code |

### 14. Estimated Time

| Phase | Estimated time | Notes |
|-------|---------------|-------|
| Phase 0 (Preparation) | 30-60 min | Mostly verifying access to dashboards |
| Phase 1 (Remediation) | 5-10 min | Simple: disable/pause Supabase project |
| Phase 2 (Rotation) | 60-90 min | Depends on number of active integrations |
| Phase 3 (Deployment) | 30-45 min | Updating env vars in Vercel + GitHub |
| Phase 4 (Verification) | 30-60 min | Testing each service |
| Phase 5 (Purge) | 15-30 min | git-filter-repo + force push + verify |
| Phase 6 (Cleanup) | 10-15 min | Delete old keys and temp files |
| Phase 7 (Documentation) | 15-30 min | Update SECRETS.md, create rotation log |
| **Total** | **3-5 hours** | Can be split across sessions if needed (but Phases 2-4 should be done in one session) |
