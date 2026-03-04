# Architecture Patterns (Quick Reference)

> Concise rules for AI agents. Full details: [docs/architecture/patterns.md](../../docs/architecture/patterns.md)

## Core Patterns

### RO-RO (Receive Object, Return Object)

- ALL functions receive a single object parameter
- ALL functions return an object (not primitives)
- Benefits: self-documenting, extensible, refactor-safe

### Result Type

- Services return `Result<T>`: `{ success: true, data: T } | { success: false, error: string }`
- Callers must check `result.success` before accessing `result.data`
- Never throw exceptions for expected business errors

### BaseCrudService

- All services extend `BaseCrudService` from `@repo/service-core`
- Provides: `findAll`, `findById`, `create`, `update`, `delete`
- Override methods for custom logic
- Uses `runWithLoggingAndValidation()` for automatic logging
- Permission checks use `PermissionEnum` only

### ResponseFactory

- All API responses use `ResponseFactory` from `apps/api`
- Consistent JSON format across all endpoints
- Maps `Result<T>` to HTTP status codes

## Data Layer

### Drizzle ORM

- All DB access through models extending `BaseModel`
- Soft delete by default (`deletedAt` timestamp)
- Transactions for multi-step operations
- Initialize once at startup with `initializeDb()`

### Schemas Package

- `@repo/schemas` is the single source of truth for ALL entity types
- Zod schemas define both validation and TypeScript types
- Never define standalone interfaces for entities

## Web Architecture

### Islands Architecture (Astro)

- Astro components by default (zero JS shipped)
- React islands only for interactive elements
- Hydration directives: `client:visible` (default), `client:load`, `client:idle`

### Three-Tier API

- Public: no auth, read-only, for web visitors
- Protected: session required, for authenticated users
- Admin: admin session + permission checks

## Package Structure

- `@repo/schemas` -> types and validation (no logic)
- `@repo/db` -> database models and queries
- `@repo/service-core` -> business logic services
- `apps/api` -> thin route handlers (delegate to services)
- `apps/web` -> Astro pages + React islands
- `apps/admin` -> TanStack Start dashboard

## Key ADRs

- [ADR-001: Astro over Next.js](../../docs/decisions/ADR-001-astro-over-nextjs.md)
- [ADR-003: Hono over Express](../../docs/decisions/ADR-003-hono-over-express.md)
- [ADR-004: Drizzle over Prisma](../../docs/decisions/ADR-004-drizzle-over-prisma.md)
