# Middleware System

Understanding and working with the Hono middleware stack in Hospeda API.

---

## Overview

Middleware functions process requests before they reach route handlers and responses before they're sent to clients.

**Execution Flow:**

```text
Request
  ↓
Middleware 1 (before)
  ↓
Middleware 2 (before)
  ↓
Middleware N (before)
  ↓
Route Handler
  ↓
Middleware N (after)
  ↓
Middleware 2 (after)
  ↓
Middleware 1 (after)
  ↓
Response
```

---

## Middleware Stack

Middleware executes in this order:

1. **Security Headers** - Adds security HTTP headers
2. **CORS** - Handles cross-origin requests
3. **Logger** - Logs requests and responses
4. **Metrics** - Collects performance metrics
5. **Rate Limiter** - Enforces rate limits
6. **Authentication** - Validates Clerk JWT tokens
7. **Actor Resolution** - Extracts user info from token
8. **Validation** - Validates request schema

---

## Built-in Middleware

### 1. Security Headers

**File**: `src/middlewares/security.ts`

Adds security HTTP headers to all responses.

```typescript
import { secureHeaders } from 'hono/secure-headers';

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"]
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin'
}));
```

**Headers Added:**

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`

### 2. CORS

**File**: `src/middlewares/cors.ts`

Handles Cross-Origin Resource Sharing.

```typescript
import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: (origin) => {
    const allowedOrigins = env.CORS_ORIGIN?.split(',') || [];
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
});
```

**Configuration**: Set `CORS_ORIGIN` in `.env`

### 3. Logger

**File**: `src/middlewares/logger.ts`

Logs all requests and responses.

```typescript
import { logger } from 'hono/logger';

app.use('*', logger());
```

**Output Example:**

```text
<-- GET /api/v1/accommodations
--> GET /api/v1/accommodations 200 45ms
```

### 4. Metrics

**File**: `src/middlewares/metrics.ts`

Collects API performance metrics.

```typescript
export const metricsMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  
  await next();
  
  const duration = Date.now() - start;
  
  // Record metrics
  httpRequestDuration.observe({
    method: c.req.method,
    route: c.req.path,
    status: c.res.status
  }, duration);
  
  httpRequestsTotal.inc({
    method: c.req.method,
    route: c.req.path,
    status: c.res.status
  });
};
```

**Metrics Endpoint**: `/metrics` (Prometheus format)

### 5. Rate Limiter

**File**: `src/middlewares/rate-limit.ts`

Enforces request rate limits.

```typescript
import { rateLimiter } from 'hono-rate-limiter';

export const rateLimitMiddleware = rateLimiter({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS) || 60000,
  limit: parseInt(env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: 'draft-7',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown'
});
```

**Configuration**:

- `RATE_LIMIT_WINDOW_MS` - Time window (default: 60000ms)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

**Response Headers:**

- `X-RateLimit-Limit` - Max requests allowed
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Reset timestamp

### 6. Authentication

**File**: `src/middlewares/auth.ts`

Validates Clerk JWT tokens.

```typescript
import { clerkMiddleware } from '@hono/clerk-auth';

export const authMiddleware = clerkMiddleware({
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
  secretKey: env.CLERK_SECRET_KEY
});
```

**Skip for Route:**

```typescript
options: { skipAuth: true }
```

### 7. Actor Resolution

**File**: `src/middlewares/actor.ts`

Extracts user information from authenticated requests.

```typescript
export const actorMiddleware = async (c: Context, next: Next) => {
  const auth = getAuth(c);
  
  if (auth?.userId) {
    const user = await clerkClient.users.getUser(auth.userId);
    
    c.set('actor', {
      isAuthenticated: true,
      userId: auth.userId,
      email: user.emailAddresses[0]?.emailAddress,
      role: user.publicMetadata?.role || 'user',
      permissions: user.publicMetadata?.permissions || []
    });
  } else {
    c.set('actor', {
      isAuthenticated: false
    });
  }
  
  await next();
};
```

**Usage**: See [Actor System Guide](actor-system.md)

### 8. Validation

**File**: Built into route factories

Validates request params, query, and body against Zod schemas.

**Automatic in Factories:**

- `createOpenApiRoute` - Full validation
- `createListRoute` - Query validation
- `createSimpleRoute` - Manual validation

**Skip for Route:**

```typescript
options: { skipValidation: true }
```

---

## Creating Custom Middleware

### Basic Middleware

```typescript
import type { Context, Next } from 'hono';

export const myMiddleware = async (c: Context, next: Next) => {
  // Before request
  console.log('Before:', c.req.path);
  
  // Call next middleware/handler
  await next();
  
  // After response
  console.log('After:', c.res.status);
};
```

### Middleware with Configuration

```typescript
interface TimingConfig {
  threshold: number;
}

export const timingMiddleware = (config: TimingConfig) => {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    
    await next();
    
    const duration = Date.now() - start;
    
    if (duration > config.threshold) {
      console.warn(`Slow request: ${c.req.path} took ${duration}ms`);
    }
  };
};

