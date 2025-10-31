# CLAUDE.md - Schemas Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.


This file provides guidance for working with the Schemas package (`@repo/schemas`).

## Overview

Centralized Zod validation schemas for all entities, API requests/responses, and business logic validation across the Hospeda platform. Ensures type-safe validation throughout the monorepo.

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
pnpm check             # Auto-fix issues

# Build
pnpm build             # Build for production (ESM + CJS)
pnpm clean             # Remove build artifacts
```

## Package Structure

```
src/
├── entities/          # Entity schemas (accommodations, users, etc.)
│   ├── accommodation/
│   ├── destination/
│   ├── event/
│   ├── post/
│   ├── user/
│   └── index.ts
├── enums/             # Enum definitions
│   ├── lifecycle.ts
│   ├── roles.ts
│   └── index.ts
├── common/            # Reusable schema patterns
│   ├── pagination.ts
│   ├── audit.ts
│   ├── search.ts
│   └── index.ts
├── api/               # API request/response schemas
│   ├── requests/
│   ├── responses/
│   └── index.ts
├── utils/             # Schema utilities
│   ├── transforms.ts
│   ├── refinements.ts
│   └── index.ts
├── metrics/           # Metrics and error tracking schemas
└── index.ts           # Main export
```

## Schema Organization

Each entity has dedicated schemas:

- **Base Schema**: Core entity structure
- **Create Schema**: For creating new entities (excludes id, timestamps)
- **Update Schema**: For updating entities (all fields optional)
- **Search Schema**: For filtering/searching entities
- **Response Schema**: For API responses (may include relations)

### Example Entity Schema Set

```ts
// entities/accommodation/base.ts
import { z } from 'zod';
import { auditFieldsSchema } from '../../common/audit';

export const accommodationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().min(10).max(5000),
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  country: z.string().default('Argentina'),
  zipCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$']),
  rating: z.number().min(0).max(5).default(0),
  isActive: z.boolean().default(true),
  ...auditFieldsSchema.shape,
});

export type Accommodation = z.infer<typeof accommodationSchema>;
```

```ts
// entities/accommodation/create.ts
import { accommodationSchema } from './base';

export const createAccommodationSchema = accommodationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  createdBy: true,
  updatedBy: true,
});

export type CreateAccommodation = z.infer<typeof createAccommodationSchema>;
```

```ts
// entities/accommodation/update.ts
import { accommodationSchema } from './base';

export const updateAccommodationSchema = accommodationSchema
  .omit({
    id: true,
    createdAt: true,
    createdBy: true,
  })
  .partial();

export type UpdateAccommodation = z.infer<typeof updateAccommodationSchema>;
```

```ts
// entities/accommodation/search.ts
import { z } from 'zod';
import { paginationQuerySchema } from '../../common/pagination';

export const searchAccommodationSchema = z
  .object({
    q: z.string().optional(),          // Text search
    city: z.string().optional(),
    priceRange: z.enum(['$', '$$', '$$$', '$$$$']).optional(),
    minRating: z.number().min(0).max(5).optional(),
    isActive: z.boolean().optional(),
  })
  .merge(paginationQuerySchema);

export type SearchAccommodation = z.infer<typeof searchAccommodationSchema>;
```

## Common Schemas

### Pagination

```ts
// common/pagination.ts
import { z } from 'zod';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
});

export const paginationResponseSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type PaginationResponse = z.infer<typeof paginationResponseSchema>;
```

### Audit Fields

```ts
// common/audit.ts
import { z } from 'zod';

export const auditFieldsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});
```

## Enums

```ts
// enums/lifecycle.ts
import { z } from 'zod';

export const LifecycleStatusEnum = z.enum([
  'draft',
  'published',
  'archived',
  'deleted',
]);

export type LifecycleStatus = z.infer<typeof LifecycleStatusEnum>;
```

```ts
// enums/roles.ts
import { z } from 'zod';

export const UserRoleEnum = z.enum([
  'user',
  'moderator',
  'admin',
  'super_admin',
]);

export type UserRole = z.infer<typeof UserRoleEnum>;
```

## Schema Utilities

### Custom Refinements

```ts
// utils/refinements.ts
import { z } from 'zod';

export const futureDate = z.date().refine(
  (date) => date > new Date(),
  { message: 'Date must be in the future' }
);

export const slug = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase with hyphens only',
  });

export const phoneNumber = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, {
    message: 'Invalid phone number format',
  });
```

### Transforms

```ts
// utils/transforms.ts
import { z } from 'zod';

