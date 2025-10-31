# CLAUDE.md - Database Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Database package (`@repo/db`).

## Overview

Database layer using Drizzle ORM with PostgreSQL. Provides type-safe models, schemas, migrations, and utilities for all database operations. Implements the repository pattern with BaseModel abstraction.

## Key Commands

```bash
# Database Operations
pnpm db:migrate        # Apply pending migrations
pnpm db:generate       # Generate migration from schema changes
pnpm db:studio         # Open Drizzle Studio (visual DB tool)

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
```

## Package Structure

```
src/
├── models/            # Entity models extending BaseModel
│   ├── accommodation/
│   ├── destination/
│   ├── event/
│   ├── post/
│   ├── user/
│   └── index.ts
├── schemas/           # Drizzle table schemas
│   ├── accommodation/
│   ├── destination/
│   ├── event/
│   ├── enums/
│   └── index.ts
├── base/              # Base classes and abstractions
│   └── BaseModel.ts
├── utils/             # Database utilities
│   ├── query-builder.ts
│   ├── error-handler.ts
│   └── enum-helpers.ts
├── client.ts          # Drizzle client initialization
└── index.ts           # Main exports
```

## Initializing the Database

```ts
import { Pool } from 'pg';
import { initializeDb } from '@repo/db';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Must be called before using any models
initializeDb(pool);
```

## BaseModel

All models extend `BaseModel<T>` which provides standard CRUD operations:

```ts
import { BaseModel } from '@repo/db/base';
import { accommodationTable } from '@repo/db/schemas';
import type { Accommodation } from '@repo/types';

export class AccommodationModel extends BaseModel<Accommodation> {
  protected table = accommodationTable;
  protected entityName = 'accommodation';

  // Override methods for custom logic
  async findAll(filters?: SearchAccommodation): Promise<Accommodation[]> {
    // Custom search logic (e.g., full-text search)
    if (filters?.q) {
      return this.searchByText(filters.q);
    }

    return super.findAll(filters);
  }
}
```

### BaseModel Methods

**Read Operations:**

- `findById(id: string): Promise<T | null>` - Find by ID
- `findOne(filters: Partial<T>): Promise<T | null>` - Find single record
- `findAll(filters?: Partial<T>): Promise<T[]>` - Find all matching
- `findWithRelations(filters, relations): Promise<T | null>` - Find with related data
- `count(filters?: Partial<T>): Promise<number>` - Count records
- `exists(filters: Partial<T>): Promise<boolean>` - Check existence

**Write Operations:**

- `create(data: Partial<T>): Promise<T>` - Create new record
- `update(id: string, data: Partial<T>): Promise<T>` - Update by ID
- `updateMany(filters, data): Promise<number>` - Bulk update

**Delete Operations:**

- `softDelete(filters: Partial<T>): Promise<void>` - Soft delete (set deletedAt)
- `hardDelete(filters: Partial<T>): Promise<void>` - Permanent delete
- `restore(filters: Partial<T>): Promise<void>` - Restore soft-deleted

## Drizzle Schemas

Define table schemas using Drizzle ORM:

```ts
// schemas/accommodation/table.ts
import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const accommodationTable = pgTable('accommodations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description').notNull(),
  address: varchar('address', { length: 500 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  // Audit fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

### Relations

```ts
// schemas/accommodation/relations.ts
import { relations } from 'drizzle-orm';
import { accommodationTable } from './table';
import { reviewTable } from '../review/table';
import { amenityTable } from '../amenity/table';

export const accommodationRelations = relations(accommodationTable, ({ many }) => ({
  reviews: many(reviewTable),
  amenities: many(amenityTable),
}));
```

## Using Models

### Basic CRUD

```ts
import { AccommodationModel } from '@repo/db';

const accommodationModel = new AccommodationModel();

// Create
const newAccommodation = await accommodationModel.create({
  name: 'Hotel Paradise',
  slug: 'hotel-paradise',
  description: 'A beautiful hotel',
  address: '123 Main St',
  city: 'Buenos Aires',
});

// Read
const accommodation = await accommodationModel.findById('uuid-here');
const allAccommodations = await accommodationModel.findAll({ isActive: true });

// Update
const updated = await accommodationModel.update('uuid-here', {
  name: 'Hotel Paradise Updated',
});

// Soft Delete
await accommodationModel.softDelete({ id: 'uuid-here' });

// Restore
await accommodationModel.restore({ id: 'uuid-here' });

// Hard Delete (permanent)
await accommodationModel.hardDelete({ id: 'uuid-here' });
```

### With Relations

```ts
const accommodationWithReviews = await accommodationModel.findWithRelations(
  { id: 'uuid-here' },
  { reviews: true, amenities: true }
);

console.log(accommodationWithReviews.reviews); // Array of reviews
console.log(accommodationWithReviews.amenities); // Array of amenities
```

### Pagination

```ts
const results = await accommodationModel.findAll({
  page: 1,
  pageSize: 10,
  city: 'Buenos Aires',
});
```

## Transactions

```ts
import { getDb } from '@repo/db';

const db = getDb();

