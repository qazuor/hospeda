# Managing Multiple Environments

Guide to configuring and managing different environments in the Hospeda project.

## Table of Contents

- [Environment Types](#environment-types)
- [Configuration Per Environment](#configuration-per-environment)
- [Environment Detection](#environment-detection)
- [File Structure](#file-structure)
- [Best Practices](#best-practices)
- [Deployment](#deployment)

---

## Environment Types

### Development

**Purpose:** Local development on developer machines.

**Characteristics:**

- Hot reload enabled
- Detailed logging (debug level)
- Local database
- Mocked external services
- Development credentials

**Configuration:**

```bash
# .env.local
NODE_ENV=development
API_PORT=3000
API_HOST=http://localhost
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospeda_dev
LOG_LEVEL=debug
ENABLE_DEBUG=true
```

**Database:**

- Local PostgreSQL instance
- Docker container recommended
- Seeded with test data

**Usage:**

```bash
pnpm dev
```

### Test

**Purpose:** Automated testing (CI/CD, local test runs).

**Characteristics:**

- Fast execution
- Isolated database
- Mocked external services
- Minimal logging
- No side effects

**Configuration:**

```bash
# .env.test
NODE_ENV=test
API_PORT=3001
API_HOST=http://localhost
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospeda_test
LOG_LEVEL=warn
ENABLE_DEBUG=false
```

**Database:**

- Separate test database
- Fresh migrations before each test suite
- No persistent data

**Usage:**

```bash
pnpm test
```

### Staging

**Purpose:** Pre-production testing with production-like data.

**Characteristics:**

- Production-like environment
- Real external services (test mode)
- Moderate logging
- Non-production data
- Testing deployments

**Configuration:**

```bash
# Vercel environment variables (staging)
NODE_ENV=staging
API_PORT=8080
API_HOST=https://staging-api.hospeda.com
DATABASE_URL=postgresql://user:pass@staging-db.neon.tech/hospeda_staging
LOG_LEVEL=info
ENABLE_DEBUG=false
```

**Database:**

- Hosted database (Neon)
- Production-like data
- Regular backups

**Usage:**

- Deployed via Vercel (staging branch)
- Automatic deployments on PR

### Production

**Purpose:** Live application serving real users.

**Characteristics:**

- High availability
- Minimal logging (errors/warnings only)
- Real external services
- Production credentials
- Performance optimized

**Configuration:**

```bash
# Vercel environment variables (production)
NODE_ENV=production
API_PORT=8080
API_HOST=https://api.hospeda.com
DATABASE_URL=postgresql://user:pass@prod-db.neon.tech/hospeda_prod
LOG_LEVEL=warn
ENABLE_DEBUG=false
```

**Database:**

- Hosted database (Neon)
- Automated backups
- Point-in-time recovery

**Usage:**

- Deployed via Vercel (main branch)
- Manual deployment approval

---

## Configuration Per Environment

### .env Files Structure

**Local Development:**

```bash
# .env.local (not committed)
NODE_ENV=development

# API
API_PORT=3000
API_HOST=http://localhost

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospeda_dev
DATABASE_SSL=false

# Authentication
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Payments
MERCADOPAGO_ACCESS_TOKEN=TEST-...
MERCADOPAGO_PUBLIC_KEY=TEST-...

# Storage
CLOUDINARY_CLOUD_NAME=dev-cloud
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Logging
LOG_LEVEL=debug
```

**Testing:**

```bash
# .env.test (committed)
NODE_ENV=test

# API
API_PORT=3001
API_HOST=http://localhost

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospeda_test
DATABASE_SSL=false

# Authentication (test keys)
CLERK_SECRET_KEY=sk_test_mock
CLERK_PUBLISHABLE_KEY=pk_test_mock

# Payments (mocked)
MERCADOPAGO_ACCESS_TOKEN=TEST-MOCK
MERCADOPAGO_PUBLIC_KEY=TEST-MOCK

# Storage (mocked)
CLOUDINARY_CLOUD_NAME=test-cloud
CLOUDINARY_API_KEY=test
CLOUDINARY_API_SECRET=test

# Logging
LOG_LEVEL=warn
```

**Staging:**

```bash
# Vercel environment variables (staging)
NODE_ENV=staging

# API
API_PORT=8080
API_HOST=https://staging-api.hospeda.com

# Database
DATABASE_URL=postgresql://...@staging-db.neon.tech/hospeda_staging
DATABASE_SSL=true

# Authentication (test environment)
CLERK_SECRET_KEY=sk_test_staging_...
CLERK_PUBLISHABLE_KEY=pk_test_staging_...

# Payments (sandbox)
MERCADOPAGO_ACCESS_TOKEN=TEST-STAGING-...
MERCADOPAGO_PUBLIC_KEY=TEST-STAGING-...

# Storage
CLOUDINARY_CLOUD_NAME=staging-cloud
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Logging
LOG_LEVEL=info
```

**Production:**

```bash
# Vercel environment variables (production)
NODE_ENV=production

# API
API_PORT=8080
API_HOST=https://api.hospeda.com

# Database
DATABASE_URL=postgresql://...@prod-db.neon.tech/hospeda_prod
DATABASE_SSL=true

# Authentication (production)
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...

# Payments (production)
MERCADOPAGO_ACCESS_TOKEN=APP-...
MERCADOPAGO_PUBLIC_KEY=APP-...

# Storage
CLOUDINARY_CLOUD_NAME=prod-cloud
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Logging
LOG_LEVEL=warn
```

### Platform Environment Variables (Vercel)

**Setting Environment Variables:**

1. Go to Vercel Dashboard
2. Select project
3. Settings → Environment Variables
4. Add variables with scope:
   - Production
   - Preview (staging)
   - Development

**Example:**

```text
Key: DATABASE_URL
Value: postgresql://...
Environments: Production, Preview, Development
```

**Sensitive Variables:**

- Mark as "Sensitive" in Vercel
- Hidden from logs
- Not visible in UI after saving

### Docker Environment Files

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  api:
    build: ./apps/api
    env_file:
      - .env.local
    environment:
      - NODE_ENV=development
    ports:
      - "3000:3000"

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=hospeda_dev
    ports:
      - "5432:5432"
```

**docker-compose.test.yml:**

```yaml
version: '3.8'

services:
  api:
    build: ./apps/api
    env_file:
      - .env.test
    environment:
      - NODE_ENV=test

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=hospeda_test
```

### CI/CD Secrets

**GitHub Actions:**

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: test
      DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY_TEST }}

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test
```

**Setting Secrets:**

1. Repository Settings → Secrets and variables → Actions
2. New repository secret
3. Add key-value pairs

---

## Environment Detection

### NODE_ENV Variable

**Standard Values:**

- `development` - Local development
- `test` - Automated testing
- `staging` - Pre-production
- `production` - Live production

**Reading NODE_ENV:**

```typescript
const environment = process.env.NODE_ENV || 'development';

if (environment === 'production') {
  // Production-specific behavior
}
```

### Custom Environment Flags

**Environment-Specific Features:**

```typescript
import { z } from 'zod';

const FeatureFlagsSchema = z.object({
  ENABLE_DEBUG: z.coerce.boolean().default(false),
  ENABLE_PROFILING: z.coerce.boolean().default(false),
  ENABLE_ANALYTICS: z.coerce.boolean().default(true),
});

const featureFlags = FeatureFlagsSchema.parse(process.env);

if (featureFlags.ENABLE_DEBUG) {
  // Enable debug features
}
```

**Environment Detection Helper:**

```typescript
type Environment = 'development' | 'test' | 'staging' | 'production';

export function getEnvironment(): Environment {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'test') return 'test';
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';

  return 'development';
}

export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}

export function isProduction(): boolean {
  return getEnvironment() === 'production';
}

export function isTest(): boolean {
  return getEnvironment() === 'test';
}
```

### Environment-Specific Defaults

**Configuration with Defaults:**

```typescript
import { z } from 'zod';
import { getEnvironment } from './environment.js';

const environment = getEnvironment();

const ConfigSchema = z.object({
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default(environment === 'production' ? 'warn' : 'debug'),

  ENABLE_DEBUG: z.coerce
    .boolean()
    .default(environment === 'development'),

  API_HOST: z
    .string()
    .default(
      environment === 'production'
        ? 'https://api.hospeda.com'
        : 'http://localhost'
    ),
});
```

---

## File Structure

### Committed vs Not Committed

```text
hospeda/
├── .env.example          # ✅ Committed - Template for all environments
├── .env.local            # ❌ Not committed - Local development
├── .env.test             # ✅ Committed - Test configuration
├── .env.production       # ✅ Committed - Production template (no secrets)
└── .gitignore            # Must include .env.local
```

### .env.example (Template)

```bash
# .env.example
# Copy to .env.local and fill in your values

# API Configuration
API_PORT=3000
API_HOST=http://localhost

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Authentication (Clerk)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Payments (Mercado Pago)
MERCADOPAGO_ACCESS_TOKEN=TEST-...
MERCADOPAGO_PUBLIC_KEY=TEST-...

# Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Logging
LOG_LEVEL=debug
```

### .gitignore

```text
# Environment variables
.env
.env.local
.env*.local

# Keep templates
!.env.example
!.env.test
!.env.production
```

---

## Best Practices

### 1. Never Commit Secrets

**❌ BAD:**

```bash
# .env
DATABASE_URL=postgresql://user:MySecretPassword123@prod-db.neon.tech/db
CLERK_SECRET_KEY=YOUR_SECRET_KEY_HERE
```

**✅ GOOD:**

```bash
# .env.example
DATABASE_URL=postgresql://user:password@host:port/database
CLERK_SECRET_KEY=sk_test_...
```

### 2. Use .env.example

**Purpose:**

- Document all required variables
- Provide example values
- Help new developers set up

**Maintenance:**

- Update when adding new variables
- Remove obsolete variables
- Keep in sync with actual config

### 3. Validate All Environments

**Startup Validation:**

```typescript
import { apiConfig } from '@repo/config';

// Validation happens on import
// Application won't start if config invalid
console.log(`Starting on port ${apiConfig.API_PORT}`);
```

**Environment-Specific Validation:**

```typescript
import { z } from 'zod';
import { isProduction } from './environment.js';

const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.coerce.boolean(),
}).refine(
  (data) => {
    // In production, SSL must be enabled
    if (isProduction() && !data.DATABASE_SSL) {
      return false;
    }
    return true;
  },
  {
    message: 'DATABASE_SSL must be enabled in production',
    path: ['DATABASE_SSL'],
  }
);
```

### 4. Document Required Variables

**In Code:**

```typescript
/**
 * API Configuration
 *
 * Required environment variables:
 * - API_PORT: Port number (1-65535)
 * - API_HOST: Host URL (http://localhost in dev)
 */
export const apiConfig = parseApiSchema(process.env);
```

**In Documentation:**

See [Environment Variables Reference](../api/env-vars.md)

### 5. Use Sensible Defaults

**Development Defaults:**

```typescript
const DevConfigSchema = z.object({
  API_PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  ENABLE_DEBUG: z.coerce.boolean().default(true),
});
```

**Production Requires Explicit Values:**

```typescript
const ProdConfigSchema = z.object({
  API_PORT: z.coerce.number(), // No default - must be set
  LOG_LEVEL: z.enum(['warn', 'error']).default('warn'),
  ENABLE_DEBUG: z.literal(false), // Must be false
});
```

---

## Deployment

### Vercel Environment Variables

**Setup Steps:**

1. **Open Vercel Dashboard**
   - Go to your project
   - Click "Settings"
   - Click "Environment Variables"

2. **Add Variables:**
   - Key: `DATABASE_URL`
   - Value: `postgresql://...`
   - Environment: Production, Preview, Development
   - Click "Save"

3. **Sensitive Variables:**
   - Check "Sensitive" for secrets
   - Values hidden after saving
   - Not shown in build logs

4. **Redeploy:**
   - Required for changes to take effect
   - Deployments → ... → Redeploy

**Accessing in Code:**

```typescript
// Vercel automatically loads env vars
import { databaseConfig } from '@repo/config';

// Works automatically in Vercel deployments
console.log(databaseConfig.DATABASE_URL);
```

### Docker Compose Environment Files

**Development:**

```yaml
# docker-compose.yml
services:
  api:
    env_file:
      - .env.local
```

**Production:**

```yaml
# docker-compose.prod.yml
services:
  api:
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
```

**Running:**

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up
```

### GitHub Actions Secrets

**Setting Secrets:**

1. Repository → Settings
2. Secrets and variables → Actions
3. New repository secret
4. Add key-value pairs

**Using in Workflow:**

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY_PROD }}

    steps:
      - name: Deploy
        run: pnpm deploy
```

---

## Related Documentation

- [Configuration Validation](./validation.md)
- [Environment Variables Reference](../api/env-vars.md)
- [Security Best Practices](./security.md)
- [Quick Start Guide](../quick-start.md)
