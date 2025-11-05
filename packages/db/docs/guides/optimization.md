# Optimization

Complete guide to query optimization and performance best practices for the Hospeda project database layer.

## Introduction

Database performance is critical for application scalability and user experience. This guide covers:

- Identifying performance bottlenecks
- Optimizing queries
- Index strategies
- Solving the N+1 problem
- Pagination best practices
- Monitoring and profiling

## N+1 Problem

### What is N+1

The N+1 problem occurs when you execute 1 query to fetch N records, then N additional queries to fetch related data.

**Example Problem:**

```typescript
// Query 1: Fetch all products (N = 100)
const products = await productModel.findAll({});

// Queries 2-101: Fetch category for each product (100 queries!)
for (const product of products.items) {
  const category = await categoryModel.findById(product.categoryId);
  console.log(category?.name);
}
// Total: 1 + 100 = 101 queries
```

### Detecting N+1

**Symptoms:**

- Slow API responses
- High database connection count
- Query logs showing repeated similar queries
- Database CPU spikes

**Detection:**

```typescript
// Enable query logging
import { logQuery } from '@repo/db/utils';

// Check logs for patterns:
// SELECT * FROM products
// SELECT * FROM categories WHERE id = '1'
// SELECT * FROM categories WHERE id = '2'
// SELECT * FROM categories WHERE id = '3'
// ... (repeated pattern = N+1!)
```

### Solution: Eager Loading

**✅ Correct: Load relations eagerly**

```typescript
// Single query with JOIN
const { items } = await productModel.findAllWithRelations(
  { category: true }
);

for (const product of items) {
  console.log(product.category.name);
}
// Total: 1 query (or 2 if using separate queries)
```

### Example Comparison

**❌ N+1 Problem (Bad):**

```typescript
// 1. Fetch products
const products = await productModel.findAll({});

// 2. Fetch category for each (N queries)
for (const product of products.items) {
  const category = await categoryModel.findById(product.categoryId);
  const owner = await userModel.findById(product.ownerId);

  console.log({
    product: product.name,
    category: category?.name,
    owner: owner?.email
  });
}
// Queries: 1 + (N * 2) = 201 queries for 100 products
```

**✅ Eager Loading (Good):**

```typescript
// Fetch products with relations in 1-2 queries
const { items } = await productModel.findAllWithRelations(
  { category: true, owner: true }
);

for (const product of items) {
  console.log({
    product: product.name,
    category: product.category.name,
    owner: product.owner.email
  });
}
// Queries: 1-2 queries total (huge improvement!)
```

### Nested N+1 Problem

```typescript
// ❌ Nested N+1 (Very Bad)
const categories = await categoryModel.findAll({});

for (const category of categories.items) {
  const products = await productModel.findAll({ categoryId: category.id });

  for (const product of products.items) {
    const reviews = await reviewModel.findAll({ productId: product.id });
  }
}
// Queries: 1 + N + (N * M) = Disaster!

// ✅ Solution: Eager load everything
const { items } = await categoryModel.findAllWithRelations(
  {
    products: {
      reviews: true
    }
  }
);
// Queries: 1-3 (nested eager loading)
```

## Indexes

### When to Add Indexes

Add indexes for columns used in:

- ✅ `WHERE` clauses
- ✅ `ORDER BY` clauses
- ✅ `JOIN` conditions (foreign keys)
- ✅ Frequently searched fields

**Don't index:**

- ❌ Small tables (< 1000 rows)
- ❌ Rarely queried columns
- ❌ Highly volatile data (frequent updates)
- ❌ Low cardinality columns (e.g., boolean with mostly one value)

### Creating Indexes

```typescript
import { index } from 'drizzle-orm/pg-core';

export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    categoryId: uuid('category_id').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    stock: integer('stock').notNull().default(0),
    price: integer('price').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    // Single column indexes
    nameIdx: index('products_name_idx').on(table.name),
    categoryIdIdx: index('products_categoryId_idx').on(table.categoryId),
    isActiveIdx: index('products_isActive_idx').on(table.isActive),

    // Composite indexes (order matters!)
    categoryActiveIdx: index('products_category_active_idx').on(
      table.categoryId,
      table.isActive
    ),

    // Covering index (includes all needed columns)
    searchIdx: index('products_search_idx').on(
      table.isActive,
      table.categoryId,
      table.price
    )
  })
);
```

