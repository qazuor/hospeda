# CLAUDE.md - Service Core Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Service Core package (`@repo/service-core`).

## Overview

Business logic layer providing services for all entities. Services extend `BaseCrudService` and encapsulate business rules, validation, and orchestration between models. Acts as the bridge between API routes and database models.

## Key Commands

```bash
# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code

# Build
pnpm build             # Build for production
pnpm dev               # Development mode (uses tsconfig paths)
```

## Package Structure

```
src/
├── services/          # Entity services
│   ├── accommodation/
│   │   ├── accommodation.service.ts
│   │   ├── accommodation.permissions.ts
│   │   └── index.ts
│   ├── destination/
│   ├── event/
│   ├── post/
│   ├── user/
│   └── index.ts
├── base/              # Base classes (split by concern)
│   ├── base.crud.service.ts      # Main service class, orchestration
│   ├── base.crud.permissions.ts  # Permission hooks (_can* methods)
│   ├── base.crud.read.ts         # Read operations (list, search, adminList, count)
│   ├── base.crud.write.ts        # Write operations (create, update, delete)
│   ├── base.crud.admin.ts        # Admin operations (getAdminInfo, setAdminInfo)
│   └── base.crud.related.ts      # Related entity service base
├── types/             # Service-specific types
│   └── index.ts
├── utils/             # Service utilities
│   ├── validation.ts
│   ├── permission.ts
│   └── service-logger.ts
└── index.ts           # Main exports
```

## BaseCrudService

All services extend `BaseCrudService<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema>`:

```ts
import { BaseCrudService } from '@repo/service-core/base';
import { AccommodationModel } from '@repo/db';
import type { Accommodation } from '@repo/types';
import type {
  CreateAccommodation,
  UpdateAccommodation,
  SearchAccommodation,
} from '@repo/schemas';

export class AccommodationService extends BaseCrudService<
  Accommodation,
  AccommodationModel,
  CreateAccommodation,
  UpdateAccommodation,
  SearchAccommodation
> {
  constructor(ctx: ServiceContext, model?: AccommodationModel) {
    super(ctx, model ?? new AccommodationModel());
  }

  // Add custom business logic methods
}
```

### Service Context

```ts
export interface ServiceContext {
  userId?: string;
  role?: string;
  permissions?: string[];
  requestId?: string;
}
```

## BaseCrudService Methods

### Standard CRUD Operations

```ts
// Create
async create(input: { data: TCreateSchema }): Promise<Result<TEntity>>

// Read
async findById(input: { id: string }): Promise<Result<TEntity>>
async findAll(input: { filters?: TSearchSchema }): Promise<Result<TEntity[]>>

// Update
async update(input: { id: string; data: TUpdateSchema }): Promise<Result<TEntity>>

// Delete
async softDelete(input: { id: string }): Promise<Result<void>>
async hardDelete(input: { id: string }): Promise<Result<void>>
async restore(input: { id: string }): Promise<Result<void>>
```

### Result Type

All methods return a `Result<T>` type:

```ts
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ServiceErrorCode; message: string } };
```

## Using Services

### Basic Usage

```ts
import { AccommodationService } from '@repo/service-core';

const service = new AccommodationService({
  userId: 'user-123',
  role: 'admin',
});

// Create
const result = await service.create({
  data: {
    name: 'Hotel Paradise',
    slug: 'hotel-paradise',
    description: 'A beautiful hotel',
    address: '123 Main St',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    priceRange: '$$',
  },
});

if (result.success) {
  console.log('Created:', result.data);
} else {
  console.error('Error:', result.error.message);
}

// Read
const found = await service.findById({ id: 'uuid-here' });

// Update
const updated = await service.update({
  id: 'uuid-here',
  data: { name: 'Hotel Paradise Updated' },
});

// Delete
await service.softDelete({ id: 'uuid-here' });
```

### With Hono Context

```ts
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';

export const handler = async (c: Context) => {
  // Create service with context from actor
  const service = new AccommodationService(c);

  const result = await service.findAll({
    filters: { city: 'Buenos Aires', isActive: true },
  });

  if (!result.success) {
    return c.json({ error: result.error.message }, 400);
  }

  return c.json({ data: result.data });
};
```

