# API Architecture

Internal architecture and design patterns of the Hospeda API.

---

## Overview

The Hospeda API follows a **layered architecture** with clear separation of concerns:

```text
┌─────────────────────────────────────┐
│          HTTP Client                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│      Middleware Stack               │
│  • Security Headers                 │
│  • CORS                             │
│  • Logger                           │
│  • Metrics                          │
│  • Rate Limiter                     │
│  • Authentication (Clerk)           │
│  • Actor Resolution                 │
│  • Validation                       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│          Route Handlers             │
│  (Created via Factory Functions)    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│      Service Layer                  │
│  (@repo/service-core)               │
│  • Business Logic                   │
│  • Authorization                    │
│  • Validation                       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│        Database Layer               │
│        (@repo/db)                   │
│  • Models                           │
│  • CRUD Operations                  │
│  • Soft Delete                      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│          PostgreSQL                 │
└─────────────────────────────────────┘
```

### Core Principles

1. **Factory Pattern** - All routes created via factory functions
2. **Type Safety** - Full TypeScript with runtime validation (Zod)
3. **Separation of Concerns** - Routes are thin, business logic in services
4. **RO-RO Pattern** - Receive Object, Return Object for all functions
5. **OpenAPI First** - Documentation generated from Zod schemas
6. **Immutability** - No mutations, always return new objects

---

## Request Flow

Detailed flow of an HTTP request through the API:

### 1. Request Received

```text
Client → Hono Server → Middleware Stack
```

### 2. Middleware Processing (In Order)

```typescript
// 1. Security Headers
secureHeaders() // Sets CSP, HSTS, X-Frame-Options, etc.

// 2. CORS
corsMiddleware() // Validates origin, sets CORS headers

// 3. Logger
loggerMiddleware() // Logs request method, path, duration

// 4. Metrics
metricsMiddleware() // Collects request metrics

// 5. Rate Limiter
rateLimitMiddleware() // Enforces rate limits per IP

// 6. Authentication (if required)
clerkMiddleware() // Validates JWT token, loads user session

// 7. Actor Resolution (if authenticated)
actorMiddleware() // Creates Actor object from session

// 8. Validation (if configured)
validationMiddleware() // Validates request body, params, query
```

### 3. Route Handler

```typescript
// Handler receives:
// - Context (c) with actor, services, etc.
// - Validated params, body, query
const handler = async (c, params, body, query) => {
  // Business logic...
}
```

### 4. Service Layer

```typescript
// Services handle business logic
const service = new AccommodationService(c)
const result = await service.findById({ id: params.id })
```

### 5. Response

```typescript
// Standardized response via ResponseFactory
return ResponseFactory.success(c, result.data, 200)
```

---

## Middleware Stack

Middleware is applied in this specific order:

### 1. Security Headers

**Purpose:** Set security-related HTTP headers

**Location:** `src/middlewares/security.ts`

**Headers Set:**

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: no-referrer`

### 2. CORS

**Purpose:** Handle Cross-Origin Resource Sharing

**Location:** `src/middlewares/cors.ts`

**Configuration:**

```typescript
{
  origin: process.env.CORS_ORIGIN.split(','),
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}
```

### 3. Logger

**Purpose:** Log HTTP requests

**Location:** `src/middlewares/logger.ts`

**Logs:**

- Request method, path
- Response status code
- Response time
- User ID (if authenticated)

### 4. Metrics

**Purpose:** Collect request metrics

**Location:** `src/middlewares/metrics.ts`

**Tracks:**

- Total requests
- Request duration
- Status code distribution
- Route-level metrics

### 5. Rate Limiter

**Purpose:** Prevent abuse via rate limiting

**Location:** `src/middlewares/rate-limit.ts`

**Default:** 100 requests per minute per IP

**Customizable per route:**

```typescript
options: {
  customRateLimit: {
    requests: 5,
    windowMs: 60000 // 5 requests per minute
  }
}
```

### 6. Authentication (Clerk)

**Purpose:** Validate JWT tokens

**Location:** `src/middlewares/auth.ts`

**Behavior:**

- Optional by default (routes can skip with `skipAuth: true`)
- Validates JWT from `Authorization: Bearer <token>` header
- Loads user session from Clerk
- Injects session into context

### 7. Actor Resolution

**Purpose:** Create Actor object from session

**Location:** `src/middlewares/actor.ts`

**Creates Actor with:**

- `isAuthenticated: boolean`
- `userId: string`
- `email: string`
- `role: string`
- `permissions: string[]`

### 8. Validation

**Purpose:** Validate request data against Zod schemas

**Location:** `src/middlewares/validation.ts`

**Validates:**

- Request body
- Path parameters
- Query parameters

**Can be skipped** with `skipValidation: true`

---

## Route Factory System

The API uses **factory functions** to create consistent, type-safe routes.

### Simple Routes

For basic endpoints (health checks, info):

```typescript
import { createSimpleRoute } from '@/utils/route-factory'

