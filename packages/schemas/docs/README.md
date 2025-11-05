# @repo/schemas Documentation

**Centralized Zod validation schemas for the Hospeda platform**

This package provides type-safe validation schemas for all entities, API requests/responses, and business logic validation across the Hospeda monorepo. Built with Zod, it ensures consistent validation and automatic type inference throughout the entire application stack.

## Overview

The `@repo/schemas` package is the single source of truth for data validation in Hospeda. It centralizes all validation logic, ensuring that the same rules apply whether data comes from user forms, API requests, database queries, or internal service calls.

**Why Centralized Validation?**

- **Consistency**: Same validation rules across frontend, backend, and database
- **Type Safety**: TypeScript types automatically inferred from schemas via `z.infer`
- **DRY Principle**: Define validation once, use everywhere
- **Maintainability**: Single place to update when business rules change
- **Testability**: Schemas are easily testable in isolation

## Quick Start

**New to this package?** Start with the [Quick Start Guide](./quick-start.md) for a 5-minute tutorial.

## Core Concepts

### Zod Schemas vs TypeScript Types

In this package, **schemas define types**, not the other way around:

```typescript
// ✅ CORRECT: Schema defines the type
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['user', 'admin'])
});

export type User = z.infer<typeof UserSchema>;

// ❌ WRONG: Don't create separate type files
// Types are always derived from schemas
```

**Benefits:**

- Single source of truth for structure AND validation
- Runtime validation with compile-time types
- Automatic type updates when schema changes

### Type Inference with z.infer

Type inference is at the heart of this package's type safety:

```typescript
const userSchema = z.object({
  name: z.string(),
  age: z.number().min(18)
});

// Automatically inferred type:
type User = z.infer<typeof userSchema>;
// { name: string; age: number }

// Use in functions:
function greetUser(user: User): string {
  return `Hello, ${user.name}!`;
}
```

**→ [Complete Type Inference Guide](./api/type-inference.md)**

### Schema Variants

Each entity typically has multiple schema variants for different use cases:

```typescript
// Base schema - complete entity structure
export const AccommodationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // ... other fields
});

// Create schema - omits auto-generated fields
export const AccommodationCreateInputSchema = AccommodationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Update schema - partial fields
export const AccommodationUpdateInputSchema = AccommodationSchema
  .omit({ id: true, createdAt: true })
  .partial();

// Search schema - filter fields
export const AccommodationSearchInputSchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  minPrice: z.number().optional(),
  ...PaginationSchema.shape
});

// Response schema - may include relations
export const AccommodationWithDestinationSchema = AccommodationSchema.extend({
  destination: DestinationSchema
});
```

**→ [Schema Reference](./api/schema-reference.md)**

### Schema Composition

Zod provides powerful composition patterns:

```typescript
// Extend - add new fields
const ExtendedSchema = BaseSchema.extend({
  newField: z.string()
});

// Merge - combine schemas
const MergedSchema = SchemaA.merge(SchemaB);

// Pick - select specific fields
const PartialSchema = BaseSchema.pick({
  id: true,
  name: true
});

// Omit - exclude fields
const WithoutDatesSchema = BaseSchema.omit({
  createdAt: true,
  updatedAt: true
});

// Partial - make all fields optional
const OptionalSchema = BaseSchema.partial();
```

## Package Architecture

### Directory Structure