## Custom Service Methods

Add business logic methods beyond basic CRUD:

```ts
export class AccommodationService extends BaseCrudService<...> {
  /**
   * Publish an accommodation (change status from draft to published)
   */
  async publish(input: { id: string }): Promise<Result<Accommodation>> {
    return this.runWithLoggingAndValidation(async () => {
      // Fetch accommodation
      const accommodation = await this.model.findById(input.id);

      if (!accommodation) {
        throw new ServiceError('Accommodation not found', ServiceErrorCode.NOT_FOUND);
      }

      // Business rule: Only draft accommodations can be published
      if (accommodation.status !== 'draft') {
        throw new ServiceError(
          'Only draft accommodations can be published',
          ServiceErrorCode.VALIDATION_ERROR
        );
      }

      // Business rule: Must have minimum required fields
      if (!accommodation.description || accommodation.description.length < 100) {
        throw new ServiceError(
          'Description must be at least 100 characters',
          ServiceErrorCode.VALIDATION_ERROR
        );
      }

      // Update status
      return this.model.update(input.id, { status: 'published' });
    });
  }

  /**
   * Get accommodations by destination with related data
   */
  async findByDestination(input: {
    destinationId: string;
    page?: number;
    pageSize?: number;
  }): Promise<Result<PaginatedResult<Accommodation>>> {
    return this.runWithLoggingAndValidation(async () => {
      const accommodations = await this.model.findAll({
        destinationId: input.destinationId,
        isActive: true,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 10,
      });

      return {
        data: accommodations,
        pagination: {
          page: input.page ?? 1,
          pageSize: input.pageSize ?? 10,
          total: accommodations.length,
          totalPages: Math.ceil(accommodations.length / (input.pageSize ?? 10)),
        },
      };
    });
  }

  /**
   * Calculate average rating for accommodation
   */
  async calculateAverageRating(input: { id: string }): Promise<Result<number>> {
    return this.runWithLoggingAndValidation(async () => {
      const reviews = await this.reviewModel.findAll({
        accommodationId: input.id,
      });

      if (reviews.length === 0) {
        return 0;
      }

      const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
      const average = sum / reviews.length;

      // Update accommodation with new average
      await this.model.update(input.id, { rating: average });

      return average;
    });
  }
}
```

## Error Handling

### Service Errors

```ts
import { ServiceError, ServiceErrorCode } from '@repo/schemas';

throw new ServiceError(
  'Accommodation not found',
  ServiceErrorCode.NOT_FOUND
);

throw new ServiceError(
  'Invalid data provided',
  ServiceErrorCode.VALIDATION_ERROR,
  { field: 'name', message: 'Name is required' }
);
```

### Error Codes

```ts
enum ServiceErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}
```

## Validation

Services automatically validate input using Zod schemas:

```ts
export class AccommodationService extends BaseCrudService<...> {
  async create(input: { data: CreateAccommodation }) {
    // Input is automatically validated against CreateAccommodation schema
    // before method executes

    return this.runWithLoggingAndValidation(async () => {
      // Business logic here
    });
  }
}
```

## Logging

Services automatically log all operations:

```ts
// Logs are automatically created for:
// - Method calls
// - Errors
// - Validation failures
// - Database operations

// Access logger directly
this.logger.info('Custom log message', { data: someData });
this.logger.error('Error occurred', error);
```

## Testing Services

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AccommodationService } from './accommodation.service';
import { createServiceTestInstance } from '@repo/service-core/test-utils';

