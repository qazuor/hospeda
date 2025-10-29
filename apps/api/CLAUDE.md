# CLAUDE.md - API Application

This file provides guidance for working with the Hospeda API application (`apps/api`).

## Overview

Hono-based REST API server providing comprehensive endpoints for the Hospeda platform. Features include authentication (Clerk), rate limiting, metrics collection, OpenAPI documentation, and standardized error handling.

## Key Commands

```bash
# Development
pnpm dev                # Start dev server with hot reload (port 3001)

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:file <path>  # Run specific test file

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code

# Build & Deploy
pnpm build             # Build for production
pnpm start             # Start production server
```

## Project Structure

```
src/
├── index.ts           # Server entry point with graceful shutdown
├── app.ts             # App initialization with middleware
├── middlewares/       # Custom middleware (auth, cors, metrics, etc.)
├── routes/            # Route handlers organized by entity
│   ├── accommodation/
│   ├── destination/
│   ├── event/
│   ├── post/
│   ├── user/
│   ├── auth/
│   ├── health/        # Health check endpoints
│   ├── metrics/       # Metrics endpoints
│   └── docs/          # API documentation endpoints
├── utils/             # Utilities and factories
│   ├── route-factory.ts      # Route creation factories
│   ├── response-factory.ts   # Response standardization
│   ├── response-helpers.ts   # Response utilities
│   └── create-app.ts         # App factory
└── schemas/           # API-specific schemas
```

## Route Factory System

Use factory functions to create consistent, type-safe routes with automatic validation and documentation.

### Simple Routes (Health Checks, Info)

```ts
import { createSimpleRoute } from '../../utils/route-factory';

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
    return { status: 'ok', timestamp: new Date().toISOString() };
  },
  options: { skipAuth: true } // Public endpoint
});
```

### OpenAPI Routes (CRUD Operations)

```ts
import { createOpenApiRoute } from '../../utils/route-factory';
import { createAccommodationSchema, accommodationSchema } from '@repo/schemas';

export const createAccommodationRoute = createOpenApiRoute({
  method: 'post',
  path: '/accommodations',
  summary: 'Create accommodation',
  description: 'Creates a new accommodation',
  tags: ['Accommodations'],
  requestBody: createAccommodationSchema,
  responseSchema: accommodationSchema,
  handler: async (c, params, body) => {
    const service = new AccommodationService(c);
    const result = await service.create(body);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  }
  // Auth is required by default
});
```

### List Routes (Paginated)

```ts
import { createListRoute } from '../../utils/route-factory';
import { searchAccommodationSchema } from '@repo/schemas';

export const listAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/accommodations',
  summary: 'List accommodations',
  description: 'Returns paginated list of accommodations',
  tags: ['Accommodations'],
  querySchema: searchAccommodationSchema.optional(),
  responseSchema: z.array(accommodationSchema),
  handler: async (c, params, body, query) => {
    const service = new AccommodationService(c);
    const result = await service.findAll(query);

    return {
      data: result.data,
      pagination: result.pagination
    };
  },
  options: { skipAuth: true } // Public listing
});
```

## Route Options

Configure route behavior with `options`:

```ts
options: {
  skipAuth: true,                              // Make route public
  skipValidation: true,                        // Skip validation middleware
  customRateLimit: {                           // Custom rate limiting
    requests: 5,
    windowMs: 60000
  },
  cacheTTL: 300,                              // Cache for 5 minutes
  middlewares: [customMiddleware]             // Additional middleware
}
```

## Middleware Stack

Middleware is applied in this order:

1. **Security Headers** (`secureHeaders`)
2. **CORS** (`corsMiddleware`)
3. **Logger** (`loggerMiddleware`)
4. **Metrics** (`metricsMiddleware`)
5. **Rate Limit** (`rateLimitMiddleware`)
6. **Authentication** (`clerkMiddleware` - unless `skipAuth: true`)
7. **Actor Resolution** (`actorMiddleware`)
8. **Validation** (`validationMiddleware` - unless `skipValidation: true`)

Key middlewares:

- `actor.ts` - Extract user/actor from Clerk auth
- `auth.ts` - Clerk authentication
- `cache.ts` - Response caching
- `metrics.ts` - Request metrics collection
- `rate-limit.ts` - Rate limiting
- `security.ts` - Security headers

## Authentication & Authorization

### Getting Current Actor

```ts
import { getActorFromContext } from '../middlewares/actor';

export const handler = async (c: Context) => {
  const actor = getActorFromContext(c);

  // Check authentication
  if (!actor.isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Check role
  if (actor.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Check permissions
  if (!actor.permissions.includes('accommodation:write')) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  // Access user data
  console.log(`User ${actor.userId} from ${actor.email}`);
};
```