export const trimmedString = z.string().transform((val) => val.trim());

export const lowercaseString = z.string().transform((val) => val.toLowerCase());

export const slugFromString = z.string().transform((val) =>
  val
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
);
```

## API Schemas

### Request Schemas

```ts
// api/requests/accommodation.ts
import { createAccommodationSchema } from '../../entities/accommodation';

export const createAccommodationRequestSchema = z.object({
  body: createAccommodationSchema,
});
```

### Response Schemas

```ts
// api/responses/common.ts
import { z } from 'zod';

export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    metadata: z
      .object({
        timestamp: z.string().datetime(),
        requestId: z.string().uuid().optional(),
      })
      .optional(),
  });

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) =>
  z.object({
    success: z.literal(true),
    data: z.array(dataSchema),
    pagination: paginationResponseSchema,
  });
```

## Error Schemas

```ts
// metrics/errors.ts
import { z } from 'zod';

export const ServiceErrorCode = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INTERNAL_ERROR',
  'DATABASE_ERROR',
]);

export const serviceErrorSchema = z.object({
  code: ServiceErrorCode,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.date(),
});

export type ServiceErrorCode = z.infer<typeof ServiceErrorCode>;
```

## Usage Examples

### In API Routes (Hono)

```ts
import { zValidator } from '@hono/zod-validator';
import { createAccommodationSchema } from '@repo/schemas';

app.post(
  '/accommodations',
  zValidator('json', createAccommodationSchema),
  async (c) => {
    const data = c.req.valid('json'); // Type-safe!
    // ...
  }
);
```

### In Services

```ts
import { createAccommodationSchema } from '@repo/schemas';

export class AccommodationService {
  async create(input: unknown) {
    // Validate and parse
    const data = createAccommodationSchema.parse(input);

    // Or with safe parse
    const result = createAccommodationSchema.safeParse(input);
    if (!result.success) {
      return { error: result.error };
    }

    // Use validated data
    return this.repository.create(result.data);
  }
}
```

### In React Forms

```tsx
import { createAccommodationSchema } from '@repo/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

export function AccommodationForm() {
  const form = useForm({
    resolver: zodResolver(createAccommodationSchema),
  });

  // Form is type-safe based on schema
}
```

## Testing Schemas

```ts
import { describe, it, expect } from 'vitest';
import { createAccommodationSchema } from './create';

describe('createAccommodationSchema', () => {
  it('should validate valid accommodation data', () => {
    const validData = {
      name: 'Hotel Test',
      slug: 'hotel-test',
      description: 'A test hotel',
      address: '123 Main St',
      city: 'Buenos Aires',
      state: 'Buenos Aires',
      priceRange: '$$',
    };

    const result = createAccommodationSchema.safeParse(validData);

    expect(result.success).toBe(true);
  });

  it('should reject invalid data', () => {
    const invalidData = {
      name: '', // Too short
      description: 'Short', // Too short
    };

    const result = createAccommodationSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(2);
  });
});
```

## Schema Composition

### Extending Schemas

```ts
const baseAccommodationSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const hotelSchema = baseAccommodationSchema.extend({
  starRating: z.number().min(1).max(5),
  hasPool: z.boolean(),
});
```

### Merging Schemas

```ts
const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string(),
});

const accommodationWithAddress = accommodationSchema.merge(addressSchema);
```

### Picking/Omitting Fields

```ts
// Pick only specific fields
const accommodationSummary = accommodationSchema.pick({
  id: true,
  name: true,
  city: true,
});

// Omit specific fields
const accommodationWithoutAudit = accommodationSchema.omit({
  createdAt: true,
  updatedAt: true,
});
```

## Best Practices

1. **One schema per file** - keep schemas focused and modular
2. **Export both schema and type** - use `z.infer<>`
3. **Use descriptive error messages** - `.min(1, 'Name is required')`
4. **Leverage common schemas** - reuse pagination, audit, etc.
5. **Validate at boundaries** - API routes, service inputs
6. **Use `.safeParse()` for runtime validation** - handle errors gracefully
7. **Test all schemas** - ensure validations work as expected
8. **Document complex refinements** - use JSDoc
9. **Keep schemas DRY** - use composition (extend, merge, pick)
10. **Version schemas carefully** - breaking changes affect whole system

## Key Dependencies

- `zod` - Schema validation
- `@repo/utils` - Utility functions
- `@repo/config` - Configuration

## Notes

- Schemas are used across API, web, and admin apps
- Changes here affect all consumers
- Always run tests before committing
- Schemas are the source of truth for types
