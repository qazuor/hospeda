# Environment Configuration

## Table of Contents

- [Overview](#overview)
- [Environment Tiers](#environment-tiers)
- [Environment Variables Reference](#environment-variables-reference)
- [Configuration by Environment](#configuration-by-environment)
- [Secret Management](#secret-management)
- [Configuration Validation](#configuration-validation)
- [Best Practices](#best-practices)

## Overview

Hospeda uses environment-specific configuration to manage different deployment tiers (development, staging, production). This document provides a comprehensive reference for all environment variables and configuration strategies.

### Configuration Philosophy

- **Environment Isolation**: Each environment is completely isolated with separate credentials
- **Secure by Default**: Secrets are never committed to version control
- **Type Safety**: Environment variables are validated at runtime
- **Documentation First**: All variables are documented and validated

### Configuration Sources

1. **`.env.example`** - Template with all available variables (committed to git)
2. **`.env.local`** - Local development overrides (gitignored)
3. **Platform Variables** - Environment-specific secrets (Vercel)
4. **Runtime Configuration** - Validated and typed configuration objects

## Environment Tiers

### Development (dev)

**Purpose**: Local development and experimentation

**Characteristics:**

- Local development servers (hot reload enabled)
- Debug logging enabled
- Local or development database
- Relaxed security settings
- Mock external services (optional)
- No rate limiting

**Access:**

- Developers: Full access
- QA: Read access
- Stakeholders: No access

### Staging (staging)

**Purpose**: Pre-production testing and QA validation

**Characteristics:**

- Production-like configuration
- Staging database (separate from production)
- Real external services (sandbox/test mode)
- Full monitoring enabled
- Relaxed rate limiting
- Test data and accounts

**Access:**

- Developers: Full access
- QA: Full access
- Stakeholders: Read access
- Clients: Preview access

### Production (production)

**Purpose**: Live production environment serving real users

**Characteristics:**

- Optimized production builds
- Production database with backups
- Real external services (production mode)
- Full monitoring and alerting
- Strict rate limiting and security
- Real user data

**Access:**

- Developers: Limited access (read-only logs)
- DevOps: Full access
- QA: No direct access (monitoring only)
- Stakeholders: Dashboard access

## Environment Variables Reference

### General Configuration

#### NODE_ENV

**Description**: Node.js environment mode

**Values:**

- `development` - Local development
- `staging` - Staging environment
- `production` - Production environment

**Required**: Yes (all environments)

**Example:**

```env
NODE_ENV=production
```

**Usage:**

```typescript
if (process.env.NODE_ENV === 'production') {
  // Production-only code
}
```

#### HOSPEDA_API_URL

**Description**: Backend API server URL

**Format**: URL with protocol and port (if needed)

**Required**: Yes (all environments)

**Examples:**

```env
# Development
HOSPEDA_API_URL=http://localhost:3001

# Staging
HOSPEDA_API_URL=https://api-staging.hospeda.com

# Production
HOSPEDA_API_URL=https://api.hospeda.com
```

#### HOSPEDA_SITE_URL

**Description**: Public website URL (Web app)

**Format**: URL with protocol

**Required**: Yes (all environments)

**Examples:**

```env
# Development
HOSPEDA_SITE_URL=http://localhost:4321

# Staging
HOSPEDA_SITE_URL=https://staging.hospeda.com

# Production
HOSPEDA_SITE_URL=https://hospeda.com
```

#### HOSPEDA_ADMIN_URL

**Description**: Admin dashboard URL

**Format**: URL with protocol

**Required**: Yes (admin app)

**Examples:**

```env
# Development
HOSPEDA_ADMIN_URL=http://localhost:3000

# Staging
HOSPEDA_ADMIN_URL=https://admin-staging.hospeda.com

# Production
HOSPEDA_ADMIN_URL=https://admin.hospeda.com
```

### Authentication (Better Auth)

#### HOSPEDA_BETTER_AUTH_URL

**Description**: Better Auth publishable key (client-side)

**Format**: `pk_test_*` or `pk_live_*`

**Required**: Yes (all environments)

**Security**: Public (safe to expose in client code)

**Example:**

```env
HOSPEDA_BETTER_AUTH_URL=YOUR_TEST_PUBLISHABLE_HERE
```

**Usage:**

```typescript
import { Better AuthProvider } from '@repo/auth-ui';

<Better AuthProvider publishableKey={import.meta.env.HOSPEDA_BETTER_AUTH_URL}>
  {/* App */}
</Better AuthProvider>
```

#### HOSPEDA_BETTER_AUTH_SECRET

**Description**: Better Auth secret key (server-side)

**Format**: `sk_test_*` or `sk_live_*`

**Required**: Yes (API)

**Security**: Secret (never expose in client code)

**Example:**

```env
HOSPEDA_BETTER_AUTH_SECRET=YOUR_TEST_SECRET_HERE
```

**Usage:**

```typescript
import { authClient } from '@repo/auth-ui';

const client = authClient({
  secretKey: process.env.HOSPEDA_BETTER_AUTH_SECRET,
});
```

#### HOSPEDA_BETTER_AUTH_WEBHOOK_SECRET

**Description**: Better Auth webhook signing secret

**Format**: `whsec_*`

**Required**: Yes (API for webhooks)

**Security**: Secret

**Example:**

```env
HOSPEDA_BETTER_AUTH_WEBHOOK_SECRET=whsec_example789ghi
```

**Usage:**

```typescript
import { Webhook } from 'svix';

const webhook = new Webhook(process.env.HOSPEDA_BETTER_AUTH_WEBHOOK_SECRET);
webhook.verify(payload, headers);
```

### Database (Neon PostgreSQL)

#### HOSPEDA_DATABASE_URL

**Description**: PostgreSQL connection string

**Format**: `postgresql://[user]:[password]@[host]:[port]/[database]?[options]`

**Required**: Yes (API, database operations)

**Security**: Secret (contains credentials)

**Example:**

```env
HOSPEDA_DATABASE_URL=postgresql://user:password@ep-example.us-east-2.aws.neon.tech/hospeda?sslmode=require
```

**Usage:**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.HOSPEDA_DATABASE_URL);
export const db = drizzle(client);
```

**Notes:**

- Use separate databases for each environment
- Include `?sslmode=require` for secure connections
- Neon provides connection pooling by default (`?pooled=true`)

### API Configuration

#### HOSPEDA_API_LOG_LEVEL

**Description**: Logging verbosity level

**Values:**

- `error` - Only errors
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Detailed debug information

**Required**: No (defaults to `info`)

**Example:**

```env
# Development
HOSPEDA_API_LOG_LEVEL=debug

# Production
HOSPEDA_API_LOG_LEVEL=info
```

#### HOSPEDA_API_CORS_ORIGINS

**Description**: Allowed CORS origins (comma-separated)

**Format**: Comma-separated URLs

**Required**: Yes (API)

**Example:**

```env
HOSPEDA_API_CORS_ORIGINS=https://hospeda.com,https://admin.hospeda.com
```

**Usage:**

```typescript
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: process.env.HOSPEDA_API_CORS_ORIGINS.split(','),
  credentials: true,
}));
```

#### HOSPEDA_API_CACHE_TTL

**Description**: Default cache TTL in seconds

**Format**: Number (seconds)

**Required**: No (defaults to `300` - 5 minutes)

**Example:**

```env
HOSPEDA_API_CACHE_TTL=300
```

#### HOSPEDA_API_COMPRESSION_ENABLED

**Description**: Enable response compression

**Values**: `true` or `false`

**Required**: No (defaults to `true`)

**Example:**

```env
HOSPEDA_API_COMPRESSION_ENABLED=true
```

#### HOSPEDA_API_RATE_LIMIT_MAX

**Description**: Maximum requests per window

**Format**: Number

**Required**: No (defaults to `100`)

**Example:**

```env
# Development (relaxed)
HOSPEDA_API_RATE_LIMIT_MAX=1000

# Production (strict)
HOSPEDA_API_RATE_LIMIT_MAX=100
```

#### HOSPEDA_API_RATE_LIMIT_WINDOW

**Description**: Rate limit window in milliseconds

**Format**: Number (milliseconds)

**Required**: No (defaults to `60000` - 1 minute)

**Example:**

```env
HOSPEDA_API_RATE_LIMIT_WINDOW=60000
```

#### HOSPEDA_API_SECURITY_HEADERS_ENABLED

**Description**: Enable security headers

**Values**: `true` or `false`

**Required**: No (defaults to `true`)

**Example:**

```env
HOSPEDA_API_SECURITY_HEADERS_ENABLED=true
```

#### HOSPEDA_API_VALIDATION_ENABLED

**Description**: Enable request validation

**Values**: `true` or `false`

**Required**: No (defaults to `true`)

**Example:**

```env
HOSPEDA_API_VALIDATION_ENABLED=true
```

#### HOSPEDA_API_METRICS_ENABLED

**Description**: Enable metrics collection

**Values**: `true` or `false`

**Required**: No (defaults to `true`)

**Example:**

```env
HOSPEDA_API_METRICS_ENABLED=true
```

### Optional Services

#### HOSPEDA_REDIS_URL

**Description**: Redis connection URL (for caching)

**Format**: `redis://[user]:[password]@[host]:[port]`

**Required**: No (optional caching layer)

**Security**: Secret (contains credentials)

**Example:**

```env
HOSPEDA_REDIS_URL=redis://default:password@redis.example.com:6379
```

**Usage:**

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.HOSPEDA_REDIS_URL);
```

#### LINEAR_API_KEY

**Description**: Linear API key for project management integration

**Format**: `lin_api_*`

**Required**: No (optional)

**Security**: Secret

**Example:**

```env
LINEAR_API_KEY=lin_api_example123
```

#### REPLICATE_API_TOKEN

**Description**: Replicate AI API token

**Format**: `r8_*`

**Required**: No (optional AI features)

**Security**: Secret

**Example:**

```env
REPLICATE_API_TOKEN=r8_example456
```

### Payment Integration (Mercado Pago)

#### MERCADO_PAGO_ACCESS_TOKEN

**Description**: Mercado Pago access token

**Format**: Varies by environment

**Required**: Yes (payment processing)

**Security**: Secret

**Example:**

```env
# Test/Staging
MERCADO_PAGO_ACCESS_TOKEN=TEST-123456789-example

# Production
MERCADO_PAGO_ACCESS_TOKEN=APP-123456789-example
```

#### MERCADO_PAGO_PUBLIC_KEY

**Description**: Mercado Pago public key (client-side)

**Format**: Varies by environment

**Required**: Yes (client-side payment forms)

**Security**: Public

**Example:**

```env
MERCADO_PAGO_PUBLIC_KEY=APP-123456789-example-public
```

### Image Storage (Cloudinary)

#### CLOUDINARY_CLOUD_NAME

**Description**: Cloudinary cloud name

**Format**: String

**Required**: Yes (image uploads)

**Security**: Public

**Example:**

```env
CLOUDINARY_CLOUD_NAME=hospeda-cloud
```

#### CLOUDINARY_API_KEY

**Description**: Cloudinary API key

**Format**: String

**Required**: Yes (server-side uploads)

**Security**: Secret

**Example:**

```env
CLOUDINARY_API_KEY=123456789012345
```

#### CLOUDINARY_API_SECRET

**Description**: Cloudinary API secret

**Format**: String

**Required**: Yes (server-side uploads)

**Security**: Secret

**Example:**

```env
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz
```

### Error Tracking (Sentry)

#### SENTRY_DSN

**Description**: Sentry Data Source Name

**Format**: URL

**Required**: No (recommended for production)

**Security**: Public (no sensitive data)

**Example:**

```env
SENTRY_DSN=https://example123@o123456.ingest.sentry.io/123456
```

#### SENTRY_ENVIRONMENT

**Description**: Sentry environment name

**Values**: `development`, `staging`, `production`

**Required**: No

**Example:**

```env
SENTRY_ENVIRONMENT=production
```

## Configuration by Environment

### Development Environment

**File**: `.env.local` (gitignored)

```env
# General
NODE_ENV=development

# URLs
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4321
HOSPEDA_ADMIN_URL=http://localhost:3000

# Database (local or development)
HOSPEDA_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hospeda_dev

# Better Auth (development application)
HOSPEDA_BETTER_AUTH_URL=pk_test_dev123
HOSPEDA_BETTER_AUTH_SECRET=sk_test_dev456
HOSPEDA_BETTER_AUTH_WEBHOOK_SECRET=whsec_dev789

# API Configuration (relaxed for development)
HOSPEDA_API_LOG_LEVEL=debug
HOSPEDA_API_CORS_ORIGINS=http://localhost:4321,http://localhost:3000
HOSPEDA_API_RATE_LIMIT_MAX=1000
HOSPEDA_API_VALIDATION_ENABLED=true

# Optional Services (can be disabled in development)
# HOSPEDA_REDIS_URL=redis://localhost:6379

# Mercado Pago (test credentials)
MERCADO_PAGO_ACCESS_TOKEN=TEST-123456-example
MERCADO_PAGO_PUBLIC_KEY=TEST-public-key

# Cloudinary (development folder/account)
CLOUDINARY_CLOUD_NAME=hospeda-dev
CLOUDINARY_API_KEY=dev-api-key
CLOUDINARY_API_SECRET=dev-api-secret

# Sentry (optional in development)
# SENTRY_DSN=https://...
# SENTRY_ENVIRONMENT=development
```

### Staging Environment

**Platform**: Vercel (Web/Admin/API)

**Configuration Method**: Platform environment variables

```env
# General
NODE_ENV=staging

# URLs
HOSPEDA_API_URL=https://api-staging.hospeda.com
HOSPEDA_SITE_URL=https://staging.hospeda.com
HOSPEDA_ADMIN_URL=https://admin-staging.hospeda.com

# Database (staging Neon database)
HOSPEDA_DATABASE_URL=postgresql://user:pass@staging-db.neon.tech/hospeda_staging

# Better Auth (staging application)
HOSPEDA_BETTER_AUTH_URL=YOUR_TEST_PUBLISHABLE_HERE
HOSPEDA_BETTER_AUTH_SECRET=YOUR_TEST_SECRET_HERE
HOSPEDA_BETTER_AUTH_WEBHOOK_SECRET=whsec_staging789

# API Configuration
HOSPEDA_API_LOG_LEVEL=info
HOSPEDA_API_CORS_ORIGINS=https://staging.hospeda.com,https://admin-staging.hospeda.com
HOSPEDA_API_CACHE_TTL=300
HOSPEDA_API_COMPRESSION_ENABLED=true
HOSPEDA_API_RATE_LIMIT_MAX=500
HOSPEDA_API_RATE_LIMIT_WINDOW=60000
HOSPEDA_API_SECURITY_HEADERS_ENABLED=true
HOSPEDA_API_VALIDATION_ENABLED=true
HOSPEDA_API_METRICS_ENABLED=true

# Optional Services
HOSPEDA_REDIS_URL=redis://staging-redis.example.com:6379

# Mercado Pago (sandbox credentials)
MERCADO_PAGO_ACCESS_TOKEN=TEST-staging-token
MERCADO_PAGO_PUBLIC_KEY=TEST-staging-public

# Cloudinary (staging folder/account)
CLOUDINARY_CLOUD_NAME=hospeda-staging
CLOUDINARY_API_KEY=staging-api-key
CLOUDINARY_API_SECRET=staging-api-secret

# Sentry
SENTRY_DSN=https://staging-sentry-dsn
SENTRY_ENVIRONMENT=staging
```

### Production Environment

**Platform**: Vercel (Web/Admin/API)

**Configuration Method**: Platform environment variables + Secrets

```env
# General
NODE_ENV=production

# URLs
HOSPEDA_API_URL=https://api.hospeda.com
HOSPEDA_SITE_URL=https://hospeda.com
HOSPEDA_ADMIN_URL=https://admin.hospeda.com

# Database (production Neon database)
HOSPEDA_DATABASE_URL=postgresql://user:pass@prod-db.neon.tech/hospeda_production

# Better Auth (production application)
HOSPEDA_BETTER_AUTH_URL=pk_live_prod123
HOSPEDA_BETTER_AUTH_SECRET=sk_live_prod456
HOSPEDA_BETTER_AUTH_WEBHOOK_SECRET=whsec_prod789

# API Configuration (strict security)
HOSPEDA_API_LOG_LEVEL=info
HOSPEDA_API_CORS_ORIGINS=https://hospeda.com,https://admin.hospeda.com
HOSPEDA_API_CACHE_TTL=300
HOSPEDA_API_COMPRESSION_ENABLED=true
HOSPEDA_API_RATE_LIMIT_MAX=100
HOSPEDA_API_RATE_LIMIT_WINDOW=60000
HOSPEDA_API_SECURITY_HEADERS_ENABLED=true
HOSPEDA_API_VALIDATION_ENABLED=true
HOSPEDA_API_METRICS_ENABLED=true

# Optional Services
HOSPEDA_REDIS_URL=redis://prod-redis.example.com:6379

# Mercado Pago (production credentials)
MERCADO_PAGO_ACCESS_TOKEN=APP-production-token
MERCADO_PAGO_PUBLIC_KEY=APP-production-public

# Cloudinary (production account)
CLOUDINARY_CLOUD_NAME=hospeda-prod
CLOUDINARY_API_KEY=prod-api-key
CLOUDINARY_API_SECRET=prod-api-secret

# Sentry
SENTRY_DSN=https://prod-sentry-dsn
SENTRY_ENVIRONMENT=production
```

## Secret Management

### Development Secrets

**Storage**: `.env.local` file (gitignored)

**Process:**

1. Copy `.env.example` to `.env.local`
2. Fill in development values
3. Never commit `.env.local` to git

**Example:**

```bash
cp .env.example .env.local
nano .env.local  # Edit with your values
```

### Staging Secrets

**Storage**: Platform environment variables

#### Staging Secrets Vercel (Web/Admin)

```bash
# Set environment variable for staging
vercel env add HOSPEDA_DATABASE_URL staging

# Or via Vercel dashboard:
# Project Settings → Environment Variables → Add
```

#### Project Settings Vercel (API)

```bash
# Set secret for API (staging environment)
vercel env add HOSPEDA_DATABASE_URL preview

# List environment variables
vercel env ls
```

### Production Secrets

**Storage**: Platform environment variables (encrypted)

#### Production Secrets Vercel (Web/Admin/API)

```bash
# Set production environment variable
vercel env add HOSPEDA_DATABASE_URL production

# Use Vercel dashboard for sensitive values
# Project Settings → Environment Variables → Add
```

### Secret Rotation

**Schedule**: Rotate secrets every 90 days (production)

**Process:**

1. Generate new secret/credentials
2. Update in platform secret storage
3. Deploy applications
4. Verify functionality
5. Revoke old secret/credentials

**Critical Secrets (rotate immediately if compromised):**

- Database credentials
- Better Auth secret keys
- Mercado Pago tokens
- Cloudinary API secrets

## Configuration Validation

### Runtime Validation

**Purpose**: Ensure all required environment variables are present and valid

**Implementation** (`packages/config/src/env.ts`):

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // General
  NODE_ENV: z.enum(['development', 'staging', 'production']),

  // URLs
  HOSPEDA_API_URL: z.string().url(),
  HOSPEDA_SITE_URL: z.string().url(),
  HOSPEDA_ADMIN_URL: z.string().url().optional(),

  // Database
  HOSPEDA_DATABASE_URL: z.string().startsWith('postgresql://'),

  // Better Auth
  HOSPEDA_BETTER_AUTH_URL: z.string().startsWith('pk_'),
  HOSPEDA_BETTER_AUTH_SECRET: z.string().startsWith('sk_'),
  HOSPEDA_BETTER_AUTH_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  // API Configuration
  HOSPEDA_API_LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  HOSPEDA_API_CORS_ORIGINS: z.string(),
  HOSPEDA_API_CACHE_TTL: z.coerce.number().default(300),
  HOSPEDA_API_COMPRESSION_ENABLED: z.coerce.boolean().default(true),
  HOSPEDA_API_RATE_LIMIT_MAX: z.coerce.number().default(100),
  HOSPEDA_API_RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
  HOSPEDA_API_SECURITY_HEADERS_ENABLED: z.coerce.boolean().default(true),
  HOSPEDA_API_VALIDATION_ENABLED: z.coerce.boolean().default(true),
  HOSPEDA_API_METRICS_ENABLED: z.coerce.boolean().default(true),

  // Optional Services
  HOSPEDA_REDIS_URL: z.string().startsWith('redis://').optional(),
  LINEAR_API_KEY: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),

  // Mercado Pago
  MERCADO_PAGO_ACCESS_TOKEN: z.string(),
  MERCADO_PAGO_PUBLIC_KEY: z.string(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Environment validation failed:');
    console.error(error);
    process.exit(1);
  }
}

// Validate on import
export const env = validateEnv();
```

**Usage:**

```typescript
import { env } from '@repo/config';

// Type-safe access to environment variables
const dbUrl = env.HOSPEDA_DATABASE_URL;
const logLevel = env.HOSPEDA_API_LOG_LEVEL;
```

### Startup Validation

**API Server** (`apps/api/src/index.ts`):

```typescript
import { env } from '@repo/config';

// Environment is validated on import
console.log('✅ Environment validated successfully');
console.log(`📊 Running in ${env.NODE_ENV} mode`);

// Start server
app.listen(3001);
```

## Best Practices

### Security

1. **Never Commit Secrets**
   - Use `.gitignore` for `.env.local`
   - Use `.env.example` as template (no actual values)
   - Use platform secret storage for staging/production

1. **Principle of Least Privilege**
   - Grant minimum necessary permissions
   - Use separate credentials per environment
   - Rotate secrets regularly

1. **Audit Secret Access**
   - Log secret changes
   - Monitor unauthorized access
   - Review access permissions regularly

### Organization

1. **Naming Convention**
   - Prefix all variables with `HOSPEDA_`
   - Use consistent naming (SCREAMING_SNAKE_CASE)
   - Group by category (API, AUTH, DATABASE, etc.)

1. **Documentation**
   - Document all variables in `.env.example`
   - Include format and example values
   - Note which variables are required vs optional

1. **Validation**
   - Validate all environment variables at startup
   - Use Zod schemas for type safety
   - Fail fast on missing/invalid variables

### Development

1. **Local Development**
   - Use `.env.local` for overrides
   - Never use production credentials locally
   - Use mock services when possible

1. **Environment Parity**
   - Keep staging as close to production as possible
   - Use same configuration structure across environments
   - Test with production-like data in staging

1. **Hot Reload**
   - Restart development server after changing `.env.local`
   - Use `dotenv-cli` for environment variable injection
   - Validate changes before committing

### Deployment

1. **Pre-Deployment**
   - Verify all required variables are set
   - Check for deprecated variables
   - Validate variable formats

1. **Post-Deployment**
   - Verify application starts successfully
   - Check logs for configuration warnings
   - Test external service connections

1. **Rollback Plan**
   - Keep previous variable values documented
   - Have rollback procedure for credential changes
   - Test rollback in staging first

---

**Document Version**: 1.0.0
**Last Updated**: 2024-01-15
**Maintained By**: DevOps Team
**Next Review**: 2024-02-15
