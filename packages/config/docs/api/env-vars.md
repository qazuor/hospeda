# Environment Variables Reference

Complete list of all environment variables used in the Hospeda platform.

## Table of Contents

- [API Configuration](#api-configuration)
- [Database Configuration](#database-configuration)
- [Logger Configuration](#logger-configuration)
- [Authentication (Clerk)](#authentication-clerk)
- [Payments (Mercado Pago)](#payments-mercado-pago)
- [Services](#services)
  - [Exchange Rate APIs](#exchange-rate-apis)
- [Feature Flags](#feature-flags)
- [Development](#development)

---

## API Configuration

Configuration for the Hono API server.

### `VITE_API_PORT`

Port number for the API server.

| Property | Value |
|----------|-------|
| **Type** | `number` |
| **Required** | No |
| **Default** | `3000` |
| **Valid Range** | 1-65535 |
| **Used In** | `apps/api` |

**Example:**

```bash
VITE_API_PORT=3000
```

**Usage:**

```typescript
import { mainConfig } from '@repo/config';

const config = mainConfig();
console.log(config.VITE_API_PORT); // 3000
```

---

### `VITE_API_HOST`

Host URL for the API server.

| Property | Value |
|----------|-------|
| **Type** | `string` (URL) |
| **Required** | No |
| **Default** | `http://localhost` |
| **Format** | Valid URL with protocol |
| **Used In** | `apps/api`, `apps/web`, `apps/admin` |

**Example:**

```bash
# Development
VITE_API_HOST=http://localhost

# Production
VITE_API_HOST=https://api.hospeda.com
```

**Usage:**

```typescript
import { mainConfig } from '@repo/config';

const config = mainConfig();
const apiUrl = `${config.VITE_API_HOST}:${config.VITE_API_PORT}`;
```

---

### `API_CORS_ALLOWED_ORIGINS`

Comma-separated list of allowed CORS origins.

| Property | Value |
|----------|-------|
| **Type** | `string` (comma-separated URLs) |
| **Required** | No |
| **Default** | `http://localhost:4321` |
| **Format** | `origin1,origin2,origin3` |
| **Used In** | `apps/api` |

**Example:**

```bash
# Development
API_CORS_ALLOWED_ORIGINS=http://localhost:4321,http://localhost:4322

# Production
API_CORS_ALLOWED_ORIGINS=https://hospeda.com,https://admin.hospeda.com
```

**Usage:**

```typescript
import { mainConfig } from '@repo/config';

const config = mainConfig();
const origins = config.API_CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim());

app.use(
  cors({
    origin: origins,
  })
);
```

---

## Database Configuration

PostgreSQL database connection and pooling configuration.

### `DATABASE_URL`

PostgreSQL connection string.

| Property | Value |
|----------|-------|
| **Type** | `string` (URL) |
| **Required** | **Yes** |
| **Default** | None |
| **Format** | `postgresql://user:password@host:port/database` |
| **Used In** | `apps/api`, `packages/db` |

**Example:**

```bash
# Local development
DATABASE_URL=postgresql://postgres:password@localhost:5432/hospeda_dev

# Production (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/hospeda?sslmode=require
```

**Security:**

- ⚠️ **Never commit this value**
- Keep in `.env.local` or secure environment
- Use SSL in production (`?sslmode=require`)

**Usage:**

```typescript
import { dbConfig } from '@repo/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const config = dbConfig();
const client = postgres(config.DATABASE_URL);
const db = drizzle(client);
```

---

### `DB_POOL_MIN`

Minimum number of database connections in the pool.

| Property | Value |
|----------|-------|
| **Type** | `number` |
| **Required** | No |
| **Default** | `2` |
| **Valid Range** | 1-100 |
| **Used In** | `packages/db` |

**Example:**

```bash
DB_POOL_MIN=2
```

---

### `DB_POOL_MAX`

Maximum number of database connections in the pool.

| Property | Value |
|----------|-------|
| **Type** | `number` |
| **Required** | No |
| **Default** | `10` |
| **Valid Range** | 1-100 |
| **Used In** | `packages/db` |

**Example:**

```bash
# Development
DB_POOL_MAX=10

# Production
DB_POOL_MAX=20
```

**Usage:**

```typescript
import { dbConfig } from '@repo/config';
import postgres from 'postgres';

const config = dbConfig();
const client = postgres(config.DATABASE_URL, {
  max: config.DB_POOL_MAX,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});
```

---

## Logger Configuration

Logging configuration for the platform.

### `LOG_LEVEL`

Logging level.

| Property | Value |
|----------|-------|
| **Type** | `enum` |
| **Required** | No |
| **Default** | `info` |
| **Valid Values** | `debug`, `info`, `warn`, `error` |
| **Used In** | All apps and packages |

**Example:**

```bash
# Development
LOG_LEVEL=debug

# Production
LOG_LEVEL=info
```

**Usage:**

```typescript
import { getLogLevel } from '@repo/config';

const level = getLogLevel();
logger.level = level;
```

---

### `LOG_FORMAT`

Log output format.

| Property | Value |
|----------|-------|
| **Type** | `enum` |
| **Required** | No |
| **Default** | `json` |
| **Valid Values** | `json`, `pretty` |
| **Used In** | All apps and packages |

**Example:**

```bash
# Development (human-readable)
LOG_FORMAT=pretty

# Production (machine-readable)
LOG_FORMAT=json
```

---

### `LOG_ENABLED`

Enable or disable logging.

| Property | Value |
|----------|-------|
| **Type** | `boolean` |
| **Required** | No |
| **Default** | `true` |
| **Valid Values** | `true`, `false`, `1`, `0`, `yes`, `no` |
| **Used In** | All apps and packages |

**Example:**

```bash
# Enable logging
LOG_ENABLED=true

# Disable for tests
LOG_ENABLED=false
```

---

## Authentication (Clerk)

Clerk authentication integration.

### `CLERK_SECRET_KEY`

Clerk API secret key for backend authentication.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | **Yes** |
| **Default** | None |
| **Format** | `sk_test_...` or `sk_live_...` |
| **Used In** | `apps/api` |

**Example:**

```bash
# Development
CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE

# Production
CLERK_SECRET_KEY=YOUR_SECRET_KEY_HERE
```

**Security:**

- ⚠️ **Never commit or expose**
- Backend only (never in frontend)
- Rotate regularly

---

### `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

Clerk publishable key for frontend authentication.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | **Yes** |
| **Default** | None |
| **Format** | `pk_test_...` or `pk_live_...` |
| **Used In** | `apps/web`, `apps/admin` |

**Example:**

```bash
# Development
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_HERE

# Production
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY_HERE
```

**Note:** Safe to expose in frontend (public key).

---

## Payments (Mercado Pago)

Mercado Pago payment integration.

### `MERCADOPAGO_ACCESS_TOKEN`

Mercado Pago access token for backend API calls.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | **Yes** |
| **Default** | None |
| **Format** | `APP_USR-...` or `TEST-...` |
| **Used In** | `apps/api`, `packages/payments` |

**Example:**

```bash
# Test mode
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxx

# Production
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxx
```

**Security:**

- ⚠️ **Never commit or expose**
- Backend only
- Use test token in development

---

### `MERCADOPAGO_PUBLIC_KEY`

Mercado Pago public key for frontend integration.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | **Yes** |
| **Default** | None |
| **Format** | `APP_USR-...` or `TEST-...` |
| **Used In** | `apps/web` |

**Example:**

```bash
# Test mode
MERCADOPAGO_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxx

# Production
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxxxxxxxxxxxxxxx
```

**Note:** Safe to expose in frontend (public key).

---

## Services

External service integrations.

### Exchange Rate APIs

Configuration for exchange rate data providers.

#### `HOSPEDA_EXCHANGE_RATE_API_KEY`

ExchangeRate-API key for global currency exchange rates.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | No |
| **Default** | None |
| **Format** | API key string |
| **Used In** | `apps/api` |

**Example:**

```bash
# Optional for development (free tier works without key)
HOSPEDA_EXCHANGE_RATE_API_KEY=

# Production with API key
HOSPEDA_EXCHANGE_RATE_API_KEY=your_api_key_here
```

**Notes:**

- Optional for development (free tier available)
- Recommended for production to avoid rate limits
- Get your key at [https://www.exchangerate-api.com](https://www.exchangerate-api.com)

**Usage:**

```typescript
import { parseExchangeRateSchema } from '@repo/config';

const config = parseExchangeRateSchema(process.env);
const apiKey = config.HOSPEDA_EXCHANGE_RATE_API_KEY;
```

---

#### `HOSPEDA_DOLAR_API_BASE_URL`

Base URL for DolarApi.com (Argentine peso exchange rates).

| Property | Value |
|----------|-------|
| **Type** | `string` (URL) |
| **Required** | No |
| **Default** | `https://dolarapi.com/v1` |
| **Format** | Valid URL |
| **Used In** | `apps/api` |

**Example:**

```bash
# Use default
HOSPEDA_DOLAR_API_BASE_URL=https://dolarapi.com/v1

# Custom endpoint
HOSPEDA_DOLAR_API_BASE_URL=https://custom-dolar-api.example.com
```

**Notes:**

- Provides Argentine peso (ARS) exchange rates
- Free API, no key required
- Default value works for most cases

**Usage:**

```typescript
import { parseExchangeRateSchema } from '@repo/config';

const config = parseExchangeRateSchema(process.env);
const baseUrl = config.HOSPEDA_DOLAR_API_BASE_URL;
const endpoint = `${baseUrl}/dolares`;
```

---

#### `HOSPEDA_EXCHANGE_RATE_API_BASE_URL`

Base URL for ExchangeRate-API (global exchange rates).

| Property | Value |
|----------|-------|
| **Type** | `string` (URL) |
| **Required** | No |
| **Default** | `https://v6.exchangerate-api.com/v6` |
| **Format** | Valid URL |
| **Used In** | `apps/api` |

**Example:**

```bash
# Use default
HOSPEDA_EXCHANGE_RATE_API_BASE_URL=https://v6.exchangerate-api.com/v6

# Custom endpoint
HOSPEDA_EXCHANGE_RATE_API_BASE_URL=https://api.example.com/v1
```

**Notes:**

- Provides global currency exchange rates
- Works with or without API key
- Default value works for most cases

**Usage:**

```typescript
import { parseExchangeRateSchema } from '@repo/config';

const config = parseExchangeRateSchema(process.env);
const apiKey = config.HOSPEDA_EXCHANGE_RATE_API_KEY || '';
const baseUrl = config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL;
const endpoint = `${baseUrl}/${apiKey}/latest/USD`;
```

---

### `CLOUDINARY_CLOUD_NAME`

Cloudinary cloud name for image storage.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | **Yes** |
| **Default** | None |
| **Format** | Alphanumeric string |
| **Used In** | `apps/api`, `apps/web`, `apps/admin` |

**Example:**

```bash
CLOUDINARY_CLOUD_NAME=hospeda-images
```

---

### `CLOUDINARY_API_KEY`

Cloudinary API key for backend uploads.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | **Yes** |
| **Default** | None |
| **Format** | Numeric string |
| **Used In** | `apps/api` |

**Example:**

```bash
CLOUDINARY_API_KEY=123456789012345
```

**Security:**

- ⚠️ **Never commit or expose**
- Backend only

---

### `CLOUDINARY_API_SECRET`

Cloudinary API secret for backend authentication.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | **Yes** |
| **Default** | None |
| **Format** | Alphanumeric string |
| **Used In** | `apps/api` |

**Example:**

```bash
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

**Security:**

- ⚠️ **Never commit or expose**
- Backend only
- Rotate regularly

---

## Feature Flags

Feature toggles for gradual rollout and testing.

### `FEATURE_EMAIL_ENABLED`

Enable email notifications.

| Property | Value |
|----------|-------|
| **Type** | `boolean` |
| **Required** | No |
| **Default** | `false` |
| **Used In** | `apps/api` |

**Example:**

```bash
FEATURE_EMAIL_ENABLED=true
```

---

### `FEATURE_PAYMENTS_ENABLED`

Enable payment processing.

| Property | Value |
|----------|-------|
| **Type** | `boolean` |
| **Required** | No |
| **Default** | `true` |
| **Used In** | `apps/api`, `apps/web` |

**Example:**

```bash
# Disable payments in development
FEATURE_PAYMENTS_ENABLED=false
```

---

### `FEATURE_ANALYTICS_ENABLED`

Enable analytics tracking.

| Property | Value |
|----------|-------|
| **Type** | `boolean` |
| **Required** | No |
| **Default** | `false` |
| **Used In** | `apps/web`, `apps/admin` |

**Example:**

```bash
# Enable in production only
FEATURE_ANALYTICS_ENABLED=true
```

---

## Development

Development-specific configuration.

### `NODE_ENV`

Node.js environment.

| Property | Value |
|----------|-------|
| **Type** | `enum` |
| **Required** | No |
| **Default** | `development` |
| **Valid Values** | `development`, `test`, `staging`, `production` |
| **Used In** | All apps and packages |

**Example:**

```bash
# Development
NODE_ENV=development

# Production
NODE_ENV=production
```

---

### `DEBUG`

Enable debug mode.

| Property | Value |
|----------|-------|
| **Type** | `boolean` |
| **Required** | No |
| **Default** | `false` |
| **Used In** | All apps and packages |

**Example:**

```bash
DEBUG=true
```

---

## Environment File Examples

### `.env.local` (Development)

```bash
# API
VITE_API_PORT=3000
VITE_API_HOST=http://localhost
API_CORS_ALLOWED_ORIGINS=http://localhost:4321,http://localhost:4322

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/hospeda_dev
DB_POOL_MIN=2
DB_POOL_MAX=10

# Logger
LOG_LEVEL=debug
LOG_FORMAT=pretty
LOG_ENABLED=true

# Clerk
CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_HERE

# Mercado Pago (Test Mode)
MERCADOPAGO_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxx
MERCADOPAGO_PUBLIC_KEY=TEST-xxxxxxxxxxxxxxxxxxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=hospeda-dev
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxxx

# Exchange Rate APIs
HOSPEDA_EXCHANGE_RATE_API_KEY=
HOSPEDA_DOLAR_API_BASE_URL=https://dolarapi.com/v1
HOSPEDA_EXCHANGE_RATE_API_BASE_URL=https://v6.exchangerate-api.com/v6

# Feature Flags
FEATURE_EMAIL_ENABLED=false
FEATURE_PAYMENTS_ENABLED=false
FEATURE_ANALYTICS_ENABLED=false

# Development
NODE_ENV=development
DEBUG=true
```

### `.env.production` (Production)

```bash
# API
VITE_API_PORT=443
VITE_API_HOST=https://api.hospeda.com
API_CORS_ALLOWED_ORIGINS=https://hospeda.com,https://admin.hospeda.com

# Database (Neon)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/hospeda?sslmode=require
DB_POOL_MIN=5
DB_POOL_MAX=20

# Logger
LOG_LEVEL=info
LOG_FORMAT=json
LOG_ENABLED=true

# Clerk
CLERK_SECRET_KEY=YOUR_SECRET_KEY_HERE
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY_HERE

# Mercado Pago (Production)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxxxxxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxxxxxxxxxxxxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=hospeda-prod
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxxx

# Exchange Rate APIs
HOSPEDA_EXCHANGE_RATE_API_KEY=your_api_key_here
HOSPEDA_DOLAR_API_BASE_URL=https://dolarapi.com/v1
HOSPEDA_EXCHANGE_RATE_API_BASE_URL=https://v6.exchangerate-api.com/v6

# Feature Flags
FEATURE_EMAIL_ENABLED=true
FEATURE_PAYMENTS_ENABLED=true
FEATURE_ANALYTICS_ENABLED=true

# Production
NODE_ENV=production
DEBUG=false
```

---

## Security Best Practices

### Never Commit Secrets

Add to `.gitignore`:

```gitignore
.env
.env.local
.env.*.local
```

### Use Different Keys Per Environment

- **Development**: Test/sandbox keys
- **Production**: Live keys
- **Staging**: Separate test keys

### Rotate Secrets Regularly

- API keys: Every 90 days
- Database passwords: Every 180 days
- Access tokens: Per service policy

### Use Secret Management

- **Development**: `.env.local` files
- **Production**: Platform secrets (Vercel, AWS Secrets Manager)
- **CI/CD**: GitHub Secrets

---

## Related Documentation

- **[Config Reference](./config-reference.md)** - API documentation
- **[Security Guide](../guides/security.md)** - Security best practices
- **[Environments Guide](../guides/environments.md)** - Managing environments
