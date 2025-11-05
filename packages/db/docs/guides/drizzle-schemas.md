# Drizzle Schemas

Complete guide to defining database table schemas using Drizzle ORM in the Hospeda project.

## Introduction

Drizzle schemas define the structure of PostgreSQL tables in TypeScript. They provide:

- **Type safety**: Full TypeScript inference from schema to queries
- **SQL generation**: Automatic migration SQL generation
- **Validation**: Compile-time checks for schema correctness
- **Relations**: First-class support for relational data
- **Flexibility**: Direct SQL access when needed

## Table Definition

### Basic pgTable Syntax

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});
```

### Anatomy of a Table Definition

```typescript
export const products           // Export const with table name (plural, camelCase)
  : ReturnType<typeof pgTable>  // TypeScript type annotation
  = pgTable(                    // pgTable function
    'products',                 // Database table name (lowercase, underscore)
    {                           // Column definitions object
      id: uuid('id')            // Column definition
        .primaryKey()           // Constraints
        .defaultRandom(),       // Default value
      // ... more columns
    }
  );
```

> **Note**: Use `ReturnType<typeof pgTable>` for proper TypeScript inference. This ensures type safety throughout your codebase.

## Column Types

### Text Types

```typescript
import { text, varchar, char } from 'drizzle-orm/pg-core';

// Unlimited text (PostgreSQL TEXT)
text('description')
text('description').notNull()
text('description').default('N/A')

// VARCHAR with length limit
varchar('name', { length: 255 })
varchar('name', { length: 255 }).notNull()

// CHAR with fixed length (rarely used)
char('code', { length: 10 })
```

**When to use:**

- `text()`: Long text, descriptions, content (no length limit)
- `varchar(n)`: Names, titles, short text with reasonable limit
- `char(n)`: Fixed-length codes (rarely needed)

### Numeric Types

```typescript
import { integer, bigint, numeric, real, doublePrecision } from 'drizzle-orm/pg-core';

// Integer (32-bit: -2,147,483,648 to 2,147,483,647)
integer('stock')
integer('stock').notNull().default(0)

// Big integer (64-bit: very large numbers)
bigint('view_count', { mode: 'number' })

// Decimal/numeric (exact precision)
numeric('price', { precision: 10, scale: 2 })  // 10 digits, 2 after decimal
numeric('rating', { precision: 3, scale: 2 })  // 3.45, 4.98, etc.

// Floating point (approximate)
real('temperature')              // 6 decimal digits precision
doublePrecision('coordinates')   // 15 decimal digits precision
```

**Best practices:**

- Use `integer` for counts, IDs, quantities
- Use `numeric` for money (store in cents to avoid decimal issues)
- Use `bigint` for timestamps, large counters
- Avoid floating point for money calculations

### UUID Type

```typescript
import { uuid } from 'drizzle-orm/pg-core';

// UUID primary key
uuid('id').primaryKey().defaultRandom()

// UUID foreign key
uuid('user_id')
  .notNull()
  .references(() => users.id)

// Nullable UUID
uuid('parent_id').references(() => categories.id)
```

> **Tip**: Use `defaultRandom()` to auto-generate UUIDs. PostgreSQL's `gen_random_uuid()` is fast and collision-resistant.

### Boolean Type

```typescript
import { boolean } from 'drizzle-orm/pg-core';

// Boolean with default
boolean('is_active').notNull().default(true)
boolean('is_published').notNull().default(false)

// Nullable boolean (three states: true, false, null)
boolean('email_verified')
```

### Timestamp Types

```typescript
import { timestamp, date, time } from 'drizzle-orm/pg-core';

// Timestamp with timezone (RECOMMENDED)
timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
timestamp('deleted_at', { withTimezone: true })

// Timestamp without timezone (NOT recommended)
timestamp('local_time')

// Date only (no time)
date('birth_date')

// Time only (no date)
time('opening_time')
```

> **Warning**: Always use `withTimezone: true` for timestamps. This prevents timezone-related bugs in production.

### JSON Types

```typescript
import { json, jsonb } from 'drizzle-orm/pg-core';
import type { Media, ContactInfo } from '@repo/schemas';

