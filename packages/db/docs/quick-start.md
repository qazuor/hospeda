# Quick Start Guide

**Get productive with @repo/db in 5 minutes**

This guide will walk you through the essentials of using the database layer, from initialization to performing CRUD operations with relations and transactions. By the end, you'll be able to confidently work with models, schemas, and queries.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Step 1: Initialize Database](#step-1-initialize-database)
3. [Step 2: Create Your First Schema](#step-2-create-your-first-schema)
4. [Step 3: Create Your First Model](#step-3-create-your-first-model)
5. [Step 4: Use the Model](#step-4-use-the-model)
6. [Step 5: Advanced Operations](#step-5-advanced-operations)
7. [Next Steps](#next-steps)

---

## Introduction

### What You'll Learn

- How to initialize the database connection
- How to define a Drizzle schema
- How to create a model extending BaseModel
- How to perform CRUD operations
- How to work with relations and transactions

### Prerequisites

- Node.js 18+ installed
- PostgreSQL 13+ running (local or remote)
- Basic TypeScript knowledge
- Hospeda monorepo set up

### Time Estimate

⏱️ **5 minutes** for basic setup and first operations
⏱️ **+10 minutes** for advanced features

---

## Step 1: Initialize Database

Before using any models, you must initialize the database connection. This should be done once at application startup.

### Install Dependencies

If you're setting up a new package, ensure the database package is installed:

```bash
# From project root
cd packages/your-package
pnpm add @repo/db
```

### Create Database Client

```typescript
// src/db/client.ts
import { Pool } from 'pg';
import { initializeDb } from '@repo/db';

/**
 * Initialize database connection pool
 *
 * This must be called once at application startup before any database
 * operations are performed.
 *
 * @returns Database pool instance
 */
export function initializeDatabaseConnection(): Pool {
  // Create connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of clients in pool
    idleTimeoutMillis: 30000, // Close idle clients after 30s
    connectionTimeoutMillis: 2000, // Return error after 2s if no connection available
  });

  // Initialize Drizzle client with the pool
  initializeDb(pool);

  // Log successful connection (in production, use proper logger)
  console.log('✅ Database connection initialized');

  return pool;
}
```

### Initialize at Startup

```typescript
// src/index.ts (or app entry point)
import { initializeDatabaseConnection } from './db/client';

async function main(): Promise<void> {
  // Initialize database FIRST
  const pool = initializeDatabaseConnection();

  // Now you can use any models
  // ... rest of your application setup

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Closing database pool...');
    await pool.end();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
```

### Verify Connection

```typescript
import { getDb } from '@repo/db';
import { sql } from 'drizzle-orm';

async function testConnection(): Promise<void> {
  try {
    const db = getDb();
    const result = await db.execute(sql`SELECT NOW()`);
    console.log('✅ Database connection test passed');
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    throw error;
  }
}
```

> **Note:** Always call `initializeDb()` before attempting any database operations. Failure to do so will result in runtime errors.

---

## Step 2: Create Your First Schema

Schemas define your database table structure using Drizzle ORM. Let's create a `products` table as an example.

### Define Table Schema

```typescript
// src/schemas/catalog/product.dbschema.ts
import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema';
import { reviews } from './review.dbschema';

/**
 * Products table schema
 *
 * Represents products available in the catalog, including physical products,
 * digital services, subscriptions, and bundles.
 */
export const products = pgTable('products', {
  // Primary key
  id: uuid('id').primaryKey().defaultRandom(),

  // Core fields
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  price: integer('price').notNull(), // Price in cents/minor units
  stock: integer('stock').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),

  // Additional metadata (flexible JSONB field)
  metadata: jsonb('metadata'),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

  // Soft delete
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),

  // Admin metadata (internal use only)
  adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
});
```

### Define Relations

```typescript
// Continue in the same file or separate relations file

/**
 * Product relations
 *
 * Defines relationships between products and other entities
 */
export const productRelations = relations(products, ({ one, many }) => ({
  // Many-to-one: Product has one creator
  createdBy: one(users, {
    fields: [products.createdById],
    references: [users.id],
    relationName: 'product_created_by',
  }),

  // Many-to-one: Product has one updater
  updatedBy: one(users, {
    fields: [products.updatedById],
    references: [users.id],
    relationName: 'product_updated_by',
  }),

  // One-to-many: Product has many reviews
  reviews: many(reviews, {
    relationName: 'product_reviews',
  }),
}));
```

### Define Enums (Optional)

If your entity uses enums, define them in the enums schema:

```typescript
// src/schemas/enums.dbschema.ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const ProductTypePgEnum = pgEnum('product_type', [
  'physical',
  'digital',
  'service',
  'subscription',
]);

// Use in your table schema
export const products = pgTable('products', {
  // ... other fields
  type: ProductTypePgEnum('type').notNull(),
});
```

### Export from Index

```typescript
// src/schemas/catalog/index.ts
export * from './product.dbschema';
export * from './review.dbschema';
```

### Generate Migration

After defining your schema, generate a migration:

```bash
# From project root
cd packages/db
pnpm db:generate
```

This creates a new migration file in `drizzle/migrations/` with the SQL to create your table.

### Apply Migration

```bash
pnpm db:migrate
```

> **Tip:** Use `pnpm db:studio` to visually inspect your database and verify the table was created correctly.

---

## Step 3: Create Your First Model

Models extend `BaseModel<T>` and provide a clean API for database operations. Let's create a `ProductModel`.

### Define the Model

```typescript
// src/models/catalog/product.model.ts
import type { Product, ProductTypeEnum } from '@repo/schemas';
import { and, eq, isNull, sql, ilike } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../../base/base.model';
import { products } from '../../schemas/catalog/product.dbschema';
import type * as schema from '../../schemas/index.js';

/**
 * Product model - Manages product catalog operations
 *
 * Extends BaseModel to provide standard CRUD operations plus
 * product-specific business logic like inventory management,
 * price calculations, and availability checks.
 *
 * @example
 * ```typescript
 * const productModel = new ProductModel();
 * const product = await productModel.create({
 *   name: 'Premium Subscription',
 *   slug: 'premium-subscription',
 *   description: 'Monthly premium features',
 *   price: 2999, // $29.99
 *   stock: 999,
 * });
 * ```
 */
export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'product';

  /**
   * Get the table name for relation queries
   */
  protected getTableName(): string {
    return 'products';
  }

  /**
   * Find products by type
   *
   * @param type - Product type (physical, digital, service, subscription)
   * @param tx - Optional transaction client
   * @returns Array of products matching the type
   *
   * @example
   * ```typescript
   * const digitalProducts = await productModel.findByType('digital');
   * ```
   */
  async findByType(
    type: ProductTypeEnum,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product[]> {
    const db = this.getClient(tx);

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          eq(products.type, type),
          isNull(products.deletedAt)
        )
      );

    return result as Product[];
  }

  /**
   * Find products by slug
   *
   * @param slug - Unique product slug
   * @param tx - Optional transaction client
   * @returns Product or null if not found
   *
   * @example
   * ```typescript
   * const product = await productModel.findBySlug('premium-subscription');
   * ```
   */
  async findBySlug(
    slug: string,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product | null> {
    return this.findOne({ slug }, tx);
  }

  /**
   * Find active products (not deleted, isActive = true)
   *
   * @param tx - Optional transaction client
   * @returns Array of active products
   *
   * @example
   * ```typescript
   * const activeProducts = await productModel.findActive();
   * ```
   */
  async findActive(tx?: NodePgDatabase<typeof schema>): Promise<Product[]> {
    const db = this.getClient(tx);

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          isNull(products.deletedAt),
          eq(products.isActive, true)
        )
      );

    return result as Product[];
  }

  /**
   * Search products by name
   *
   * @param query - Search query (case-insensitive)
   * @param tx - Optional transaction client
   * @returns Array of matching products
   *
   * @example
   * ```typescript
   * const results = await productModel.searchByName('subscription');
   * ```
   */
  async searchByName(
    query: string,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product[]> {
    const db = this.getClient(tx);

    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          ilike(products.name, `%${query}%`),
          isNull(products.deletedAt)
        )
      );

    return result as Product[];
  }

  /**
   * Check if product is available for purchase
   *
   * @param productId - Product ID
   * @param quantity - Desired quantity (default: 1)
   * @param tx - Optional transaction client
   * @returns True if product is available
   *
   * @example
   * ```typescript
   * const available = await productModel.isAvailable('product-uuid', 5);
   * if (available) {
   *   // Proceed with purchase
   * }
   * ```
   */
  async isAvailable(
    productId: string,
    quantity = 1,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<boolean> {
    const product = await this.findById(productId, tx);

    if (!product || product.deletedAt || !product.isActive) {
      return false;
    }

    return product.stock >= quantity;
  }

  /**
   * Update product stock (atomic operation)
   *
   * @param productId - Product ID
   * @param quantity - Quantity to add (positive) or remove (negative)
   * @param tx - Optional transaction client
   * @returns Updated product
   *
   * @example
   * ```typescript
   * // Add stock
   * await productModel.updateStock('product-uuid', 10);
   *
   * // Remove stock (purchase)
   * await productModel.updateStock('product-uuid', -1);
   * ```
   */
  async updateStock(
    productId: string,
    quantity: number,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product> {
    const db = this.getClient(tx);

    const [updated] = await db
      .update(products)
      .set({
        stock: sql`${products.stock} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    if (!updated) {
      throw new Error(`Product not found: ${productId}`);
    }

    return updated as Product;
  }
}
```

### Export from Index

```typescript
// src/models/catalog/index.ts
export * from './product.model';
```

> **Best Practice:** Always add JSDoc comments to your models and methods. This improves IDE autocomplete and helps other developers understand your code.

---

## Step 4: Use the Model

Now that you have a model, let's use it to perform database operations.

### Create Records

```typescript
import { ProductModel } from '@repo/db';

const productModel = new ProductModel();

/**
 * Create a new product
 */
async function createProduct() {
  const product = await productModel.create({
    name: 'Premium Subscription',
    slug: 'premium-subscription',
    description: 'Access to all premium features for one month',
    price: 2999, // $29.99 in cents
    stock: 999,
    isActive: true,
    metadata: {
      category: 'subscription',
      features: ['unlimited-listings', 'priority-support', 'analytics'],
    },
  });

  console.log('✅ Product created:', product.id);
  return product;
}
```

### Read Records

#### Find by ID

```typescript
/**
 * Find product by ID
 */
async function getProduct(productId: string) {
  const product = await productModel.findById(productId);

  if (!product) {
    console.log('❌ Product not found');
    return null;
  }

  console.log('✅ Product found:', product.name);
  return product;
}
```

#### Find One

```typescript
/**
 * Find product by unique field
 */
async function getProductBySlug(slug: string) {
  const product = await productModel.findBySlug(slug);

  if (!product) {
    console.log('❌ Product not found');
    return null;
  }

  return product;
}
```

#### Find All

```typescript
/**
 * Find all products matching criteria
 */
async function listProducts() {
  // Find all active products
  const activeProducts = await productModel.findAll({
    isActive: true,
    deletedAt: null,
  });

  console.log(`Found ${activeProducts.items.length} active products`);
  return activeProducts.items;
}
```

#### Pagination

```typescript
/**
 * Get paginated products
 */
async function getProductsPage(page = 1, pageSize = 20) {
  const result = await productModel.findAll(
    { isActive: true },
    { page, pageSize }
  );

  console.log(`Page ${page}: ${result.items.length} products`);
  console.log(`Total products: ${result.total}`);
  console.log(`Total pages: ${Math.ceil(result.total / pageSize)}`);

  return result;
}
```

### Update Records

```typescript
/**
 * Update product
 */
async function updateProduct(productId: string) {
  const updated = await productModel.update(productId, {
    name: 'Premium Subscription (Updated)',
    price: 3499, // Price increase
    updatedAt: new Date(),
  });

  console.log('✅ Product updated:', updated.name);
  return updated;
}
```

### Delete Records

#### Soft Delete

```typescript
/**
 * Soft delete (recommended)
 */
async function deactivateProduct(productId: string) {
  await productModel.softDelete({ id: productId });
  console.log('✅ Product soft deleted (can be restored)');
}
```

#### Restore

```typescript
/**
 * Restore soft-deleted product
 */
async function restoreProduct(productId: string) {
  await productModel.restore({ id: productId });
  console.log('✅ Product restored');
}
```

#### Hard Delete

```typescript
/**
 * Permanent delete (use with caution)
 */
async function deleteProductPermanently(productId: string) {
  await productModel.hardDelete({ id: productId });
  console.log('⚠️ Product permanently deleted');
}
```

### Query with Relations

```typescript
import { ProductModel } from '@repo/db';

/**
 * Get products with related reviews
 */
async function getProductsWithReviews() {
  const result = await productModel.findAllWithRelations(
    { isActive: true },
    { reviews: true }
  );

  for (const product of result.items) {
    console.log(`${product.name}: ${product.reviews?.length || 0} reviews`);
  }

  return result.items;
}
```

### Count & Exists

```typescript
/**
 * Count products
 */
async function countActiveProducts() {
  const count = await productModel.count({ isActive: true });
  console.log(`Active products: ${count}`);
  return count;
}

/**
 * Check if product exists
 */
async function checkProductExists(slug: string) {
  const exists = await productModel.exists({ slug });
  console.log(`Product "${slug}" exists: ${exists}`);
  return exists;
}
```

---

## Step 5: Advanced Operations

### Custom Queries

Sometimes you need more complex queries than BaseModel provides:

```typescript
import { getDb } from '@repo/db';
import { products } from '@repo/db/schemas';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

/**
 * Find products with complex filters
 */
async function findProductsInPriceRange(minPrice: number, maxPrice: number) {
  const db = getDb();

  const results = await db
    .select()
    .from(products)
    .where(
      and(
        gte(products.price, minPrice),
        lte(products.price, maxPrice),
        eq(products.isActive, true)
      )
    )
    .orderBy(products.price);

  return results;
}
```

### Transactions

Transactions ensure that multiple operations succeed or fail together:

```typescript
import { getDb } from '@repo/db';
import { ProductModel } from '@repo/db';

/**
 * Create product with initial review (atomic)
 */
async function createProductWithReview() {
  const db = getDb();
  const productModel = new ProductModel();

  await db.transaction(async (trx) => {
    // Create product
    const product = await productModel.create({
      name: 'Test Product',
      slug: 'test-product',
      description: 'Test description',
      price: 1000,
      stock: 10,
    }, trx);

    // Create initial review
    const reviewModel = new ReviewModel();
    await reviewModel.create({
      productId: product.id,
      rating: 5,
      comment: 'Great product!',
    }, trx);

    // If either operation fails, both are rolled back
  });

  console.log('✅ Product and review created atomically');
}
```

### Bulk Operations

```typescript
/**
 * Update multiple products at once
 */
async function deactivateOldProducts() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const db = getDb();
  const result = await db
    .update(products)
    .set({ isActive: false })
    .where(
      and(
        lte(products.createdAt, oneYearAgo),
        eq(products.isActive, true)
      )
    );

  console.log(`✅ Deactivated old products`);
  return result;
}
```

### Raw SQL (Use Sparingly)

For extremely complex queries, you can use raw SQL:

```typescript
import { getDb } from '@repo/db';
import { sql } from 'drizzle-orm';

/**
 * Complex analytics query
 */
async function getProductAnalytics() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT
      p.name,
      COUNT(r.id) as review_count,
      AVG(r.rating) as avg_rating
    FROM products p
    LEFT JOIN reviews r ON r.product_id = p.id
    WHERE p.deleted_at IS NULL
    GROUP BY p.id, p.name
    ORDER BY avg_rating DESC
    LIMIT 10
  `);

  return result.rows;
}
```

> **Warning:** Avoid raw SQL when possible. Use Drizzle's query builder for type safety and better maintainability.

---

## Next Steps

Congratulations! 🎉 You now know the basics of working with `@repo/db`.

### Continue Learning

#### Complete API Reference

- **[BaseModel API](./api/BaseModel.md)** - All available methods
- **[Query Building](./api/query-builder.md)** - Dynamic query construction
- **[Relations](./api/relations.md)** - Working with related entities

#### Development Guides

- **[Creating Models](./guides/creating-models.md)** - Detailed model patterns
- **[Defining Schemas](./guides/defining-schemas.md)** - Schema best practices
- **[Migrations](./guides/migrations.md)** - Managing schema changes
- **[Testing Models](./guides/testing.md)** - Test strategies and patterns
- **[Transactions](./guides/transactions.md)** - Advanced transaction patterns

#### Advanced Topics

- **[Query Optimization](./guides/optimization.md)** - Performance tuning
- **[Custom Queries](./guides/custom-queries.md)** - Beyond BaseModel
- **[Error Handling](./guides/error-handling.md)** - Robust error patterns

### Common Patterns to Explore

#### Soft Delete Patterns

```typescript
// Find only non-deleted records (default)
const active = await productModel.findAll({ deletedAt: null });

// Find deleted records
const deleted = await productModel.findAll({ deletedAt: { $ne: null } });

// Restore deleted record
await productModel.restore({ id: 'uuid' });
```

#### Audit Trail

All models automatically track `createdAt`, `updatedAt`, and `deletedAt`:

```typescript
const product = await productModel.findById('uuid');
console.log('Created:', product.createdAt);
console.log('Last updated:', product.updatedAt);
console.log('Deleted:', product.deletedAt || 'Not deleted');
```

#### Complex Filters

```typescript
import { and, or, like, gte } from 'drizzle-orm';

const results = await db
  .select()
  .from(products)
  .where(
    and(
      or(
        like(products.name, '%subscription%'),
        like(products.description, '%subscription%')
      ),
      gte(products.price, 1000)
    )
  );
```

### Get Help

- **[Documentation Portal](./README.md)** - Complete docs
- **[Troubleshooting Guide](./guides/troubleshooting.md)** - Common issues
- **[Examples](./examples/README.md)** - More code samples
- **[CLAUDE.md](../CLAUDE.md)** - Package development guide

### Testing Resources

Learn how to test your models effectively:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ProductModel } from '@repo/db';

describe('ProductModel', () => {
  let model: ProductModel;
  let testProduct: Product;

  beforeAll(async () => {
    model = new ProductModel();
  });

  it('should create and find product', async () => {
    // Create
    testProduct = await model.create({
      name: 'Test Product',
      slug: 'test-product',
      description: 'Test',
      price: 1000,
      stock: 10,
    });

    expect(testProduct.id).toBeDefined();

    // Find
    const found = await model.findById(testProduct.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Test Product');
  });

  afterAll(async () => {
    // Cleanup
    if (testProduct?.id) {
      await model.hardDelete({ id: testProduct.id });
    }
  });
});
```

---

**You're all set!** Start building with confidence using `@repo/db`. 🚀
