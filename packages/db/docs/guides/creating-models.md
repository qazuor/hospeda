# Creating Models

Complete tutorial on creating new database models in the Hospeda project.

## What You'll Learn

This guide covers everything you need to create a new model from scratch:

- Defining Drizzle table schemas
- Setting up relations between entities
- Creating model classes that extend BaseModel
- Overriding methods for custom logic
- Adding domain-specific business logic
- Writing comprehensive tests
- Following project conventions and best practices

## Prerequisites

Before starting, ensure you have:

- Basic TypeScript knowledge
- Understanding of relational databases (PostgreSQL)
- Familiarity with ORM concepts
- Development environment set up ([setup guide](../../README.md#setup))

## Overview

Models in Hospeda follow a layered architecture:

```text
┌─────────────────────────────────────┐
│  Drizzle Schema (Database Table)    │
│  - Column definitions               │
│  - Constraints                      │
│  - Indexes                          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Relations Definition               │
│  - One-to-many                      │
│  - Many-to-one                      │
│  - Many-to-many                     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Model Class (extends BaseModel)    │
│  - CRUD operations (inherited)      │
│  - Custom queries                   │
│  - Business logic                   │
│  - Validation                       │
└─────────────────────────────────────┘
```

## Example Entity: Product

Throughout this guide, we'll create a complete Product model with:

- **ID**: UUID primary key
- **Name**: Product name (required)
- **Slug**: URL-friendly identifier (unique)
- **Description**: Full product description
- **Price**: Product price in cents (integer)
- **Stock**: Current inventory count
- **isActive**: Visibility flag
- **Audit fields**: createdAt, updatedAt, deletedAt

## Step 1: Create Drizzle Schema

### Location

Create schema file at:

```text
packages/db/src/schemas/catalog/product.dbschema.ts
```

### Define Table

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

/**
 * Product entity schema
 *
 * Defines the structure of the products table in PostgreSQL.
 * All products support soft delete via deletedAt timestamp.
 */
export const products: ReturnType<typeof pgTable> = pgTable('products', {
  // Primary key
  id: uuid('id').primaryKey().defaultRandom(),

  // Core fields
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),

  // Pricing and inventory
  price: integer('price').notNull(), // Price in cents
  stock: integer('stock').notNull().default(0),

  // Status
  isActive: boolean('is_active').notNull().default(true),

  // Audit fields (required in all tables)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});
```

### Column Types Reference

Common Drizzle column types used in Hospeda:

```typescript
// Text types
text('column_name')                        // Unlimited text
text('column_name').notNull()              // Required text
text('column_name').unique()               // Unique constraint

// Numeric types
integer('column_name')                     // 32-bit integer
integer('column_name').default(0)          // With default value
numeric('column_name', { precision: 10, scale: 2 }) // Decimal numbers

// UUID
uuid('id')                                 // UUID type
uuid('id').primaryKey()                    // UUID primary key
uuid('id').defaultRandom()                 // Auto-generate UUID

// Boolean
boolean('is_active')                       // Boolean field
boolean('is_active').default(true)         // With default

// Timestamps
timestamp('created_at')                    // Timestamp without timezone
timestamp('created_at', { withTimezone: true }) // With timezone (recommended)
timestamp('created_at').defaultNow()       // Auto-set to now

// JSONB (for complex types)
jsonb('metadata').$type<Record<string, unknown>>() // Generic object
jsonb('config').$type<CustomType>()        // Typed object
```

### Add Foreign Keys

If your entity references other tables:

```typescript
import { users } from '../user/user.dbschema';

export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  stock: integer('stock').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),

  // Foreign key to users table
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'restrict' // Prevent deletion if products exist
    }),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});
```

### Add Indexes

Indexes improve query performance for frequently searched columns:

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';

export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull(),
    price: integer('price').notNull(),
    stock: integer('stock').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true })
  },
  (table) => ({
    // Index on isActive for filtering active products
    products_isActive_idx: index('products_isActive_idx').on(table.isActive),

    // Composite index for common query pattern
    products_isActive_stock_idx: index('products_isActive_stock_idx').on(
      table.isActive,
      table.stock
    )
  })
);
```

> **Note**: Add indexes for columns used in WHERE clauses, ORDER BY, or JOIN conditions. But don't over-index - each index adds overhead to INSERT/UPDATE operations.