export const healthRoute = createSimpleRoute({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  description: 'Returns server health status',
  tags: ['Health'],
  responseSchema: z.object({
    status: z.string(),
    timestamp: z.string()
  }),
  handler: async (c) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  },
  options: { skipAuth: true }
})
```

### OpenAPI Routes

For CRUD operations with full validation:

```typescript
import { createOpenApiRoute } from '@/utils/route-factory'

export const createRoute = createOpenApiRoute({
  method: 'post',
  path: '/accommodations',
  summary: 'Create accommodation',
  description: 'Creates a new accommodation',
  tags: ['Accommodations'],
  requestBody: createAccommodationSchema,
  responseSchema: accommodationSchema,
  handler: async (c, params, body) => {
    const service = new AccommodationService(c)
    const result = await service.create(body)

    if (!result.success) {
      throw new Error(result.error.message)
    }

    return result.data
  }
  // Auth required by default
})
```

### List Routes

For paginated list endpoints:

```typescript
import { createListRoute } from '@/utils/route-factory'

export const listRoute = createListRoute({
  method: 'get',
  path: '/accommodations',
  summary: 'List accommodations',
  description: 'Returns paginated list',
  tags: ['Accommodations'],
  querySchema: searchAccommodationSchema.optional(),
  responseSchema: z.array(accommodationSchema),
  handler: async (c, params, body, query) => {
    const service = new AccommodationService(c)
    const result = await service.findAll(query)

    return {
      data: result.data,
      pagination: result.pagination
    }
  },
  options: { skipAuth: true }
})
```

### Route Options

Configure route behavior:

```typescript
options: {
  // Skip authentication
  skipAuth: true,

  // Skip validation middleware
  skipValidation: true,

  // Custom rate limiting
  customRateLimit: {
    requests: 5,
    windowMs: 60000
  },

  // Cache TTL (seconds)
  cacheTTL: 300,

  // Additional middleware
  middlewares: [customMiddleware]
}
```

---

## Service Layer Integration

Routes interact with the **Service Layer** (`@repo/service-core`) for business logic.

### Creating Service Instance

```typescript
import { AccommodationService } from '@repo/service-core'

const handler = async (c: Context) => {
  // Service requires context (for actor, DB, etc.)
  const service = new AccommodationService(c)

  // Call service methods
  const result = await service.findById({ id: '123' })

  // Handle result
  if (!result.success) {
    return ResponseFactory.error(c, result.error.message)
  }

  return ResponseFactory.success(c, result.data)
}
```

### Service Methods

All services extend `BaseCrudService` with standard methods:

- `findAll(filters)` - List with pagination
- `findById({ id })` - Get single record
- `create(data)` - Create new record
- `update({ id, data })` - Update record
- `delete({ id })` - Soft delete record

### Result Pattern

Services return `ServiceResult<T>`:

```typescript
type ServiceResult<T> = {
  success: true
  data: T
} | {
  success: false
  error: {
    code: ServiceErrorCode
    message: string
  }
}
```

---

## Actor System

The **Actor System** provides unified authentication and authorization.

### Actor Object

Created by `actorMiddleware` from Clerk session:

```typescript
interface Actor {
  isAuthenticated: boolean
  userId: string
  email: string
  role: string // 'admin', 'user', 'guest'
  permissions: string[] // ['accommodation:write', ...]
}
```

### Getting Actor in Handler

```typescript
import { getActorFromContext } from '@/middlewares/actor'

