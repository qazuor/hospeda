# 🌍 Environment Variables Reference

This document lists all environment variables used by the Hospeda API, organized by category with current defaults and validation.

## 📊 Server Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | `'development' \| 'production' \| 'test'` | `development` | Node.js environment |
| `API_PORT` | `number` | `3001` | API server port |
| `API_HOST` | `string` | `localhost` | API server host |

## 📝 Logging Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LOG_LEVEL` | `'debug' \| 'info' \| 'warn' \| 'error'` | `info` | Minimum log level |
| `ENABLE_REQUEST_LOGGING` | `boolean` | `true` | Enable HTTP request logging |
| `API_LOG_INCLUDE_TIMESTAMPS` | `boolean` | `true` | Include timestamps in logs |
| `API_LOG_INCLUDE_LEVEL` | `boolean` | `true` | Include log level in output |
| `API_LOG_USE_COLORS` | `boolean` | `true` | Use colors in console output |
| `API_LOG_SAVE` | `boolean` | `false` | Save logs to file |
| `API_LOG_EXPAND_OBJECT_LEVELS` | `boolean` | `false` | Expand nested objects in logs |
| `API_LOG_TRUNCATE_LONG_TEXT` | `boolean` | `true` | Truncate long text in logs |
| `API_LOG_TRUNCATE_LONG_TEXT_AT` | `number` | `1000` | Truncate text at N characters |
| `API_LOG_STRINGIFY_OBJECTS` | `boolean` | `false` | Stringify objects in logs |

## CORS Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `API_CORS_ORIGINS` | `string` | `http://localhost:3000,http://localhost:4321` | Allowed origins (comma-separated) |
| `API_CORS_ALLOW_CREDENTIALS` | `boolean` | `true` | Allow credentials in CORS requests |
| `API_CORS_MAX_AGE` | `number` | `86400` | CORS preflight cache duration (seconds) |
| `API_CORS_ALLOW_METHODS` | `string` | `GET,POST,PUT,DELETE,PATCH,OPTIONS` | Allowed HTTP methods |
| `API_CORS_ALLOW_HEADERS` | `string` | `Content-Type,Authorization,X-Requested-With` | Allowed headers |
| `API_CORS_EXPOSE_HEADERS` | `string` | `Content-Length,X-Request-ID` | Exposed headers |

## 💾 Cache Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CACHE_ENABLED` | `boolean` | `true` | Enable response caching |
| `CACHE_DEFAULT_TTL` | `number` | `300` | Default cache TTL (seconds) |
| `CACHE_MAX_ITEMS` | `number` | `1000` | Maximum cached items |
| `CACHE_CLEANUP_INTERVAL` | `number` | `600` | Cache cleanup interval (seconds) |

## 🗜️ Compression Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `COMPRESSION_ENABLED` | `boolean` | `true` | Enable response compression |
| `COMPRESSION_THRESHOLD` | `number` | `1024` | Minimum size for compression (bytes) |
| `COMPRESSION_LEVEL` | `number` | `6` | Compression level (1-9) |
| `COMPRESSION_CONTENT_TYPES` | `string` | `application/json,text/html,text/css,text/javascript,application/javascript` | Compressible content types |

## 🛡️ Security Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SECURITY_ENABLED` | `boolean` | `true` | Enable security middleware |
| `SECURITY_CSRF_ENABLED` | `boolean` | `true` | Enable CSRF protection |
| `SECURITY_HEADERS_ENABLED` | `boolean` | `true` | Enable security headers |
| `SECURITY_STRICT_TRANSPORT_SECURITY` | `string` | `max-age=31536000; includeSubDomains` | HSTS header value |
| `SECURITY_X_FRAME_OPTIONS` | `string` | `SAMEORIGIN` | X-Frame-Options header |
| `SECURITY_X_CONTENT_TYPE_OPTIONS` | `string` | `nosniff` | X-Content-Type-Options header |
| `SECURITY_X_XSS_PROTECTION` | `string` | `1; mode=block` | X-XSS-Protection header |
| `SECURITY_REFERRER_POLICY` | `string` | `strict-origin-when-cross-origin` | Referrer-Policy header |