## Step 2: Define Relations

### Location

Add relations in the same file as the schema:

```typescript
// At the end of product.dbschema.ts
import { relations } from 'drizzle-orm';

export const productsRelations = relations(products, ({ one, many }) => ({
  // Many-to-one: Product belongs to one owner
  owner: one(users, {
    fields: [products.ownerId],
    references: [users.id]
  }),

  // One-to-many: Product has many reviews
  reviews: many(productReviews),

  // One-to-many: Product has many tags
  tags: many(rProductTags)
}));
```

### Relation Types

#### One-to-One

When an entity has exactly one related record:

```typescript
import { relations } from 'drizzle-orm';

export const productsRelations = relations(products, ({ one }) => ({
  // Product has one inventory record
  inventory: one(productInventory, {
    fields: [products.id],
    references: [productInventory.productId]
  })
}));
```

#### Many-to-One

When many records belong to one parent:

```typescript
export const productsRelations = relations(products, ({ one }) => ({
  // Many products belong to one category
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  })
}));
```

#### One-to-Many

When one record has many children:

```typescript
export const productsRelations = relations(products, ({ many }) => ({
  // One product has many reviews
  reviews: many(productReviews)
}));
```

#### Many-to-Many

Uses a junction/pivot table:

```typescript
// Junction table
export const rProductTags: ReturnType<typeof pgTable> = pgTable('r_product_tags', {
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id')
    .notNull()
    .references(() => tags.id, { onDelete: 'cascade' })
});

// Product side
export const productsRelations = relations(products, ({ many }) => ({
  tags: many(rProductTags)
}));

// Junction table relations
export const rProductTagsRelations = relations(rProductTags, ({ one }) => ({
  product: one(products, {
    fields: [rProductTags.productId],
    references: [products.id]
  }),
  tag: one(tags, {
    fields: [rProductTags.tagId],
    references: [tags.id]
  })
}));

// Tag side
export const tagsRelations = relations(tags, ({ many }) => ({
  products: many(rProductTags)
}));
```

### Export Relations

Update the schema index file:

```typescript
// packages/db/src/schemas/catalog/index.ts
export { products, productsRelations } from './product.dbschema';
export { categories, categoriesRelations } from './category.dbschema';
// ... other exports
```

## Step 3: Create Model Class

### Location

Create model file at:

```text
packages/db/src/models/product.model.ts
```

### Basic Model Structure

```typescript
import type { Product } from '@repo/schemas';
import { BaseModel } from '../base/base.model';
import { products } from '../schemas/catalog/product.dbschema';

/**
 * Model for the Product entity
 *
 * Extends BaseModel to provide CRUD and relation methods.
 * Handles all database operations for products including
 * inventory management and pricing queries.
 *
 * @example
 * ```typescript
 * const productModel = new ProductModel();
 *
 * // Create product
 * const product = await productModel.create({
 *   name: 'Premium Widget',
 *   slug: 'premium-widget',
 *   description: 'High-quality widget',
 *   price: 9999, // $99.99 in cents
 *   stock: 100
 * });
 *
 * // Find by ID
 * const found = await productModel.findById(product.id);
 *
 * // Soft delete
 * await productModel.softDelete({ id: product.id });
 * ```
 */
export class ProductModel extends BaseModel<Product> {
  /**
   * The Drizzle table schema for products
   */
  protected table = products;

  /**
   * The entity name for logging and error context
   */
  protected entityName = 'products';

  /**
   * Get the table name for dynamic relation queries
   *
   * @returns Table name as string
   */
  protected getTableName(): string {
    return 'products';
  }
}

// Export singleton instance for convenience
export const productModel = new ProductModel();
```

### Constructor Pattern

Models don't typically need custom constructors as BaseModel handles initialization. But if needed:

```typescript
export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'products';

  /**
   * Optional custom logger or config
   */
  private logger?: Logger;

  /**
   * Create new ProductModel instance
   *
   * @param options - Optional configuration
   * @param options.logger - Custom logger instance
   */
  constructor(options?: { logger?: Logger }) {
    super();
    this.logger = options?.logger;
  }

  protected getTableName(): string {
    return 'products';
  }
}
```

> **Tip**: Keep constructors simple. Most models don't need custom constructors.

