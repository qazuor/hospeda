# 🏭 Route Factory System Documentation

## Overview

The Route Factory System is our modern approach to creating consistent, type-safe, and feature-rich API endpoints with minimal boilerplate. It provides three factory functions that handle common patterns while maintaining full flexibility.

## 🎯 Core Benefits

- **📉 40% Less Boilerplate**: Automatic middleware application and response formatting
- **🔒 100% Type Safety**: No dangerous type assertions or `any` types
- **⚡ Built-in Features**: Caching, rate limiting, validation, error handling
- **📊 Consistent APIs**: Standardized response format across all endpoints
- **🧪 Easy Testing**: Simplified mocking and testing patterns

---

## 🏗️ Factory Types

### 1. **createSimpleRoute** - Basic endpoints

### 2. **createListRoute** - Paginated list endpoints  

### 3. **createCRUDRoute** - Full CRUD operations

---

## 🎨 createSimpleRoute

**Perfect for**: Health checks, status endpoints, simple GET/POST operations

### **Basic Usage**

```typescript
export const healthRoute = createSimpleRoute({
  method: 'get',
  path: '/health',
  summary: 'Health check endpoint',
  description: 'Returns the current health status of the API',
  tags: ['Health'],
  handler: async (ctx) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }
});
```

### **With Request Body Validation**

```typescript
const CreatePostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  tags: z.array(z.string()).optional()
});

export const createPostRoute = createSimpleRoute({
  method: 'post',
  path: '/posts',
  summary: 'Create a new post',
  requestBody: CreatePostSchema,
  responseSchema: PostResponseSchema,
  handler: async (ctx, body) => {
    // body is fully typed based on CreatePostSchema
    const actor = ctx.get('actor');
    
    if (actor.type !== 'USER') {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    
    const post = await postService.create({
      ...body,
      authorId: actor.user.id
    });
    
    return post;
  }
});
```

### **Configuration Options**

```typescript
interface SimpleRouteConfig<TBody, TResponse> {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  requestBody?: ZodSchema<TBody>;
  responseSchema?: ZodSchema<TResponse>;
  middleware?: {
    cache?: boolean | CacheOptions;
    rateLimit?: boolean | RateLimitOptions;
    auth?: boolean;
  };
  handler: SimpleRouteHandler<TBody, TResponse>;
}
```

---

## 📋 createListRoute

**Perfect for**: Paginated lists, search endpoints, filtered collections

### **Basic Usage**

```typescript
const UserListQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  search: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

export const userListRoute = createListRoute({
  path: '/users',
  summary: 'List users with pagination and filtering',
  requestQuery: UserListQuerySchema,
  responseSchema: UserListResponseSchema,
  handler: async (ctx, params, query) => {
    // query is fully typed and transformed
    const { page, limit, search, status } = query;
    
    const actor = ctx.get('actor');
    const users = await userService.list({
      actor,
      pagination: { page, limit },
      filters: { search, status }
    });
    
    return {
      users: users.data,
      pagination: {
        page,
        limit,
        total: users.total,
        totalPages: Math.ceil(users.total / limit)
      }
    };
  }
});
```

### **Advanced Filtering**

```typescript
const AccommodationListQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('20'),
  city: z.string().optional(),
  maxPrice: z.string().transform(Number).optional(),
  minRating: z.string().transform(Number).optional(),
  amenities: z.string().optional().transform(val => 
    val ? val.split(',') : undefined
  ),
  sortBy: z.enum(['price', 'rating', 'distance']).default('rating')
});

export const accommodationListRoute = createListRoute({
  path: '/accommodations',
  summary: 'Search accommodations with filters',
  requestQuery: AccommodationListQuerySchema,
  responseSchema: AccommodationListResponseSchema,
  middleware: {
    cache: { ttl: 300 }, // Cache for 5 minutes
    rateLimit: { max: 50, windowMs: 60000 } // 50 requests per minute
  },
  handler: async (ctx, params, query) => {
    const results = await accommodationService.search({
      ...query,
      actor: ctx.get('actor')
    });
    
    return results;
  }
});
```

