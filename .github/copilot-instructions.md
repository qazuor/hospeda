# Hospeda - AI Coding Agent Instructions

## 🏗️ Architecture Overview

Hospeda is a **TurboRepo monorepo** for a tourism accommodation platform using:

- **Apps**: `api/` (Hono), `web/` (Astro+React), `admin/` (TanStack Start)
- **Packages**: Shared libraries with `@repo/*` namespace (`db`, `schemas`, `types`, `service-core`, etc.)
- **Database**: PostgreSQL + Drizzle ORM with type-safe schemas
- **Auth**: Clerk integration with Actor-based permissions

## 🔧 Development Workflow

**Key Commands:**

```bash
# Start everything in dev mode
pnpm dev

# Target specific apps/packages
pnpm dev --filter=api
pnpm dev --filter=web

# Database operations
pnpm db:fresh        # Reset DB with migrations + seed
pnpm db:studio       # Open Drizzle Studio
pnpm db:migrate      # Apply migrations

# Build & test
pnpm build           # Build all packages
pnpm test            # Run all tests with Vitest
pnpm check           # Biome format + lint
```

## 📁 File Organization Patterns

### API Routes Structure

- Routes use **factory pattern**: `createSimpleRoute()`, `createCRUDRoute()`, `createListRoute()`
- Location: `apps/api/src/routes/{entity}/index.ts`
- Always use Zod schemas from `@repo/schemas` - never inline validation
- Example route registration:

```ts
app.route('/', accommodationListRoute);     // Public
app.route('/', createAccommodationRoute);   // Protected
```

### Service Layer Pattern

- All business logic extends `BaseCrudService<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema>`
- Location: `packages/service-core/src/services/{entity}/{entity}.service.ts`
- Constructor pattern: `constructor(ctx: ServiceContext, model?: TModel)`
- Use `runWithLoggingAndValidation()` wrapper for all public methods

### Database Models

- Extend `BaseModel<T>` in `packages/db/src/models/{entity}.model.ts`
- Required: `protected table` and `protected entityName`
- Override `findAll()` for custom search logic (text search with 'q' parameter)

### Schema Organization

- Zod schemas in `packages/schemas/src/{entity}/`
- Types in `packages/types/src/{entity}/`
- Database schemas in `packages/db/src/schemas/{entity}/`

## 🛡️ Essential Conventions

### TypeScript Rules

- **Always use named exports only**
- **RO-RO pattern**: Functions receive/return objects with named properties
- **Strict types**: Declare input/output types for ALL functions
- Use `import type` for type imports
- Prefer `type` over `interface`

### Authentication & Authorization

- Use **Actor system**: `getActorFromContext(c)` in routes
- Permission checks: `actor.role`, `actor.permissions.includes()`
- Routes support `skipAuth: true` option for public endpoints

### Error Handling

- Use `ServiceError` with `ServiceErrorCode` enum
- API responses follow standard format:

```ts
{ success: boolean, data?: T, error?: { code, message } }
```

### Validation

- **Always validate with Zod** - use `zValidator('json', schema)` middleware
- Access validated data: `c.req.valid('json')`
- Schemas must be imported from `@repo/schemas`

## 🔄 Core Patterns

### Creating New Entities

1. Define types in `packages/types/src/{entity}/`
2. Create Zod schemas in `packages/schemas/src/{entity}/`
3. Add database schema in `packages/db/src/schemas/{entity}/`
4. Create model extending `BaseModel` in `packages/db/src/models/`
5. Create service extending `BaseCrudService` in `packages/service-core/src/services/`
6. Create API routes using factory functions in `apps/api/src/routes/`

### Database Operations

- Use transactions for multi-step operations: `db.transaction(async (trx) => {})`
- Soft delete is default: `softDelete()`, `restore()`, `hardDelete()`
- Pagination: `{ page, pageSize }` options in `findAll()`

### Testing

- Use Vitest with mocks in `test/` directories
- Model mocks: `createBaseModelMock<T>()`
- Service tests: `createServiceTestInstance()`
- API tests: Mock actors with `createMockUserActor()`

## 🚀 Key Utilities

### Route Factories

- `createSimpleRoute()`: Basic endpoints (health, info)
- `createCRUDRoute()`: Full CRUD with path params
- `createListRoute()`: Paginated listings

### Package Aliases (Vite/Astro configs)

```ts
'@repo/types': '../../packages/types/src'
'@repo/db': '../../packages/db/src'
'@repo/schemas': '../../packages/schemas/src'
```

### Environment & Config

- Use `@repo/config` for environment variable management
- Shared env mapping between apps via Vite plugins
- Environment files: `.env`, `.env.local` (local takes precedence)

## ⚡ Performance & Caching

- API responses have built-in caching with TTL options
- Rate limiting per route: `customRateLimit: { requests, windowMs }`
- Use `cacheTTL` option for static/slow-changing data
- Database connection pooling handled by Drizzle

Remember: This is a **strongly-typed** codebase. Always leverage the type system and existing patterns rather than creating new approaches.
