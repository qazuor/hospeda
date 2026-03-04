# GitHub Secrets Configuration

This document describes how to configure the required GitHub secrets for the CI/CD pipeline.

## Required Secrets

The following secrets must be configured in GitHub for the CI/CD pipeline to work correctly.

**Important:** You only need to configure these secrets. The CI workflow automatically maps them to the formats needed by each app (e.g., `VITE_*` for admin, `PUBLIC_*` for web).

### 1. Database

- **`HOSPEDA_DATABASE_URL`**
  - PostgreSQL connection string
  - Format: `postgresql://user:password@host:5432/database`
  - Example: `postgresql://hospeda_user:mypass123@localhost:5432/hospeda_db`

### 2. Better Auth

- **`HOSPEDA_BETTER_AUTH_SECRET`**
  - Secret key used by Better Auth for signing sessions and tokens
  - Generate with: `openssl rand -base64 32`
  - Must be at least 32 characters
  - Keep this secret consistent across all environments that share the same database

### 3. Application URLs

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

## How to Configure Secrets in GitHub

### Step 1: Access Repository Settings

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click on **Secrets and variables** -> **Actions**

### Step 2: Add Secrets

1. Click on **New repository secret**
2. Enter the secret name (e.g., `HOSPEDA_DATABASE_URL`)
3. Enter the secret value
4. Click **Add secret**
5. Repeat for each required secret

### Step 3: Verify Configuration

After adding all secrets, you should see them listed in the repository secrets page:

```
HOSPEDA_DATABASE_URL
HOSPEDA_BETTER_AUTH_SECRET
HOSPEDA_API_URL
HOSPEDA_SITE_URL
```

## Secret Values by Environment

### Development (Local)

These values are stored in `.env.local` at the project root:

```bash
# Database
HOSPEDA_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospeda

# Better Auth
HOSPEDA_BETTER_AUTH_SECRET=your-dev-secret-at-least-32-characters-long

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
HOSPEDA_BETTER_AUTH_SECRET=staging-secret-generated-with-openssl-rand
HOSPEDA_API_URL=https://api-staging.hospeda.com
HOSPEDA_SITE_URL=https://staging.hospeda.com
```

### Production

Use production values:

```bash
HOSPEDA_DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/hospeda_prod
HOSPEDA_BETTER_AUTH_SECRET=production-secret-generated-with-openssl-rand
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

5. **Better Auth secret generation**
   - Always use a cryptographically secure random generator
   - Recommended: `openssl rand -base64 32`
   - Never reuse the same secret across production and non-production environments

## Troubleshooting

### Build fails with "environment validation FAILED"

**Cause:** One or more required secrets are missing or invalid.

**Solution:**

1. Check that all required secrets are configured in GitHub
2. Verify the secret names match exactly (case-sensitive)
3. Check that secret values are valid (e.g., URLs are proper URLs)

### API app build fails

**Cause:** Database URL or Better Auth secret is missing.

**Solution:**

1. Verify `HOSPEDA_DATABASE_URL` is a valid PostgreSQL connection string
2. Verify `HOSPEDA_BETTER_AUTH_SECRET` is configured and at least 32 characters

## Need Help?

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