await db.transaction(async (trx) => {
  // All operations within this transaction
  const accommodation = await trx.insert(accommodationTable).values({
    name: 'Hotel',
  }).returning();

  await trx.insert(reviewTable).values({
    accommodationId: accommodation.id,
    rating: 5,
  });

  // If any operation fails, entire transaction rolls back
});
```

## Custom Queries

### Using Drizzle Query Builder

```ts
import { getDb } from '@repo/db';
import { accommodationTable } from '@repo/db/schemas';
import { eq, and, gte, like } from 'drizzle-orm';

const db = getDb();

// Simple query
const accommodations = await db
  .select()
  .from(accommodationTable)
  .where(eq(accommodationTable.city, 'Buenos Aires'));

// Complex query
const filtered = await db
  .select()
  .from(accommodationTable)
  .where(
    and(
      eq(accommodationTable.isActive, true),
      gte(accommodationTable.rating, 4),
      like(accommodationTable.name, '%Hotel%')
    )
  )
  .limit(10);
```

### Raw SQL (Use Sparingly)

```ts
import { getDb } from '@repo/db';
import { sql } from 'drizzle-orm';

const db = getDb();

const result = await db.execute(
  sql`SELECT COUNT(*) FROM accommodations WHERE is_active = true`
);
```

## Migrations

### Generate Migration

After changing a schema file:

```bash
pnpm db:generate
```

This creates a new migration file in `drizzle/migrations/`.

### Apply Migrations

```bash
pnpm db:migrate
```

### Migration File Example

```sql
-- drizzle/migrations/0001_add_accommodations.sql
CREATE TABLE accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
```

## Enums

### Database Enums

```ts
// schemas/enums/lifecycle.ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const lifecycleStatusEnum = pgEnum('lifecycle_status', [
  'draft',
  'published',
  'archived',
]);

// Use in table
export const postTable = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: lifecycleStatusEnum('status').default('draft').notNull(),
});
```

### Enum Helpers

```ts
import { getEnumValues, enumToArray } from '@repo/db/utils';

const statusValues = getEnumValues('LifecycleStatusEnum');
// ['draft', 'published', 'archived']

const statusArray = enumToArray(LifecycleStatusEnum);
// [{ value: 'draft', label: 'Draft' }, ...]
```

## Error Handling

```ts
import { DbError } from '@repo/db/utils';

try {
  await accommodationModel.create(data);
} catch (error) {
  if (error instanceof DbError) {
    console.error('Database error:', error.message);
    console.error('Code:', error.code);
  }
  throw error;
}
```

## Testing Models

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createBaseModelMock } from '@repo/db/test-utils';
import { AccommodationModel } from './accommodation.model';

describe('AccommodationModel', () => {
  let model: AccommodationModel;

  beforeAll(() => {
    // Initialize test database
    model = new AccommodationModel();
  });

  it('should create accommodation', async () => {
    const data = {
      name: 'Test Hotel',
      slug: 'test-hotel',
      // ...
    };

    const result = await model.create(data);

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Hotel');
  });

  it('should find by id', async () => {
    const created = await model.create({ /* data */ });
    const found = await model.findById(created.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });
});
```

## Query Building Utilities

```ts
import { buildWhereClause } from '@repo/db/utils';
import { accommodationTable } from '@repo/db/schemas';

const filters = {
  city: 'Buenos Aires',
  isActive: true,
  minRating: 4,
};

const whereClause = buildWhereClause(accommodationTable, filters);

const results = await db
  .select()
  .from(accommodationTable)
  .where(whereClause);
```

## Best Practices

1. **Always use models** - don't query tables directly in business logic
2. **Initialize database once** - call `initializeDb()` at app startup
3. **Use transactions** for multi-step operations
4. **Soft delete by default** - use `softDelete()` unless hard delete needed
5. **Override findAll()** for custom search (e.g., full-text search)
6. **Use TypeScript types** from `@repo/types` - don't redefine
7. **Test all model methods** - ensure CRUD operations work
8. **Use query builder** - avoid raw SQL unless necessary
9. **Handle errors properly** - catch `DbError` specifically
10. **Document complex queries** - use JSDoc for unusual patterns

## Key Dependencies

- `drizzle-orm` - ORM library
- `pg` - PostgreSQL client
- `@repo/schemas` - Zod validation schemas
- `@repo/types` - TypeScript types
- `@repo/utils` - Utility functions
- `@repo/logger` - Logging

## Common Patterns

### Model with Custom Methods

```ts
export class AccommodationModel extends BaseModel<Accommodation> {
  protected table = accommodationTable;
  protected entityName = 'accommodation';

  async findBySlug(slug: string): Promise<Accommodation | null> {
    return this.findOne({ slug });
  }

  async findByCity(city: string): Promise<Accommodation[]> {
    return this.findAll({ city, isActive: true });
  }

  async incrementViewCount(id: string): Promise<void> {
    const db = getDb();
    await db
      .update(accommodationTable)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(accommodationTable.id, id));
  }
}
```

### Repository Pattern

Models follow the repository pattern - they encapsulate all database access for an entity.

## Notes

- Models are stateless - create new instances as needed
- Connection pooling is automatic via Drizzle
- Migrations are forward-only - no rollback support
- Use Drizzle Studio for visual database management