describe('AccommodationService', () => {
  let service: AccommodationService;

  beforeEach(() => {
    service = createServiceTestInstance(AccommodationService, {
      userId: 'test-user',
      role: 'admin',
    });
  });

  it('should create accommodation', async () => {
    const data = {
      name: 'Test Hotel',
      slug: 'test-hotel',
      description: 'A test hotel',
      address: '123 Main St',
      city: 'Buenos Aires',
      state: 'Buenos Aires',
      priceRange: '$$' as const,
    };

    const result = await service.create({ data });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test Hotel');
    }
  });

  it('should validate required fields', async () => {
    const invalidData = {
      name: '', // Invalid: empty
      // Missing required fields
    };

    const result = await service.create({ data: invalidData as any });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    }
  });

  it('should enforce business rules', async () => {
    // Create draft accommodation
    const created = await service.create({ data: draftData });

    // Try to publish without description
    const published = await service.publish({ id: created.data.id });

    expect(published.success).toBe(false);
  });
});
```

## Authorization & Permission Checks

### 🔥 CRITICAL: Granular Permission Pattern

**ALL permission checks MUST use ONLY granular permissions. NEVER check roles.**

#### Correct Pattern (ALWAYS use this)

```ts
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_CREATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create entity'
        );
    }
}
```

#### Wrong Patterns (NEVER use these)

```ts
// ❌ WRONG - Checks role instead of permissions
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (!actor || !actor.id || actor.role !== RoleEnum.ADMIN) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create entity'
        );
    }
}

// ❌ WRONG - Uses role as bypass with permissions
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        (actor.role !== RoleEnum.ADMIN &&
            !actor.permissions.includes(PermissionEnum.ENTITY_CREATE))
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create entity'
        );
    }
}
```

### Permission Check Rules

1. **ONLY import `PermissionEnum`** - DO NOT import or check `RoleEnum`
2. **ALWAYS check ONLY**: `!actor.permissions.includes(PermissionEnum.XXX)`
3. **NO role bypasses** - Even admins must have the specific permission
4. **Add missing permissions**: If a permission doesn't exist in `permission.enum.ts`, add it

### Standard Permission Mapping

Each service has 12 standard permission hooks that map to permissions:

| Hook | Permission Pattern | Example |
|------|-------------------|---------|
| `_canCreate` | `ENTITY_CREATE` | `ACCOMMODATION_LISTING_CREATE` |
| `_canUpdate` | `ENTITY_UPDATE` | `ACCOMMODATION_LISTING_UPDATE` |
| `_canPatch` | `ENTITY_UPDATE` | `ACCOMMODATION_LISTING_UPDATE` |
| `_canDelete` | `ENTITY_DELETE` | `ACCOMMODATION_LISTING_DELETE` |
| `_canSoftDelete` | `ENTITY_DELETE` | `ACCOMMODATION_LISTING_DELETE` |
| `_canHardDelete` | `ENTITY_HARD_DELETE` | `ACCOMMODATION_LISTING_HARD_DELETE` |
| `_canRestore` | `ENTITY_RESTORE` | `ACCOMMODATION_LISTING_RESTORE` |
| `_canView` | `ENTITY_VIEW` | `ACCOMMODATION_LISTING_VIEW` |
| `_canList` | `ENTITY_VIEW` | `ACCOMMODATION_LISTING_VIEW` |
| `_canSearch` | `ENTITY_VIEW` | `ACCOMMODATION_LISTING_VIEW` |
| `_canCount` | `ENTITY_VIEW` | `ACCOMMODATION_LISTING_VIEW` |
| `_canAdminList` | `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN` + entity-specific | `ACCOMMODATION_VIEW_ALL` |

### Admin-Specific Permission Hooks

`_canAdminList()` is the ONLY concrete (non-abstract) permission hook in the hierarchy. It provides defense-in-depth for admin list operations:

- **Default behavior**: Checks `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN`, then delegates to `_canList()` for entity-specific checks
- **Override pattern**: Services override `_canAdminList()` to add entity-specific admin permission (e.g., `ACCOMMODATION_VIEW_ALL`)
- **Override MUST call super**: `await super._canAdminList(actor)` must be called first to preserve the admin access check
- **Always use async/await**: Override signature must be `protected async _canAdminList(actor: Actor): Promise<void>` with `await` on super call

### Permission Error Message Convention

All permission error messages must follow these standardized patterns:

| Context | Pattern | Example |
|---------|---------|---------|
| Base admin access checks | `"Admin access required for [operation]"` | `"Admin access required for admin list operations"` |
| Entity-specific permission (after admin) | `"Permission denied: [PERMISSION_ENUM] required for [operation]"` | `"Permission denied: ACCOMMODATION_VIEW_ALL required for admin list"` |
| Standard CRUD checks | `"Permission denied: Insufficient permissions to [verb] [entity]"` | `"Permission denied: Insufficient permissions to create accommodation"` |

### Known Limitations

- **No `@MustCallSuper` enforcement**: TypeScript has no mechanism to enforce that overrides call `super._canAdminList()`. Mitigation: every service with a `_canAdminList` override MUST have a call-order test verifying `super._canAdminList` is called before entity-specific checks. See `accommodation.adminListPermission.test.ts` for the reference pattern.

### Complete Permission File Template

```ts
import type { EntityName } from '@repo/schemas';
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../../types';
import { ServiceError } from '../../types';

