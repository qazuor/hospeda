# Environment Variables Reference

Complete reference for all environment variables used across the Hospeda monorepo. Organized by application and category.

**Last Updated**: 2026-02-28

---

## Table of Contents

1. [API App (apps/api)](#api-app-appsapi)
2. [Web App (apps/web)](#web-app-appsweb)
3. [Admin App (apps/admin)](#admin-app-appsadmin)
4. [Where to Configure](#where-to-configure)
5. [GitHub Actions](#github-actions)

---

## API App (`apps/api`)

Source: `apps/api/.env.example`

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode: `development`, `staging`, `production` |
| `API_PORT` | No | `3001` | HTTP port for the API server |
| `API_HOST` | No | `localhost` | Host to bind the server |

### Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOSPEDA_DATABASE_URL` | **Yes** | - | PostgreSQL connection string (`postgresql://user:pass@host:port/db`) |
| `DB_POOL_MAX_CONNECTIONS` | No | `10` | Maximum database pool connections |
| `DB_POOL_IDLE_TIMEOUT_MS` | No | `30000` | Idle connection timeout (ms) |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | No | `2000` | Connection acquisition timeout (ms) |

### Authentication (Better Auth)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOSPEDA_BETTER_AUTH_SECRET` | **Yes** | - | JWT secret (min 32 chars) |
| `HOSPEDA_BETTER_AUTH_URL` | Yes (prod) | - | Better Auth base URL (e.g., `https://api.hospeda.com/api/auth`) |

### Trusted Origins / URLs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOSPEDA_API_URL` | Yes | `http://localhost:3001` | Public API URL |
| `HOSPEDA_SITE_URL` | Yes | `http://localhost:4321` | Public website URL |
| `HOSPEDA_ADMIN_URL` | Yes | `http://localhost:3000` | Admin dashboard URL |

### Social OAuth (optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOSPEDA_GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID |
| `HOSPEDA_GOOGLE_CLIENT_SECRET` | No | - | Google OAuth client secret |
| `HOSPEDA_FACEBOOK_CLIENT_ID` | No | - | Facebook OAuth client ID |
| `HOSPEDA_FACEBOOK_CLIENT_SECRET` | No | - | Facebook OAuth client secret |

### CORS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_CORS_ORIGINS` | Yes | `http://localhost:3000,http://localhost:4321` | Comma-separated allowed origins |
| `API_CORS_ALLOW_CREDENTIALS` | No | `true` | Allow credentials in CORS |
| `API_CORS_MAX_AGE` | No | `86400` | CORS preflight cache (seconds) |
| `API_CORS_ALLOW_METHODS` | No | `GET,POST,PUT,DELETE,PATCH,OPTIONS` | Allowed HTTP methods |
| `API_CORS_ALLOW_HEADERS` | No | `Content-Type,Authorization,...` | Allowed request headers |
| `API_CORS_EXPOSE_HEADERS` | No | `Content-Length,X-Request-ID` | Exposed response headers |

### Rate Limiting (Global)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_RATE_LIMIT_ENABLED` | No | `true` | Enable global rate limiting |
| `API_RATE_LIMIT_WINDOW_MS` | No | `900000` | Window duration (15 min) |
| `API_RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |
| `API_RATE_LIMIT_KEY_GENERATOR` | No | `ip` | Rate limit key strategy |
| `API_RATE_LIMIT_TRUST_PROXY` | No | `false` | Trust X-Forwarded-For header |

### Rate Limiting (Auth Endpoints)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_RATE_LIMIT_AUTH_ENABLED` | No | `true` | Enable auth rate limiting |
| `API_RATE_LIMIT_AUTH_WINDOW_MS` | No | `300000` | Window duration (5 min) |
| `API_RATE_LIMIT_AUTH_MAX_REQUESTS` | No | `50` | Max auth requests per window |

### Rate Limiting (Public Endpoints)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_RATE_LIMIT_PUBLIC_ENABLED` | No | `true` | Enable public rate limiting |
| `API_RATE_LIMIT_PUBLIC_WINDOW_MS` | No | `3600000` | Window duration (1 hour) |
| `API_RATE_LIMIT_PUBLIC_MAX_REQUESTS` | No | `1000` | Max public requests per window |

### Rate Limiting (Admin Endpoints)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_RATE_LIMIT_ADMIN_ENABLED` | No | `true` | Enable admin rate limiting |
| `API_RATE_LIMIT_ADMIN_WINDOW_MS` | No | `600000` | Window duration (10 min) |
| `API_RATE_LIMIT_ADMIN_MAX_REQUESTS` | No | `200` | Max admin requests per window |

### Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_SECURITY_ENABLED` | No | `true` | Enable security middleware |
| `API_SECURITY_CSRF_ENABLED` | No | `true` | Enable CSRF protection |
| `API_SECURITY_CSRF_ORIGINS` | No | `http://localhost:3000,...` | CSRF trusted origins |
| `API_SECURITY_HEADERS_ENABLED` | No | `true` | Enable security headers |
| `API_SECURITY_CONTENT_SECURITY_POLICY` | No | (see .env.example) | CSP header value |
| `API_SECURITY_STRICT_TRANSPORT_SECURITY` | No | `max-age=31536000; includeSubDomains` | HSTS header |
| `API_SECURITY_X_FRAME_OPTIONS` | No | `SAMEORIGIN` | X-Frame-Options header |
| `API_SECURITY_X_CONTENT_TYPE_OPTIONS` | No | `nosniff` | X-Content-Type-Options header |
| `API_SECURITY_X_XSS_PROTECTION` | No | `1; mode=block` | XSS protection header |
| `API_SECURITY_REFERRER_POLICY` | No | `strict-origin-when-cross-origin` | Referrer policy |
| `API_SECURITY_PERMISSIONS_POLICY` | No | `camera=(), microphone=(), geolocation=()` | Permissions policy |

### Cache

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_CACHE_ENABLED` | No | `true` | Enable HTTP caching |
| `API_CACHE_DEFAULT_MAX_AGE` | No | `300` | Default max-age (seconds) |
| `API_CACHE_DEFAULT_STALE_WHILE_REVALIDATE` | No | `60` | Stale-while-revalidate (seconds) |
| `API_CACHE_DEFAULT_STALE_IF_ERROR` | No | `86400` | Stale-if-error (seconds) |
| `API_CACHE_ETAG_ENABLED` | No | `true` | Enable ETag headers |
| `API_CACHE_LAST_MODIFIED_ENABLED` | No | `true` | Enable Last-Modified headers |

### Compression

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_COMPRESSION_ENABLED` | No | `true` | Enable response compression |
| `API_COMPRESSION_LEVEL` | No | `6` | Compression level (1-9) |
| `API_COMPRESSION_THRESHOLD` | No | `1024` | Min bytes to compress |
| `API_COMPRESSION_ALGORITHMS` | No | `gzip,deflate` | Compression algorithms |

### Validation

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_VALIDATION_MAX_BODY_SIZE` | No | `10485760` | Max request body (10MB) |
| `API_VALIDATION_MAX_REQUEST_TIME` | No | `30000` | Request timeout (30s) |
| `API_VALIDATION_SANITIZE_ENABLED` | No | `true` | Enable input sanitization |
| `API_VALIDATION_SANITIZE_MAX_STRING_LENGTH` | No | `1000` | Max string length |
| `API_VALIDATION_SANITIZE_REMOVE_HTML_TAGS` | No | `true` | Strip HTML from input |

### Response Format

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_RESPONSE_FORMAT_ENABLED` | No | `true` | Enable response formatting |
| `API_RESPONSE_INCLUDE_TIMESTAMP` | No | `true` | Include timestamp in responses |
| `API_RESPONSE_INCLUDE_VERSION` | No | `true` | Include API version |
| `API_RESPONSE_API_VERSION` | No | `1.0.0` | API version string |
| `API_RESPONSE_INCLUDE_REQUEST_ID` | No | `true` | Include request ID |

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_LOG_LEVEL` | No | `info` | Log level: `error`, `warn`, `info`, `debug` |
| `API_ENABLE_REQUEST_LOGGING` | No | `true` | Log HTTP requests |
| `API_LOG_USE_COLORS` | No | `true` | Colorize log output |
| `API_LOG_SAVE` | No | `false` | Persist logs to file |
| `API_LOG_TRUNCATE_TEXT` | No | `true` | Truncate long log entries |
| `API_LOG_TRUNCATE_AT` | No | `1000` | Truncate after N chars |

### Metrics

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_METRICS_ENABLED` | No | `true` | Enable metrics collection |
| `API_METRICS_SLOW_REQUEST_THRESHOLD_MS` | No | `1000` | Slow request threshold |
| `API_METRICS_SLOW_AUTH_THRESHOLD_MS` | No | `2000` | Slow auth threshold |

### Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOSPEDA_REDIS_URL` | No (recommended for prod) | - | Redis connection URL |

### Cron Jobs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRON_SECRET` | No | - | Secret key to authenticate cron requests |
| `CRON_ADAPTER` | No | `node-cron` | Cron adapter: `node-cron` (local dev) or `vercel` (production) |

### Sentry (Error Tracking)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | No (recommended) | - | Sentry Data Source Name |
| `SENTRY_PROJECT` | No | `hospeda` | Sentry project name |
| `SENTRY_ENVIRONMENT` | No | - | Environment tag (`development`, `staging`, `production`) |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` | Trace sampling rate (0.0 to 1.0) |
| `SENTRY_PROFILES_SAMPLE_RATE` | No | `0.1` | Profile sampling rate |
| `SENTRY_DEBUG` | No | `false` | Enable Sentry debug logging |

### External Integrations

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HOSPEDA_LINEAR_API_KEY` | No | - | Linear API key (bug report integration) |
| `HOSPEDA_LINEAR_TEAM_ID` | No | - | Linear team ID |
| `HOSPEDA_EXCHANGE_RATE_API_KEY` | No | - | Exchange rate API key |

### Test / Debug (non-production only)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISABLE_AUTH` | No | `false` | Disable authentication (dev only) |
| `ALLOW_MOCK_ACTOR` | No | `false` | Allow mock actor headers |
| `TESTING_RATE_LIMIT` | No | `false` | Enable rate limit testing mode |
| `DEBUG_TESTS` | No | `false` | Enable test debug output |
| `COMMIT_SHA` | No | `unknown` | Git commit SHA for tracking |

---

## Web App (`apps/web`)

The Web app (Astro) uses `import.meta.env` for environment access. Variables prefixed with `PUBLIC_` are available client-side.

### Core Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PUBLIC_API_URL` | **Yes** | - | API server URL (client + server accessible) |
| `HOSPEDA_API_URL` | Alt | - | Monorepo alternative for API URL (server-side only) |
| `PUBLIC_SITE_URL` | **Yes** | - | Public site URL |
| `HOSPEDA_SITE_URL` | Alt | - | Monorepo alternative for site URL |
| `NODE_ENV` | No | `development` | Environment mode |

At least one of `HOSPEDA_API_URL` or `PUBLIC_API_URL` must be set. Same for site URL.

### Sentry

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PUBLIC_SENTRY_DSN` | No (recommended) | - | Sentry DSN for the web app |
| `PUBLIC_SENTRY_PROJECT` | No | `hospeda` | Sentry project name |

### Environment Validation

The web app validates environment variables at startup using Zod schemas in `src/env.ts`:

```typescript
// Server-side schema
const serverEnvSchema = z.object({
  HOSPEDA_API_URL: z.string().url().optional(),
  PUBLIC_API_URL: z.string().url().optional(),
  HOSPEDA_SITE_URL: z.string().url().optional(),
  PUBLIC_SITE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
}).refine(
  (data) => data.HOSPEDA_API_URL || data.PUBLIC_API_URL,
  { message: 'Either HOSPEDA_API_URL or PUBLIC_API_URL must be set' }
);

// Client-side schema
const clientEnvSchema = z.object({
  PUBLIC_API_URL: z.string().url(),
  PUBLIC_SITE_URL: z.string().url(),
});
```

---

## Admin App (`apps/admin`)

The Admin app (TanStack Start) uses Vite env vars. Variables prefixed with `VITE_` are available client-side.

### Core Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | **Yes** | - | API server URL |
| `VITE_SITE_URL` | No | - | Public site URL |
| `NODE_ENV` | No | `development` | Environment mode |

### Sentry

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SENTRY_DSN` | No (recommended) | - | Sentry DSN for the admin app |
| `VITE_SENTRY_PROJECT` | No | `hospeda` | Sentry project name |

---

## Where to Configure

### Local Development

All apps: Copy `.env.example` to `.env` (or `.env.local`) in each app directory and fill in values.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin/.env.example apps/admin/.env
```

### Vercel (API, Web, and Admin Production/Staging)

Set via the Vercel dashboard or CLI:

```bash
# Via CLI
vercel env add PUBLIC_API_URL production
vercel env add PUBLIC_SITE_URL production

# Via dashboard
# Project Settings -> Environment Variables -> Add
```

Use environment scoping in Vercel to separate production, preview, and development values.

### GitHub Actions

Set in repository settings under **Settings -> Secrets and variables -> Actions**:

| Secret | Used By |
|--------|---------|
| `VERCEL_TOKEN` | API, Web, and Admin deployments to Vercel |
| `VERCEL_ORG_ID` | Vercel organization identifier |
| `VERCEL_PROJECT_ID_API` | Identifies the Vercel project for the API app |
| `VERCEL_PROJECT_ID_WEB` | Identifies the Vercel project for the web app |
| `VERCEL_PROJECT_ID_ADMIN` | Identifies the Vercel project for the admin app |

---

## Environment Variable Naming Conventions

| Prefix | Scope | Example |
|--------|-------|---------|
| `HOSPEDA_` | Server-side, shared across apps | `HOSPEDA_DATABASE_URL` |
| `API_` | API-specific server config | `API_PORT`, `API_CORS_ORIGINS` |
| `DB_` | Database pool config | `DB_POOL_MAX_CONNECTIONS` |
| `PUBLIC_` | Astro client-side accessible | `PUBLIC_API_URL` |
| `VITE_` | Vite/TanStack client-side accessible | `VITE_SENTRY_DSN` |
| `SENTRY_` | Sentry configuration | `SENTRY_DSN` |

---

## Sentry DSN Quick Reference

From `docs/monitoring/sentry-setup-guide.md`:

| App | Env Var | Sentry Project |
|-----|---------|----------------|
| API | `SENTRY_DSN` | `hospeda-api` |
| Web | `PUBLIC_SENTRY_DSN` | `hospeda-web` |
| Admin | `VITE_SENTRY_DSN` | `hospeda-admin` |

All three projects belong to the `hospeda` team under the `qazuor` Sentry organization (`us.sentry.io`).