const handler = async (c: Context) => {
  const actor = getActorFromContext(c)

  // Check authentication
  if (!actor.isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Check role
  if (actor.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Check permissions
  if (!actor.permissions.includes('accommodation:write')) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  // Pass actor to service
  const service = new AccommodationService(c)
  const result = await service.create(actor, data)

  return ResponseFactory.success(c, result.data)
}
```

### Permission System

Permissions follow pattern: `<resource>:<action>`

Examples:

- `accommodation:read`
- `accommodation:write`
- `accommodation:delete`
- `user:admin`

---

## Response Standardization

All responses follow a **standardized format** using `ResponseFactory`.

### Success Response

```typescript
return ResponseFactory.success(c, data, 200)

// Response:
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```typescript
return ResponseFactory.error(
  c,
  'Not found',
  404,
  ServiceErrorCode.NOT_FOUND
)

// Response:
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Not found"
  }
}
```

### Paginated Response

```typescript
return ResponseFactory.paginated(c, {
  data: items,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 100,
    totalPages: 10
  }
})

// Response:
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Validation Error

```typescript
return ResponseFactory.validationError(c, errors)

// Response:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

---

## Error Handling

### Service Errors

Services throw `ServiceError`:

```typescript
import { ServiceError, ServiceErrorCode } from '@repo/schemas'

throw new ServiceError(
  'Accommodation not found',
  ServiceErrorCode.NOT_FOUND
)
```

### Route Error Handling

Use `handleRouteError` utility:

```typescript
import { handleRouteError } from '@/utils/response-helpers'

try {
  const result = await service.doSomething()

  if (!result.success) {
    throw new ServiceError(
      result.error.message,
      result.error.code
    )
  }

  return ResponseFactory.success(c, result.data)
} catch (error) {
  return handleRouteError(c, error)
}
```

### Error Codes

Defined in `@repo/schemas`:

- `VALIDATION_ERROR` - Invalid input
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Insufficient permissions
- `CONFLICT` - Resource conflict (duplicate)
- `INTERNAL_ERROR` - Server error

---

## Key Patterns

### 1. Factory Pattern

All routes created via factory functions for consistency.

### 2. RO-RO Pattern

**Receive Object, Return Object** - All functions use object parameters:

```typescript
// ✅ Good
function create({ name, slug }: CreateParams) { }

// ❌ Bad
function create(name: string, slug: string) { }
```

### 3. Result Pattern

Services return `ServiceResult<T>` instead of throwing:

```typescript
// ✅ Good
const result = await service.create(data)
if (!result.success) {
  // Handle error
}

// ❌ Bad (avoid throwing in services)
try {
  const data = await service.create(data)
} catch (error) {
  // Handle error
}
```

### 4. Immutability

Never mutate objects, always return new ones:

```typescript
// ✅ Good
return { ...user, name: 'New Name' }

// ❌ Bad
user.name = 'New Name'
return user
```

### 5. Named Exports

Always use named exports:

```typescript
// ✅ Good
export const healthRoute = createSimpleRoute({ ... })
export function getActorFromContext(c: Context) { }

// ❌ Bad
export default healthRoute
```

---

## Performance Considerations

### 1. Database Connection Pooling

Drizzle ORM handles connection pooling automatically.

### 2. Caching

Routes can specify `cacheTTL` option:

```typescript
options: {
  cacheTTL: 300 // 5 minutes
}
```

### 3. Pagination

Always paginate list endpoints:

```typescript
const result = await service.findAll({
  page: 1,
  pageSize: 10
})
```

### 4. Rate Limiting

Prevents abuse and ensures fair usage:

- Default: 100 requests/minute per IP
- Customizable per route

### 5. Metrics

Monitor performance via `/metrics` endpoint.

---

## Security Considerations

### 1. Authentication

- JWT validation via Clerk
- Secure token storage (HTTP-only cookies)

### 2. Authorization

- Role-based access control (RBAC)
- Permission checking via Actor system

### 3. Input Validation

- Zod schema validation
- SQL injection prevention (Drizzle ORM)
- XSS prevention (sanitization)

### 4. Security Headers

- CSP, HSTS, X-Frame-Options, etc.
- Configured via security middleware

### 5. Rate Limiting

- Per-IP rate limiting
- Prevents brute force attacks

---

## Next Steps

- **[Creating Endpoints](development/creating-endpoints.md)** - Build your first endpoint
- **[Middleware System](development/middleware.md)** - Deep dive into middleware
- **[Testing Guide](development/testing.md)** - Testing strategies

---

⬅️ Back to [API Documentation](README.md)