## Step 4: Override Methods

### Override findAll for Custom Search

Add custom filtering logic:

```typescript
import { getDb } from '../client';
import { like, and, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schemas/index';

export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'products';

  protected getTableName(): string {
    return 'products';
  }

  /**
   * Find products with custom filtering
   *
   * Extends base findAll with:
   * - Name/description search
   * - Price range filtering
   * - Stock availability filtering
   *
   * @param where - Filter conditions
   * @param where.q - Search query for name/description
   * @param where.minPrice - Minimum price filter
   * @param where.maxPrice - Maximum price filter
   * @param where.inStock - Filter for in-stock items only
   * @param options - Pagination options
   * @param tx - Optional transaction
   * @returns Filtered products with total count
   *
   * @example
   * ```typescript
   * const { items, total } = await productModel.findAll({
   *   q: 'widget',
   *   minPrice: 1000,
   *   maxPrice: 5000,
   *   inStock: true
   * }, { page: 1, pageSize: 20 });
   * ```
   */
  async findAll(
    where: Record<string, unknown>,
    options?: { page?: number; pageSize?: number },
    tx?: NodePgDatabase<typeof schema>
  ): Promise<{ items: Product[]; total: number }> {
    const db = this.getClient(tx);
    const conditions = [];

    // Text search in name or description
    if (where.q && typeof where.q === 'string') {
      conditions.push(
        like(this.table.name, `%${where.q}%`)
      );
    }

    // Price range filtering
    if (where.minPrice !== undefined) {
      conditions.push(gte(this.table.price, where.minPrice as number));
    }

    if (where.maxPrice !== undefined) {
      conditions.push(lte(this.table.price, where.maxPrice as number));
    }

    // Stock availability
    if (where.inStock === true) {
      conditions.push(gte(this.table.stock, 1));
    }

    // Active status
    if (where.isActive !== undefined) {
      conditions.push(eq(this.table.isActive, where.isActive as boolean));
    }

    // Soft delete filter (always exclude deleted)
    conditions.push(eq(this.table.deletedAt, null));

    // Build final where clause
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Handle pagination
    const isPaginated = options?.page !== undefined && options?.pageSize !== undefined;

    if (isPaginated) {
      const offset = (options.page! - 1) * options.pageSize!;
      const [items, [{ count: total }]] = await Promise.all([
        db.select().from(this.table).where(whereClause).limit(options.pageSize!).offset(offset),
        db.select({ count: count() }).from(this.table).where(whereClause)
      ]);

      return { items: items as Product[], total: Number(total) };
    }

    // No pagination - return all
    const items = await db.select().from(this.table).where(whereClause);
    return { items: items as Product[], total: items.length };
  }
}
```

### Add Custom Query Methods

```typescript
/**
 * Find products by slug
 *
 * @param slug - Product slug
 * @param tx - Optional transaction
 * @returns Product or null
 *
 * @example
 * ```typescript
 * const product = await productModel.findBySlug('premium-widget');
 * ```
 */
async findBySlug(
  slug: string,
  tx?: NodePgDatabase<typeof schema>
): Promise<Product | null> {
  return this.findOne({ slug }, tx);
}

/**
 * Find products with low stock
 *
 * @param threshold - Stock threshold (default: 10)
 * @param tx - Optional transaction
 * @returns Products below threshold
 *
 * @example
 * ```typescript
 * const lowStock = await productModel.findLowStock(5);
 * ```
 */
async findLowStock(
  threshold: number = 10,
  tx?: NodePgDatabase<typeof schema>
): Promise<Product[]> {
  const db = this.getClient(tx);

  const items = await db
    .select()
    .from(this.table)
    .where(
      and(
        lte(this.table.stock, threshold),
        eq(this.table.isActive, true),
        eq(this.table.deletedAt, null)
      )
    );

  return items as Product[];
}

/**
 * Find products by price range
 *
 * @param options - Price range options
 * @param options.minPrice - Minimum price in cents
 * @param options.maxPrice - Maximum price in cents
 * @param tx - Optional transaction
 * @returns Products in range
 *
 * @example
 * ```typescript
 * const affordable = await productModel.findByPriceRange({
 *   minPrice: 1000,
 *   maxPrice: 5000
 * });
 * ```
 */
async findByPriceRange(
  options: { minPrice: number; maxPrice: number },
  tx?: NodePgDatabase<typeof schema>
): Promise<Product[]> {
  const db = this.getClient(tx);

  const items = await db
    .select()
    .from(this.table)
    .where(
      and(
        gte(this.table.price, options.minPrice),
        lte(this.table.price, options.maxPrice),
        eq(this.table.isActive, true),
        eq(this.table.deletedAt, null)
      )
    );

  return items as Product[];
}
```