/**
 * Checks if an actor has permission to create entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCreate(actor: Actor, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_CREATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to create entities'
        );
    }
}

/**
 * Checks if an actor has permission to update entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanUpdate(actor: Actor, _entity: EntityName): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to update entities'
        );
    }
}

/**
 * Checks if an actor has permission to patch entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanPatch(actor: Actor, _entity: EntityName, _data: unknown): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_UPDATE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to patch entities'
        );
    }
}

/**
 * Checks if an actor has permission to delete entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanDelete(actor: Actor, _entity: EntityName): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to delete entities'
        );
    }
}

/**
 * Checks if an actor has permission to hard delete entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanHardDelete(actor: Actor, _entity: EntityName): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_HARD_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to permanently delete entities'
        );
    }
}

/**
 * Checks if an actor has permission to restore entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanRestore(actor: Actor, _entity: EntityName): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_RESTORE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to restore entities'
        );
    }
}

/**
 * Checks if an actor has permission to view entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanView(actor: Actor, _entity: EntityName): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to view entities'
        );
    }
}

/**
 * Checks if an actor has permission to list entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanList(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to list entities'
        );
    }
}

/**
 * Checks if an actor has permission to soft delete entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSoftDelete(actor: Actor, _entity: EntityName): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_DELETE)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to soft delete entities'
        );
    }
}

/**
 * Checks if an actor has permission to search entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanSearch(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to search entities'
        );
    }
}

/**
 * Checks if an actor has permission to count entities.
 * @throws {ServiceError} If the permission check fails.
 */
export function checkCanCount(actor: Actor): void {
    if (
        !actor ||
        !actor.id ||
        !actor.permissions.includes(PermissionEnum.ENTITY_VIEW)
    ) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Permission denied: Insufficient permissions to count entities'
        );
    }
}
```

### Adding Missing Permissions

If permissions don't exist in `packages/schemas/src/enums/permission.enum.ts`:

1. Add category to `PermissionCategoryEnum`:

```ts
export enum PermissionCategoryEnum {
    // ... existing categories
    ENTITY_NAME = 'ENTITY_NAME',
}
```

2. Add permissions to `PermissionEnum`:

```ts
export enum PermissionEnum {
    // ... existing permissions

    // ENTITY_NAME: Permissions related to entity management
    ENTITY_NAME_CREATE = 'entityName.create',
    ENTITY_NAME_UPDATE = 'entityName.update',
    ENTITY_NAME_DELETE = 'entityName.delete',
    ENTITY_NAME_VIEW = 'entityName.view',
    ENTITY_NAME_RESTORE = 'entityName.restore',
    ENTITY_NAME_HARD_DELETE = 'entityName.hardDelete',
    ENTITY_NAME_SOFT_DELETE_VIEW = 'entityName.softDelete.view',
    ENTITY_NAME_STATUS_MANAGE = 'entityName.status.manage', // Optional, for status management
}
```

## Destination Hierarchy

`DestinationService` provides hierarchy traversal, path-based lookups, and automatic hierarchy field computation.

### Hierarchy Methods

```ts
const service = new DestinationService(ctx);

// Direct children
await service.getChildren(actor, { destinationId });