```text
src/
├── entities/          # Entity schemas (50+ entities)
│   ├── accommodation/ # Example entity
│   │   ├── accommodation.schema.ts        # Base schema
│   │   ├── accommodation.crud.schema.ts   # CRUD operations
│   │   ├── accommodation.query.schema.ts  # Query/search
│   │   ├── accommodation.relations.schema.ts # With relations
│   │   └── index.ts                       # Barrel export
│   ├── user/
│   ├── booking/
│   └── ... (50+ more)
├── enums/             # Enum definitions (40+ enums)
│   ├── role.enum.ts
│   ├── lifecycle-state.enum.ts
│   ├── payment-status.enum.ts
│   └── ... (40+ more)
├── common/            # Reusable schemas
│   ├── pagination.schema.ts    # Pagination patterns
│   ├── audit.schema.ts         # Audit fields
│   ├── base.schema.ts          # Base entity schema
│   ├── search.schema.ts        # Search patterns
│   └── ... (20+ more)
├── api/               # API-specific schemas
│   ├── health.schema.ts
│   └── ...
├── utils/             # Schema utilities
│   ├── utils.ts                # Regex validators
│   ├── openapi.utils.ts        # OpenAPI integration
│   └── ...
└── index.ts           # Main export
```

### Schema Organization by Entity

Each entity follows a consistent structure:

**Base Schema** (`entity.schema.ts`)

- Complete entity structure
- All fields with validation rules
- Includes base fields (audit, lifecycle, etc.)

**CRUD Schemas** (`entity.crud.schema.ts`)

- `CreateInputSchema` - fields for creating
- `CreateOutputSchema` - response after creation
- `UpdateInputSchema` - fields for updating (partial)
- `UpdateOutputSchema` - response after update
- `PatchInputSchema` - partial updates
- `DeleteInputSchema` - deletion parameters
- `DeleteOutputSchema` - deletion result
- `RestoreInputSchema` - restoration parameters
- `RestoreOutputSchema` - restoration result

**Query Schemas** (`entity.query.schema.ts`)

- `SearchInputSchema` - search parameters
- `SearchOutputSchema` - search results
- `ListInputSchema` - list parameters
- `ListOutputSchema` - list results
- `FiltersSchema` - available filters
- `StatsSchema` - statistics
- `SummarySchema` - summary view

**Relations Schemas** (`entity.relations.schema.ts`)

- `EntityWithRelationASchema` - includes specific relation
- `EntityWithBasicRelationsSchema` - common relations
- `EntityWithFullRelationsSchema` - all relations

## API Reference

### Entity Schemas

Comprehensive documentation of all 50+ entity schemas:

