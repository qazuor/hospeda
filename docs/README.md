# Hospeda Documentation

Welcome to the comprehensive documentation for the Hospeda tourism accommodation platform.

## 📚 Documentation Structure

### For Developers
- [`/development/`](./development/) - Guides for adding new services, understanding architecture, and contributing
- [`/architecture/`](./architecture/) - System architecture, patterns, and design decisions
- [`/deployment/`](./deployment/) - Deployment guides, environment setup, and production considerations

### For API Consumers
- [`/api/`](./api/) - Complete API documentation, service catalogs, and integration guides

## 🏗️ Project Overview

Hospeda is a **TurboRepo monorepo** for a tourism accommodation platform using:
- **Apps**: `api/` (Hono), `web/` (Astro+React), `admin/` (TanStack Start)
- **Packages**: Shared libraries with `@repo/*` namespace (`db`, `schemas`, `types`, `service-core`, etc.)
- **Database**: PostgreSQL + Drizzle ORM with type-safe schemas
- **Auth**: Clerk integration with Actor-based permissions

## 🚀 Quick Start

### Development Setup
```bash
# Install dependencies
pnpm install

# Start everything in dev mode
pnpm dev

# Target specific apps
pnpm dev --filter=api
pnpm dev --filter=web
```

### Database Operations
```bash
pnpm db:fresh        # Reset DB with migrations + seed
pnpm db:studio       # Open Drizzle Studio
pnpm db:migrate      # Apply migrations
```

### Build & Test
```bash
pnpm build           # Build all packages
pnpm test            # Run all tests
pnpm check           # Biome format + lint
```

## 📖 Key Documentation

### New Developer Onboarding
1. [Architecture Overview](./architecture/README.md) - Understand the system design
2. [Adding a New Service](./development/adding-services.md) - Step-by-step guide
3. [Development Patterns](./development/patterns.md) - Code patterns and conventions
4. [Testing Guide](./development/testing.md) - Testing strategies and best practices

### API Integration
1. [Service Catalog](./api/service-catalog.md) - All available services and methods
2. [Authentication](./api/authentication.md) - Actor system and permissions
3. [API Patterns](./api/patterns.md) - Standard request/response patterns
4. [Error Handling](./api/error-handling.md) - Error codes and handling

### Architecture Deep Dives
1. [Service Layer](./architecture/service-layer.md) - Business logic organization
2. [Database Design](./architecture/database.md) - Schema patterns and migrations
3. [Type System](./architecture/types.md) - TypeScript patterns and schemas
4. [Testing Architecture](./architecture/testing.md) - Test patterns and factories

## 🔧 Development Workflow

### Creating New Entities
1. Define types in `packages/types/src/{entity}/`
2. Create Zod schemas in `packages/schemas/src/{entity}/`
3. Add database schema in `packages/db/src/schemas/{entity}/`
4. Create model extending `BaseModel` in `packages/db/src/models/`
5. Create service extending `BaseCrudService` in `packages/service-core/src/services/`
6. Create API routes using factory functions in `apps/api/src/routes/`

### Key Conventions
- **Always use named exports only**
- **RO-RO pattern**: Functions receive/return objects with named properties
- **Strict types**: Declare input/output types for ALL functions
- **Always validate with Zod** - use `zValidator('json', schema)` middleware

## 📞 Support

- **Development Questions**: Check `/development/` guides
- **API Issues**: Reference `/api/` documentation
- **Architecture Decisions**: See `/architecture/` deep dives
- **Deployment Issues**: Check `/deployment/` guides

---

*This documentation is maintained alongside the codebase. Please keep it updated when making changes.*