// JSONB (binary, faster queries, recommended)
jsonb('metadata').$type<Record<string, unknown>>()
jsonb('config').$type<{ theme: string; lang: string }>()
jsonb('media').$type<Media>().notNull()
jsonb('contact').$type<ContactInfo>()

// JSON (text-based, slower)
json('legacy_data').$type<Record<string, unknown>>()
```

**JSONB vs JSON:**

- **JSONB**: Binary format, supports indexing, faster queries, slightly slower writes
- **JSON**: Text format, preserves formatting, faster writes, no indexing

> **Best practice**: Always use JSONB unless you need to preserve exact JSON formatting.

### Array Types

```typescript
import { text, integer } from 'drizzle-orm/pg-core';

// Text array
text('tags').array()

// Integer array
integer('feature_ids').array()

// With default
text('categories').array().default([])
```

### Enum Types

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

// Define enum
export const RolePgEnum = pgEnum('role', ['admin', 'user', 'moderator']);

// Use in table
export const users: ReturnType<typeof pgTable> = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: RolePgEnum('role').notNull().default('user')
});
```

## Constraints

### NOT NULL

```typescript
// Required field
text('name').notNull()

// Optional field (nullable by default)
text('nickname')

// With default value
boolean('is_active').notNull().default(true)
```

### UNIQUE

```typescript
// Single column unique
text('email').notNull().unique()
text('slug').notNull().unique()

// Composite unique (define in second argument)
export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id').notNull()
  },
  (table) => ({
    // Unique combination of name + ownerId
    uniqueNamePerOwner: unique('unique_name_per_owner').on(table.name, table.ownerId)
  })
);
```

### DEFAULT Values

```typescript
// Static defaults
text('status').default('pending')
integer('count').default(0)
boolean('active').default(true)

// Function defaults
timestamp('created_at').defaultNow()          // CURRENT_TIMESTAMP
uuid('id').defaultRandom()                    // gen_random_uuid()
```

### CHECK Constraints

```typescript
import { check } from 'drizzle-orm/pg-core';

export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    price: integer('price').notNull(),
    stock: integer('stock').notNull()
  },
  (table) => ({
    // Price must be positive
    pricePositive: check('price_positive', sql`${table.price} > 0`),

    // Stock must be non-negative
    stockNonNegative: check('stock_non_negative', sql`${table.stock} >= 0`)
  })
);
```

## Primary Keys & Indexes

### Primary Keys

```typescript
// UUID primary key (recommended)
uuid('id').primaryKey().defaultRandom()

// Integer primary key (for legacy systems)
serial('id').primaryKey()

// Composite primary key
export const orderItems: ReturnType<typeof pgTable> = pgTable(
  'order_items',
  {
    orderId: uuid('order_id').notNull(),
    productId: uuid('product_id').notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orderId, table.productId] })
  })
);
```

### Indexes

```typescript
import { index } from 'drizzle-orm/pg-core';

export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    stock: integer('stock').notNull().default(0),
    categoryId: uuid('category_id').notNull()
  },
  (table) => ({
    // Single column index
    nameIdx: index('products_name_idx').on(table.name),

    // Multiple single-column indexes
    isActiveIdx: index('products_isActive_idx').on(table.isActive),
    stockIdx: index('products_stock_idx').on(table.stock),

    // Composite index (order matters!)
    categoryActiveIdx: index('products_category_active_idx').on(
      table.categoryId,
      table.isActive
    )
  })
);
```

**Index naming convention:**

```text
{tableName}_{columnName}_idx
{tableName}_{column1}_{column2}_idx
```

**When to add indexes:**

- ✅ Foreign keys
- ✅ Columns in WHERE clauses
- ✅ Columns in ORDER BY
- ✅ Columns in JOIN conditions
- ❌ Small tables (< 1000 rows)
- ❌ Columns rarely queried
- ❌ Highly volatile data (frequent updates)

## Foreign Keys

### Basic Foreign Key

```typescript
import { users } from '../user/user.dbschema';

export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),

  // Foreign key to users.id
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id)
});
```

### Foreign Key with Cascade Actions

