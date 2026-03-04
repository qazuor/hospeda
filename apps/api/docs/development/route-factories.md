# Route Factories

Guide to using route factory functions for creating consistent, type-safe API endpoints.

---

## Overview

Route factories provide pre-configured patterns for common endpoint types:

- **`createSimpleRoute`** - Health checks, info pages, simple responses
- **`createOpenApiRoute`** - CRUD operations with full OpenAPI documentation
- **`createListRoute`** - Paginated list endpoints

All factories provide:

- ✅ Automatic OpenAPI documentation
- ✅ Type-safe request/response handling
- ✅ Consistent error handling
- ✅ Built-in validation
- ✅ Middleware integration

---

## Quick Comparison

| Factory | Best For | Validation | Pagination | Auth Default |
|---------|----------|------------|------------|--------------|
| `createSimpleRoute` | Health, metrics, info | Manual | No | Optional |
| `createOpenApiRoute` | CRUD operations | Automatic | No | Required |
| `createListRoute` | List endpoints | Automatic | Yes | Optional |

---

## createSimpleRoute

For simple endpoints without complex validation or CRUD operations.

### Basic Example

```typescript
import { createSimpleRoute } from '../../utils/route-factory';
import { z } from 'zod';

export const healthRoute = createSimpleRoute({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  description: 'Returns API health status',
  tags: ['Health'],
  responseSchema: z.object({
    status: z.string(),
    timestamp: z.string(),
    uptime: z.number()
  }),
  handler: async (c) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  },
  options: { skipAuth: true }
});
```

### Parameters

```typescript
{
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  responseSchema: ZodSchema;
  handler: (c: Context) => Promise<ResponseData>;
  options?: RouteOptions;
}
```

### Handler Signature

```typescript
async (c: Context) => Promise<ResponseData>
```

- **`c`**: Hono context object
- **Returns**: Data matching `responseSchema`

### Use Cases

- Health checks
- Version info
- Metrics endpoints
- Static content
- Non-CRUD operations

---

## createOpenApiRoute

For CRUD operations with full OpenAPI documentation and automatic validation.

### createOpenApiRoute - Basic Example

```typescript
import { createOpenApiRoute } from '../../utils/route-factory';
import { createAccommodationSchema, accommodationSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { z } from 'zod';

export const createAccommodationRoute = createOpenApiRoute({
  method: 'post',
  path: '/',
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
  // Auth required by default
});
```

### With Path Parameters

```typescript
export const getByIdRoute = createOpenApiRoute({
  method: 'get',
  path: '/:id',
  summary: 'Get accommodation by ID',
  tags: ['Accommodations'],
  requestParams: {
    id: z.string().uuid()
  },
  responseSchema: accommodationSchema,
  handler: async (c, params, body) => {
    const { id } = params; // Type-safe!
    const service = new AccommodationService(c);
    const result = await service.findById({ id });

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  },
  options: { skipAuth: true }
});
```

### With Query Parameters

```typescript
export const searchRoute = createOpenApiRoute({
  method: 'get',
  path: '/search',
  summary: 'Search accommodations',
  tags: ['Accommodations'],
  requestQuery: {
    city: z.string().optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional()
  },
  responseSchema: z.array(accommodationSchema),
  handler: async (c, params, body, query) => {
    const { city, minPrice, maxPrice } = query; // Type-safe!
    // ...
  }
});
```

### createOpenApiRoute - Parameters

```typescript
{
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  requestParams?: ZodObject;    // Path parameters
  requestQuery?: ZodObject;     // Query parameters
  requestBody?: ZodSchema;      // Request body
  responseSchema: ZodSchema;
  handler: HandlerFunction;
  options?: RouteOptions;
}
```

### createOpenApiRoute - Handler Signature

```typescript
async (
  c: Context,
  params: PathParams,
  body: RequestBody,
  query?: QueryParams
) => Promise<ResponseData>
```

- **`c`**: Hono context object
- **`params`**: Validated path parameters
- **`body`**: Validated request body
- **`query`**: Validated query parameters
- **Returns**: Data matching `responseSchema`

### createOpenApiRoute - Use Cases

- Create (POST)
- Read by ID (GET)
- Update (PATCH/PUT)
- Delete (DELETE)
- Search with filters
- Any CRUD operation