### Actor Properties

- `isAuthenticated: boolean`
- `userId: string`
- `email: string`
- `role: string`
- `permissions: string[]`

## Response Standardization

Use `ResponseFactory` for consistent responses:

```ts
import { ResponseFactory } from '../utils/response-factory';

// Success response
return ResponseFactory.success(c, data, 200);

// Error response
return ResponseFactory.error(c, 'Not found', 404, ServiceErrorCode.NOT_FOUND);

// Paginated response
return ResponseFactory.paginated(c, {
  data: items,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 100,
    totalPages: 10
  }
});

// Validation error
return ResponseFactory.validationError(c, errors);
```

## Error Handling

```ts
import { handleRouteError } from '../utils/response-helpers';
import { ServiceError, ServiceErrorCode } from '@repo/schemas';

try {
  const result = await service.doSomething();

  if (!result.success) {
    throw new ServiceError(
      result.error.message,
      ServiceErrorCode.VALIDATION_ERROR
    );
  }

  return ResponseFactory.success(c, result.data);
} catch (error) {
  return handleRouteError(c, error);
}
```

## Route Registration

In entity index file (e.g., `routes/accommodation/index.ts`):

```ts
import { createRouter } from '../../utils/create-app';
import { listRoute } from './list';
import { createRoute } from './create';
import { getByIdRoute } from './getById';

const router = createRouter();

// Register routes
router.route('/', listRoute);
router.route('/', createRoute);
router.route('/', getByIdRoute);

export default router;
```

In main routes index (`routes/index.ts`):

```ts
import accommodationRoutes from './accommodation';

export const registerRoutes = (app: Hono) => {
  app.route('/api/v1/accommodations', accommodationRoutes);
};
```

## Service Integration

```ts
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';

const handler = async (c: Context) => {
  // Create service instance with context
  const service = new AccommodationService(c);

  // Call service methods
  const result = await service.findAll({ isActive: true });

  if (!result.success) {
    return ResponseFactory.error(c, result.error.message);
  }

  return ResponseFactory.success(c, result.data);
};
```

## OpenAPI Documentation

Access documentation at:

- `/docs` - Documentation index
- `/reference` - Scalar API reference
- `/ui` - Swagger UI

Define OpenAPI schemas:

```ts
import { createOpenAPISchema } from '../utils/openapi-schema';

const schema = createOpenAPISchema({
  title: 'Accommodation',
  description: 'Accommodation entity',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    // ...
  }
});
```

## Environment Variables

Required environment variables (see `utils/env.ts`):

```env
# Server
API_PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://...

# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# CORS
CORS_ORIGIN=http://localhost:4321,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Testing

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createMockUserActor } from '../utils/test-helpers';

describe('Accommodation Routes', () => {
  it('should create accommodation', async () => {
    const mockActor = createMockUserActor({
      role: 'admin',
      permissions: ['accommodation:write']
    });

    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token'
      },
      body: JSON.stringify(mockData)
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

## Common Patterns

### Route with Path Parameters

```ts
requestParams: {
  id: z.string().uuid()
},
handler: async (c, params, body) => {
  const { id } = params;
  // Use id
}
```

### Route with Query Parameters

```ts
requestQuery: {
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().max(100).default(10)
},
handler: async (c, params, body, query) => {
  const { status, limit } = query;
  // Use query params
}
```

### Batch Operations

```ts
requestBody: z.object({
  ids: z.array(z.string().uuid())
}),
handler: async (c, params, body) => {
  const { ids } = body;
  const service = new AccommodationService(c);

  const results = await Promise.all(
    ids.map(id => service.delete({ id }))
  );

  return { processed: results.length };
}
```

## Performance Considerations

- Use `cacheTTL` for static/slow-changing data
- Implement pagination for list endpoints (always)
- Use database connection pooling (automatic with Drizzle)
- Monitor metrics at `/metrics` endpoint
- Rate limiting prevents abuse

## Key Dependencies

- `hono` - Web framework
- `@hono/zod-openapi` - OpenAPI + Zod validation
- `@hono/clerk-auth` - Clerk authentication
- `@repo/service-core` - Business logic services
- `@repo/schemas` - Zod validation schemas
- `@repo/db` - Database models

## Best Practices

1. **Always use factory functions** for routes
2. **Import schemas from `@repo/schemas`** - never inline
3. **Use ResponseFactory** for consistent responses
4. **Extract business logic to services** - keep routes thin
5. **Set appropriate route options** (auth, cache, rate limit)
6. **Document with OpenAPI** metadata
7. **Test all endpoints** with different actor roles
8. **Handle errors gracefully** with try-catch
9. **Validate all inputs** with Zod schemas
10. **Use TypeScript strict mode** - no `any` types