- [Accommodation Schemas](./api/schema-reference.md#accommodation)
- [User Schemas](./api/schema-reference.md#user)
- [Booking Schemas](./api/schema-reference.md#booking)
- [Post Schemas](./api/schema-reference.md#post)
- [Event Schemas](./api/schema-reference.md#event)
- [Review Schemas](./api/schema-reference.md#review)
- [Payment Schemas](./api/schema-reference.md#payment)
- ... and 43+ more

**→ [Complete Schema Reference](./api/schema-reference.md)**

### Common Schemas

Reusable schema patterns used across entities:

- **Pagination**: `PaginationSchema`, `CursorPaginationParamsSchema`
- **Audit**: `BaseAuditFields`, audit timestamps and user tracking
- **Lifecycle**: `BaseLifecycleFields`, entity state management
- **Search**: `BaseSearchSchema`, search and filtering
- **Visibility**: `BaseVisibilityFields`, public/private/draft
- **Location**: `FullLocationFields`, address and coordinates
- **Contact**: `BaseContactFields`, email and phone
- **Social**: `SocialNetworkFields`, social media links

### Enum Schemas

40+ enum definitions for domain concepts:

- **Lifecycle**: `LifecycleStateEnumSchema` (draft, published, archived)
- **Roles**: `RoleEnumSchema` (user, moderator, admin)
- **Visibility**: `VisibilityEnumSchema` (public, private, unlisted)
- **Status**: `BookingStatusEnum`, `PaymentStatusEnum`, etc.
- **Types**: `AccommodationTypeEnum`, `EventCategoryEnum`, etc.

### Utility Schemas

Custom validators and transforms:

- **Validators**: `SlugRegex`, `InternationalPhoneRegex`, `isValidLatitude`
- **Transforms**: String trimming, lowercase conversion, slug generation
- **Refinements**: Date validation, custom business rules

**→ [Custom Validators Reference](./api/validators.md)**

## Common Patterns

### Entity Schema Organization

Standard pattern for organizing entity schemas:

```typescript
// entities/product/product.schema.ts
export const ProductSchema = z.object({
  id: z.string().uuid(),
  ...BaseAuditFields,
  ...BaseLifecycleFields,
  name: z.string().min(1).max(255),
  type: ProductTypeEnumSchema,
  metadata: z.record(z.unknown()).optional()
});

export type Product = z.infer<typeof ProductSchema>;

// entities/product/product.crud.schema.ts
export const ProductCreateInputSchema = ProductSchema.omit({
  id: true,
  ...omittedSystemFieldsForActions
});

export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;

// entities/product/product.query.schema.ts
export const ProductSearchInputSchema = z.object({
  q: z.string().optional(),
  type: ProductTypeEnumSchema.optional(),
  ...BaseSearchSchema.shape
});

export type ProductSearchInput = z.infer<typeof ProductSearchInputSchema>;
```

### CRUD Schema Derivation

Consistent pattern for deriving CRUD schemas from base:

```typescript
// Helper constant for system fields
export const omittedSystemFieldsForActions = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'deletedById'
];

// Create: Omit all system fields
export const CreateSchema = BaseSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true
});

// Update: Omit immutable fields, make partial
export const UpdateSchema = BaseSchema
  .omit({
    id: true,
    createdAt: true
  })
  .partial();

// Patch: Same as update (explicitly named)
export const PatchSchema = UpdateSchema;
```

### Query/Filter Schemas

Standard pattern for search and list queries:

```typescript
// Search with full-text and filters
export const EntitySearchInputSchema = z.object({
  q: z.string().optional(),           // Full-text search
  categoryId: z.string().uuid().optional(),
  status: StatusEnum.optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  ...BaseSearchSchema.shape           // page, pageSize, sortBy, sortOrder
});

// List with basic filters (no full-text)
export const EntityListInputSchema = z.object({
  categoryId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  ...PaginationSchema.shape           // page, pageSize
});

// Output with pagination
export const EntitySearchOutputSchema = PaginationResultSchema(
  EntitySearchResultSchema
);
```

### API Request/Response Schemas

Pattern for HTTP endpoints:

```typescript
// Request schemas
export const CreateEntityRequestSchema = z.object({
  body: CreateEntityInputSchema
});

export const UpdateEntityRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: UpdateEntityInputSchema
});

export const GetEntityRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

// Response schemas
export const EntityResponseSchema = z.object({
  success: z.literal(true),
  data: EntitySchema
});

export const EntityListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(EntitySchema),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
});
```

## Usage Examples

### In API Routes (Hono)

```typescript
import { zValidator } from '@hono/zod-validator';
import {
  AccommodationCreateInputSchema,
  AccommodationSearchInputSchema
} from '@repo/schemas';

// POST /accommodations - Create
app.post(
  '/accommodations',
  zValidator('json', AccommodationCreateInputSchema),
  async (c) => {
    const data = c.req.valid('json'); // Type: AccommodationCreateInput
    const result = await accommodationService.create(data);
    return c.json({ success: true, data: result });
  }
);

// GET /accommodations - Search
app.get(
  '/accommodations',
  zValidator('query', AccommodationSearchInputSchema),
  async (c) => {
    const filters = c.req.valid('query'); // Type: AccommodationSearchInput
    const results = await accommodationService.search(filters);
    return c.json({ success: true, data: results });
  }
);
```

### In Services (parse vs safeParse)

```typescript
import {
  AccommodationCreateInputSchema,
  type AccommodationCreateInput
} from '@repo/schemas';

export class AccommodationService {
  async create(input: unknown): Promise<Result<Accommodation>> {
    // Option 1: parse() - throws on validation error
    try {
      const data = AccommodationCreateInputSchema.parse(input);
      return this.repository.create(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { error: 'VALIDATION_ERROR', details: error.issues };
      }
      throw error;
    }

    // Option 2: safeParse() - returns result object
    const result = AccommodationCreateInputSchema.safeParse(input);
    if (!result.success) {
      return {
        error: 'VALIDATION_ERROR',
        details: result.error.issues
      };
    }

    return this.repository.create(result.data);
  }
}
```

### In React Forms (zodResolver)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AccommodationCreateInputSchema,
  type AccommodationCreateInput
} from '@repo/schemas';

export function AccommodationForm() {
  const form = useForm<AccommodationCreateInput>({
    resolver: zodResolver(AccommodationCreateInputSchema),
    defaultValues: {
      name: '',
      description: '',
      city: ''
    }
  });

  const onSubmit = form.handleSubmit(async (data) => {
    // data is already validated and typed as AccommodationCreateInput
    await createAccommodation(data);
  });

  return (
    <form onSubmit={onSubmit}>
      <input {...form.register('name')} />
      {form.formState.errors.name && (
        <span>{form.formState.errors.name.message}</span>
      )}
      {/* ... more fields */}
    </form>
  );
}
```

## Testing Schemas

### Basic Validation Tests

```typescript
import { describe, it, expect } from 'vitest';
import { AccommodationCreateInputSchema } from './accommodation.crud.schema';

describe('AccommodationCreateInputSchema', () => {
  it('should validate valid accommodation data', () => {
    const validData = {
      name: 'Hotel Paradise',
      description: 'A beautiful hotel in the city',
      city: 'Buenos Aires',
      address: '123 Main St'
    };

    const result = AccommodationCreateInputSchema.safeParse(validData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Hotel Paradise');
    }
  });

  it('should reject invalid data', () => {
    const invalidData = {
      name: '', // Too short
      description: 'Short', // Too short
      city: 'BA' // Too short
    };

    const result = AccommodationCreateInputSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(3);
      expect(result.error.issues[0].path).toContain('name');
    }
  });

  it('should apply default values', () => {
    const data = {
      name: 'Hotel',
      description: 'Description',
      city: 'Buenos Aires',
      address: '123 Main St'
    };

    const result = AccommodationCreateInputSchema.parse(data);

    expect(result.isActive).toBe(true); // Default value
    expect(result.rating).toBe(0); // Default value
  });
});
```

### Testing Custom Refinements

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SlugRegex } from '../utils/utils';

describe('Slug validation', () => {
  const slugSchema = z.string().regex(SlugRegex);

  it('should accept valid slugs', () => {
    expect(slugSchema.safeParse('my-slug').success).toBe(true);
    expect(slugSchema.safeParse('slug-123').success).toBe(true);
    expect(slugSchema.safeParse('a').success).toBe(true);
  });

  it('should reject invalid slugs', () => {
    expect(slugSchema.safeParse('My-Slug').success).toBe(false); // Uppercase
    expect(slugSchema.safeParse('slug_name').success).toBe(false); // Underscore
    expect(slugSchema.safeParse('slug--name').success).toBe(false); // Double dash
    expect(slugSchema.safeParse('-slug').success).toBe(false); // Leading dash
    expect(slugSchema.safeParse('slug-').success).toBe(false); // Trailing dash
  });
});
```

## Best Practices

### 1. Schema Naming Conventions

Always suffix schemas with `Schema`:

```typescript
// ✅ CORRECT
export const UserSchema = z.object({ ... });
export const CreateUserInputSchema = UserSchema.omit({ ... });

// ❌ WRONG
export const User = z.object({ ... });
export const CreateUserInput = User.omit({ ... });
```

### 2. Type Inference

Always derive types with `z.infer`:

```typescript
// ✅ CORRECT
export const UserSchema = z.object({ ... });
export type User = z.infer<typeof UserSchema>;

// ❌ WRONG: Don't create separate type definitions
export type User = {
  id: string;
  name: string;
};
export const UserSchema = z.object({ ... });
```

### 3. Use Base Fields

Leverage common base field objects:

```typescript
// ✅ CORRECT
export const EntitySchema = z.object({
  id: EntityIdSchema,
  ...BaseAuditFields,
  ...BaseLifecycleFields,
  // ... entity-specific fields
});

// ❌ WRONG: Repeating fields
export const EntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // ... repeated in every schema
});
```

### 4. Schema Composition

Use composition instead of duplication:

```typescript
// ✅ CORRECT
export const BaseProductSchema = z.object({
  name: z.string(),
  price: z.number()
});

export const DigitalProductSchema = BaseProductSchema.extend({
  downloadUrl: z.string().url()
});

// ❌ WRONG: Duplicating fields
export const DigitalProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  downloadUrl: z.string().url()
});
```

### 5. Descriptive Error Messages

Provide clear, user-friendly error messages:

```typescript
// ✅ CORRECT
const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name cannot exceed 50 characters');

// ❌ WRONG: Using default messages
const nameSchema = z.string().min(2).max(50);
```

### 6. Validation at Boundaries

Validate at system boundaries:

```typescript
// ✅ CORRECT: Validate at API entry
app.post('/users', zValidator('json', CreateUserSchema), async (c) => {
  const data = c.req.valid('json'); // Already validated
  // ... use data safely
});

// ❌ WRONG: Trusting input without validation
app.post('/users', async (c) => {
  const data = await c.req.json(); // Unvalidated!
  // ... potential runtime errors
});
```

### 7. Use safeParse for Runtime Validation

Use `safeParse()` when errors should be handled:

```typescript
// ✅ CORRECT
const result = schema.safeParse(data);
if (!result.success) {
  return { error: result.error };
}
return { data: result.data };

// ❌ WRONG: Using parse() without try/catch
const data = schema.parse(input); // May throw!
```

### 8. Test All Schemas

Every schema should have tests:

```typescript
// ✅ CORRECT
describe('UserSchema', () => {
  it('should validate valid user', () => { ... });
  it('should reject invalid email', () => { ... });
  it('should apply defaults', () => { ... });
});

// ❌ WRONG: No tests for schema
```

### 9. Keep Schemas DRY

Avoid repeating validation logic:

```typescript
// ✅ CORRECT: Define once, reuse
export const emailSchema = z.string().email().toLowerCase();

export const UserSchema = z.object({
  email: emailSchema,
  backupEmail: emailSchema.optional()
});

// ❌ WRONG: Repeating logic
export const UserSchema = z.object({
  email: z.string().email().toLowerCase(),
  backupEmail: z.string().email().toLowerCase().optional()
});
```

### 10. Version Carefully

Schema changes affect the entire system:

```typescript
// ⚠️ BREAKING CHANGE: Adding required field
export const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string() // NEW REQUIRED FIELD - BREAKS EXISTING CODE
});

// ✅ SAFE: Adding optional field
export const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional() // SAFE - OPTIONAL FIELD
});
```

## Related Packages

- **[@repo/db](../../db/README.md)**: Database layer using Drizzle ORM
- **[@repo/service-core](../../service-core/README.md)**: Business logic services
- **[@repo/utils](../../utils/README.md)**: Shared utilities
- **[apps/api](../../../apps/api/README.md)**: Hono API server

## Contributing

When adding or modifying schemas:

1. Follow naming conventions (`*Schema` suffix)
2. Export both schema and type (`z.infer`)
3. Add comprehensive tests
4. Document with JSDoc comments
5. Update this documentation
6. Consider backward compatibility

## Need Help?

- **Questions?** Check the [Quick Start Guide](./quick-start.md)
- **API Details?** See [Schema Reference](./api/schema-reference.md)
- **Type Issues?** Read [Type Inference Guide](./api/type-inference.md)
- **Custom Validation?** Check [Validators Guide](./api/validators.md)
