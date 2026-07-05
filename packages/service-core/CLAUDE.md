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

## Integration Tests (SPEC-080)

Integration tests verify that `getById()` for the SPEC-066 affected services
(AccommodationService, PostService, EventService, AccommodationReviewService,
DestinationReviewService, UserBookmarkService, OwnerPromotionService,
SponsorshipService, SponsorshipPackageService, PostSponsorshipService) returns
populated relation objects when connected to a real PostgreSQL database. This
catches Drizzle schema misconfigurations that mocked unit tests cannot detect:
missing `relations()` definitions, wrong `validRelationKeys`, incorrect
`getTableName()` keys, and nested-relation resolution bugs (the GAP-028 case).

### Prerequisites

- Docker running with PostgreSQL: `pnpm db:start`
- `HOSPEDA_TEST_DATABASE_URL` available; it defaults to the same credentials
  used by SPEC-061 in CI. The suite has its own global-setup that creates an
  ephemeral `hospeda_service_integration_test` DB and drops it on teardown,
  so it does not collide with SPEC-061's `hospeda_integration_test`.

### Commands

```bash
pnpm test:integration          # run service-core integration tests
pnpm test:integration:watch    # watch mode
```

From the repo root, `pnpm test:integration` runs the entire integration
matrix via turbo, including this package and `@repo/db` (SPEC-061).

### How It Works

1. `test/integration/services/global-setup.ts` provisions the ephemeral
   database, pushes the Drizzle schema via `drizzle-kit`, and applies
   `apply-postgres-extras.sh` for triggers and materialized views.
2. `helpers.ts` exposes `getServiceTestDb()`, `withServiceTestTransaction()`,
   and per-entity seed helpers (`seedAccommodation`, `seedPost`,
   `seedEvent`, `seedAccommodationReview`, `seedDestinationReview`,
   `seedOwnerPromotion`, `seedSponsorshipPackage`, `seedSponsorship`,
   `seedPostSponsorship`, `seedUserBookmark`).
3. Each test seeds the required FK chain inside a transaction, calls
   `service.getById(actor, id, ctx)` against the real DB, asserts both the
   FK columns and the populated relation objects, and lets the transaction
   roll back on completion. Pool teardown happens in `afterAll`.

### Assertions and Service Contracts

- `service.getById` THROWS `ServiceError` (code `NOT_FOUND`) when the entity
  is missing — it does NOT return a `{ data: null, error }` shape. NOT_FOUND
  tests must use `await expect(...).rejects.toThrow(/not found/i)`.
- The relations actually loaded are whatever each service returns from its
  `getDefaultListRelations()` override. SPEC-080 documents the expected set
  per service, but the test suite asserts the actual set in code. Surfacing
  a mismatch (e.g., EventService currently loads only `{ organizer, location }`
  even though it conceptually has `author` and `tags`) is by design.

### Skip Behavior

When `HOSPEDA_TEST_DATABASE_URL` is not set, every test is skipped via
`it.skipIf(!isServiceTestDbAvailable())`. The exit code stays 0 so local
dev workflows are not broken when Docker is down.

### Schema Discoveries Worth Knowing

- `post_sponsorships.sponsor` is a `post_sponsors` brand entity with name,
  type, description, logo, and contact info — NOT a User. PostService
  resolves `data.sponsorship.sponsor` to that brand record.
- `EventService.getDefaultListRelations()` returns `{ author, organizer, location }`.
  `tags` is intentionally excluded because `r_entity_tag` is polymorphic
  (entityType + entityId composite reference) and Drizzle's relational query
  API cannot resolve polymorphic relations natively. Callers that need event
  tags must load them via a separate query.

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

## User Bookmark & Collection Services (SPEC-098)

Two services handle the Favorites/Wishlists feature:

- **`UserBookmarkService`**: manages individual bookmarks (favorites). Enforces plan-based quota via `enforceFavoritesLimit` middleware. Supports polymorphic `entityType` (ACCOMMODATION, DESTINATION, EVENT, POST, ATTRACTION).
- **`UserBookmarkCollectionService`**: manages user-created collections (wishlists). Enforces a per-user creation cap via `_canCreate` (default 10, configurable via `HOSPEDA_MAX_COLLECTIONS_PER_USER`). Returns `QUOTA_EXCEEDED` with `{ currentCount, maxAllowed }` details when the cap is reached.

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