---

## 🔧 createCRUDRoute

**Perfect for**: Resource management, entity operations, RESTful endpoints

### **Basic CRUD Setup**

```typescript
const UserParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID format')
});

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['user', 'admin']).default('user')
});

const UpdateUserSchema = CreateUserSchema.partial();

export const userCrudRoute = createCRUDRoute({
  path: '/users/{id}',
  entityName: 'User',
  requestParams: UserParamsSchema,
  requestBody: CreateUserSchema,
  updateBody: UpdateUserSchema,
  responseSchema: UserResponseSchema,
  middleware: {
    auth: true, // Require authentication for all operations
    rateLimit: { max: 100 }
  },
  handlers: {
    // GET /users/{id}
    get: async (ctx, params) => {
      const actor = ctx.get('actor');
      const user = await userService.getById(params.id, actor);
      return user;
    },
    
    // POST /users/{id} (or PUT for creation)
    post: async (ctx, params, body) => {
      const actor = ctx.get('actor');
      
      if (actor.type !== 'USER' || !actor.permissions.includes('admin')) {
        throw new HTTPException(403, { message: 'Admin access required' });
      }
      
      const user = await userService.create({
        ...body,
        id: params.id
      }, actor);
      
      return user;
    },
    
    // PUT /users/{id}
    put: async (ctx, params, body) => {
      const actor = ctx.get('actor');
      const user = await userService.update(params.id, body, actor);
      return user;
    },
    
    // DELETE /users/{id}
    delete: async (ctx, params) => {
      const actor = ctx.get('actor');
      await userService.delete(params.id, actor);
      return { deleted: true };
    }
  }
});
```

### **Partial CRUD (Only Some Operations)**

```typescript
export const profileRoute = createCRUDRoute({
  path: '/profile',
  entityName: 'Profile',
  requestBody: UpdateProfileSchema,
  responseSchema: ProfileResponseSchema,
  middleware: { auth: true },
  handlers: {
    // Only GET and PUT operations
    get: async (ctx) => {
      const actor = ctx.get('actor');
      if (actor.type !== 'USER') {
        throw new HTTPException(401);
      }
      return await userService.getProfile(actor.user.id);
    },
    
    put: async (ctx, params, body) => {
      const actor = ctx.get('actor');
      if (actor.type !== 'USER') {
        throw new HTTPException(401);
      }
      return await userService.updateProfile(actor.user.id, body);
    }
    // POST and DELETE not provided = endpoints not created
  }
});
```

---

## ⚙️ Middleware Configuration

### **Built-in Middleware Options**

```typescript
interface MiddlewareOptions {
  cache?: boolean | {
    ttl: number;           // Cache TTL in seconds
    vary?: string[];       // Vary headers for cache keys
    private?: boolean;     // Cache-Control: private
  };
  
  rateLimit?: boolean | {
    max: number;           // Max requests
    windowMs: number;      // Time window
    message?: string;      // Custom error message
  };
  
  auth?: boolean;          // Require authentication
  
  compression?: boolean;   // Enable response compression
  
  cors?: boolean | {       // CORS configuration
    origins: string[];
    methods: string[];
  };
}
```

### **Global vs Route-Specific Middleware**

```typescript
// Global middleware (applied to all routes)
app.use(securityHeadersMiddleware);
app.use(rateLimitMiddleware);

// Route-specific middleware (only for this route)
export const sensitiveRoute = createSimpleRoute({
  // ...
  middleware: {
    rateLimit: { max: 10, windowMs: 60000 }, // Very strict limits
    cache: false, // Disable caching for sensitive data
    auth: true // Require authentication
  },
  // ...
});
```

---

## 🎯 Response Format

