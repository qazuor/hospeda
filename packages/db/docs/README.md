# @repo/db Documentation

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)

**Type-safe database layer for the Hospeda monorepo**

This package provides a fully-typed, modular, and extensible database layer built on **Drizzle ORM** and **PostgreSQL**. It implements the repository pattern with a powerful `BaseModel` abstraction that handles CRUD operations, soft deletes, relations, transactions, and more.

## Features

- **🔒 Type-Safe**: Full TypeScript support with inference from schemas to queries
- **📦 Repository Pattern**: BaseModel abstraction for consistent data access
- **🗑️ Soft Deletes**: Built-in soft delete and restore functionality
- **🔗 Relations**: First-class support for entity relationships
- **📊 Query Building**: Dynamic query builder with type safety
- **🔄 Transactions**: Built-in transaction support
- **🧪 Testable**: Utilities for testing models and mocking relations
- **📝 Migrations**: Robust migration system with Drizzle Kit
- **📚 Well Documented**: Comprehensive JSDoc and guides

## Quick Links

- **[Quick Start Guide](./quick-start.md)** - Get productive in 5 minutes
- **[API Reference](#api-reference)** - Complete method documentation
- **[Development Guides](#guides)** - In-depth tutorials
- **[Architecture Overview](#architecture)** - Understand the design
- **[Examples](#examples)** - Working code samples

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [Architecture](#architecture)
4. [API Reference](#api-reference)
5. [Guides](#guides)
6. [Examples](#examples)
7. [Testing](#testing)
8. [Migration & Deployment](#migration--deployment)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

This package is designed for internal use within the Hospeda monorepo:

```bash
# From project root
pnpm install

# Or add to another package
pnpm add @repo/db --filter=your-package
```

### Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Internal packages: `@repo/schemas`, `@repo/utils`, `@repo/logger`

### Quick Example

```typescript
import { Pool } from 'pg';
import { initializeDb, ProductModel } from '@repo/db';

// 1. Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
initializeDb(pool);

// 2. Use a model
const productModel = new ProductModel();

// 3. Perform operations
const product = await productModel.create({
  name: 'Premium Listing',
  type: 'accommodation_listing',
  metadata: { category: 'accommodation' },
});

console.log(product.id); // UUID generated automatically
```

**→ [Complete Quick Start Tutorial](./quick-start.md)**

---

## Core Concepts

### BaseModel Pattern

All models extend `BaseModel<T>` which provides standardized CRUD operations. This ensures consistency across all database entities and reduces boilerplate.

```typescript
import { BaseModel } from '@repo/db/base';
import { products } from '@repo/db/schemas';
import type { Product } from '@repo/schemas';

export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'product';

  protected getTableName(): string {
    return 'products';
  }

  // Add custom methods as needed
  async findByType(type: string): Promise<Product[]> {
    return this.findAll({ type });
  }
}
```

**Key Benefits**:

- Consistent API across all entities
- Built-in error handling and logging
- Transaction support out of the box
- Soft delete functionality
- Type safety from database to application

### Drizzle Schemas

Schemas define the database structure using Drizzle ORM's declarative syntax:

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  metadata: jsonb('metadata'),

  // Audit fields (standard across all tables)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

  // Soft delete
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

**Standard Fields**:

- `id`: UUID primary key with auto-generation
- `createdAt`, `updatedAt`: Automatic timestamps
- `deletedAt`: Soft delete support (nullable)
- Audit fields: `createdById`, `updatedById`, `deletedById` (where applicable)

### Relations

Define relationships between entities using Drizzle's `relations` API:

```typescript
import { relations } from 'drizzle-orm';

export const productRelations = relations(products, ({ many }) => ({
  pricingPlans: many(pricingPlans),
}));
```

**Query with relations**:

```typescript
const productWithPlans = await productModel.findAllWithRelations(
  { type: 'accommodation_listing' },
  { pricingPlans: true }
);
```

### Soft Delete

Soft deletes mark records as deleted without removing them from the database:

```typescript
// Soft delete (sets deletedAt timestamp)
await productModel.softDelete({ id: 'product-uuid' });

// Restore soft-deleted record
await productModel.restore({ id: 'product-uuid' });

// Permanent delete
await productModel.hardDelete({ id: 'product-uuid' });
```

**Benefits**:

- Maintain data integrity and audit trail
- Support "undelete" functionality
- Historical data analysis
- Compliance with data retention policies

### Query Building

Dynamic query construction with type safety:

```typescript
import { buildWhereClause } from '@repo/db/utils';
import { eq, and, gte } from 'drizzle-orm';

// Simple query
const activeProducts = await productModel.findAll({
  type: 'accommodation_listing',
  deletedAt: null
});

// Complex query with operators
const db = getDb();
const results = await db
  .select()
  .from(products)
  .where(
    and(
      eq(products.type, 'accommodation_listing'),
      gte(products.createdAt, startDate)
    )
  );
```

### Transactions

Atomic operations across multiple database changes:

```typescript
import { getDb } from '@repo/db';

const db = getDb();

await db.transaction(async (trx) => {
  // Create product
  const product = await productModel.create({
    name: 'New Product',
    type: 'service',
  }, trx);

  // Create pricing plan
  await pricingPlanModel.create({
    productId: product.id,
    amountMinor: 50000,
    currency: 'ARS',
  }, trx);

  // If any operation fails, entire transaction rolls back
});
```

### Migrations

Schema changes are managed through migrations:

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply pending migrations
pnpm db:migrate

# Open visual database tool
pnpm db:studio
```

---

## Architecture

### Package Structure

```
packages/db/
├── src/
│   ├── base/                 # Base classes
│   │   └── base.model.ts     # BaseModel<T> abstract class
│   ├── models/               # Entity models
│   │   ├── catalog/
│   │   │   ├── product.model.ts
│   │   │   ├── pricingPlan.model.ts
│   │   │   └── pricingTier.model.ts
│   │   ├── accommodation/
│   │   └── ...
│   ├── schemas/              # Drizzle schemas
│   │   ├── catalog/
│   │   │   ├── product.dbschema.ts
│   │   │   └── ...
│   │   ├── enums.dbschema.ts
│   │   └── index.ts
│   ├── utils/                # Utilities
│   │   ├── drizzle-helpers.ts
│   │   ├── error.ts
│   │   ├── logger.ts
│   │   └── enum-helpers.ts
│   ├── client.ts             # DB client management
│   └── index.ts              # Main exports
├── test/                     # Tests
├── drizzle/                  # Migrations
└── docs/                     # Documentation
```

### Model Hierarchy

```
BaseModel<T>
    ├── ProductModel
    ├── PricingPlanModel
    ├── PricingTierModel
    ├── AccommodationModel
    ├── UserModel
    └── ... (all entity models)
```

### Data Flow

```
Application Layer
       ↓
Service Layer (@repo/service-core)
       ↓
Model Layer (@repo/db/models) ← BaseModel abstraction
       ↓
Drizzle ORM (Query Builder)
       ↓
PostgreSQL Database
```

### Type Safety Flow

```
Drizzle Schema → Zod Schema (@repo/schemas) → TypeScript Types → Model<T>
                                                                      ↓
                                                               Application
```

**Example**:

```typescript
// 1. Drizzle schema defines DB structure
export const products = pgTable('products', { ... });

// 2. Zod schema validates and provides types
export const productSchema = z.object({ ... });
export type Product = z.infer<typeof productSchema>;

// 3. Model uses the type
export class ProductModel extends BaseModel<Product> {
  // Full type safety throughout
}
```

---

## API Reference

### BaseModel<T>

| Method | Description | Link |
|--------|-------------|------|
| `findAll(where?, options?)` | Find all entities matching criteria | [Docs](./api/BaseModel.md#findall) |
| `findById(id)` | Find entity by ID | [Docs](./api/BaseModel.md#findbyid) |
| `findOne(where)` | Find single entity | [Docs](./api/BaseModel.md#findone) |
| `findAllWithRelations(where, relations)` | Find with related entities | [Docs](./api/BaseModel.md#findallwithrelations) |
| `create(data, tx?)` | Create new entity | [Docs](./api/BaseModel.md#create) |
| `update(id, data, tx?)` | Update entity by ID | [Docs](./api/BaseModel.md#update) |
| `updateMany(where, data, tx?)` | Bulk update | [Docs](./api/BaseModel.md#updatemany) |
| `softDelete(where, tx?)` | Soft delete entities | [Docs](./api/BaseModel.md#softdelete) |
| `hardDelete(where, tx?)` | Permanently delete entities | [Docs](./api/BaseModel.md#harddelete) |
| `restore(where, tx?)` | Restore soft-deleted entities | [Docs](./api/BaseModel.md#restore) |
| `count(where?, tx?)` | Count matching entities | [Docs](./api/BaseModel.md#count) |
| `exists(where, tx?)` | Check if entity exists | [Docs](./api/BaseModel.md#exists) |

### Query Methods

| Method | Description | Link |
|--------|-------------|------|
| `buildWhereClause(filters, table)` | Build dynamic WHERE clause | [Docs](./api/query-builder.md#buildwhereclause) |
| `getDb()` | Get database client | [Docs](./api/client.md#getdb) |
| `initializeDb(pool)` | Initialize database | [Docs](./api/client.md#initializedb) |

### Relations API

| Method | Description | Link |
|--------|-------------|------|
| `findAllWithRelations(where, relations)` | Query with relations | [Docs](./api/relations.md#findallwithrelations) |

### Utilities

| Function | Description | Link |
|----------|-------------|------|
| `getEnumValues(enumName)` | Get enum values | [Docs](./api/utils.md#getenumvalues) |
| `enumToArray(enum)` | Convert enum to array | [Docs](./api/utils.md#enumtoarray) |
| `DbError` | Custom database error class | [Docs](./api/utils.md#dberror) |

**→ [Complete API Reference](./api/README.md)**

---

## Guides

### Getting Started

- [Quick Start](./quick-start.md) - 5-minute introduction
- [Installation & Setup](./guides/installation.md) - Detailed setup guide
- [Basic CRUD Operations](./guides/basic-crud.md) - Create, read, update, delete

### Development

- [Creating Models](./guides/creating-models.md) - Build custom models
- [Defining Schemas](./guides/defining-schemas.md) - Drizzle schema patterns
- [Working with Relations](./guides/relations.md) - Entity relationships
- [Using Transactions](./guides/transactions.md) - Atomic operations
- [Soft Delete & Restore](./guides/soft-delete.md) - Deletion patterns

### Advanced

- [Custom Queries](./guides/custom-queries.md) - Beyond BaseModel
- [Query Optimization](./guides/optimization.md) - Performance tuning
- [Testing Models](./guides/testing.md) - Test strategies
- [Migrations](./guides/migrations.md) - Schema evolution
- [Error Handling](./guides/error-handling.md) - Robust error management

**→ [All Development Guides](./guides/README.md)**

---

## Examples

### Basic CRUD

```typescript
import { ProductModel } from '@repo/db';

const productModel = new ProductModel();

// Create
const product = await productModel.create({
  name: 'Premium Listing',
  type: 'accommodation_listing',
});

// Read
const found = await productModel.findById(product.id);
const all = await productModel.findAll({ type: 'accommodation_listing' });

// Update
const updated = await productModel.update(product.id, {
  name: 'Premium Listing (Updated)',
});

// Soft Delete
await productModel.softDelete({ id: product.id });

// Restore
await productModel.restore({ id: product.id });

// Hard Delete
await productModel.hardDelete({ id: product.id });
```

### Queries with Relations

```typescript
// Find products with pricing plans
const productsWithPlans = await productModel.findAllWithRelations(
  { type: 'accommodation_listing' },
  { pricingPlans: true }
);

// Access related data
for (const product of productsWithPlans.items) {
  console.log(product.name);
  console.log(product.pricingPlans); // Array of pricing plans
}
```

### Pagination

```typescript
// Paginated results
const page1 = await productModel.findAll(
  { type: 'service' },
  { page: 1, pageSize: 20 }
);

console.log(page1.items);  // Array of 20 products
console.log(page1.total);  // Total count of matching products
```

### Transactions

```typescript
import { getDb } from '@repo/db';

const db = getDb();

await db.transaction(async (trx) => {
  // All operations use trx for atomicity
  const product = await productModel.create({
    name: 'Service Bundle',
    type: 'service',
  }, trx);

  await pricingPlanModel.create({
    productId: product.id,
    amountMinor: 100000,
    currency: 'ARS',
  }, trx);

  // Auto-rollback on error
});
```

### Custom Model Methods

```typescript
export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'product';

  protected getTableName(): string {
    return 'products';
  }

  // Custom business logic
  async findActive(): Promise<Product[]> {
    const db = this.getClient();
    return db
      .select()
      .from(this.table)
      .where(
        and(
          isNull(products.deletedAt),
          sql`${products.metadata}->>'isActive' = 'true'`
        )
      );
  }

  async findByCategory(category: string): Promise<Product[]> {
    const db = this.getClient();
    return db
      .select()
      .from(this.table)
      .where(sql`${products.metadata}->>'category' = ${category}`);
  }
}
```

**→ [More Examples](./examples/README.md)**

---

## Testing

### Unit Tests

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { ProductModel } from '@repo/db';

describe('ProductModel', () => {
  let model: ProductModel;

  beforeAll(() => {
    model = new ProductModel();
  });

  it('should create product', async () => {
    const product = await model.create({
      name: 'Test Product',
      type: 'service',
    });

    expect(product.id).toBeDefined();
    expect(product.name).toBe('Test Product');
  });

  it('should find by id', async () => {
    const created = await model.create({ name: 'Find Test', type: 'service' });
    const found = await model.findById(created.id);

    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
  });
});
```

### Integration Tests

```typescript
it('should handle transaction rollback', async () => {
  const db = getDb();

  await expect(
    db.transaction(async (trx) => {
      await productModel.create({ name: 'Test', type: 'service' }, trx);
      throw new Error('Force rollback');
    })
  ).rejects.toThrow('Force rollback');

  // Verify nothing was created
  const products = await productModel.findAll({ name: 'Test' });
  expect(products.items).toHaveLength(0);
});
```

**→ [Testing Guide](./guides/testing.md)**

---

## Migration & Deployment

### Generate Migration

```bash
# After modifying schemas
pnpm db:generate
```

This creates a new migration file in `drizzle/migrations/` with SQL statements.

### Apply Migrations

```bash
# Apply all pending migrations
pnpm db:migrate
```

### Drizzle Studio

Visual database tool for inspecting and editing data:

```bash
pnpm db:studio
```

Opens at `https://local.drizzle.studio`

**→ [Complete Migration Guide](./guides/migrations.md)**

---

## Troubleshooting

### Common Issues

**Database connection errors**:

```typescript
// Ensure initializeDb is called before any queries
import { initializeDb } from '@repo/db';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
initializeDb(pool);
```

**Type errors**:

- Ensure schemas match Zod types in `@repo/schemas`
- Run `pnpm typecheck` to verify types
- Check that all required fields are provided

**Migration errors**:

- Review generated SQL in `drizzle/migrations/`
- Check for conflicting schema changes
- Ensure database is accessible

**Query performance**:

- Add indexes for frequently queried columns
- Use `EXPLAIN ANALYZE` to profile queries
- Consider pagination for large result sets

**→ [Complete Troubleshooting Guide](./guides/troubleshooting.md)**

---

## Contributing

See the main project [CLAUDE.md](../../../CLAUDE.md) for development guidelines and workflows.

**Package-specific guidelines**:

- All models must extend `BaseModel<T>`
- All schemas use Drizzle ORM syntax
- All exports are named (no default exports)
- All public APIs have JSDoc documentation
- Test coverage must be ≥90%

---

## Related Packages

- **[@repo/schemas](../../schemas/README.md)** - Zod validation schemas
- **[@repo/service-core](../../service-core/README.md)** - Business logic layer
- **[@repo/utils](../../utils/README.md)** - Shared utilities
- **[@repo/logger](../../logger/README.md)** - Logging utilities

---

## Resources

- **[Drizzle ORM Documentation](https://orm.drizzle.team/)** - Official Drizzle docs
- **[PostgreSQL Documentation](https://www.postgresql.org/docs/)** - PostgreSQL reference
- **[CLAUDE.md](../CLAUDE.md)** - Package development guide

---

**Need help?** Check the [Quick Start Guide](./quick-start.md) or review [common examples](./examples/README.md).