---

## createListRoute

For paginated list endpoints with automatic pagination handling.

### createListRoute - Basic Example

```typescript
import { createListRoute } from '../../utils/route-factory';
import { accommodationSchema, searchAccommodationSchema } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { z } from 'zod';

export const listAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/',
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
  options: { skipAuth: true }
});
```

### createListRoute - Parameters

```typescript
{
  method: 'get';
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  querySchema?: ZodSchema;      // Filters/search parameters
  responseSchema: ZodArray;     // Array of items
  handler: HandlerFunction;
  options?: RouteOptions;
}
```

### createListRoute - Handler Signature

```typescript
async (
  c: Context,
  params: PathParams,
  body: RequestBody,
  query?: QueryParams
) => Promise<{
  data: ItemArray;
  pagination: PaginationInfo;
}>
```

- **`query`**: Automatically includes `page` and `pageSize` from URL
- **Returns**: Object with `data` array and `pagination` object

### createListRoute - Pagination Response

```typescript
{
  data: Item[];
  pagination: {
    page: number;        // Current page (1-indexed)
    pageSize: number;    // Items per page
    total: number;       // Total items
    totalPages: number;  // Total pages
  }
}
```

### Query Parameters

Automatically available in query:

- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 10)
- Plus any custom filters from `querySchema`

### createListRoute - Use Cases

- List all entities
- Filtered lists
- Search results
- Any paginated data

---

## Route Options

Configure route behavior with `options` parameter.

### Available Options

```typescript
{
  skipAuth?: boolean;              // Skip authentication
  skipValidation?: boolean;        // Skip validation middleware
  customRateLimit?: {              // Custom rate limit
    requests: number;
    windowMs: number;
  };
  cacheTTL?: number;              // Cache duration (seconds)
  middlewares?: Middleware[];     // Additional middleware
}
```

### Example: Public Endpoint

```typescript
options: {
  skipAuth: true
}
```

### Example: Custom Rate Limit

```typescript
options: {
  customRateLimit: {
    requests: 5,      // 5 requests
    windowMs: 60000   // per minute
  }
}
```

### Example: Response Caching

```typescript
options: {
  cacheTTL: 300,    // Cache for 5 minutes
  skipAuth: true
}
```

### Example: Multiple Options

```typescript
options: {
  skipAuth: true,
  cacheTTL: 600,
  customRateLimit: {
    requests: 100,
    windowMs: 60000
  }
}
```

---

## Advanced Patterns

### Error Handling

```typescript
handler: async (c, params, body) => {
  const service = new MyService(c);
  const result = await service.doSomething(body);

  if (!result.success) {
    // Throw error for automatic error response
    throw new Error(result.error.message);
  }

  return result.data;
}
```

### Custom Validation

```typescript
requestBody: createSchema.refine(
  (data) => data.endDate > data.startDate,
  { message: 'End date must be after start date' }
)
```

### Multiple Response Schemas

```typescript
responseSchema: z.union([
  successSchema,
  errorSchema
])
```

### Nested Path Parameters

```typescript
requestParams: {
  accommodationId: z.string().uuid(),
  roomId: z.string().uuid()
}
```

### Complex Query Filters

```typescript
requestQuery: {
  status: z.enum(['active', 'inactive']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sortBy: z.enum(['name', 'price', 'date']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
}
```

---

## Type Safety

All factories provide full TypeScript type inference:

```typescript
handler: async (c, params, body, query) => {
  // params, body, query are all type-safe!
  const id = params.id;              // string (if defined)
  const name = body.name;            // string (from schema)
  const filter = query?.status;      // 'active' | 'inactive' (from schema)
}
```

---

## OpenAPI Integration

Routes automatically generate OpenAPI documentation:

```typescript
// This route appears in /ui and /reference automatically
export const myRoute = createOpenApiRoute({
  summary: 'Create user',          // Appears in docs
  description: 'Creates new user', // Appears in docs
  tags: ['Users'],                 // Groups in docs
  requestBody: createUserSchema,   // Auto-generates examples
  responseSchema: userSchema       // Auto-generates examples
  // ...
});
```

---

## Best Practices

### Choose the Right Factory