```typescript
// ON DELETE RESTRICT (prevent deletion)
ownerId: uuid('owner_id')
  .notNull()
  .references(() => users.id, {
    onDelete: 'restrict'  // Default: cannot delete user if products exist
  })

// ON DELETE CASCADE (delete children)
ownerId: uuid('owner_id')
  .notNull()
  .references(() => users.id, {
    onDelete: 'cascade'   // Delete products when user is deleted
  })

// ON DELETE SET NULL (nullify reference)
ownerId: uuid('owner_id')
  .references(() => users.id, {
    onDelete: 'set null'  // Set to null when user is deleted
  })

// ON UPDATE CASCADE (update reference)
categoryId: uuid('category_id')
  .notNull()
  .references(() => categories.id, {
    onUpdate: 'cascade',  // Update products when category ID changes
    onDelete: 'restrict'
  })
```

**Cascade actions:**

- `restrict`: Prevent parent deletion (default)
- `cascade`: Delete/update children automatically
- `set null`: Set foreign key to NULL
- `set default`: Set foreign key to default value
- `no action`: Similar to restrict

> **Best practice**: Use `restrict` for critical data, `cascade` for truly dependent data, `set null` for optional relations.

## Enums

### Define PostgreSQL Enum

```typescript
// packages/db/src/schemas/enums.dbschema.ts
import { pgEnum } from 'drizzle-orm/pg-core';

// User roles
export const RolePgEnum = pgEnum('role', ['admin', 'user', 'moderator', 'guest']);

// Lifecycle status
export const LifecycleStatusPgEnum = pgEnum('lifecycle_status', [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
  'DELETED'
]);

// Visibility
export const VisibilityPgEnum = pgEnum('visibility', ['PUBLIC', 'PRIVATE', 'UNLISTED']);

// Accommodation type
export const AccommodationTypePgEnum = pgEnum('accommodation_type', [
  'HOTEL',
  'HOSTEL',
  'APARTMENT',
  'HOUSE',
  'CABIN'
]);
```

### Use Enum in Table

```typescript
import { LifecycleStatusPgEnum, VisibilityPgEnum } from '../enums.dbschema';

export const posts: ReturnType<typeof pgTable> = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),

  // Enum columns
  lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('DRAFT'),
  visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC')
});
```

**Enum best practices:**

- Use UPPER_CASE for enum values
- Keep enums in centralized `enums.dbschema.ts`
- Don't change enum order (breaks existing data)
- To add values, append to end or use migration

### Adding Enum Values

To add a new enum value, create a migration:

```sql
-- migration: add_new_role.sql
ALTER TYPE role ADD VALUE IF NOT EXISTS 'super_admin';
```

> **Warning**: PostgreSQL doesn't support removing enum values. Plan your enums carefully.

## Audit Fields

### Standard Audit Pattern

All tables in Hospeda should include these audit fields:

```typescript
export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ... entity-specific fields ...

  // Standard audit fields (REQUIRED)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});
```

### Extended Audit with User Tracking

```typescript
import { users } from '../user/user.dbschema';

export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ... entity-specific fields ...

  // Extended audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});
```

> **Tip**: Use `set null` for audit fields - you want to keep history even if user is deleted.

## Complex Types

### JSONB for Structured Data

```typescript
import type { Media, ContactInfo, Seo, AdminInfo } from '@repo/schemas';

export const accommodations: ReturnType<typeof pgTable> = pgTable('accommodations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),

  // Complex JSON types
  media: jsonb('media').$type<Media>().notNull(),
  contactInfo: jsonb('contact_info').$type<ContactInfo>(),
  seo: jsonb('seo').$type<Seo>(),
  adminInfo: jsonb('admin_info').$type<AdminInfo>(),

  // Generic object
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});
```

**Type definitions:**

```typescript
// packages/schemas/src/entities/media.schema.ts
import { z } from 'zod';

export const MediaSchema = z.object({
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string(),
    width: z.number(),
    height: z.number()
  })),
  videos: z.array(z.object({
    url: z.string().url(),
    thumbnail: z.string().url(),
    duration: z.number()
  })).optional()
});

export type Media = z.infer<typeof MediaSchema>;
```

### Array Columns

```typescript
// Simple array
text('tags').array().default([])
integer('category_ids').array()

// Array with type annotation
text('emails').array().$type<string[]>()

// Querying arrays (use sql operator)
import { sql } from 'drizzle-orm';

const products = await db
  .select()
  .from(productsTable)
  .where(sql`${productsTable.tags} @> ARRAY['featured']::text[]`);
```

