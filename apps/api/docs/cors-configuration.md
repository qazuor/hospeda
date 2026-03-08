# CORS Configuration

## Overview

The API uses Hono's built-in `cors` middleware configured via environment variables.
All CORS settings are validated at startup using Zod schemas in `src/utils/env.ts`.

The middleware is applied globally in `src/utils/create-app.ts` before authentication,
so CORS preflight requests (`OPTIONS`) are handled without requiring a valid session.

## Current Implementation

**File:** `src/middlewares/cors.ts`

The `corsMiddleware()` factory calls `getCorsConfig()` at request time (lazy evaluation),
which reads from `process.env` directly via `safeEnv.get`. This means CORS configuration
can be changed without restarting the server if the environment supports live env reloads.

**Important behavior:** When `API_CORS_ORIGINS` includes `*` (wildcard), credentials are
automatically set to `false`. The `Authorization` header cannot be sent with wildcard origins
because browsers reject credentialed requests to `*`. Always use explicit origins in production.

### Origin Verification

A secondary `originVerificationMiddleware` (`src/middlewares/security.ts`) provides
defense-in-depth for mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`). It checks the
`Origin` or `Referer` header against the same allowed origins list from `getCorsConfig()`.
Requests without an origin header are allowed (same-origin or non-browser clients).

## Environment Variables

All variables are prefixed with `API_CORS_`.

| Variable | Default | Description |
|---|---|---|
| `API_CORS_ORIGINS` | `http://localhost:3000,http://localhost:4321` | Comma-separated list of allowed origins. Supports `*` for development only. |
| `API_CORS_ALLOW_CREDENTIALS` | `true` | Send cookies and auth headers cross-origin. Forced to `false` when origins includes `*`. |
| `API_CORS_MAX_AGE` | `86400` | Preflight cache duration in seconds (24 hours). |
| `API_CORS_ALLOW_METHODS` | `GET,POST,PUT,DELETE,PATCH,OPTIONS` | Allowed HTTP methods. |
| `API_CORS_ALLOW_HEADERS` | `Content-Type,Authorization,X-Requested-With` | Headers the client may send. |
| `API_CORS_EXPOSE_HEADERS` | `Content-Length,X-Request-ID` | Response headers the browser may read. |

## Production Origins

The following origins must be explicitly whitelisted in `API_CORS_ORIGINS`:

| App | Production URL | Notes |
|---|---|---|
| Web (Astro) | `https://hospeda.com.ar` | Primary public site |
| Web (www) | `https://www.hospeda.com.ar` | www redirect target |
| Admin (TanStack) | `https://admin.hospeda.com.ar` | Internal admin panel |
| Vercel preview (web) | `https://*.vercel.app` | Staging/preview deployments |

Example production value:

```
API_CORS_ORIGINS=https://hospeda.com.ar,https://www.hospeda.com.ar,https://admin.hospeda.com.ar
```

For staging environments that use Vercel preview URLs, the origin verification middleware
supports wildcard subdomain matching (e.g., `*.vercel.app`). However, Hono's `cors()`
middleware does not support wildcards in subdomains natively. Pass an array with explicit
preview URLs or handle them via a custom `origin` function if needed.

## Configuration Per Environment

### Development (local)

```bash
API_CORS_ORIGINS=http://localhost:3000,http://localhost:4321
API_CORS_ALLOW_CREDENTIALS=true
```

Default values cover the admin app (port 3000) and web app (port 4321).

### Staging (Vercel preview)

```bash
API_CORS_ORIGINS=https://hospeda-web-git-develop.vercel.app,https://hospeda-admin-git-develop.vercel.app
API_CORS_ALLOW_CREDENTIALS=true
```

Use exact preview URLs. Vercel provides a stable preview URL per branch.

### Production (Vercel)

```bash
API_CORS_ORIGINS=https://hospeda.com.ar,https://www.hospeda.com.ar,https://admin.hospeda.com.ar
API_CORS_ALLOW_CREDENTIALS=true
API_CORS_MAX_AGE=86400
```

Set these as environment variables in the Vercel dashboard (Project Settings > Environment Variables)
or via the Vercel CLI:

```bash
vercel env add API_CORS_ORIGINS production
vercel env add API_CORS_ALLOW_CREDENTIALS production
vercel env add API_CORS_MAX_AGE production
```

## Security Recommendations

1. **Never use `*` in production.** Wildcard origins disable credentials and expose the API
   to any website. Always specify exact origins.

2. **Match the frontend deployment URLs exactly.** A trailing slash or different scheme
   (`http` vs `https`) will cause CORS failures. Use `https://` in all production origins.

3. **Do not include the API's own URL** in `API_CORS_ORIGINS`. CORS origins are the
   calling clients, not the server itself.

4. **Keep `API_CORS_ALLOW_CREDENTIALS=true`** for production. The web and admin apps
   send session cookies via Better Auth. Setting this to `false` will break authentication.

5. **Review `API_CORS_ALLOW_HEADERS`** if adding new custom request headers. Any header
   sent by the client that is not listed here will trigger a CORS preflight failure.

6. **Rotate secrets, not CORS config.** CORS configuration is not secret. Do not mix it
   with credential rotation. The only sensitive CORS-adjacent secret is
   `HOSPEDA_BETTER_AUTH_SECRET`.

7. **Set `API_RATE_LIMIT_TRUST_PROXY=true`** when deploying behind Vercel or Cloudflare.
   This enables correct IP detection from `x-forwarded-for` for rate limiting. Without it,
   all requests appear to come from the same proxy IP.