### Index Types

**B-Tree (Default):**

```sql
-- Good for: =, <, >, <=, >=, BETWEEN, IN, ORDER BY
CREATE INDEX products_name_idx ON products (name);
```

**Partial Indexes:**

```sql
-- Index only active products (smaller, faster)
CREATE INDEX products_active_name_idx ON products (name)
WHERE is_active = true AND deleted_at IS NULL;
```

**Composite Indexes:**

```sql
-- Order matters! Good for queries filtering by both
CREATE INDEX products_category_active_idx ON products (category_id, is_active);

-- Effective for:
-- WHERE category_id = X AND is_active = true ✅
-- WHERE category_id = X ✅
-- WHERE is_active = true ❌ (can't use index efficiently)
```

**Covering Indexes:**

```sql
-- Includes all columns needed by query (no table access required)
CREATE INDEX products_covering_idx ON products (category_id, is_active, name, price);

-- Query can be satisfied entirely from index
SELECT name, price FROM products
WHERE category_id = X AND is_active = true;
```

### Index Maintenance

```sql
-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- Find unused indexes (candidates for removal)
SELECT
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';

-- Rebuild indexes (reclaim space, improve performance)
REINDEX TABLE products;
```

## Query Performance

### Limit Results

```typescript
// ❌ Bad: Load all products
const products = await productModel.findAll({});
// Might return 100,000 rows!

// ✅ Good: Use pagination
const products = await productModel.findAll({}, { page: 1, pageSize: 20 });
// Only 20 rows returned
```

### Filter at Database Level

```typescript
// ❌ Bad: Filter in application
const allProducts = await productModel.findAll({});
const activeProducts = allProducts.items.filter(p => p.isActive);

// ✅ Good: Filter in database
const activeProducts = await productModel.findAll({ isActive: true });
```

### Select Only Needed Columns

```typescript
import { getDb } from '@repo/db';

const db = getDb();

// ❌ Bad: Select all columns
const products = await db.select().from(productsTable);

// ✅ Good: Select specific columns
const products = await db
  .select({
    id: productsTable.id,
    name: productsTable.name,
    price: productsTable.price
  })
  .from(productsTable);
```

### Use Proper Data Types

```typescript
// ❌ Bad: Text for numbers
price: text('price')  // Slow comparisons, no math operations

// ✅ Good: Integer for cents
price: integer('price')  // Fast comparisons, supports SUM, AVG, etc.

// ❌ Bad: Text for dates
createdAt: text('created_at')  // Can't use date functions

// ✅ Good: Timestamp
createdAt: timestamp('created_at', { withTimezone: true })
```

### Avoid Functions in WHERE

```typescript
// ❌ Bad: Function on indexed column (can't use index)
await db
  .select()
  .from(productsTable)
  .where(sql`LOWER(${productsTable.name}) = 'laptop'`);

// ✅ Good: Use case-insensitive collation or text search
await db
  .select()
  .from(productsTable)
  .where(ilike(productsTable.name, 'laptop'));

// ✅ Better: Store lowercase in separate column with index
await db
  .select()
  .from(productsTable)
  .where(eq(productsTable.nameNormalized, 'laptop'));
```

## Pagination

### Offset Pagination

**Standard pagination:**

```typescript
async findAll(
  where: Record<string, unknown>,
  options?: { page?: number; pageSize?: number }
): Promise<{ items: Product[]; total: number }> {
  const db = this.getClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.select()
      .from(this.table)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset),
    this.count(where)
  ]);

  return { items: items as Product[], total };
}
```

**Pros:**

- Simple implementation
- Can jump to any page
- Shows total count

**Cons:**

- Slow for large offsets (OFFSET 10000 still scans 10000 rows)
- Inconsistent with concurrent writes

### Cursor Pagination

**For large datasets:**

