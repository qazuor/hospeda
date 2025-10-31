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
│   │   └── index.ts
│   ├── destination/
│   ├── event/
│   ├── post/
│   ├── user/
│   └── index.ts
├── base/              # Base classes
│   └── BaseCrudService.ts
├── types/             # Service-specific types
│   └── service-context.ts
├── utils/             # Service utilities
│   └── validation.ts
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

## Authorization

Services check permissions based on context:

```ts
export class AccommodationService extends BaseCrudService<...> {
  async delete(input: { id: string }): Promise<Result<void>> {
    // Check if user has permission
    if (this.ctx.role !== 'admin') {
      throw new ServiceError(
        'Only admins can delete accommodations',
        ServiceErrorCode.FORBIDDEN
      );
    }

    return this.softDelete(input);
  }

  async findAll(input: { filters?: SearchAccommodation }) {
    // Users can only see their own drafts
    const filters = { ...input.filters };

    if (this.ctx.role !== 'admin') {
      filters.status = 'published';
    }

    return super.findAll({ filters });
  }
}
```

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

## Notes

- Services are stateless - create new instances per request
- Context should include user information for authorization
- Services are the single source of truth for business logic
- All database access goes through services, not directly to models