## Promo Code Effect Engine (SPEC-262)

The engine is fully DB-backed. All effect state lives in extras-carril columns
(added via `pnpm db:apply-extras`); no config-file-only effects remain.

### Effect kinds

Three discriminated kinds, controlled by `billing_promo_codes.effect_kind` (varchar, `'discount' | 'trial_extension' | 'comp'`):

| Kind | Parameters | What it does |
|---|---|---|
| `discount` | `value_kind` (`'percentage'`\|`'fixed'`), `value` (int), `duration_cycles` (int\|null) | Reduces the charge amount for N billing cycles, or forever when `duration_cycles = NULL`. |
| `trial_extension` | `extra_days` (int) | Adds N days to the subscription trial period at signup or via `extendExistingSubscriptionTrial`. |
| `comp` | — | Permanently comps the subscription; no MercadoPago preapproval is ever created. |

### Seam files (relative to `packages/service-core/src/services/billing/promo-code/`)

| File | Responsibility |
|---|---|
| `effect-reducer.ts` | Pure function `calculatePromoCodeEffect` — all monetary math, no DB access. Single source of truth for discount amounts and remaining-cycle computation. |
| `promo-code.validation.ts` | Best-effort validation (`validatePromoCode`) — business-rule checks (expiry, maxUses, plan restrictions, minAmount). NOT race-safe; use for UI preview only. |
| `promo-code.redemption.ts` | Atomic redemption (`tryRedeemAtomically` — SELECT FOR UPDATE), usage recording (`redeemAndRecordUsage`), and `applyPromoCode` (dispatches per effect kind). |
| `promo-code.renewal.ts` | Multi-cycle discount renewal (`resolveRenewalPromoEffect`) — called on each `subscription_authorized_payment.created` webhook; decrements `promo_effect_remaining_cycles` and returns a typed `RenewalPromoDecision`. |
| `promo-code.trial-extension.ts` | `extendExistingSubscriptionTrial` — applies a `trial_extension` promo to an already-active subscription (pushes `trial_end` on the DB row; MP date reconciliation is done by the caller). |
| `promo-code.crud.ts` | CRUD operations and mapping of extras-carril columns to the typed `PromoEffect` discriminated union. |
| `promo-code.service.ts` | Facade — re-exports all public functions and types so consumers import from a single entry point. |

### Checkout-side resolution

`apps/api/src/services/subscription-checkout-promo.service.ts` exports `resolveCheckoutPromoPlan`, which maps a raw code string to the `CheckoutPromoPlan` discriminated union:

```
{ kind: 'none' }        — no code supplied
{ kind: 'trial' }       — trial_extension → freeTrialDays forwarded to qzpay
{ kind: 'discount' }    — discount → discounted amount + cycle-counter seed inputs
{ kind: 'comp' }        — comp → createCompSubscription (no MP preapproval)
{ kind: 'invalid' }     — validation failed (caller maps to INVALID_PROMO_CODE)
```

### Comp subscription: why no MercadoPago preapproval

A `comp` promo code causes `apps/api/src/services/subscription-comp-create.service.ts` to insert a `billing_subscriptions` row with `status = 'comp'` (the `SubscriptionStatusEnum.COMP` value) directly in DB, skipping qzpay entirely. Key consequences:

- `mp_subscription_id` is NULL — no preapproval is created or charged.
- The dunning cron excludes `status='comp'` rows.
- `loadEntitlements` treats `comp` as an active accommodation subscription, so full plan entitlements are retained.
- The insert, promo stamp, and redemption record are wrapped in one transaction for atomicity.

### Multi-cycle discount: how the renewal counter works

The extras-carril column `billing_subscriptions.promo_effect_remaining_cycles` (integer, nullable) is the cycle countdown:

- `NULL` — forever discount (`duration_cycles = NULL` on the promo code); counter never decremented.
- `N > 0` — N more discounted cycles remain.
- `0` — discount exhausted; full price is already in effect for the next cycle.

The counter is seeded at apply time and decremented exactly once per confirmed charge on the `subscription_authorized_payment.created` webhook path (via `resolveRenewalPromoEffect`). When decrement reaches 0, `resolveRenewalPromoEffect` returns action `restore-full` and the API layer calls `paymentAdapter.subscriptions.update(mpSubscriptionId, { transactionAmount: fullMajor })` to restore the preapproval amount. The full plan price (from `billing_prices.unit_amount` in centavos) is the source of truth — never a value read back from MercadoPago.