```typescript
interface CursorPaginationOptions {
  cursor?: string;  // Last seen ID
  pageSize?: number;
}

async findAllCursor(
  where: Record<string, unknown>,
  options: CursorPaginationOptions = {}
): Promise<{ items: Product[]; nextCursor?: string }> {
  const db = this.getClient();
  const pageSize = options.pageSize ?? 20;

  const conditions = buildWhereClause(where, this.table as unknown);

  // Add cursor condition
  if (options.cursor) {
    conditions.push(gt(this.table.id, options.cursor));
  }

  const items = await db
    .select()
    .from(this.table)
    .where(and(...conditions))
    .orderBy(this.table.id)
    .limit(pageSize + 1);  // Fetch one extra to check if there's more

  const hasMore = items.length > pageSize;
  const resultItems = hasMore ? items.slice(0, pageSize) : items;
  const nextCursor = hasMore ? resultItems[resultItems.length - 1].id : undefined;

  return {
    items: resultItems as Product[],
    nextCursor
  };
}
```

**Pros:**

- Fast for any page
- Consistent with concurrent writes
- No OFFSET overhead

**Cons:**

- Can't jump to arbitrary page
- No total count
- Requires stable sort column (usually ID)

## Relations Optimization

### Selective Loading

```typescript
// ❌ Bad: Load all relations (slow)
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  {
    category: true,
    owner: true,
    reviews: true,
    images: true,
    tags: true
  }
);

// ✅ Good: Load only needed relations (fast)
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  { category: true }
);
```

### Batch Loading

```typescript
// ❌ Bad: Load categories one by one
for (const product of products) {
  product.category = await categoryModel.findById(product.categoryId);
}

// ✅ Good: Batch load all categories
const categoryIds = [...new Set(products.map(p => p.categoryId))];
const categories = await categoryModel.findAll({
  id: { in: categoryIds }
});

const categoryMap = new Map(categories.items.map(c => [c.id, c]));
products.forEach(p => {
  p.category = categoryMap.get(p.categoryId);
});
```

### Avoid Deep Nesting

```typescript
// ❌ Bad: Deep nesting (slow)
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  {
    category: {
      parent: {
        parent: {
          parent: true
        }
      }
    }
  }
);

// ✅ Good: Load depth needed for UI
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  { category: true }
);
```

## Monitoring

### Query Logging

```typescript
// packages/db/src/utils/logger.ts
export function logQuery(
  entity: string,
  operation: string,
  params: unknown,
  result: unknown
): void {
  console.log({
    entity,
    operation,
    params,
    result: result ? 'success' : 'empty',
    timestamp: new Date().toISOString()
  });
}

// Enable in development
if (process.env.NODE_ENV === 'development') {
  logQuery('products', 'findAll', { page: 1 }, results);
}
```

### Slow Query Detection

```sql
-- Enable slow query logging (PostgreSQL)
ALTER DATABASE hospeda SET log_min_duration_statement = 1000;  -- Log queries > 1s

-- Check slow queries
SELECT
  query,
  calls,
  total_time / calls as avg_time_ms,
  max_time as max_time_ms
FROM pg_stat_statements
WHERE calls > 100
ORDER BY total_time DESC
LIMIT 10;
```

### Query Explain

```typescript
import { sql } from 'drizzle-orm';

// Analyze query execution plan
const explain = await db.execute(
  sql`EXPLAIN ANALYZE
    SELECT * FROM products
    WHERE category_id = 'uuid'
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 20`
);

console.log(explain);
```

**Read EXPLAIN output:**

- **Seq Scan**: Table scan (slow, add index)
- **Index Scan**: Using index (good)
- **Bitmap Index Scan**: Multiple indexes (acceptable)
- **Cost**: Estimated expense (lower is better)
- **Rows**: Estimated rows returned

## Caching Strategies

### Application-Level Cache

```typescript
import { LRUCache } from 'lru-cache';

// Simple in-memory cache
const productCache = new LRUCache<string, Product>({
  max: 500,  // Max 500 products
  ttl: 1000 * 60 * 5  // 5 minutes
});

export class ProductModel extends BaseModel<Product> {
  async findById(id: string): Promise<Product | null> {
    // Check cache first
    const cached = productCache.get(id);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const product = await super.findById(id);

    // Store in cache
    if (product) {
      productCache.set(id, product);
    }

    return product;
  }
}
```