- ✅ **Health checks** → `createSimpleRoute`
- ✅ **CRUD operations** → `createOpenApiRoute`
- ✅ **Paginated lists** → `createListRoute`

### Schema Reuse

```typescript
// ✅ Good - Reuse schemas from @repo/schemas
import { createUserSchema, userSchema } from '@repo/schemas';

// ❌ Bad - Inline schemas
requestBody: z.object({ name: z.string() })
```

### Error Handling Patterns

```typescript
// ✅ Good - Throw errors for automatic handling
if (!result.success) {
  throw new Error(result.error.message);
}

// ❌ Bad - Manual error responses
if (!result.success) {
  return c.json({ error: result.error.message }, 400);
}
```

### Service Integration

```typescript
// ✅ Good - Use service layer
const service = new AccommodationService(c);
const result = await service.create(body);

// ❌ Bad - Direct model access
const model = new AccommodationModel();
const result = await model.create(body);
```

---

## Troubleshooting

### Error: Schema validation failed

**Cause**: Request doesn't match schema

**Solution**: Check request body/params match schema definition

### Error: Handler signature mismatch

**Cause**: Handler parameters don't match factory type

**Solution**: Check handler signature matches factory requirements

### Error: Type not inferred

**Cause**: Schema not properly typed

**Solution**: Use `z.infer<typeof schema>` for types

---

## Response Format

All routes automatically return a standardized response format via `ResponseFactory`.

### Success Response

```typescript
{
  success: true,
  data: {
    // Handler's return value
  },
  metadata: {
    timestamp: "2026-01-01T00:00:00.000Z",
    requestId: "req_12345",
    cached: false,
    responseTime: 45
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Request validation failed",
    details: [
      {
        field: "email",
        message: "Invalid email format",
        userFriendlyMessage: "Please enter a valid email address",
        suggestion: "Use format: name@domain.com"
      }
    ]
  },
  metadata: {
    timestamp: "2026-01-01T00:00:00.000Z",
    requestId: "req_12345"
  }
}
```

---

## Testing Routes

### Testing Simple Routes

```typescript
describe('Health Route', () => {
  it('should return health status', async () => {
    const app = createTestApp(healthRoute);

    const response = await app.request('/health');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('healthy');
  });
});
```

### Testing with Authentication

```typescript
describe('User CRUD Route', () => {
  it('should require authentication', async () => {
    const app = createTestApp(userCrudRoute);

    const response = await app.request('/users/123');

    expect(response.status).toBe(401);
  });

  it('should return user data for authenticated request', async () => {
    const app = createTestApp(userCrudRoute);
    const mockActor = createMockUserActor();

    const response = await app.request('/users/123', {
      headers: { 'x-test-actor': JSON.stringify(mockActor) }
    });

    expect(response.status).toBe(200);
  });
});
```

### Testing Validation

```typescript
describe('Create User Route', () => {
  it('should validate email format', async () => {
    const app = createTestApp(createUserRoute);

    const response = await app.request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        name: 'Test User'
      })
    });

    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.details[0].field).toBe('email');
  });
});
```

---

## Migration Guide

### From Old Pattern

```typescript
// Old pattern (lots of boilerplate)
app.openapi(
  createRoute({
    method: 'get',
    path: '/users',
    request: { query: UserQuerySchema },
    responses: {
      200: {
        content: { 'application/json': { schema: UserListResponseSchema } }
      }
    }
  }),
  async (c) => {
    const query = c.req.valid('query');
    // ... handler logic
    return c.json({
      success: true,
      data: users,
      metadata: { timestamp: new Date().toISOString(), requestId: c.get('requestId') }
    });
  }
);
```

### To New Pattern

```typescript
// New pattern (clean and type-safe)
export const userListRoute = createListRoute({
  path: '/users',
  requestQuery: UserQuerySchema,
  responseSchema: UserListResponseSchema,
  handler: async (ctx, params, body, query) => {
    // ... handler logic
    return users; // Response formatting is automatic
  }
});
```

---

## Next Steps

- [Creating Endpoints](creating-endpoints.md) - Full endpoint tutorial
- [Middleware System](middleware.md) - Add custom middleware
- [Response Factory](response-factory.md) - Response patterns

---

Back to [Development Guide](README.md)