### PostGIS Types (Geospatial)

```typescript
import { customType } from 'drizzle-orm/pg-core';

// Define custom geometry type
const geometry = customType<{ data: string }>({
  dataType() {
    return 'geometry(Point, 4326)';
  }
});

export const locations: ReturnType<typeof pgTable> = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),

  // Geospatial point (latitude, longitude)
  coordinates: geometry('coordinates').notNull()
});
```

> **Note**: PostGIS is optional. Install `postgis` extension if you need geospatial features.

## Best Practices

### Naming Conventions

```typescript
// Table names: lowercase, plural, underscore_case
export const products = pgTable('products', { /* ... */ });
export const orderItems = pgTable('order_items', { /* ... */ });
export const userBookmarks = pgTable('user_bookmarks', { /* ... */ });

// Column names: lowercase, underscore_case
id: uuid('id')
userId: uuid('user_id')
createdAt: timestamp('created_at')
isActive: boolean('is_active')

// Variable names: camelCase
export const products: ReturnType<typeof pgTable> = ...
export const orderItems: ReturnType<typeof pgTable> = ...
```

### Type Safety

```typescript
// ✅ GOOD: Typed JSONB
jsonb('metadata').$type<{ theme: string; lang: string }>()

// ❌ BAD: Untyped JSONB
jsonb('metadata')

// ✅ GOOD: Enum type
VisibilityPgEnum('visibility').notNull().default('PUBLIC')

// ❌ BAD: Text for enum
text('visibility').notNull().default('PUBLIC')
```

### Required Fields

```typescript
// ✅ GOOD: Explicit NOT NULL
text('name').notNull()
uuid('owner_id').notNull().references(() => users.id)

// ❌ BAD: Implicit nullable (confusing)
text('name')  // Is this required or optional?

// ✅ GOOD: Explicit nullable with reason
text('nickname')  // Optional: user may not have a nickname
```

### Default Values

```typescript
// ✅ GOOD: Sensible defaults
boolean('is_active').notNull().default(true)
integer('stock').notNull().default(0)
timestamp('created_at').defaultNow().notNull()

// ❌ BAD: No default for required boolean
boolean('is_active').notNull()  // Should have default true or false

// ✅ GOOD: NULL default for optional
text('nickname')  // Implicitly defaults to NULL
```

### Documentation

```typescript
/**
 * Products table
 *
 * Stores all products in the catalog with pricing,
 * inventory, and categorization information.
 *
 * Supports soft delete via deletedAt timestamp.
 */
export const products: ReturnType<typeof pgTable> = pgTable('products', {
  // Primary key
  id: uuid('id').primaryKey().defaultRandom(),

  // Core product information
  name: text('name').notNull(),              // Display name
  slug: text('slug').notNull().unique(),     // URL-friendly identifier
  description: text('description').notNull(), // Full description

  // Pricing and inventory
  price: integer('price').notNull(),  // Price in cents to avoid decimals
  stock: integer('stock').notNull().default(0),

  // ... rest of fields
});
```

## Complete Example

Here's a complete schema with all best practices:

```typescript
// packages/db/src/schemas/catalog/product.dbschema.ts
import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import type { Media } from '@repo/schemas';
import { categories } from './category.dbschema';
import { LifecycleStatusPgEnum, VisibilityPgEnum } from '../enums.dbschema';
import { users } from '../user/user.dbschema';

/**
 * Products table schema
 *
 * Manages product catalog with pricing, inventory, and categorization.
 * Supports soft delete and full audit trail.
 */
export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Core information
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull(),

    // Categorization
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),

    // Pricing and inventory
    price: integer('price').notNull(),  // Price in cents
    stock: integer('stock').notNull().default(0),

    // Status flags
    isActive: boolean('is_active').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),

    // Lifecycle and visibility
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('DRAFT'),
    visibility: VisibilityPgEnum('visibility').notNull().default('PUBLIC'),

    // Media and metadata
    media: jsonb('media').$type<Media>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    // Ownership
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
  },
  (table) => ({
    // Performance indexes
    isActiveIdx: index('products_isActive_idx').on(table.isActive),
    categoryIdIdx: index('products_categoryId_idx').on(table.categoryId),
    isFeaturedIdx: index('products_isFeatured_idx').on(table.isFeatured),

    // Composite indexes for common queries
    categoryActiveIdx: index('products_category_active_idx').on(
      table.categoryId,
      table.isActive
    ),
    featuredActiveIdx: index('products_featured_active_idx').on(
      table.isFeatured,
      table.isActive
    )
  })
);

/**
 * Product relations
 */
export const productsRelations = relations(products, ({ one, many }) => ({
  // Many-to-one relations
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  owner: one(users, {
    fields: [products.ownerId],
    references: [users.id]
  }),
  createdBy: one(users, {
    fields: [products.createdById],
    references: [users.id]
  }),
  updatedBy: one(users, {
    fields: [products.updatedById],
    references: [users.id]
  }),
  deletedBy: one(users, {
    fields: [products.deletedById],
    references: [users.id]
  }),

  // One-to-many relations
  reviews: many(productReviews),
  images: many(productImages)
}));
```

## Schema Migration Workflow

After creating or modifying a schema:

### 1. Generate Migration

```bash
cd packages/db
pnpm db:generate
```

This creates a new migration file in `drizzle/migrations/`.

### 2. Review Migration

```sql
-- Example: drizzle/migrations/0001_create_products.sql
CREATE TABLE "products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "price" INTEGER NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX "products_isActive_idx" ON "products" ("is_active");
```

### 3. Apply Migration

```bash
pnpm db:migrate
```

### 4. Verify in Database

```bash
pnpm db:studio
```

## Common Patterns

### Junction Table (Many-to-Many)

```typescript
export const rProductTags: ReturnType<typeof pgTable> = pgTable(
  'r_product_tags',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),

    // Optional: extra metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    // Composite primary key
    pk: primaryKey({ columns: [table.productId, table.tagId] }),

    // Indexes for reverse lookups
    productIdIdx: index('r_product_tags_productId_idx').on(table.productId),
    tagIdIdx: index('r_product_tags_tagId_idx').on(table.tagId)
  })
);
```

### Polymorphic Relations

```typescript
export const comments: ReturnType<typeof pgTable> = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),

  // Polymorphic reference
  entityType: text('entity_type').notNull(),  // 'product', 'post', 'event'
  entityId: uuid('entity_id').notNull(),

  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  // Index on polymorphic keys
  entityIdx: index('comments_entity_idx').on(table.entityType, table.entityId)
}));
```

### Soft Delete Pattern

```typescript
export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),

  // Standard audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

  // Soft delete timestamp
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  // Optional: who deleted it
  deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});
```

## Troubleshooting

### Error: "Cannot find module 'drizzle-orm/pg-core'"

Install dependencies:

```bash
pnpm install drizzle-orm pg
```

### Error: "Property 'defaultRandom' does not exist"

Update Drizzle ORM to latest version:

```bash
pnpm update drizzle-orm
```

### Migration generates wrong SQL

Check column types match PostgreSQL expectations:

```typescript
// ❌ Wrong: TypeScript number doesn't map to PostgreSQL
price: number()  // Error!

// ✅ Correct: Use integer or numeric
price: integer('price')
price: numeric('price', { precision: 10, scale: 2 })
```

### Foreign key constraint errors

Ensure tables are created in correct order:

```typescript
// ✅ Correct order: users first, then products
export const users: ReturnType<typeof pgTable> = pgTable('users', { /* ... */ });
export const products: ReturnType<typeof pgTable> = pgTable('products', {
  ownerId: uuid('owner_id').references(() => users.id)
});

// ❌ Wrong: products references users before it's defined
```

## Related Guides

- [Creating Models](./creating-models.md) - Build model classes from schemas
- [Relations](./relations.md) - Define and query relations
- [Migrations](./migrations.md) - Migration workflow
- [Testing](./testing.md) - Test your schemas

## Additional Resources

- [Drizzle ORM Column Types](https://orm.drizzle.team/docs/column-types/pg)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [Drizzle Schema API](https://orm.drizzle.team/docs/sql-schema-declaration)
