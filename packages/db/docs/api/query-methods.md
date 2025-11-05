# Query Methods Guide

Deep dive into query capabilities, filtering, pagination, sorting, and advanced query patterns in `@repo/db`.

## Table of Contents

- [Overview](#overview)
- [Basic Queries](#basic-queries)
  - [Finding by ID](#finding-by-id)
  - [Finding Single Records](#finding-single-records)
  - [Finding Multiple Records](#finding-multiple-records)
- [Filtering](#filtering)
  - [Simple Filters](#simple-filters)
  - [Multiple Conditions](#multiple-conditions)
  - [Null Values](#null-values)
- [Query Building](#query-building)
  - [Drizzle Operators](#drizzle-operators)
  - [Complex Filters](#complex-filters)
  - [Dynamic Query Building](#dynamic-query-building)
- [Pagination](#pagination)
  - [Basic Pagination](#basic-pagination)
  - [Cursor-Based Pagination](#cursor-based-pagination)
  - [Infinite Scroll Pattern](#infinite-scroll-pattern)
- [Sorting and Ordering](#sorting-and-ordering)
  - [Basic Sorting](#basic-sorting)
  - [Multiple Sort Fields](#multiple-sort-fields)
  - [Custom Sort Logic](#custom-sort-logic)
- [Relations](#relations)
  - [Loading Relations](#loading-relations)
  - [Nested Relations](#nested-relations)
  - [Selective Loading](#selective-loading)
- [Aggregation](#aggregation)
  - [Count](#count)
  - [Sum, Avg, Min, Max](#sum-avg-min-max)
  - [Group By](#group-by)
- [Advanced Patterns](#advanced-patterns)
  - [Full-Text Search](#full-text-search)
  - [Date Range Queries](#date-range-queries)
  - [Array Operations](#array-operations)
  - [JSON Queries](#json-queries)
- [Performance](#performance)
- [Best Practices](#best-practices)

---

## Overview

Query methods in `BaseModel` provide type-safe database access with Drizzle ORM. They handle filtering, pagination, relations, and error handling automatically.

**Core Query Methods:**

- `findById(id)` - Find single record by ID
- `findOne(where)` - Find first matching record
- `findAll(where, options)` - Find all matching records
- `findWithRelations(where, relations)` - Find with related data
- `findAllWithRelations(relations, where, options)` - Find multiple with relations
- `count(where)` - Count matching records

**Common Features:**

- Type-safe filters
- Built-in pagination
- Relation loading
- Transaction support
- Automatic logging
- Error handling

---

## Basic Queries

### Finding by ID

The simplest query - find a record by its unique identifier.

```typescript
import { ProductModel } from '@repo/db';

const productModel = new ProductModel();

// Find by ID
const product = await productModel.findById('550e8400-e29b-41d4-a716-446655440000');

if (product) {
  console.log(product.name);
  console.log(product.price);
} else {
  console.log('Product not found');
}
```

**Type Safety:**

```typescript
// TypeScript knows the return type
const product: Product | null = await productModel.findById('uuid');

// Safe to use with non-null assertion after check
const product = await productModel.findById('uuid');
if (!product) throw new Error('Not found');

// TypeScript knows product is not null here
console.log(product.name.toUpperCase());
```

**Performance:**

Primary key lookups are the fastest queries. Database uses index for O(log n) lookup.

```typescript
// ✅ Fast - indexed by primary key
await productModel.findById('uuid');

// ❌ Slower - must scan table
await productModel.findOne({ name: 'Product Name' });
```

---

### Finding Single Records

Find first record matching criteria.

```typescript
// Find by unique field
const product = await productModel.findOne({ slug: 'smartphone-x' });

// Find by multiple criteria
const product = await productModel.findOne({
  categoryId: 'cat-uuid',
  isActive: true,
  isFeatured: true,
});

// Find by email (user model)
const user = await userModel.findOne({ email: 'user@example.com' });
```

**Always Returns First Match:**

```typescript
// If multiple records match, only first is returned
const product = await productModel.findOne({ categoryId: 'cat-uuid' });
// Returns first product in category (order depends on database)

// For all matches, use findAll
const { items } = await productModel.findAll({ categoryId: 'cat-uuid' });
// Returns all products in category
```

**Uniqueness Check:**

```typescript
// Check if slug is available
const existing = await productModel.findOne({ slug: newSlug });
if (existing) {
  throw new Error('Slug already taken');
}

// Safe to create
await productModel.create({ slug: newSlug, ... });
```

---

### Finding Multiple Records

Find all records matching criteria.

```typescript
// Find all products
const { items, total } = await productModel.findAll({});

// Find with filter
const { items, total } = await productModel.findAll({
  isActive: true,
  categoryId: 'cat-uuid',
});

// Results
console.log(`Found ${items.length} of ${total} products`);
for (const product of items) {
  console.log(product.name);
}
```

**Without Pagination:**

```typescript
// Returns ALL matching records
const { items, total } = await productModel.findAll({
  isActive: true,
});

console.log(items.length === total);  // true - all results returned
```

**With Pagination:**

```typescript
// Returns one page of results
const { items, total } = await productModel.findAll(
  { isActive: true },
  { page: 1, pageSize: 20 }
);

console.log(items.length);   // 20 (or less on last page)
console.log(total);          // Total across all pages (e.g., 156)
```

---

## Filtering

### Simple Filters

Basic equality filters using plain objects.

```typescript
// Single condition
const products = await productModel.findAll({ isActive: true });

// Multiple conditions (AND logic)
const products = await productModel.findAll({
  isActive: true,
  categoryId: 'cat-uuid',
  price: 99.99,
});
```

**How It Works:**

Filters are converted to SQL `WHERE` clauses using `buildWhereClause` utility:

```typescript
{ isActive: true, categoryId: 'cat-uuid' }
// Becomes: WHERE is_active = true AND category_id = 'cat-uuid'
```

---

### Multiple Conditions

Combine multiple filters with AND logic.

```typescript
// All conditions must match
const products = await productModel.findAll({
  categoryId: 'electronics-uuid',
  isActive: true,
  isFeatured: true,
  price: 699.99,
});
// WHERE category_id = 'electronics-uuid'
//   AND is_active = true
//   AND is_featured = true
//   AND price = 699.99
```

**OR Logic:**

For OR conditions, override `findAll` or use Drizzle directly:

```typescript
import { or, eq } from 'drizzle-orm';

export class ProductModel extends BaseModel<Product> {
  async findByMultipleSlugs(slugs: string[]) {
    const db = this.getClient();

    const conditions = slugs.map(slug => eq(products.slug, slug));

    const items = await db
      .select()
      .from(products)
      .where(or(...conditions));

    return { items, total: items.length };
  }
}

// Usage
const products = await productModel.findByMultipleSlugs([
  'smartphone-x',
  'tablet-pro',
  'laptop-air'
]);
```

---

### Null Values

Handle null/undefined filters correctly.

```typescript
// Filter by null (IS NULL)
const products = await productModel.findAll({
  deletedAt: null,  // Only non-deleted products
});
// WHERE deleted_at IS NULL

// Exclude nulls
const products = await productModel.findAll({
  description: { not: null },  // Requires custom implementation
});
```

**Undefined vs Null:**

```typescript
// undefined is ignored
const products = await productModel.findAll({
  categoryId: 'cat-uuid',
  deletedAt: undefined,  // Ignored in WHERE clause
});
// WHERE category_id = 'cat-uuid'

// null is treated as IS NULL
const products = await productModel.findAll({
  deletedAt: null,
});
// WHERE deleted_at IS NULL
```

---

## Query Building

### Drizzle Operators

Use Drizzle operators for complex queries.

**Import Operators:**

```typescript
import { eq, ne, gt, gte, lt, lte, like, ilike, and, or, isNull, isNotNull } from 'drizzle-orm';
```

**Common Operators:**

| Operator | SQL | Example |
|----------|-----|---------|
| `eq(field, value)` | `=` | `eq(products.price, 99.99)` |
| `ne(field, value)` | `!=` | `ne(products.status, 'draft')` |
| `gt(field, value)` | `>` | `gt(products.price, 50)` |
| `gte(field, value)` | `>=` | `gte(products.rating, 4)` |
| `lt(field, value)` | `<` | `lt(products.stock, 10)` |
| `lte(field, value)` | `<=` | `lte(products.price, 100)` |
| `like(field, pattern)` | `LIKE` | `like(products.name, '%phone%')` |
| `ilike(field, pattern)` | `ILIKE` | `ilike(products.name, '%PHONE%')` |
| `isNull(field)` | `IS NULL` | `isNull(products.deletedAt)` |
| `isNotNull(field)` | `IS NOT NULL` | `isNotNull(products.description)` |

**Example:**

```typescript
import { getDb } from '@repo/db';
import { products } from '@repo/db/schemas';
import { and, gte, lte, eq } from 'drizzle-orm';

const db = getDb();

// Price range query
const items = await db
  .select()
  .from(products)
  .where(
    and(
      eq(products.isActive, true),
      gte(products.price, 50),
      lte(products.price, 100)
    )
  );
// WHERE is_active = true AND price >= 50 AND price <= 100
```

---

### Complex Filters

Build complex queries with AND/OR combinations.

```typescript
import { and, or, eq, gte, ilike } from 'drizzle-orm';

// (condition1 AND condition2) OR condition3
const items = await db
  .select()
  .from(products)
  .where(
    or(
      and(
        eq(products.categoryId, 'electronics-uuid'),
        gte(products.price, 500)
      ),
      eq(products.isFeatured, true)
    )
  );
// WHERE (category_id = 'electronics-uuid' AND price >= 500)
//    OR is_featured = true
```

**Text Search:**

```typescript
// Case-insensitive search
const searchTerm = '%smartphone%';
const items = await db
  .select()
  .from(products)
  .where(
    and(
      eq(products.isActive, true),
      or(
        ilike(products.name, searchTerm),
        ilike(products.description, searchTerm)
      )
    )
  );
// WHERE is_active = true
//   AND (name ILIKE '%smartphone%' OR description ILIKE '%smartphone%')
```

---

### Dynamic Query Building

Build queries dynamically based on optional filters.

```typescript
export class ProductModel extends BaseModel<Product> {
  async search(filters: {
    q?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    isActive?: boolean;
  }) {
    const db = this.getClient();
    const conditions: SQL[] = [];

    // Add conditions dynamically
    if (filters.q) {
      const searchTerm = `%${filters.q}%`;
      conditions.push(
        or(
          ilike(products.name, searchTerm),
          ilike(products.description, searchTerm)
        )
      );
    }

    if (filters.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }

    if (filters.minPrice !== undefined) {
      conditions.push(gte(products.price, filters.minPrice));
    }

    if (filters.maxPrice !== undefined) {
      conditions.push(lte(products.price, filters.maxPrice));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(products.isActive, filters.isActive));
    }

    // Combine all conditions
    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const items = await db
      .select()
      .from(products)
      .where(whereClause);

    return { items, total: items.length };
  }
}

// Usage
const products = await productModel.search({
  q: 'smartphone',
  minPrice: 500,
  maxPrice: 1000,
  isActive: true,
});
```

---

## Pagination

### Basic Pagination

Offset-based pagination for consistent page-based navigation.

```typescript
// Page 1
const page1 = await productModel.findAll(
  { isActive: true },
  { page: 1, pageSize: 20 }
);

console.log(page1.items.length);  // 20 (or less)
console.log(page1.total);         // 156

// Page 2
const page2 = await productModel.findAll(
  { isActive: true },
  { page: 2, pageSize: 20 }
);

// Calculate total pages
const totalPages = Math.ceil(page1.total / 20);  // 8 pages
```

**Pagination Math:**

```typescript
const page = 3;
const pageSize = 20;
const offset = (page - 1) * pageSize;  // 40

// SQL: LIMIT 20 OFFSET 40
// Returns items 41-60
```

**Building Pagination UI:**

```typescript
interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

function getPaginationInfo(
  page: number,
  pageSize: number,
  totalItems: number
): PaginationInfo {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    currentPage: page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

// Usage
const { items, total } = await productModel.findAll(
  { isActive: true },
  { page: 2, pageSize: 20 }
);

const pagination = getPaginationInfo(2, 20, total);
console.log(pagination);
// {
//   currentPage: 2,
//   pageSize: 20,
//   totalItems: 156,
//   totalPages: 8,
//   hasNextPage: true,
//   hasPrevPage: true
// }
```

---

### Cursor-Based Pagination

For infinite scroll and real-time feeds where items may be added/removed.

```typescript
export class ProductModel extends BaseModel<Product> {
  async findWithCursor(
    filters: Record<string, unknown>,
    cursor?: string,
    limit: number = 20
  ) {
    const db = this.getClient();
    const conditions: SQL[] = [];

    // Add filters
    const baseWhere = buildWhereClause(filters, this.table as unknown);
    if (baseWhere) conditions.push(baseWhere);

    // Add cursor condition (cursor is a timestamp or ID)
    if (cursor) {
      conditions.push(lt(products.createdAt, new Date(cursor)));
    }

    const whereClause = conditions.length > 0
      ? and(...conditions)
      : undefined;

    const items = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(limit + 1);  // Fetch one extra to check if more exist

    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;

    const nextCursor = hasMore
      ? results[results.length - 1].createdAt.toISOString()
      : null;

    return {
      items: results,
      nextCursor,
      hasMore,
    };
  }
}

// Usage - Initial load
const page1 = await productModel.findWithCursor({ isActive: true });
console.log(page1.items);       // First 20 items
console.log(page1.nextCursor);  // "2024-01-15T10:30:00Z"
console.log(page1.hasMore);     // true

// Load more
const page2 = await productModel.findWithCursor(
  { isActive: true },
  page1.nextCursor  // Use cursor from previous page
);
console.log(page2.items);       // Next 20 items
```

**Cursor vs Offset Pagination:**

| Aspect | Offset | Cursor |
|--------|--------|--------|
| Use case | Classic pagination | Infinite scroll |
| Performance | Slower for deep pages | Consistent speed |
| Stability | Items may shift | Stable results |
| Complexity | Simple | More complex |

---

### Infinite Scroll Pattern

Implement infinite scroll with cursor pagination.

```typescript
// Frontend component (React example)
function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  async function loadMore() {
    const response = await fetch(
      `/api/products?cursor=${cursor || ''}&limit=20`
    );
    const data = await response.json();

    setProducts([...products, ...data.items]);
    setCursor(data.nextCursor);
    setHasMore(data.hasMore);
  }

  // Trigger loadMore on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );

    // Observe sentinel element at bottom of list
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) observer.observe(sentinel);

    return () => observer.disconnect();
  }, [cursor, hasMore]);

  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
      {hasMore && <div id="scroll-sentinel">Loading...</div>}
    </div>
  );
}
```

---

## Sorting and Ordering

### Basic Sorting

Order results by fields.

```typescript
import { asc, desc } from 'drizzle-orm';

// Sort by price ascending
const items = await db
  .select()
  .from(products)
  .where(eq(products.isActive, true))
  .orderBy(asc(products.price));

// Sort by created date descending (newest first)
const items = await db
  .select()
  .from(products)
  .orderBy(desc(products.createdAt));
```

---

### Multiple Sort Fields

Sort by multiple fields with priority.

```typescript
import { asc, desc } from 'drizzle-orm';

// Sort by category, then price
const items = await db
  .select()
  .from(products)
  .orderBy(
    asc(products.categoryId),
    asc(products.price)
  );
// ORDER BY category_id ASC, price ASC

// Featured first, then by rating
const items = await db
  .select()
  .from(products)
  .orderBy(
    desc(products.isFeatured),  // true first
    desc(products.averageRating),
    asc(products.name)
  );
```

---

### Custom Sort Logic

Implement custom sorting in model.

```typescript
export class ProductModel extends BaseModel<Product> {
  async findAll(
    where: Record<string, unknown>,
    options?: {
      page?: number;
      pageSize?: number;
      sortBy?: 'price' | 'rating' | 'name' | 'created';
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const db = this.getClient();
    const whereClause = buildWhereClause(where, this.table as unknown);

    // Determine sort field
    const sortField = (() => {
      switch (options?.sortBy) {
        case 'price': return products.price;
        case 'rating': return products.averageRating;
        case 'name': return products.name;
        default: return products.createdAt;
      }
    })();

    // Determine sort direction
    const sortFn = options?.sortOrder === 'asc' ? asc : desc;

    let query = db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(sortFn(sortField));

    // Apply pagination
    if (options?.page && options?.pageSize) {
      const offset = (options.page - 1) * options.pageSize;
      query = query.limit(options.pageSize).offset(offset);
    }

    const items = await query;

    // Get total count
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(products)
      .where(whereClause);

    return { items, total };
  }
}

// Usage
const products = await productModel.findAll(
  { isActive: true },
  {
    page: 1,
    pageSize: 20,
    sortBy: 'price',
    sortOrder: 'asc',
  }
);
```

---

## Relations

See [Relations Guide](./relations.md) for complete documentation on loading and querying relations.

### Loading Relations

```typescript
// Load single relation
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  { category: true }
);

console.log(product?.category.name);
```

### Nested Relations

```typescript
// Load nested relations
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  {
    category: {
      parent: true,
    },
    reviews: {
      author: true,
    },
  }
);
```

### Selective Loading

```typescript
// Load only needed relations
const products = await productModel.findAllWithRelations(
  { category: true },  // Only category, not reviews
  { isActive: true },
  { page: 1, pageSize: 20 }
);
```

---

## Aggregation

### Count

Count matching records.

```typescript
// Count all
const total = await productModel.count({});

// Count with filter
const activeCount = await productModel.count({ isActive: true });

// Count by category
const categoryCount = await productModel.count({
  categoryId: 'cat-uuid',
});
```

---

### Sum, Avg, Min, Max

Aggregate functions require custom implementation.

```typescript
import { sum, avg, min, max } from 'drizzle-orm';

export class ProductModel extends BaseModel<Product> {
  async getStatistics(categoryId?: string) {
    const db = this.getClient();

    const whereClause = categoryId
      ? eq(products.categoryId, categoryId)
      : undefined;

    const [result] = await db
      .select({
        total: count(),
        totalRevenue: sum(products.price),
        avgPrice: avg(products.price),
        minPrice: min(products.price),
        maxPrice: max(products.price),
      })
      .from(products)
      .where(whereClause);

    return result;
  }
}

// Usage
const stats = await productModel.getStatistics('electronics-uuid');
console.log(stats);
// {
//   total: 42,
//   totalRevenue: 29497.58,
//   avgPrice: 702.33,
//   minPrice: 99.99,
//   maxPrice: 1999.99
// }
```

---

### Group By

Group aggregations by field.

```typescript
export class ProductModel extends BaseModel<Product> {
  async getCountByCategory() {
    const db = this.getClient();

    const results = await db
      .select({
        categoryId: products.categoryId,
        count: count(),
        avgPrice: avg(products.price),
      })
      .from(products)
      .where(eq(products.isActive, true))
      .groupBy(products.categoryId)
      .orderBy(desc(count()));

    return results;
  }
}

// Usage
const categoryStats = await productModel.getCountByCategory();
console.log(categoryStats);
// [
//   { categoryId: 'electronics-uuid', count: 42, avgPrice: 702.33 },
//   { categoryId: 'clothing-uuid', count: 38, avgPrice: 45.99 },
//   ...
// ]
```

---

## Advanced Patterns

### Full-Text Search

Implement search across text fields.

```typescript
import { or, ilike, sql } from 'drizzle-orm';

export class ProductModel extends BaseModel<Product> {
  async search(query: string, options?: { page?: number; pageSize?: number }) {
    const db = this.getClient();
    const searchTerm = `%${query.trim()}%`;

    // Simple ILIKE search
    const whereClause = or(
      ilike(products.name, searchTerm),
      ilike(products.description, searchTerm),
      ilike(products.brand, searchTerm)
    );

    const items = await db
      .select()
      .from(products)
      .where(whereClause);

    return { items, total: items.length };
  }

  /**
   * PostgreSQL full-text search (more advanced)
   */
  async fullTextSearch(query: string) {
    const db = this.getClient();

    const items = await db
      .select()
      .from(products)
      .where(
        sql`to_tsvector('english', ${products.name} || ' ' || ${products.description})
            @@ plainto_tsquery('english', ${query})`
      );

    return { items, total: items.length };
  }
}
```

---

### Date Range Queries

Query by date ranges.

```typescript
import { gte, lte, and } from 'drizzle-orm';

export class ProductModel extends BaseModel<Product> {
  async findByDateRange(startDate: Date, endDate: Date) {
    const db = this.getClient();

    const items = await db
      .select()
      .from(products)
      .where(
        and(
          gte(products.createdAt, startDate),
          lte(products.createdAt, endDate)
        )
      );

    return { items, total: items.length };
  }

  async findRecentProducts(days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.findByDateRange(cutoffDate, new Date());
  }
}

// Usage
const lastWeek = await productModel.findRecentProducts(7);
const january = await productModel.findByDateRange(
  new Date('2024-01-01'),
  new Date('2024-01-31')
);
```

---

### Array Operations

Query JSON array fields.

```typescript
import { sql } from 'drizzle-orm';

export class ProductModel extends BaseModel<Product> {
  /**
   * Find products with specific tag
   */
  async findByTag(tagId: string) {
    const db = this.getClient();

    const items = await db
      .select()
      .from(products)
      .where(
        sql`${products.tags}::jsonb @> ${JSON.stringify([tagId])}::jsonb`
      );

    return { items, total: items.length };
  }

  /**
   * Find products with any of the tags
   */
  async findByTags(tagIds: string[]) {
    const db = this.getClient();

    const items = await db
      .select()
      .from(products)
      .where(
        sql`${products.tags}::jsonb ?| array[${tagIds.map(id => `'${id}'`).join(',')}]`
      );

    return { items, total: items.length };
  }
}
```

---

### JSON Queries

Query JSONB fields.

```typescript
import { sql } from 'drizzle-orm';

export class ProductModel extends BaseModel<Product> {
  /**
   * Find products with specific metadata
   */
  async findByMetadata(key: string, value: unknown) {
    const db = this.getClient();

    const items = await db
      .select()
      .from(products)
      .where(
        sql`${products.metadata}->>${key} = ${value}`
      );

    return { items, total: items.length };
  }

  /**
   * Find products with nested JSON value
   */
  async findByNestedMetadata(path: string[], value: unknown) {
    const db = this.getClient();
    const jsonPath = `{${path.join(',')}}`;

    const items = await db
      .select()
      .from(products)
      .where(
        sql`${products.metadata}#>>${jsonPath} = ${value}`
      );

    return { items, total: items.length };
  }
}

// Usage
const products = await productModel.findByMetadata('color', 'blue');
const products = await productModel.findByNestedMetadata(
  ['specs', 'screen', 'size'],
  '6.5'
);
```

---

## Performance

### Query Optimization

```typescript
// ✅ Good - Uses index on primary key
await productModel.findById('uuid-123');

// ✅ Good - Uses index on slug (if indexed)
await productModel.findOne({ slug: 'smartphone-x' });

// ❌ Slow - Full table scan
await productModel.findOne({ description: 'Some text' });

// ✅ Better - Add index on frequently queried fields
// CREATE INDEX idx_products_category ON products(category_id);
await productModel.findAll({ categoryId: 'cat-uuid' });
```

### Avoid N+1 Queries

```typescript
// ❌ N+1 problem - N separate queries
const products = await productModel.findAll({});
for (const product of products.items) {
  const category = await categoryModel.findById(product.categoryId);
  console.log(category.name);
}

// ✅ Solution - Eager load relations
const products = await productModel.findAllWithRelations(
  { category: true },
  {}
);
for (const product of products.items) {
  console.log(product.category.name);  // Already loaded
}
```

### Pagination for Large Results

```typescript
// ❌ Loading all records
const { items } = await productModel.findAll({});  // Could be 10,000+ records!

// ✅ Paginate
const { items, total } = await productModel.findAll(
  {},
  { page: 1, pageSize: 20 }
);
```

---

## Best Practices

### 1. Use Specific Queries

```typescript
// ✅ findById for ID lookups
await productModel.findById('uuid-123');

// ❌ findOne with ID (less efficient)
await productModel.findOne({ id: 'uuid-123' });
```

### 2. Load Only What You Need

```typescript
// ✅ Load only necessary relations
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  { category: true }  // Only category
);

// ❌ Loading everything
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  { category: true, reviews: true, tags: true, images: true }
);
```

### 3. Use Count for Existence Checks

```typescript
// ✅ Count is faster
const exists = await productModel.count({ slug: 'test' }) > 0;

// ❌ Finding full record just to check existence
const product = await productModel.findOne({ slug: 'test' });
const exists = product !== null;
```

### 4. Index Frequently Queried Fields

```sql
-- Add indexes in migrations for fields used in WHERE clauses
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_slug ON products(slug);
```

### 5. Override findAll for Custom Logic

```typescript
export class ProductModel extends BaseModel<Product> {
  async findAll(where: Record<string, unknown>, ...args) {
    // Add custom logic (search, filtering, etc.)
    return super.findAll(where, ...args);
  }
}
```

---

## See Also

- [BaseModel API Reference](./BaseModel.md) - Complete API documentation
- [Relations Guide](./relations.md) - Loading and querying relations
- [Quick Start Guide](../quick-start.md) - Getting started

---

*Last updated: 2025-11-05*
