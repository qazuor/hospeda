# Soft Delete

Complete guide to implementing and using the soft delete pattern in the Hospeda project.

## Introduction

Soft delete is a data management pattern where records are marked as deleted instead of being permanently removed from the database.

### What is Soft Delete

Instead of:

```sql
-- Hard delete: Record gone forever
DELETE FROM products WHERE id = '123';
```

We do:

```sql
-- Soft delete: Record marked as deleted
UPDATE products SET deleted_at = NOW() WHERE id = '123';
```

### Why Use Soft Delete

**Benefits:**

- **Data Recovery**: Restore accidentally deleted records
- **Audit Trail**: Maintain complete history
- **Compliance**: Meet regulatory requirements (GDPR, HIPAA)
- **Analytics**: Include deleted records in historical reports
- **Relations**: Preserve related data integrity
- **Debugging**: Investigate issues with deleted data

**Tradeoffs:**

- **Storage**: Deleted records occupy space
- **Complexity**: Queries must filter out deleted records
- **Performance**: Extra WHERE clause in queries
- **Cleanup**: Need process to permanently delete old records

## Implementation

### Schema Definition

All tables in Hospeda include a `deletedAt` timestamp:

```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),

  // Standard audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

  // Soft delete timestamp
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});
```

**Key points:**

- `deletedAt` is nullable (NULL = not deleted)
- Use `withTimezone: true` for consistent timestamps
- No default value (NULL initially)

### Extended Soft Delete with User Tracking

Track who deleted the record:

```typescript
import { users } from '../user/user.dbschema';

export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),

  // Audit fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
  updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

  // Soft delete with user tracking
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});
```

> **Tip**: Use `onDelete: 'set null'` for audit fields so history is preserved even if user is deleted.

## BaseModel Methods

Hospeda's `BaseModel` provides built-in soft delete methods.

### softDelete()

Marks records as deleted:

```typescript
/**
 * Soft delete entities matching the where clause
 *
 * @param where - Filter conditions
 * @param tx - Optional transaction
 * @returns Number of deleted rows
 */
async softDelete(
  where: Record<string, unknown>,
  tx?: NodePgDatabase<typeof schema>
): Promise<number>
```

**Example:**

```typescript
import { productModel } from '@repo/db';

// Soft delete by ID
const count = await productModel.softDelete({ id: 'product-id' });
console.log(`Soft deleted ${count} product(s)`);

// Soft delete multiple
await productModel.softDelete({ categoryId: 'category-id' });
```

### restore()

Restores soft-deleted records:

```typescript
/**
 * Restore soft-deleted entities
 *
 * @param where - Filter conditions
 * @param tx - Optional transaction
 * @returns Number of restored rows
 */
async restore(
  where: Record<string, unknown>,
  tx?: NodePgDatabase<typeof schema>
): Promise<number>
```

**Example:**

```typescript
// Restore by ID
const count = await productModel.restore({ id: 'product-id' });
console.log(`Restored ${count} product(s)`);

// Restore multiple
await productModel.restore({ categoryId: 'category-id' });
```

### hardDelete()

Permanently deletes records:

```typescript
/**
 * Permanently delete entities
 *
 * @param where - Filter conditions
 * @param tx - Optional transaction
 * @returns Number of deleted rows
 */
async hardDelete(
  where: Record<string, unknown>,
  tx?: NodePgDatabase<typeof schema>
): Promise<number>
```

**Example:**

```typescript
// Hard delete by ID
const count = await productModel.hardDelete({ id: 'product-id' });
console.log(`Permanently deleted ${count} product(s)`);
```

> **Warning**: Hard delete is irreversible. Use with caution.

## Querying

### Filter Out Soft-Deleted (Default)

By default, queries should exclude soft-deleted records:

```typescript
import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '@repo/db';

const db = getDb();

// Always filter out deleted records
const products = await db
  .select()
  .from(productsTable)
  .where(
    and(
      eq(productsTable.isActive, true),
      isNull(productsTable.deletedAt)  // Exclude soft-deleted
    )
  );
```

**BaseModel does this automatically:**

```typescript
// BaseModel methods automatically exclude soft-deleted
const products = await productModel.findAll({ isActive: true });
// SQL: WHERE is_active = true AND deleted_at IS NULL
```

### Include Soft-Deleted

To include soft-deleted records in queries:

```typescript
import { eq } from 'drizzle-orm';

// Query without deletedAt filter
const allProducts = await db
  .select()
  .from(productsTable)
  .where(eq(productsTable.categoryId, categoryId));
// Includes soft-deleted records
```

### Only Soft-Deleted

Query only deleted records:

```typescript
import { isNotNull, and } from 'drizzle-orm';

// Only soft-deleted products
const deletedProducts = await db
  .select()
  .from(productsTable)
  .where(
    and(
      isNotNull(productsTable.deletedAt),
      eq(productsTable.categoryId, categoryId)
    )
  );
```

### Custom Model Method

Add a method to find soft-deleted records:

```typescript
export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'products';

  protected getTableName(): string {
    return 'products';
  }

  /**
   * Find soft-deleted products
   *
   * @param where - Filter conditions
   * @param tx - Optional transaction
   * @returns Soft-deleted products
   *
   * @example
   * ```typescript
   * const deleted = await productModel.findDeleted({
   *   categoryId: 'category-id'
   * });
   * ```
   */
  async findDeleted(
    where: Record<string, unknown>,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<Product[]> {
    const db = this.getClient(tx);

    const conditions = buildWhereClause(where, this.table as unknown);

    const items = await db
      .select()
      .from(this.table)
      .where(
        and(
          conditions,
          isNotNull(this.table.deletedAt)
        )
      );

    return items as Product[];
  }
}
```

## Hard Delete

### When to Use

Use hard delete for:

- ✅ Truly temporary data (sessions, tokens)
- ✅ Test/development data
- ✅ Compliance-required deletions (GDPR right to be forgotten)
- ✅ Cleaning up very old soft-deleted records

**Don't use for:**

- ❌ User-generated content
- ❌ Transaction records
- ❌ Critical business data
- ❌ Data needed for audit trail

### hardDelete Method

```typescript
// Permanently delete
await productModel.hardDelete({ id: 'product-id' });

// Hard delete old soft-deleted records (cleanup)
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

// Custom cleanup method
async function cleanupOldDeleted() {
  const db = getDb();

  const result = await db
    .delete(productsTable)
    .where(lte(productsTable.deletedAt, thirtyDaysAgo))
    .returning();

  console.log(`Permanently deleted ${result.length} old products`);
}
```

## Best Practices

### 1. Default to Soft Delete

```typescript
// ✅ Good: Default soft delete
async deleteProduct(id: string) {
  return await productModel.softDelete({ id });
}

// ❌ Bad: Default hard delete
async deleteProduct(id: string) {
  return await productModel.hardDelete({ id });
}
```

### 2. Always Filter in Queries

```typescript
// ✅ Good: Explicitly filter deleted
const products = await db
  .select()
  .from(productsTable)
  .where(
    and(
      eq(productsTable.categoryId, categoryId),
      isNull(productsTable.deletedAt)
    )
  );

// ❌ Bad: Forgot to filter deleted
const products = await db
  .select()
  .from(productsTable)
  .where(eq(productsTable.categoryId, categoryId));
```

### 3. Use Indexes

Index the `deletedAt` column for better performance:

```typescript
export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deletedAt: timestamp('deleted_at', { withTimezone: true })
  },
  (table) => ({
    // Index for filtering deleted records
    deletedAtIdx: index('products_deletedAt_idx').on(table.deletedAt)
  })
);
```

### 4. Partial Indexes (Performance Optimization)

Index only non-deleted records:

```typescript
// PostgreSQL partial index (requires manual migration)
CREATE INDEX products_active_idx ON products (name, category_id)
WHERE deleted_at IS NULL;
```

This index is smaller and faster since it only includes active records.

### 5. Track Deletion User

```typescript
// ✅ Good: Track who deleted
async deleteProduct(id: string, userId: string) {
  const db = getDb();

  await db
    .update(productsTable)
    .set({
      deletedAt: new Date(),
      deletedById: userId
    })
    .where(eq(productsTable.id, id));
}

// ❌ Bad: No tracking
async deleteProduct(id: string) {
  await productModel.softDelete({ id });
}
```

### 6. Unique Constraints with Soft Delete

Unique constraints must allow multiple deleted records:

```sql
-- ❌ Problem: Can't soft delete and recreate with same slug
CREATE UNIQUE INDEX products_slug_unique ON products (slug);

-- ✅ Solution: Partial unique index (only active records)
CREATE UNIQUE INDEX products_slug_unique ON products (slug)
WHERE deleted_at IS NULL;
```