// All descendants with optional filters
await service.getDescendants(actor, { destinationId, maxDepth: 2, destinationType: 'CITY' });

// Ancestors ordered root-to-parent
await service.getAncestors(actor, { destinationId });

// Breadcrumb for navigation UI
await service.getBreadcrumb(actor, { destinationId });

// Resolve destination by materialized path
await service.getByPath(actor, { path: '/argentina/litoral/entre-rios' });
```

### Hierarchy Hooks

- `_beforeCreate`: Auto-computes `slug`, `path`, `pathIds`, `level` from parent. Validates parent-child type relationship.
- `_beforeUpdate`: Detects cycles via `isDescendant`, cascades path updates to all descendants on reparenting.

### Helper Functions (in `destination.hierarchy.helpers.ts`)

| Function | Purpose |
|----------|---------|
| `validateDestinationTypeLevel` | Validates type is valid for the level |
| `getExpectedParentType` | Returns expected parent type for a given type |
| `computeHierarchyPath` | Builds path: `parent.path + '/' + slug` |
| `computeHierarchyPathIds` | Builds ancestor UUID chain |
| `computeHierarchyLevel` | Calculates `parentLevel + 1` |
| `isValidParentChildRelation` | Validates parent-child type pairing |

## Service Composition

Services can use other services:

```ts
export class AccommodationService extends BaseCrudService<...> {
  private reviewService: ReviewService;
  private destinationService: DestinationService;

  constructor(ctx: ServiceContext, model?: AccommodationModel) {
    super(ctx, model ?? new AccommodationModel());

    // Inject other services
    this.reviewService = new ReviewService(ctx);
    this.destinationService = new DestinationService(ctx);
  }

  async getAccommodationWithDetails(input: { id: string }) {
    return this.runWithLoggingAndValidation(async () => {
      const accommodation = await this.findById(input);

      if (!accommodation.success) {
        return accommodation;
      }

      // Get related data from other services
      const reviews = await this.reviewService.findAll({
        filters: { accommodationId: input.id },
      });

      const destination = await this.destinationService.findById({
        id: accommodation.data.destinationId,
      });

      return {
        ...accommodation.data,
        reviews: reviews.data,
        destination: destination.data,
      };
    });
  }
}
```

## Best Practices

1. **Always use services** - never call models directly from routes
2. **Return Result type** - for consistent error handling
3. **Validate at service layer** - use Zod schemas
4. **Enforce business rules** - in service methods
5. **Use `runWithLoggingAndValidation()`** - for automatic logging
6. **Check permissions** - based on service context
7. **Keep services focused** - one service per entity
8. **Test all methods** - including error cases
9. **Document complex logic** - use JSDoc
10. **Use composition** - inject other services as needed

## Key Dependencies

- `@repo/db` - Database models
- `@repo/schemas` - Zod validation schemas
- `@repo/types` - TypeScript types
- `@repo/logger` - Logging
- `@repo/utils` - Utility functions

## Transaction Support (SPEC-059)

This package provides first-class transaction support via `withServiceTransaction` and a `ctx.tx` propagation contract that flows through every base and custom service method.

### Passing `ctx` to service methods

Every base CRUD method accepts an optional trailing `ctx?: ServiceContext`:

- Read: `getById`, `list`, `search`, `count`, `getByField`, `adminSearch`
- Write: `create`, `update`, `softDelete`, `hardDelete`, `restore`, `updateVisibility`, `setFeaturedStatus`
- Admin: `getAdminInfo`, `setAdminInfo`

Custom service methods follow the same convention — `ctx?` is always the LAST parameter so existing callers keep working.

```ts
// Without transaction
await accommodationService.create(input, actor);

// Enlisted in a caller-provided transaction
await accommodationService.create(input, actor, ctx);
```

When a method receives `ctx`, it threads `ctx?.tx` to every underlying model call (`model.create`, `model.findById`, `model.update`, etc), so the database work participates in the caller's boundary.

### `withServiceTransaction`

```ts
import { withServiceTransaction } from '@repo/service-core';

