# GitHub Secrets Configuration

This document describes how to configure the required GitHub secrets for the CI/CD pipeline.

## Required Secrets

The following secrets must be configured in GitHub for the CI/CD pipeline to work correctly:

### 1. Database

- **`HOSPEDA_DATABASE_URL`**
  - PostgreSQL connection string
  - Format: `postgresql://user:password@host:5432/database`
  - Example: `postgresql://hospeda_user:mypass123@localhost:5432/hospeda_db`

### 2. Clerk Authentication (Server-side)

- **`HOSPEDA_CLERK_SECRET_KEY`**
  - Clerk secret key for API server-side authentication
  - Format: `sk_test_...` (test) or `sk_live_...` (production)
  - Get from: [Clerk Dashboard](https://dashboard.clerk.com) → API Keys

- **`CLERK_SECRET_KEY`**
  - Same value as `HOSPEDA_CLERK_SECRET_KEY`
  - Used by Admin app for TanStack Start server-side auth
  - **⚠️ Important:** This should be the same secret key

### 3. Clerk Authentication (Client-side - Public)

- **`HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY`**
  - Clerk publishable key (safe to expose in client)
  - Format: `pk_test_...` (test) or `pk_live_...` (production)
  - Get from: [Clerk Dashboard](https://dashboard.clerk.com) → API Keys

### 4. Application URLs

- **`HOSPEDA_API_URL`**
  - URL where the API is hosted
  - Development: `http://localhost:3001`
  - Staging: `https://api-staging.hospeda.com`
  - Production: `https://api.hospeda.com`

- **`HOSPEDA_SITE_URL`**
  - URL where the web app is hosted
  - Development: `http://localhost:4321`
  - Staging: `https://staging.hospeda.com`
  - Production: `https://hospeda.com`

### 5. Optional Secrets

- **`HOSPEDA_CLERK_WEBHOOK_SECRET`**
  - Webhook secret for Clerk webhooks (if using webhooks)
  - Format: `whsec_...`
  - Get from: [Clerk Dashboard](https://dashboard.clerk.com) → Webhooks

## How to Configure Secrets in GitHub

### Step 1: Access Repository Settings

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click on **Secrets and variables** → **Actions**

### Step 2: Add Secrets

1. Click on **New repository secret**
2. Enter the secret name (e.g., `HOSPEDA_DATABASE_URL`)
3. Enter the secret value
4. Click **Add secret**
5. Repeat for each required secret

### Step 3: Verify Configuration

After adding all secrets, you should see them listed in the repository secrets page:

```
✅ HOSPEDA_DATABASE_URL
✅ HOSPEDA_CLERK_SECRET_KEY
✅ CLERK_SECRET_KEY
✅ HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY
✅ HOSPEDA_API_URL
✅ HOSPEDA_SITE_URL
⚪ HOSPEDA_CLERK_WEBHOOK_SECRET (optional)
```

## Secret Values by Environment

### Development (Local)

These values are stored in `.env.local` at the project root:

```bash
# Database
HOSPEDA_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospeda

# Clerk
HOSPEDA_CLERK_SECRET_KEY=sk_test_YOUR_TEST_KEY
CLERK_SECRET_KEY=sk_test_YOUR_TEST_KEY
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY

# URLs
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4321
```

### CI/CD (GitHub Actions)

Use the same test/development values for CI/CD, or dedicated test environment values.

### Staging

Use staging-specific values:

```bash
HOSPEDA_DATABASE_URL=postgresql://user:pass@staging-db.example.com:5432/hospeda_staging
HOSPEDA_CLERK_SECRET_KEY=sk_test_...  # or sk_live_... if using production Clerk
CLERK_SECRET_KEY=sk_test_...
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
HOSPEDA_API_URL=https://api-staging.hospeda.com
HOSPEDA_SITE_URL=https://staging.hospeda.com
```

### Production

Use production values:

```bash
HOSPEDA_DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/hospeda_prod
HOSPEDA_CLERK_SECRET_KEY=sk_live_...
CLERK_SECRET_KEY=sk_live_...
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
HOSPEDA_API_URL=https://api.hospeda.com
HOSPEDA_SITE_URL=https://hospeda.com
```

## Security Notes

1. **Never commit secrets to the repository**
   - Secrets should only be in `.env.local` (which is gitignored)
   - Or in GitHub Secrets
   - Or in your deployment platform's environment variables

2. **Use different secrets for different environments**
   - Development: Use test/development values
   - Staging: Use staging-specific values
   - Production: Use production values

3. **Rotate secrets regularly**
   - Change secrets periodically for security
   - Update in all environments after rotation

4. **Public vs Private secrets**
   - Variables with `PUBLIC_` or `VITE_` prefix are exposed to client
   - Variables without these prefixes are server-only
   - Only put non-sensitive data in public variables

## Troubleshooting

### Build fails with "environment validation FAILED"

**Cause:** One or more required secrets are missing or invalid.

**Solution:**
1. Check that all required secrets are configured in GitHub
2. Verify the secret names match exactly (case-sensitive)
3. Check that secret values are valid (e.g., URLs are proper URLs)

### Admin app typecheck fails

**Cause:** `CLERK_SECRET_KEY` is missing or invalid.

**Solution:**
1. Ensure `CLERK_SECRET_KEY` is configured in GitHub Secrets
2. Ensure it has the same value as `HOSPEDA_CLERK_SECRET_KEY`

### API app build fails

**Cause:** Database URL or Clerk keys are missing.

**Solution:**
1. Verify `HOSPEDA_DATABASE_URL` is a valid PostgreSQL connection string
2. Verify both Clerk keys are configured

## Need Help?

- 📚 [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- 🔑 [Clerk API Keys](https://clerk.com/docs/references/backend/overview)
- 🗄️ [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