In Drizzle (requires manual migration):

```typescript
// In schema, just mark as unique
slug: text('slug').notNull().unique()

// Then create manual migration:
// drizzle/migrations/0005_partial_unique_index.sql
DROP INDEX IF EXISTS products_slug_unique;
CREATE UNIQUE INDEX products_slug_unique ON products (slug)
WHERE deleted_at IS NULL;
```

## Advanced Patterns

### Cascade Soft Delete

Soft delete related records:

```typescript
export class ProductModel extends BaseModel<Product> {
  /**
   * Soft delete product and all related records
   */
  async softDeleteWithRelations(productId: string): Promise<void> {
    const db = getDb();

    await db.transaction(async (trx) => {
      // Soft delete product
      await this.softDelete({ id: productId }, trx);

      // Soft delete reviews
      await productReviewModel.softDelete({ productId }, trx);

      // Soft delete images
      await productImageModel.softDelete({ productId }, trx);

      // Remove tags (junction table - hard delete)
      await trx
        .delete(rProductTags)
        .where(eq(rProductTags.productId, productId));
    });
  }
}
```

### Auto-Cleanup Job

Permanently delete old soft-deleted records:

```typescript
/**
 * Cleanup soft-deleted records older than retention period
 *
 * @param retentionDays - Days to keep soft-deleted records
 */
export async function cleanupOldDeleted(retentionDays: number = 90): Promise<void> {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  console.log(`Cleaning up records deleted before ${cutoffDate.toISOString()}`);

  // Cleanup products
  const deletedProducts = await db
    .delete(productsTable)
    .where(
      and(
        isNotNull(productsTable.deletedAt),
        lte(productsTable.deletedAt, cutoffDate)
      )
    )
    .returning();

  console.log(`Permanently deleted ${deletedProducts.length} products`);

  // Cleanup reviews
  const deletedReviews = await db
    .delete(productReviewsTable)
    .where(
      and(
        isNotNull(productReviewsTable.deletedAt),
        lte(productReviewsTable.deletedAt, cutoffDate)
      )
    )
    .returning();

  console.log(`Permanently deleted ${deletedReviews.length} reviews`);
}
```

**Schedule with cron:**

```typescript
// Schedule daily cleanup at 2 AM
import { schedule } from 'node-cron';

schedule('0 2 * * *', async () => {
  console.log('Running cleanup job...');
  await cleanupOldDeleted(90);  // Keep 90 days
  console.log('Cleanup complete');
});
```

### Soft Delete with Audit Log

Log deletions for compliance:

```typescript
export class ProductModel extends BaseModel<Product> {
  async softDelete(
    where: Record<string, unknown>,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<number> {
    const db = this.getClient(tx);

    // Get records before deletion
    const records = await this.findAll(where, undefined, tx);

    // Soft delete
    const count = await super.softDelete(where, tx);

    // Log deletions
    for (const record of records.items) {
      await auditLogModel.create({
        entityType: 'product',
        entityId: record.id,
        action: 'soft_delete',
        userId: getCurrentUserId(),
        timestamp: new Date(),
        data: record
      }, tx);
    }

    return count;
  }
}
```

### Restore with Validation

Validate before restoring:

```typescript
export class ProductModel extends BaseModel<Product> {
  /**
   * Restore product with validation
   *
   * @param id - Product ID
   * @throws {Error} If product can't be restored
   */
  async restoreWithValidation(id: string): Promise<Product> {
    const db = getDb();

    return await db.transaction(async (trx) => {
      // Find soft-deleted product
      const product = await trx
        .select()
        .from(this.table)
        .where(
          and(
            eq(this.table.id, id),
            isNotNull(this.table.deletedAt)
          )
        )
        .limit(1);

      if (!product[0]) {
        throw new Error('Product not found or not deleted');
      }

      // Validate slug is available
      const existingWithSlug = await trx
        .select()
        .from(this.table)
        .where(
          and(
            eq(this.table.slug, product[0].slug),
            isNull(this.table.deletedAt)
          )
        )
        .limit(1);

      if (existingWithSlug[0]) {
        throw new Error('Slug already in use by active product');
      }

      // Restore
      await this.restore({ id }, trx);

      // Restore related records
      await productReviewModel.restore({ productId: id }, trx);
      await productImageModel.restore({ productId: id }, trx);

      return product[0] as Product;
    });
  }
}
```

## Data Retention Policies

### Define Retention Periods