await withServiceTransaction(async (ctx) => {
    await accommodationService.update({ id, data }, actor, ctx);
    await reviewService.listByAccommodation({ accommodationId: id }, actor, ctx);
}, undefined, { timeoutMs: 5000 });
```

- `ctx.tx` is **always defined** inside the callback. Callers that need the raw Drizzle transaction use `ctx.tx!` with a `// biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction` comment.
- The `timeoutMs` option is applied as a `SET LOCAL statement_timeout` pragma at the start of the transaction. Default: `30000` ms.
- External API calls (QZPay, MercadoPago, third-party HTTP) MUST stay OUTSIDE the callback — they are not rollback-able. The established pattern is: external call first, then `withServiceTransaction` to persist the results.

**Nested behavior**: calling `withServiceTransaction` inside another `withServiceTransaction` creates a NEW, independent boundary (no savepoint join). Rolling back the inner call does not roll back the outer one, and vice versa. If you need true nested atomicity, refactor to a single top-level transaction that performs all the work.

### `hookState` pattern for inter-hook communication

Services that need to pass state between `_before*` and `_after*` hooks must use `ctx.hookState` (a `Record<string, unknown>` scoped to a single service invocation), NOT private instance fields. Instance fields are shared across concurrent requests on the same service instance — they are not concurrency-safe.

Each service defines a typed hook-state interface extending `Record<string, unknown>`:

```ts
// event.types.ts
export interface EventHookState extends Record<string, unknown> {
    lastRestoredEvent?: Event;
    lastDeletedEvent?: Event;
}
```

Hooks typed as `ServiceContext<EventHookState>` get typed access:

```ts
protected async _beforeRestore(
    input: { id: string },
    actor: Actor,
    ctx: ServiceContext<EventHookState>
): Promise<void> {
    const current = await this.model.findById(input.id, ctx?.tx);
    ctx.hookState.lastRestoredEvent = current ?? undefined;
}

protected async _afterRestore(
    _input: { id: string },
    _actor: Actor,
    ctx: ServiceContext<EventHookState>
): Promise<void> {
    const restored = ctx.hookState.lastRestoredEvent;
    if (restored) { /* emit event, update counters, etc. */ }
}
```

When `ctx` is provided without `hookState`, the base runner initializes it as `{}`, so hooks that read a key they didn't set just see `undefined` — no crash.

### `_executeAdminSearch` `ctx` forwarding

`BaseCrudRead._executeAdminSearch` destructures `ctx` from its `params` argument and forwards `ctx?.tx` to the underlying `model.findAllWithRelations` / `model.findAll` calls. If you override `_executeAdminSearch` in a concrete service, you must do the same:

```ts
protected async _executeAdminSearch(params: {
    where: ...;
    pagination: ...;
    ctx?: ServiceContext;
}) {
    const { where, pagination, ctx } = params;
    return this.model.findAll(where, pagination, undefined, ctx?.tx);
}
```

See `packages/service-core/src/base/base.crud.read.ts` for the reference implementation.

### Known limitations

- **No savepoints**: nested `withServiceTransaction` does not issue `SAVEPOINT` statements; it opens an independent boundary. Work around this by flattening to a single top-level transaction.
- **External API rollback is impossible**: if a remote API succeeds and a subsequent local write fails, the remote side is not reversed by the local rollback. Sequence external calls before the transaction and compensate explicitly if needed.
- **Raw `DrizzleClient` parameters are deprecated**: legacy internal methods that accept a bare `DrizzleClient` have been migrated to `ctx?: ServiceContext`. New code should not introduce `DrizzleClient` parameters; use `ctx` instead.
- **Driver coupling**: `withServiceTransaction` delegates to `@repo/db`'s `withTransaction`. Swapping drivers requires revisiting this layer.

## Notes

- Services are stateless - create new instances per request
- Context should include user information for authorization
- Services are the single source of truth for business logic
- All database access goes through services, not directly to models

## Related Documentation

- [Adding Services Guide](../../docs/guides/adding-services.md)
- [Error Handling Guide](../../docs/guides/error-handling.md)
- [Architecture Patterns](../../docs/architecture/patterns.md)

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>