All routes automatically return the standardized response format:

### **Success Response**

```typescript
{
  success: true,
  data: {
    // Your handler's return value
  },
  metadata: {
    timestamp: "2024-01-01T00:00:00.000Z",
    requestId: "req_12345",
    cached: false,
    responseTime: 45
  }
}
```

### **Error Response**

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
    timestamp: "2024-01-01T00:00:00.000Z",
    requestId: "req_12345"
  }
}
```

---

## 🧪 Testing Routes

### **Testing Simple Routes**

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

### **Testing with Authentication**

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

### **Testing Validation**

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

## 📊 Performance & Monitoring

### **Built-in Metrics**

All routes automatically track:

- Request/response times
- Success/error rates
- Cache hit rates
- Rate limit violations

### **Custom Metrics**

```typescript
export const analyticsRoute = createSimpleRoute({
  path: '/analytics/track',
  method: 'post',
  handler: async (ctx, body) => {
    // Custom metric tracking
    const metrics = ctx.get('metrics');
    metrics.increment('custom.analytics.event', {
      type: body.eventType,
      user: ctx.get('actor').type
    });
    
    return { tracked: true };
  }
});
```

---

## 🔮 Advanced Patterns

### **Route Composition**

```typescript
// Shared configurations
const AuthenticatedRoute = {
  middleware: { auth: true },
  tags: ['Authenticated']
};

const AdminRoute = {
  ...AuthenticatedRoute,
  middleware: { 
    ...AuthenticatedRoute.middleware,
    rateLimit: { max: 1000 } // Higher limits for admins
  }
};

// Usage
export const adminUserRoute = createCRUDRoute({
  ...AdminRoute,
  path: '/admin/users/{id}',
  // ... rest of config
});
```

### **Dynamic Middleware**

```typescript
const createConditionalAuth = (condition: (ctx: Context) => boolean) => {
  return async (ctx: Context, next: Next) => {
    if (condition(ctx)) {
      // Apply auth middleware
      return authMiddleware(ctx, next);
    }
    await next();
  };
};
```

---

## 📚 Migration Guide

### **From Old Pattern**

```typescript
// ❌ Old pattern (lots of boilerplate)
app.openapi(
  createRoute({
    method: 'get',
    path: '/users',
    request: {
      query: UserQuerySchema
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: UserListResponseSchema
          }
        }
      }
    }
  }),
  async (c) => {
    const query = c.req.valid('query');
    // ... handler logic
    return c.json({
      success: true,
      data: users,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId')
      }
    });
  }
);
```

### **To New Pattern**

```typescript
// ✅ New pattern (clean and type-safe)
export const userListRoute = createListRoute({
  path: '/users',
  requestQuery: UserQuerySchema,
  responseSchema: UserListResponseSchema,
  handler: async (ctx, params, query) => {
    // ... handler logic
    return users; // Response formatting is automatic
  }
});
```

---

## 🚀 Best Practices

### **1. Schema Organization**

```typescript
// schemas/user.schemas.ts
export const UserParamsSchema = z.object({
  id: z.string().uuid()
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2)
});

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.string()
});
```

### **2. Handler Organization**

```typescript
// handlers/user.handlers.ts
export const getUserHandler: CRUDHandler<UserParams, never> = async (ctx, params) => {
  return await userService.getById(params.id, ctx.get('actor'));
};

export const createUserHandler: CRUDHandler<UserParams, CreateUser> = async (ctx, params, body) => {
  return await userService.create(body, ctx.get('actor'));
};
```

### **3. Route Registration**

```typescript
// routes/user/index.ts
import { userListRoute, userCrudRoute } from './routes';

export const userRoutes = createRouter()
  .route('/', userListRoute)
  .route('/{id}', userCrudRoute);
```

---

*The Route Factory System eliminates boilerplate while maintaining full type safety and flexibility. Last updated: 2024-12-19*
