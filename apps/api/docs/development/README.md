# Development Guide

Guide for developers building and extending the Hospeda API.

---

## 🎯 Quick Start

New to API development? Start here:

1. **Setup your environment** - [Setup Guide](../setup.md)
2. **Understand the architecture** - [Architecture](../architecture.md)
3. **Create your first endpoint** - [Creating Endpoints](creating-endpoints.md)
4. **Learn the patterns** - [Route Factories](route-factories.md)

---

## 📖 Documentation Structure

### Core Concepts

- **[Creating Endpoints](creating-endpoints.md)** - Step-by-step tutorial for adding new endpoints
- **[Route Factories](route-factories.md)** - Using factory functions (Simple, OpenAPI, List)
- **[Middleware System](middleware.md)** - Understanding and creating middleware
- **[Actor System](actor-system.md)** - Authentication and authorization middleware

### Advanced Topics

- **[Validation](validation.md)** - Request validation with Zod schemas
- **[Response Factory](response-factory.md)** - Standardized response patterns
- **[Debugging](debugging.md)** - Troubleshooting and debugging techniques
- **[Performance](performance.md)** - Optimization tips and best practices
- **[Deployment](deployment.md)** - Deploying to Fly.io

---

## 💡 Common Tasks

### Adding a New Entity

1. Create Zod schema in `@repo/schemas`
2. Create database schema in `@repo/db/schemas`
3. Create model extending `BaseModel` in `@repo/db/models`
4. Create service extending `BaseCrudService` in `@repo/service-core`
5. Create routes using factories in `apps/api/routes`

[Full tutorial →](creating-endpoints.md)

### Creating a Custom Route

```typescript
import { createSimpleRoute } from '../../utils/route-factory';

export const myRoute = createSimpleRoute({
  method: 'get',
  path: '/my-endpoint',
  summary: 'My custom endpoint',
  tags: ['Custom'],
  responseSchema: z.object({ message: z.string() }),
  handler: async (c) => {
    return { message: 'Hello World' };
  }
});
```

[Route factories guide →](route-factories.md)

### Adding Custom Middleware

```typescript
import type { Context, Next } from 'hono';

export const myMiddleware = async (c: Context, next: Next) => {
  // Before request
  console.log('Request:', c.req.path);
  
  await next();
  
  // After request
  console.log('Response:', c.res.status);
};
```

[Middleware guide →](middleware.md)

### Using the Actor System

```typescript
import { getActorFromContext } from '../middlewares/actor';

export const handler = async (c: Context) => {
  const actor = getActorFromContext(c);
  
  if (!actor.isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Use actor data
  console.log(`User: ${actor.email}`);
};
```

[Actor system guide →](actor-system.md)

---

## 🏗️ Architecture Quick Reference

### Request Flow

```text
Client Request
    ↓
Middleware Stack
  • Security Headers
  • CORS
  • Logger
  • Metrics
  • Rate Limiter
  • Authentication
  • Actor Resolution
  • Validation
    ↓
Route Handler
    ↓
Service Layer
    ↓
Model Layer
    ↓
Database
```

### Route Factory Types

| Factory | Use Case | Auth | Validation |
|---------|----------|------|------------|
| `createSimpleRoute` | Health checks, info | Optional | Manual |
| `createOpenApiRoute` | CRUD operations | Default | Automatic |
| `createListRoute` | Paginated lists | Optional | Automatic |

### Middleware Execution Order

1. Security Headers
2. CORS
3. Logger
4. Metrics
5. Rate Limiter
6. Authentication (Clerk)
7. Actor Resolution
8. Validation

---

## 📦 Code Examples

Check `apps/api/docs/examples/` for complete working examples:

- `crud-endpoint.ts` - Complete CRUD endpoint implementation
- `list-endpoint.ts` - Paginated list endpoint
- `custom-endpoint.ts` - Custom route with business logic
- `complex-logic.ts` - Advanced patterns and techniques

---

## 🔧 Development Tools

### Running the API

```bash
# Development mode with hot reload
pnpm dev

# Production build
pnpm build
pnpm start
```

### Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

### Debugging

```bash
# Enable debug logs
DEBUG=* pnpm dev

# TypeScript validation
pnpm typecheck

# Linting
pnpm lint
```

### Database

```bash
# Open Drizzle Studio
pnpm db:studio

# Generate migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Fresh database (reset + seed)
pnpm db:fresh
```

---

## 📚 Key Dependencies

- **Hono** - Web framework
- **@hono/zod-openapi** - OpenAPI + Zod validation
- **@hono/clerk-auth** - Clerk authentication
- **@repo/service-core** - Business logic services
- **@repo/schemas** - Zod validation schemas
- **@repo/db** - Database models and Drizzle ORM

---

## 🎓 Learning Path

### Beginner

1. [Setup Guide](../setup.md)
2. [Architecture Overview](../architecture.md)
3. [Creating Endpoints Tutorial](creating-endpoints.md)
4. [Route Factories Guide](route-factories.md)

### Intermediate

1. [Middleware System](middleware.md)
2. [Actor System](actor-system.md)
3. [Validation Patterns](validation.md)
4. [Response Patterns](response-factory.md)

### Advanced

1. [Debugging Techniques](debugging.md)
2. [Performance Optimization](performance.md)
3. [Deployment Guide](deployment.md)
4. [Complex Examples](../examples/)

---

## ✅ Best Practices

### Code Standards

- Always use factory functions for routes
- Import schemas from `@repo/schemas`
- Extract business logic to services
- Keep route handlers thin
- Use ResponseFactory for consistent responses
- Document with OpenAPI metadata

### Testing Standards

- Write tests first (TDD)
- Test all endpoint variants (success, errors, auth)
- Mock external dependencies
- Achieve 90% coverage minimum

### Performance

- Use pagination for lists
- Implement response caching
- Monitor rate limits
- Optimize database queries

### Security

- Validate all inputs with Zod
- Use authentication middleware
- Check permissions with Actor system
- Sanitize error messages

---

## 🔗 Related Documentation

- 📖 [API Usage Guide](../usage/README.md) - For API consumers
- 🏗️ [Architecture](../architecture.md) - System design
- ⚙️ [Setup Guide](../setup.md) - Local setup
- 📊 [OpenAPI Docs](../usage/openapi.md) - Interactive documentation

---

⬅️ Back to [API Documentation](../README.md)