## Step 5: Add Custom Business Logic

```typescript
import { sql } from 'drizzle-orm';
import { DbError } from '../utils/error';
import { logQuery, logError } from '../utils/logger';

export class ProductModel extends BaseModel<Product> {
  // ... previous code

  /**
   * Update product stock after sale
   *
   * Decrements stock by quantity. Throws error if insufficient stock.
   *
   * @param productId - Product ID
   * @param quantity - Quantity sold
   * @param tx - Optional transaction
   * @throws {DbError} If insufficient stock
   *
   * @example
   * ```typescript
   * await productModel.decrementStock('product-id', 5);
   * ```
   */
  async decrementStock(
    productId: string,
    quantity: number,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<void> {
    const db = this.getClient(tx);

    try {
      // Check current stock
      const product = await this.findById(productId, tx);
      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}, requested: ${quantity}`);
      }

      // Update stock
      await db
        .update(this.table)
        .set({ stock: sql`${this.table.stock} - ${quantity}` })
        .where(eq(this.table.id, productId));

      logQuery(this.entityName, 'decrementStock', { productId, quantity }, 'success');
    } catch (error) {
      logError(this.entityName, 'decrementStock', { productId, quantity }, error as Error);
      throw new DbError(
        this.entityName,
        'decrementStock',
        { productId, quantity },
        (error as Error).message
      );
    }
  }

  /**
   * Increment product stock after restock
   *
   * @param productId - Product ID
   * @param quantity - Quantity added
   * @param tx - Optional transaction
   *
   * @example
   * ```typescript
   * await productModel.incrementStock('product-id', 50);
   * ```
   */
  async incrementStock(
    productId: string,
    quantity: number,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<void> {
    const db = this.getClient(tx);

    try {
      await db
        .update(this.table)
        .set({ stock: sql`${this.table.stock} + ${quantity}` })
        .where(eq(this.table.id, productId));

      logQuery(this.entityName, 'incrementStock', { productId, quantity }, 'success');
    } catch (error) {
      logError(this.entityName, 'incrementStock', { productId, quantity }, error as Error);
      throw new DbError(
        this.entityName,
        'incrementStock',
        { productId, quantity },
        (error as Error).message
      );
    }
  }

  /**
   * Toggle product active status
   *
   * @param productId - Product ID
   * @param tx - Optional transaction
   * @returns Updated product
   *
   * @example
   * ```typescript
   * const product = await productModel.toggleActive('product-id');
   * ```
   */
  async toggleActive(
    productId: string,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product | null> {
    const db = this.getClient(tx);

    try {
      const product = await this.findById(productId, tx);
      if (!product) {
        return null;
      }

      const updated = await this.update(
        { id: productId },
        { isActive: !product.isActive },
        tx
      );

      logQuery(this.entityName, 'toggleActive', { productId }, updated);
      return updated;
    } catch (error) {
      logError(this.entityName, 'toggleActive', { productId }, error as Error);
      throw new DbError(
        this.entityName,
        'toggleActive',
        { productId },
        (error as Error).message
      );
    }
  }

  /**
   * Calculate total inventory value
   *
   * @param tx - Optional transaction
   * @returns Total value in cents
   *
   * @example
   * ```typescript
   * const totalValue = await productModel.calculateInventoryValue();
   * console.log(`Inventory worth: $${totalValue / 100}`);
   * ```
   */
  async calculateInventoryValue(
    tx?: NodePgDatabase<typeof schema>
  ): Promise<number> {
    const db = this.getClient(tx);

    try {
      const result = await db
        .select({
          total: sql<number>`SUM(${this.table.price} * ${this.table.stock})`
        })
        .from(this.table)
        .where(
          and(
            eq(this.table.isActive, true),
            eq(this.table.deletedAt, null)
          )
        );

      const total = result[0]?.total ?? 0;
      logQuery(this.entityName, 'calculateInventoryValue', {}, { total });
      return Number(total);
    } catch (error) {
      logError(this.entityName, 'calculateInventoryValue', {}, error as Error);
      throw new DbError(
        this.entityName,
        'calculateInventoryValue',
        {},
        (error as Error).message
      );
    }
  }
}
```

## Step 6: Write Tests

### Location

Create test file at:

```text
packages/db/test/models/product.model.test.ts
```

### Test Structure

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { ProductModel } from '../../src/models/product.model';
import * as logger from '../../src/utils/logger';

// Mock dependencies
vi.mock('../../src/client', () => ({
  getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
  logQuery: vi.fn(),
  logError: vi.fn()
}));

describe('ProductModel', () => {
  let model: ProductModel;
  let getDb: ReturnType<typeof vi.fn>;
  let logQuery: ReturnType<typeof vi.fn>;
  let logError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    model = new ProductModel();
    getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
    logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
    logError = logger.logError as ReturnType<typeof vi.fn>;
    vi.clearAllMocks();
  });

  describe('findBySlug', () => {
    it('should find product by slug', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        slug: 'test-product',
        price: 1000,
        stock: 10
      };

      vi.spyOn(model, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await model.findBySlug('test-product');

      expect(result).toEqual(mockProduct);
      expect(model.findOne).toHaveBeenCalledWith({ slug: 'test-product' }, undefined);
    });

    it('should return null if product not found', async () => {
      vi.spyOn(model, 'findOne').mockResolvedValue(null);

      const result = await model.findBySlug('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findLowStock', () => {
    it('should find products with low stock', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: '1', name: 'Product 1', stock: 5 },
          { id: '2', name: 'Product 2', stock: 3 }
        ])
      };

      getDb.mockReturnValue(mockDb);

      const result = await model.findLowStock(10);

      expect(result).toHaveLength(2);
      expect(result[0].stock).toBeLessThanOrEqual(10);
    });

    it('should use default threshold of 10', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      };

      getDb.mockReturnValue(mockDb);

      await model.findLowStock();

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('decrementStock', () => {
    it('should decrement stock successfully', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        stock: 20
      };

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      };

      vi.spyOn(model, 'findById').mockResolvedValue(mockProduct as any);
      getDb.mockReturnValue(mockDb);

      await model.decrementStock('1', 5);

      expect(model.findById).toHaveBeenCalledWith('1', undefined);
      expect(mockDb.update).toHaveBeenCalled();
      expect(logQuery).toHaveBeenCalled();
    });

    it('should throw error if insufficient stock', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        stock: 3
      };

      vi.spyOn(model, 'findById').mockResolvedValue(mockProduct as any);

      await expect(model.decrementStock('1', 5)).rejects.toThrow('Insufficient stock');
      expect(logError).toHaveBeenCalled();
    });

    it('should throw error if product not found', async () => {
      vi.spyOn(model, 'findById').mockResolvedValue(null);

      await expect(model.decrementStock('999', 5)).rejects.toThrow('Product not found');
    });
  });

  describe('incrementStock', () => {
    it('should increment stock successfully', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([])
      };

      getDb.mockReturnValue(mockDb);

      await model.incrementStock('1', 50);

      expect(mockDb.update).toHaveBeenCalled();
      expect(logQuery).toHaveBeenCalled();
    });
  });

  describe('toggleActive', () => {
    it('should toggle active status from true to false', async () => {
      const mockProduct = {
        id: '1',
        name: 'Test Product',
        isActive: true
      };

      const updatedProduct = { ...mockProduct, isActive: false };

      vi.spyOn(model, 'findById').mockResolvedValue(mockProduct as any);
      vi.spyOn(model, 'update').mockResolvedValue(updatedProduct as any);

      const result = await model.toggleActive('1');

      expect(result?.isActive).toBe(false);
      expect(model.update).toHaveBeenCalledWith(
        { id: '1' },
        { isActive: false },
        undefined
      );
    });

    it('should return null if product not found', async () => {
      vi.spyOn(model, 'findById').mockResolvedValue(null);

      const result = await model.toggleActive('999');

      expect(result).toBeNull();
    });
  });

  describe('calculateInventoryValue', () => {
    it('should calculate total inventory value', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 150000 }])
      };

      getDb.mockReturnValue(mockDb);

      const result = await model.calculateInventoryValue();

      expect(result).toBe(150000);
      expect(logQuery).toHaveBeenCalled();
    });

    it('should return 0 if no products', async () => {
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: null }])
      };

      getDb.mockReturnValue(mockDb);

      const result = await model.calculateInventoryValue();

      expect(result).toBe(0);
    });
  });
});
```

## Complete Example

Here's the full Product model implementation:

```typescript
// packages/db/src/models/product.model.ts
import type { Product } from '@repo/schemas';
import { and, eq, gte, lte, like, sql, count } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BaseModel } from '../base/base.model';
import { getDb } from '../client';
import { products } from '../schemas/catalog/product.dbschema';
import type * as schema from '../schemas/index';
import { DbError } from '../utils/error';
import { logError, logQuery } from '../utils/logger';

/**
 * Model for the Product entity
 */
export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'products';

  protected getTableName(): string {
    return 'products';
  }

  async findAll(
    where: Record<string, unknown>,
    options?: { page?: number; pageSize?: number },
    tx?: NodePgDatabase<typeof schema>
  ): Promise<{ items: Product[]; total: number }> {
    const db = this.getClient(tx);
    const conditions = [];

    if (where.q && typeof where.q === 'string') {
      conditions.push(like(this.table.name, `%${where.q}%`));
    }

    if (where.minPrice !== undefined) {
      conditions.push(gte(this.table.price, where.minPrice as number));
    }

    if (where.maxPrice !== undefined) {
      conditions.push(lte(this.table.price, where.maxPrice as number));
    }

    if (where.inStock === true) {
      conditions.push(gte(this.table.stock, 1));
    }

    if (where.isActive !== undefined) {
      conditions.push(eq(this.table.isActive, where.isActive as boolean));
    }

    conditions.push(eq(this.table.deletedAt, null));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const isPaginated = options?.page !== undefined && options?.pageSize !== undefined;

    if (isPaginated) {
      const offset = (options.page! - 1) * options.pageSize!;
      const [items, [{ count: total }]] = await Promise.all([
        db.select().from(this.table).where(whereClause).limit(options.pageSize!).offset(offset),
        db.select({ count: count() }).from(this.table).where(whereClause)
      ]);

      return { items: items as Product[], total: Number(total) };
    }

    const items = await db.select().from(this.table).where(whereClause);
    return { items: items as Product[], total: items.length };
  }

  async findBySlug(
    slug: string,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product | null> {
    return this.findOne({ slug }, tx);
  }

  async findLowStock(
    threshold: number = 10,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product[]> {
    const db = this.getClient(tx);

    const items = await db
      .select()
      .from(this.table)
      .where(
        and(
          lte(this.table.stock, threshold),
          eq(this.table.isActive, true),
          eq(this.table.deletedAt, null)
        )
      );

    return items as Product[];
  }

  async decrementStock(
    productId: string,
    quantity: number,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<void> {
    const db = this.getClient(tx);

    try {
      const product = await this.findById(productId, tx);
      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}, requested: ${quantity}`);
      }

      await db
        .update(this.table)
        .set({ stock: sql`${this.table.stock} - ${quantity}` })
        .where(eq(this.table.id, productId));

      logQuery(this.entityName, 'decrementStock', { productId, quantity }, 'success');
    } catch (error) {
      logError(this.entityName, 'decrementStock', { productId, quantity }, error as Error);
      throw new DbError(
        this.entityName,
        'decrementStock',
        { productId, quantity },
        (error as Error).message
      );
    }
  }

  async incrementStock(
    productId: string,
    quantity: number,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<void> {
    const db = this.getClient(tx);

    try {
      await db
        .update(this.table)
        .set({ stock: sql`${this.table.stock} + ${quantity}` })
        .where(eq(this.table.id, productId));

      logQuery(this.entityName, 'incrementStock', { productId, quantity }, 'success');
    } catch (error) {
      logError(this.entityName, 'incrementStock', { productId, quantity }, error as Error);
      throw new DbError(
        this.entityName,
        'incrementStock',
        { productId, quantity },
        (error as Error).message
      );
    }
  }

  async toggleActive(
    productId: string,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product | null> {
    const db = this.getClient(tx);

    try {
      const product = await this.findById(productId, tx);
      if (!product) {
        return null;
      }

      const updated = await this.update(
        { id: productId },
        { isActive: !product.isActive },
        tx
      );

      logQuery(this.entityName, 'toggleActive', { productId }, updated);
      return updated;
    } catch (error) {
      logError(this.entityName, 'toggleActive', { productId }, error as Error);
      throw new DbError(
        this.entityName,
        'toggleActive',
        { productId },
        (error as Error).message
      );
    }
  }

  async calculateInventoryValue(
    tx?: NodePgDatabase<typeof schema>
  ): Promise<number> {
    const db = this.getClient(tx);

    try {
      const result = await db
        .select({
          total: sql<number>`SUM(${this.table.price} * ${this.table.stock})`
        })
        .from(this.table)
        .where(
          and(
            eq(this.table.isActive, true),
            eq(this.table.deletedAt, null)
          )
        );

      const total = result[0]?.total ?? 0;
      logQuery(this.entityName, 'calculateInventoryValue', {}, { total });
      return Number(total);
    } catch (error) {
      logError(this.entityName, 'calculateInventoryValue', {}, error as Error);
      throw new DbError(
        this.entityName,
        'calculateInventoryValue',
        {},
        (error as Error).message
      );
    }
  }
}

export const productModel = new ProductModel();
```

## Next Steps

After creating your model:

1. **Generate migration**: `pnpm db:generate`
2. **Apply migration**: `pnpm db:migrate`
3. **Run tests**: `cd packages/db && pnpm run test`
4. **Check coverage**: Ensure 90%+ test coverage
5. **Create service layer**: Implement business logic in `@repo/service-core`
6. **Create API routes**: Add endpoints in `apps/api`

## Best Practices

1. **Always extend BaseModel** - Don't reinvent CRUD operations
2. **Use meaningful method names** - `findBySlug` not `getByS`
3. **Add JSDoc comments** - Document all public methods
4. **Write tests first** - TDD approach (Red → Green → Refactor)
5. **Use transactions** - For operations affecting multiple tables
6. **Log everything** - Use `logQuery` and `logError` helpers
7. **Handle errors properly** - Throw `DbError` with context
8. **Follow naming conventions** - `camelCase` for methods, `PascalCase` for classes
9. **Keep models focused** - One model per database table
10. **Validate at service layer** - Models handle data access, not validation

## Common Mistakes to Avoid

1. ❌ **Mixing business logic in models** - Keep models focused on data access
2. ❌ **Skipping tests** - 90% coverage is required, no exceptions
3. ❌ **Using `any` type** - Always use proper TypeScript types
4. ❌ **Forgetting audit fields** - All tables need createdAt, updatedAt, deletedAt
5. ❌ **Not using transactions** - Multi-step operations need ACID guarantees
6. ❌ **Ignoring soft delete** - Use softDelete by default, hardDelete only when necessary
7. ❌ **Not adding indexes** - Query performance matters
8. ❌ **Inconsistent naming** - Follow project conventions
9. ❌ **Skipping JSDoc** - Documentation is required for all exports
10. ❌ **Hardcoding table names** - Use `getTableName()` method

## Troubleshooting

### Error: "Table not found in schema"

Ensure you've exported the table in the schema index file:

```typescript
// packages/db/src/schemas/catalog/index.ts
export { products, productsRelations } from './product.dbschema';
```

### Error: "Cannot find module '@repo/schemas'"

The Product type should be defined in `@repo/schemas`:

```typescript
// packages/schemas/src/entities/product.schema.ts
import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  price: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable()
});

export type Product = z.infer<typeof ProductSchema>;
```

### Tests failing with "getDb is not a function"

Ensure proper mocking in tests:

```typescript
vi.mock('../../src/client', () => ({
  getDb: vi.fn()
}));
```

## Related Guides

- [Drizzle Schemas](./drizzle-schemas.md) - Deep dive into schema syntax
- [Relations](./relations.md) - Working with relations
- [Soft Delete](./soft-delete.md) - Soft delete patterns
- [Testing](./testing.md) - Comprehensive testing guide
- [Transactions](./transactions.md) - Transaction handling

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [Hospeda Project Standards](../../CLAUDE.md)