// Usage
app.use('*', timingMiddleware({ threshold: 1000 }));
```

### Middleware with Early Return

```typescript
export const apiKeyMiddleware = async (c: Context, next: Next) => {
  const apiKey = c.req.header('X-API-Key');
  
  if (!apiKey) {
    return c.json({ error: 'API key required' }, 401);
  }
  
  if (apiKey !== env.API_KEY) {
    return c.json({ error: 'Invalid API key' }, 403);
  }
  
  await next();
};
```

### Middleware with Context Data

```typescript
export const requestIdMiddleware = async (c: Context, next: Next) => {
  const requestId = crypto.randomUUID();
  
  // Store in context
  c.set('requestId', requestId);
  
  // Add to response header
  c.header('X-Request-ID', requestId);
  
  await next();
};

// Access in handler
const requestId = c.get('requestId');
```

---

## Applying Middleware

### Global Middleware

Apply to all routes:

```typescript
// src/app.ts
import { myMiddleware } from './middlewares/my-middleware';

app.use('*', myMiddleware);
```

### Path-Specific Middleware

Apply to specific paths:

```typescript
// Only for /api/* routes
app.use('/api/*', myMiddleware);

// Only for /admin/* routes
app.use('/admin/*', adminMiddleware);
```

### Route-Specific Middleware

Apply to individual routes:

```typescript
// Via route options
export const myRoute = createSimpleRoute({
  // ...
  options: {
    middlewares: [myMiddleware, anotherMiddleware]
  }
});

// Via Hono .use()
router.use('/special/*', specialMiddleware);
```

---

## Middleware Order

Order matters! Middleware executes in registration order.

### Example: Bad Order

```typescript
// ❌ Bad - Auth before logger
app.use('*', authMiddleware);
app.use('*', logger);  // Won't log auth failures
```

### Example: Good Order

```typescript
// ✅ Good - Logger before auth
app.use('*', logger);
app.use('*', authMiddleware);  // Logs all requests including auth failures
```

---

## Common Patterns

### Request Timing

```typescript
export const timingMiddleware = async (c: Context, next: Next) => {
  const start = Date.now();
  
  await next();
  
  const duration = Date.now() - start;
  c.header('X-Response-Time', `${duration}ms`);
};
```

### Request Logging

```typescript
export const detailedLogger = async (c: Context, next: Next) => {
  console.log({
    method: c.req.method,
    path: c.req.path,
    headers: c.req.header(),
    timestamp: new Date().toISOString()
  });
  
  await next();
  
  console.log({
    status: c.res.status,
    headers: c.res.headers
  });
};
```

### Error Boundary

```typescript
export const errorBoundary = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error) {
    console.error('Middleware error:', error);
    return c.json({
      error: 'Internal server error'
    }, 500);
  }
};
```

### Request Validation

```typescript
export const validateHeaders = async (c: Context, next: Next) => {
  const contentType = c.req.header('content-type');
  
  if (!contentType?.includes('application/json')) {
    return c.json({
      error: 'Content-Type must be application/json'
    }, 400);
  }
  
  await next();
};
```

### Response Transformation

```typescript
export const addTimestamp = async (c: Context, next: Next) => {
  await next();
  
  // Modify response
  const body = await c.res.json();
  c.res = c.json({
    ...body,
    timestamp: new Date().toISOString()
  });
};
```

---

## Testing Middleware

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { myMiddleware } from '../middlewares/my-middleware';

describe('myMiddleware', () => {
  it('should add header', async () => {
    const app = new Hono();
    app.use('*', myMiddleware);
    app.get('/', (c) => c.json({ ok: true }));
    
    const res = await app.request('/');
    
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Custom-Header')).toBe('value');
  });
  
  it('should block unauthorized requests', async () => {
    const app = new Hono();
    app.use('*', authMiddleware);
    app.get('/', (c) => c.json({ ok: true }));
    
    const res = await app.request('/');
    
    expect(res.status).toBe(401);
  });
});
```

---

## Best Practices

### Performance

- Keep middleware lightweight
- Avoid heavy computations
- Use async operations efficiently
- Don't block the event loop

### Error Handling

- Always handle errors in middleware
- Use try-catch for async operations
- Return appropriate status codes
- Log errors for debugging

### Security

- Validate inputs early
- Sanitize user data
- Use security headers
- Rate limit aggressively

### Maintainability

- One responsibility per middleware
- Keep middleware simple
- Document configuration options
- Write tests for middleware

---

## Troubleshooting

### Middleware not executing

**Cause**: Registered after routes

**Solution**: Register middleware before route definitions

### Middleware executing twice

**Cause**: Registered globally and on route

**Solution**: Choose one registration method

### Response not sent

**Cause**: Forgot to call `await next()`

**Solution**: Always call `next()` unless returning early

---

## Next Steps

- [Actor System](actor-system.md) - Authentication middleware details
- [Creating Endpoints](creating-endpoints.md) - Using middleware in routes
- [Performance Guide](performance.md) - Optimizing middleware

---

⬅️ Back to [Development Guide](README.md)