### Redis Cache

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export class ProductModel extends BaseModel<Product> {
  private getCacheKey(id: string): string {
    return `product:${id}`;
  }

  async findById(id: string): Promise<Product | null> {
    // Check Redis cache
    const cached = await redis.get(this.getCacheKey(id));
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const product = await super.findById(id);

    // Store in Redis (5 min TTL)
    if (product) {
      await redis.setex(
        this.getCacheKey(id),
        300,
        JSON.stringify(product)
      );
    }

    return product;
  }

  async update(where: Record<string, unknown>, data: Partial<Product>): Promise<Product | null> {
    // Update database
    const updated = await super.update(where, data);

    // Invalidate cache
    if (updated && where.id) {
      await redis.del(this.getCacheKey(where.id as string));
    }

    return updated;
  }
}
```

## Connection Pooling

### Configure Pool

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,        // Maximum connections
  min: 2,         // Minimum connections
  idle: 10000,    // Idle timeout (10s)
  connectionTimeoutMillis: 5000  // Connection timeout (5s)
});

export function getDb() {
  return drizzle(pool);
}
```

### Monitor Connections

```sql
-- Check active connections
SELECT
  count(*),
  state,
  wait_event_type
FROM pg_stat_activity
WHERE datname = 'hospeda'
GROUP BY state, wait_event_type;

-- Check connection pool stats
SELECT
  datname,
  numbackends,
  xact_commit,
  xact_rollback,
  blks_read,
  blks_hit
FROM pg_stat_database
WHERE datname = 'hospeda';
```

## Best Practices

### 1. Use Indexes Wisely

```typescript
// ✅ Index foreign keys
categoryId: uuid('category_id')
  .notNull()
  .references(() => categories.id)
// Add index: index('products_categoryId_idx').on(table.categoryId)

// ✅ Index frequently queried columns
isActive: boolean('is_active').notNull().default(true)
// Add index: index('products_isActive_idx').on(table.isActive)

// ❌ Don't over-index
// Every index adds overhead to INSERT/UPDATE
```

### 2. Paginate Everything

```typescript
// ✅ Always use pagination for lists
const products = await productModel.findAll({}, { page: 1, pageSize: 20 });

// ❌ Never load all records
const products = await productModel.findAll({});  // Could be millions!
```

### 3. Filter in Database

```typescript
// ✅ Database filtering (fast)
const active = await productModel.findAll({ isActive: true });

// ❌ Application filtering (slow)
const all = await productModel.findAll({});
const active = all.items.filter(p => p.isActive);
```

### 4. Eager Load Relations

```typescript
// ✅ Eager loading (1-2 queries)
const products = await productModel.findAllWithRelations({ category: true });

// ❌ N+1 problem (N+1 queries)
const products = await productModel.findAll({});
for (const p of products.items) {
  p.category = await categoryModel.findById(p.categoryId);
}
```

### 5. Use Transactions

```typescript
// ✅ Transaction for multi-step operations
await db.transaction(async (trx) => {
  await productModel.create(data, trx);
  await inventoryModel.create(inventoryData, trx);
});

// ❌ Separate queries (inconsistent state possible)
await productModel.create(data);
await inventoryModel.create(inventoryData);
```

### 6. Monitor Performance

```typescript
// Log slow queries
const start = Date.now();
const result = await productModel.findAll({});
const duration = Date.now() - start;

if (duration > 1000) {
  console.warn(`Slow query detected: ${duration}ms`);
}
```

## Troubleshooting

### Slow Queries

1. **Enable query logging**
2. **Run EXPLAIN ANALYZE**
3. **Check for missing indexes**
4. **Look for N+1 problems**
5. **Verify WHERE clause uses indexes**

### High Memory Usage

1. **Add pagination**
2. **Select only needed columns**
3. **Limit result set size**
4. **Use streaming for large datasets**

### Connection Pool Exhaustion

1. **Increase max connections**
2. **Check for connection leaks**
3. **Add connection timeout**
4. **Monitor active connections**

### Index Not Being Used

1. **Check query matches index columns**
2. **Verify WHERE clause doesn't use functions**
3. **Run ANALYZE on table**
4. **Check if table is too small (PostgreSQL might skip index)**

## Related Guides

- [Creating Models](./creating-models.md) - Efficient model design
- [Relations](./relations.md) - Optimize relation queries
- [Testing](./testing.md) - Performance testing

## Additional Resources

- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Drizzle ORM Performance](https://orm.drizzle.team/docs/performance)
- [Use The Index, Luke!](https://use-the-index-luke.com/)