## 🚦 Rate Limiting Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RATE_LIMIT_ENABLED` | `boolean` | `true` | Enable rate limiting |
| `RATE_LIMIT_WINDOW_MS` | `number` | `900000` | Rate limit window (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `number` | `100` | Max requests per window |
| `RATE_LIMIT_KEY_GENERATOR` | `string` | `ip` | Key generation strategy |
| `RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS` | `boolean` | `false` | Skip counting successful requests |
| `RATE_LIMIT_SKIP_FAILED_REQUESTS` | `boolean` | `false` | Skip counting failed requests |
| `RATE_LIMIT_STANDARD_HEADERS` | `boolean` | `true` | Include standard rate limit headers |
| `RATE_LIMIT_LEGACY_HEADERS` | `boolean` | `false` | Include legacy rate limit headers |
| `RATE_LIMIT_MESSAGE` | `string` | `Too many requests, please try again later.` | Rate limit error message |

## 📊 Metrics Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `METRICS_ENABLED` | `boolean` | `true` | Enable metrics collection |
| `METRICS_ENDPOINT_ENABLED` | `boolean` | `true` | Enable /metrics endpoint |
| `METRICS_DETAILED_ENABLED` | `boolean` | `true` | Enable detailed metrics |
| `METRICS_MEMORY_ENABLED` | `boolean` | `true` | Enable memory metrics |
| `METRICS_PROMETHEUS_ENABLED` | `boolean` | `true` | Enable Prometheus format |
| `METRICS_MAX_ENDPOINTS` | `number` | `50` | Maximum tracked endpoints |
| `METRICS_MAX_SAMPLES_PER_ENDPOINT` | `number` | `200` | Maximum samples per endpoint |
| `METRICS_CLEANUP_INTERVAL_MINUTES` | `number` | `5` | Cleanup interval (minutes) |
| `METRICS_MEMORY_LIMIT_MB` | `number` | `50` | Memory usage limit (MB) |
| `METRICS_PERCENTILES` | `string` | `95,99` | Calculated percentiles |

## 🔐 Authentication Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HOSPEDA_BETTER_AUTH_URL` | `string` | - | Better Auth URL |
| `HOSPEDA_BETTER_AUTH_SECRET` | `string` | - | Better Auth secret key |
| `SEED_AUTH_PROVIDER` | `'BETTER_AUTH' \| 'AUTH0' \| 'CUSTOM'` | `BETTER_AUTH` | Primary auth provider used by seeds to link Super Admin |
| `SEED_SUPER_ADMIN_AUTH_PROVIDER_USER_ID` | `string` | - | Provider user id to link Super Admin in DB |
| `SEED_AUTH_PROVIDER` | `'BETTER_AUTH' \| 'AUTH0' \| 'CUSTOM'` | `BETTER_AUTH` | Primary auth provider used by seeds to link Super Admin |
| `SEED_SUPER_ADMIN_AUTH_PROVIDER_USER_ID` | `string` | - | Provider user id to link Super Admin in DB |

## 🗄️ Database Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | `string` | - | Database connection URL |
| `DATABASE_MAX_CONNECTIONS` | `number` | `10` | Maximum database connections |
| `DATABASE_CONNECTION_TIMEOUT` | `number` | `30000` | Connection timeout (ms) |
| `DATABASE_QUERY_TIMEOUT` | `number` | `10000` | Query timeout (ms) |

## 🧪 Testing Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TESTING_RATE_LIMIT` | `string` | - | Enable rate limiting in tests (set to 'true') |

---

## 🛠️ Configuration Loading

The API uses a robust configuration system with validation:

```typescript
// src/utils/env.ts
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  // ... all variables with validation
});

export const env = EnvSchema.parse(process.env);
```

## 📝 Environment Files

### **Development (.env.local)**

```env
NODE_ENV=development
API_PORT=3001
LOG_LEVEL=debug
RATE_LIMIT_ENABLED=false
SECURITY_ENABLED=true
```

### **Production (.env.production)**

```env
NODE_ENV=production
API_PORT=8080
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
SECURITY_ENABLED=true
COMPRESSION_ENABLED=true
```

### **Testing (.env.test)**

```env
NODE_ENV=test
API_PORT=3002
LOG_LEVEL=warn
RATE_LIMIT_ENABLED=false
CACHE_ENABLED=false
```

## ⚡ Performance Recommendations

### **Development**

- Disable rate limiting: `RATE_LIMIT_ENABLED=false`
- Enable debug logging: `LOG_LEVEL=debug`
- Disable compression: `COMPRESSION_ENABLED=false`

### **Production**

- Enable all security features
- Set appropriate rate limits
- Enable compression and caching
- Use `info` log level

### **Testing**

- Disable rate limiting (except specific tests)
- Disable caching for consistent results
- Use minimal logging

## 🔍 Validation & Type Safety

All environment variables are:

- ✅ **Validated** using Zod schemas
- ✅ **Type-safe** with TypeScript
- ✅ **Documented** with descriptions
- ✅ **Defaulted** for development ease

## 🚨 Security Notes

### **Sensitive Variables**

Never commit these to version control:

- `HOSPEDA_BETTER_AUTH_SECRET`
- `DATABASE_URL`
- Any production secrets

### **Environment File Priority**

1. `.env.test` (in test environment)
2. `.env.local` (local overrides)
3. `.env` (defaults)

## Feedback System

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `HOSPEDA_LINEAR_API_KEY` | `string` | `undefined` | Linear API key for feedback issue creation. When absent, feedback falls back to email. |
| `HOSPEDA_FEEDBACK_FALLBACK_EMAIL` | `string` | `undefined` | Email address for fallback notifications when Linear is unavailable. |
| `HOSPEDA_FEEDBACK_ENABLED` | `boolean` | `true` | Kill switch to disable the entire feedback system. |

---

Environment configuration is automatically validated on startup. Invalid configurations will prevent the API from starting.