```typescript
// config/data-retention.ts
export const DATA_RETENTION_DAYS = {
  products: 365,      // Keep deleted products for 1 year
  reviews: 730,       // Keep deleted reviews for 2 years
  orders: 2555,       // Keep deleted orders for 7 years (compliance)
  sessions: 30,       // Keep deleted sessions for 30 days
  logs: 90            // Keep deleted logs for 90 days
} as const;
```

### Implement Retention Policy

```typescript
import { DATA_RETENTION_DAYS } from '../config/data-retention';

export async function enforceDataRetention(): Promise<void> {
  console.log('Enforcing data retention policies...');

  for (const [entity, days] of Object.entries(DATA_RETENTION_DAYS)) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    console.log(`${entity}: Deleting records older than ${cutoffDate.toISOString()}`);

    const count = await cleanupEntity(entity, cutoffDate);
    console.log(`${entity}: Deleted ${count} records`);
  }

  console.log('Data retention enforcement complete');
}
```

## Testing

### Test Soft Delete

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { productModel } from '@repo/db';

describe('ProductModel - Soft Delete', () => {
  let productId: string;

  beforeEach(async () => {
    // Create test product
    const product = await productModel.create({
      name: 'Test Product',
      slug: 'test-product',
      price: 1000,
      stock: 10
    });
    productId = product.id;
  });

  it('should soft delete product', async () => {
    // Soft delete
    const count = await productModel.softDelete({ id: productId });
    expect(count).toBe(1);

    // Product should not be in normal queries
    const found = await productModel.findById(productId);
    expect(found).toBeNull();

    // But should exist in database
    const db = getDb();
    const deleted = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    expect(deleted[0]).toBeDefined();
    expect(deleted[0].deletedAt).not.toBeNull();
  });

  it('should restore soft-deleted product', async () => {
    // Soft delete
    await productModel.softDelete({ id: productId });

    // Restore
    const count = await productModel.restore({ id: productId });
    expect(count).toBe(1);

    // Product should be in normal queries
    const found = await productModel.findById(productId);
    expect(found).not.toBeNull();
    expect(found?.deletedAt).toBeNull();
  });

  it('should hard delete product', async () => {
    // Hard delete
    const count = await productModel.hardDelete({ id: productId });
    expect(count).toBe(1);

    // Product should not exist at all
    const db = getDb();
    const deleted = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, productId))
      .limit(1);

    expect(deleted[0]).toBeUndefined();
  });

  it('should exclude soft-deleted from findAll', async () => {
    // Create another product
    await productModel.create({
      name: 'Active Product',
      slug: 'active-product',
      price: 2000,
      stock: 5
    });

    // Soft delete first product
    await productModel.softDelete({ id: productId });

    // FindAll should only return active product
    const { items } = await productModel.findAll({});
    expect(items.length).toBe(1);
    expect(items[0].slug).toBe('active-product');
  });
});
```

## Troubleshooting

### Soft-deleted records appearing in queries

Ensure you're filtering by `deletedAt`:

```typescript
// ✅ Add deletedAt filter
const products = await db
  .select()
  .from(productsTable)
  .where(isNull(productsTable.deletedAt));
```

### Unique constraint violations after soft delete

Use partial unique indexes:

```sql
CREATE UNIQUE INDEX products_slug_unique ON products (slug)
WHERE deleted_at IS NULL;
```

### Can't restore due to unique constraint

Check for conflicts before restoring:

```typescript
// Check if slug is available
const existing = await productModel.findOne({
  slug: product.slug
});

if (existing) {
  throw new Error('Cannot restore: slug already in use');
}
```

### Performance issues with large deleted datasets

Add indexes and consider cleanup:

```typescript
// Index on deletedAt
CREATE INDEX products_deletedAt_idx ON products (deleted_at);

// Partial index on active records
CREATE INDEX products_active_idx ON products (id, name)
WHERE deleted_at IS NULL;

// Regular cleanup
await cleanupOldDeleted(90);
```

## Related Guides

- [Creating Models](./creating-models.md) - Implement soft delete in models
- [Testing](./testing.md) - Test soft delete functionality
- [Optimization](./optimization.md) - Optimize soft delete queries

## Additional Resources

- [Soft Delete Pattern](https://www.martinfowler.com/eaaCatalog/tombstone.html)
- [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
- [GDPR Right to Erasure](https://gdpr-info.eu/art-17-gdpr/)