### MP preapproval mutation spike

The feasibility of mutating a live MercadoPago preapproval's `auto_recurring.transaction_amount` (required for the multi-cycle discount mechanism) was verified in:

`packages/service-core/src/services/billing/promo-code/docs/mp-preapproval-mutation-spike.md`

**Outcome A — GO.** The mutation is confirmed viable: Hospeda already performs this exact `PUT /preapproval/{id}` call in production (plan upgrade/downgrade cron). One staging verification remains (that restoring to the original authorized amount never requires payer re-authorization), but the mechanism is proven.

### DB migration files

`effect_kind`, `value_kind`, `duration_cycles`, `extra_days` (`billing_promo_codes`) and
`promo_effect_remaining_cycles` (`billing_subscriptions`) are typed Drizzle columns as of
`@qazuor/qzpay-drizzle` 1.11.0 (HOS-73) — added via the normal Carril 1 migration
(`packages/db/src/migrations/0044_adorable_longshot.sql`), not the extras carril. The old
extras files (`016`-`019`) that originally added these columns before they were
promoted upstream have been removed. HOS-75 replaced the remaining raw-SQL reads/writes
of these columns across the billing services/routes/crons with typed Drizzle queries.

| File | What it adds |
|---|---|
| `packages/db/src/migrations/extras/020-promo-code-effect-constraints-backfill.sql` | CHECK constraints + backfill of existing rows to the correct `effect_kind` (still extras — Drizzle can't declare CHECK constraints) |

Apply with `pnpm db:apply-extras` (or `hops db-migrate --target=staging|prod`). Never use `drizzle-kit push` against staging/prod.

## Review Moderation (SPEC-166)

Review moderation adds a `moderationState` (`PENDING | APPROVED | REJECTED`) to
`accommodation_reviews` and `destination_reviews`, independent from `lifecycleState`.

### Key exports from `services/moderation/`

```ts
import {
  resolveInitialModerationState,
  MODERATION_PENDING_THRESHOLD,
  ModerationAggregationService,
} from '@repo/service-core';
```

| Export | Purpose |
|--------|---------|
| `resolveInitialModerationState(input)` | Computes initial `moderationState` from entity type, verification level, and content-mod score. |
| `MODERATION_PENDING_THRESHOLD` | `0.5` — score at or above this forces `PENDING`. |
| `ModerationAggregationService` | Cross-entity pending-count aggregation (accommodations, destinations, posts, events). |

### Review service methods added in SPEC-166

Both `AccommodationReviewService` and `DestinationReviewService` expose:

| Method | Permission gate | Description |
|--------|----------------|-------------|
| `moderateReview({ id, decision, reason, actor })` | `ACCOMMODATION_REVIEW_MODERATE` / `DESTINATION_REVIEW_MODERATE` | Sets `moderationState` to `APPROVED` or `REJECTED`. Does NOT touch `lifecycleState`. |
| `getPendingCount({ actor })` | Same as above | Count of PENDING reviews (non-deleted only). |

### Public-visibility filter

All public read paths (`_executeSearch`, `_executeCount`, `listByAccommodation`,
`listWithUser`) force-override both filters:

```
lifecycleState = 'ACTIVE'  AND  moderationState = 'APPROVED'
```

This is applied AFTER the caller's filters so no HTTP query param can override it.
Admin list paths do NOT apply this override — admins need to query all states.

Full reference: [docs/guides/review-moderation.md](../../docs/guides/review-moderation.md)

## Social Automation: Hashtag Limits, Operational Settings, Credential Vault (HOS-64)

Three independent goals from the HOS-64 spec, all under the social automation pipeline.

### G-1 — Hashtag-limit enforcement

`packages/service-core/src/services/social/social-hashtag-limit.util.ts` exports a pure
function that takes a platform→hashtag-count map and a platform→max-allowed map and returns
either `{ ok: true }` or a structured validation error naming every platform that exceeded
its limit. `social-draft-ingestion.service.ts` calls it during GPT draft ingestion, reading
the per-platform `max_hashtags_instagram/facebook/x` values from `social_settings` (raw
no-actor-context model read, same pattern as `apps/api/src/routes/ai/social/catalog.ts`).
`apps/api/src/routes/ai/social/drafts.ts` maps a `VALIDATION_ERROR` result to HTTP 400 with
the offending platform(s), max allowed, and actual count in the response body.

### G-2 — Operational settings + settings-driven cron cadence

5 new keys in `social_settings` (seeded once, admin-editable thereafter via the existing
`SOCIAL_SETTINGS_MANAGE`-gated settings routes):

| Key | Consumed by | Replaces |
|---|---|---|
| `max_retry_count` | `social-publish-dispatch.service.ts` | hard-coded `MAX_RETRY_COUNT = 3` |
| `make_webhook_timeout_ms` | `social-publish-dispatch.service.ts` | hard-coded `MAKE_WEBHOOK_TIMEOUT_MS = 40_000` |
| `download_timeout_ms` / `assets_folder` | media download step of the dispatch pipeline | equivalent hard-coded literals |
| `dispatch_cron_cadence` | `apps/api/src/cron/jobs/social-publish-dispatch.job.ts` | hard-coded `'*/5 * * * *'` schedule literal |

`dispatch_cron_cadence` is read at job registration/startup via a helper that validates it as
a syntactically valid 5-field cron expression, falling back to the original `*/5 * * * *`
literal when the setting is missing or invalid — the dispatch cron can never fail to register
because of a bad admin-entered value.

### G-4 — Social Credentials Vault

Mirrors the AI Credential Vault (SPEC-173) pattern exactly, one vault per domain (separate
blast radius, separate master key — never share `HOSPEDA_AI_VAULT_MASTER_KEY` and
`HOSPEDA_SOCIAL_VAULT_MASTER_KEY`).

- **Shared crypto util**: `apps/api/src/utils/secret-vault-crypto.ts` holds
  `encryptSecret`/`decryptSecret` (AES-256-GCM), extracted verbatim from the AI vault's
  `ai-vault.ts` and parameterized by the master-key *value* (not hardcoded to one env var),
  so both `ai-vault.ts` and `social-vault.ts` are now thin wrappers pinning their own env var.
- **Tables**: `social_credentials` (one active row per key, soft-delete via `deletedAt`) and
  `social_credential_audit` (append-only — no `deletedAt`, no `updatedAt`; every create /
  rotate / update / delete writes exactly one row, in the same DB transaction as the
  mutation). Schema: `packages/db/src/schemas/social/social_credentials.dbschema.ts` and
  `social_credential_audit.dbschema.ts`.
- **The 4 secrets it owns**: `make_webhook_url`, `make_api_key`, `ai_social_key`,
  `operator_pin` — previously plaintext `social_settings` rows / `HOSPEDA_*` env vars, now
  vault-only reads via `getDecryptedSocialCredential({ key })` (server-side callers only,
  never exposed over HTTP) and masked listing via `listSocialCredentials()` (`id/key/label/
  createdAt/updatedAt/deletedAt` — never `ciphertext`/`iv`/`authTag`).
- **Service**: `apps/api/src/services/social-credential-vault.service.ts` — plain module
  (does NOT extend `BaseCrudService`), same design rationale as the AI vault: mutations take
  a plain `actorId` string rather than a full `Actor` object, keeping it decoupled from this
  package's `Actor` type since the vault route layer is the only caller.
- **Admin routes**: `apps/api/src/routes/social/admin/credentials/*` (list/create/rotate/
  update/delete), gated by `SOCIAL_SETTINGS_MANAGE` (reused, not a dedicated permission — same
  precedent as the AI vault reusing `AI_SETTINGS_MANAGE`).

## Social Automation: Per-Target Media & Multi-Format Publishing (HOS-65)

Extends the HOS-64 pipeline so one `social_posts` row can fan out to N targets, each
with its OWN media and format, published to new platforms (LinkedIn, TikTok).

### Per-target media via a link table (not a column)

Media associates to a target through `social_post_target_media` — a many-to-many link
table (`socialPostTargetId` × `socialPostMediaId` + `position`), NOT a nullable FK column
on `social_post_media`. A link table was chosen over a column so ONE asset can be shared
by multiple targets (e.g. the same video on both a LinkedIn and a TikTok target) without
duplicating the `social_post_media` row (see `.specs/HOS-65-publishing-engine-extension/spec.md`
§7/§11). `social_post_media` still keeps its `socialPostId` — the post owns the media pool,
the link table adds per-target scoping on top. Model: `SocialPostTargetMediaModel`
(`packages/db/src/models/social/social-post-target-media.model.ts`).

- **Write path**: `SocialImagePipelineService.processImage`/`processImages`/`processVideo`
  create the `social_post_media` row as before AND, when a `socialPostTargetId` is passed,
  a `social_post_target_media` link row at the same `position` (private `createMediaLinks()`
  helper). `SocialDraftIngestionService` drives this per-target: for each valid target it
  calls `resolveTargetAssets` (own `assets` array, else legacy root `image` fallback, else
  `[]` for TEXT_POST/NONE) then dispatches each asset with that target's id.
- **Read path** (`social-publish-dispatch.service.ts::buildMakePayload`): resolves media
  per target via a 3-level join (link row → `social_post_media` → `social_assets`, ordered by
  the link table's `position`), then `resolveTargetMediaUrls(publishFormat, targetMediaRows,
  postMediaRowsFallback)` applies the per-format selection: TEXT_POST→0, STORY/IMAGE_POST→1,
  VIDEO_POST/REEL→1 video, CAROUSEL/FEED_POST/PHOTO_POST→N. All 8 `SocialPublishFormatEnum`
  values have an explicit rule — a selector scoped to only the 4 spec-named formats would
  silently zero out media for real FEED_POST/PHOTO_POST targets.

### Backfill + fallback for pre-existing posts

`packages/db/src/migrations/extras/027-social-post-target-media-backfill.data-migration.sql`
(idempotent, `pnpm db:apply-extras`) fans out every existing `social_post_media` row into one
link row per target of that media's post, preserving `position`. For posts that have ZERO
link rows yet (pre-/partially-migrated), `buildMakePayload` falls back to the post-level media
query (`resolvePostLevelMediaRows`, invoked lazily only when target-scoped rows are empty), so
old posts keep publishing correctly during the transition.

### Override columns are now live

`social_post_targets.captionOverride` / `hashtagsOverrideText` / `footerOverride` (nullable,
shipped dead in SPEC-254) are now READ by `buildMakePayload`: non-null wins, `null` inherits
the parent post's resolved caption/hashtags/footer (`??` so an explicit empty-string override
is honored, not treated as absent). No schema change — the reader was the missing piece.

### Video/story presets

`social-video-pipeline-config.util.ts` exports the STORY 9:16 Cloudinary transform (applied
via the `transformation` upload option) and VIDEO_POST duration/size LIMITS. Limits are
enforced as pre/post-upload VALIDATION (reject over-limit via the graceful-fail contract), not
as a Cloudinary transform — a duration transform would silently truncate the video.

### New platforms

`SocialPlatformEnum` gained `LINKEDIN` + `TIKTOK` (Postgres enum widened via migration
`0047`). Seeded platform/format rows in `packages/seed/src/required/socialAutomation.seed.ts`
(LinkedIn: TEXT_POST/VIDEO_POST; TikTok: VIDEO_POST — neither supports STORY). The dispatch
service stays platform-agnostic; each new platform needs only its Make.com scenario (external).

## Decoupled External Ports (ImportContext)

`ImportContext` (in `services/accommodation-import/adapter.types.ts`) carries optional
**port functions** for capabilities that require credentials or infrastructure this
package must NOT own directly — `apps/api` builds and injects the implementation,
`packages/service-core` only calls the function. This keeps service-core decoupled and
unit-testable without pulling in apps/api's AI engine, vault master keys, or OAuth token
services.

Two ports exist today, both following the same shape:

| Port | Owner (apps/api) | Purpose |
|------|-------------------|---------|
| `aiExtract` | AI engine + entitlement/quota gate | AI-assisted field extraction (SPEC-222 Strategy B) |
| `mercadoLibreTokenProvider` | OAuth token service + credential vault (HOS-45) | Returns a valid, transparently-refreshed MercadoLibre access token |

When adding a new OAuth-backed or credential-gated provider, add a new port to
`ImportContext` following this same pattern (an async function with no arguments or a
small typed input, apps/api wires the real implementation, service-core only calls it
and degrades gracefully — never throws — when the port is absent).

## Related Documentation

- [Adding a New Entity Guide](../../docs/guides/adding-new-entity.md) — the end-to-end pattern, including the service layer
- [Error Handling Guide](../../docs/guides/error-handling.md)
- [Architecture Patterns](../../docs/architecture/patterns.md)
- [Review Moderation Guide](../../docs/guides/review-moderation.md)

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>
