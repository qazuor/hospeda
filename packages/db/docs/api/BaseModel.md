# BaseModel API Reference

Complete API reference for the `BaseModel` abstract class - the foundation of all database models in the `@repo/db` package.

## Table of Contents

- [Overview](#overview)
- [Generic Type Parameters](#generic-type-parameters)
- [Protected Properties](#protected-properties)
- [Query Methods](#query-methods)
  - [findAll](#findall)
  - [findById](#findbyid)
  - [findOne](#findone)
  - [findWithRelations](#findwithrelations)
  - [findAllWithRelations](#findallwithrelations)
  - [count](#count)
- [Write Methods](#write-methods)
  - [create](#create)
  - [update](#update)
  - [updateById](#updatebyid)
- [Delete Methods](#delete-methods)
  - [softDelete](#softdelete)
  - [hardDelete](#harddelete)
  - [restore](#restore)
- [Utility Methods](#utility-methods)
  - [getClient](#getclient)
  - [getTableName](#gettablename)
  - [raw](#raw)
- [Complete Examples](#complete-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

`BaseModel` is an abstract class that provides standardized CRUD operations, soft/hard delete, restore, and relation methods with built-in logging and error handling. All database models extend this class to inherit consistent data access patterns.

**Purpose:**

- Provide a consistent API for all database operations
- Encapsulate common CRUD logic
- Handle database errors uniformly
- Support transactions across all operations
- Enable relation loading with type safety
- Implement soft delete pattern by default

**Key Features:**

- Type-safe operations via TypeScript generics
- Built-in pagination support
- Relation loading (eager and nested)
- Transaction support on all methods
- Automatic logging and error handling
- Soft delete with restore capability

**Import:**

```typescript
import { BaseModel } from '@repo/db/base';
```

---

## Generic Type Parameters

### `TEntity`

The entity type managed by the model. This type parameter flows through all methods to provide type safety.

**Example:**

```typescript
import type { Product } from '@repo/schemas';
import { BaseModel } from '@repo/db/base';

export class ProductModel extends BaseModel<Product> {
  // All methods now work with Product type
}
```

**Type Safety:**

```typescript
const productModel = new ProductModel();

// ✅ TypeScript knows this returns Product | null
const product: Product | null = await productModel.findById('uuid');

// ✅ TypeScript validates create data
await productModel.create({
  name: 'Test Product',
  price: 29.99,
  // TypeScript error if invalid fields
});

// ✅ TypeScript validates update data
await productModel.update({ id: 'uuid' }, {
  price: 39.99, // Only valid Product fields allowed
});
```

---

## Protected Properties

### `table`

The Drizzle table schema object that defines the database table structure.

**Type:**

```typescript
protected abstract table: Table;
```

**Usage:**

```typescript
import { products } from '../schemas/catalog/product.dbschema';

export class ProductModel extends BaseModel<Product> {
  protected table = products;
}
```

**Purpose:**

- Used internally for all database queries
- Provides column definitions for query building
- Enables relation mapping

---

### `entityName`

A string identifier for the entity, used in logging and error messages.

**Type:**

```typescript
protected abstract entityName: string;
```

**Usage:**

```typescript
export class ProductModel extends BaseModel<Product> {
  protected entityName = 'product';
}
```

**Purpose:**

- Human-readable name in logs
- Error message context
- Debugging information

**Example Log Output:**

```
[DB:Query] product.findById { id: "uuid-123" } -> { name: "Test Product" }
[DB:Error] product.create { name: "Invalid" } -> ValidationError: ...
```

---

## Query Methods

### findAll

Finds entities matching filter criteria with optional pagination.

**Signature:**

```typescript
async findAll(
  where: Record<string, unknown>,
  options?: { page?: number; pageSize?: number },
  tx?: NodePgDatabase<typeof schema>
): Promise<{ items: TEntity[]; total: number }>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `where` | `Record<string, unknown>` | Yes | Filter object with key-value pairs matching table columns |
| `options` | `{ page?: number; pageSize?: number }` | No | Pagination options. If provided, returns paginated results |
| `options.page` | `number` | No | Page number (1-indexed). Used with `pageSize` for pagination |
| `options.pageSize` | `number` | No | Number of items per page. Used with `page` for pagination |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client for atomic operations |

**Returns:**

```typescript
Promise<{
  items: TEntity[];  // Array of matching entities
  total: number;     // Total count (all pages if paginated, or items.length if not)
}>
```

**Behavior:**

- **Without pagination:** Returns all matching records. `total` equals `items.length`
- **With pagination:** Returns page of records. `total` is the count across all pages
- Empty `where` object returns all records
- `undefined` values in `where` are ignored
- Results are ordered by database default (usually insertion order)

**Basic Usage:**

```typescript
// Find all products
const allProducts = await productModel.findAll({});
console.log(allProducts.items);        // All products
console.log(allProducts.total);        // Count of all products

// Find with filter
const activeProducts = await productModel.findAll({
  isActive: true,
  categoryId: 'cat-uuid',
});
console.log(activeProducts.items);     // Filtered products
console.log(activeProducts.total);     // Count of filtered products
```

**Paginated Usage:**

```typescript
// Get page 1 (first 20 products)
const page1 = await productModel.findAll(
  { isActive: true },
  { page: 1, pageSize: 20 }
);

console.log(page1.items.length);       // 20 (or less if fewer results)
console.log(page1.total);              // Total matching products (e.g., 156)

// Get page 2
const page2 = await productModel.findAll(
  { isActive: true },
  { page: 2, pageSize: 20 }
);

console.log(page2.items.length);       // 20 (or less)
console.log(page2.total);              // Same as page1.total (156)
```

**With Transaction:**

```typescript
await db.transaction(async (trx) => {
  const products = await productModel.findAll(
    { categoryId: 'cat-uuid' },
    undefined,
    trx
  );

  // Use products within transaction
  for (const product of products.items) {
    await productModel.update({ id: product.id }, { stock: 0 }, trx);
  }
});
```

**Overriding for Custom Logic:**

```typescript
export class ProductModel extends BaseModel<Product> {
  /**
   * Override findAll to add full-text search capability
   */
  async findAll(
    where: Record<string, unknown>,
    options?: { page?: number; pageSize?: number },
    tx?: NodePgDatabase<typeof schema>
  ): Promise<{ items: Product[]; total: number }> {
    // Extract custom search parameter
    const { q, ...otherFilters } = where;

    // If no search query, use base implementation
    if (!q) {
      return super.findAll(where, options, tx);
    }

    // Custom full-text search logic
    const db = this.getClient(tx);
    const searchTerm = `%${q}%`;

    const whereClause = and(
      buildWhereClause(otherFilters, this.table as unknown),
      or(
        ilike(products.name, searchTerm),
        ilike(products.description, searchTerm)
      )
    );

    // Apply pagination if provided
    if (options?.page && options?.pageSize) {
      const offset = (options.page - 1) * options.pageSize;
      const [items, total] = await Promise.all([
        db.select().from(this.table).where(whereClause)
          .limit(options.pageSize).offset(offset),
        this.count({ ...otherFilters, q }, tx)
      ]);
      return { items: items as Product[], total };
    }

    // No pagination
    const items = await db.select().from(this.table).where(whereClause);
    return { items: items as Product[], total: items.length };
  }
}
```

**Related Methods:**

- [`findOne`](#findone) - Find single record
- [`findById`](#findbyid) - Find by ID
- [`count`](#count) - Count matching records

---

### findById

Finds a single entity by its unique ID.

**Signature:**

```typescript
async findById(
  id: string,
  tx?: NodePgDatabase<typeof schema>
): Promise<TEntity | null>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | UUID of the entity to find |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<TEntity | null>  // Entity if found, null if not found
```

**Usage:**

```typescript
// Find existing product
const product = await productModel.findById('uuid-123');
if (product) {
  console.log(product.name);
  console.log(product.price);
} else {
  console.log('Product not found');
}

// With null check
const product = await productModel.findById('uuid-123');
if (!product) {
  throw new Error('Product not found');
}
// TypeScript knows product is not null here
console.log(product.name);
```

**With Transaction:**

```typescript
await db.transaction(async (trx) => {
  const product = await productModel.findById('uuid-123', trx);
  if (!product) {
    throw new Error('Product not found');
  }

  await productModel.update({ id: product.id }, { stock: product.stock - 1 }, trx);
});
```

**Error Handling:**

```typescript
try {
  const product = await productModel.findById('uuid-123');
} catch (error) {
  if (error instanceof DbError) {
    console.error(`Database error finding product: ${error.message}`);
  }
  throw error;
}
```

**Related Methods:**

- [`findOne`](#findone) - Find by any criteria
- [`findAll`](#findall) - Find multiple records

---

### findOne

Finds the first entity matching filter criteria.

**Signature:**

```typescript
async findOne(
  where: Record<string, unknown>,
  tx?: NodePgDatabase<typeof schema>
): Promise<TEntity | null>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `where` | `Record<string, unknown>` | Yes | Filter object with key-value pairs |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<TEntity | null>  // First matching entity or null if none found
```

**Behavior:**

- Returns first matching record (LIMIT 1)
- Returns `null` if no match found
- Order is database default unless table has explicit ordering

**Usage:**

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

**Common Patterns:**

```typescript
// Verify uniqueness before create
const existing = await productModel.findOne({ slug: newProduct.slug });
if (existing) {
  throw new Error('Product with this slug already exists');
}
await productModel.create(newProduct);

// Find or create pattern
let product = await productModel.findOne({ externalId: '12345' });
if (!product) {
  product = await productModel.create({
    externalId: '12345',
    name: 'Imported Product',
  });
}
```

**With Transaction:**

```typescript
await db.transaction(async (trx) => {
  const product = await productModel.findOne({ slug: 'test' }, trx);

  if (product) {
    await productModel.update({ id: product.id }, { stock: 0 }, trx);
  } else {
    await productModel.create({ slug: 'test', stock: 100 }, trx);
  }
});
```

**Related Methods:**

- [`findById`](#findbyid) - Find by ID specifically
- [`findAll`](#findall) - Find multiple records

---

### findWithRelations

Finds a single entity with specified relations populated.

**Signature:**

```typescript
async findWithRelations(
  where: Record<string, unknown>,
  relations: Record<string, boolean | Record<string, unknown>>,
  tx?: NodePgDatabase<typeof schema>
): Promise<TEntity | null>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `where` | `Record<string, unknown>` | Yes | Filter object to find the entity |
| `relations` | `Record<string, boolean \| Record<string, unknown>>` | Yes | Relations to include. Use `true` for simple relations, nested object for nested relations |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<TEntity | null>  // Entity with relations populated, or null if not found
```

**Relation Syntax:**

```typescript
// Simple relations
{
  category: true,
  reviews: true,
}

// Nested relations
{
  reviews: {
    author: true,
  },
}

// Multiple levels
{
  category: {
    parent: true,
  },
  reviews: {
    author: {
      profile: true,
    },
  },
}
```

**Basic Usage:**

```typescript
// Load product with category
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  { category: true }
);

if (product) {
  console.log(product.name);
  console.log(product.category.name);  // Category is loaded
}
```

**Multiple Relations:**

```typescript
const product = await productModel.findWithRelations(
  { slug: 'smartphone-x' },
  {
    category: true,
    reviews: true,
    tags: true,
  }
);

if (product) {
  console.log(product.category);      // Category object
  console.log(product.reviews);       // Array of reviews
  console.log(product.tags);          // Array of tags
}
```

**Nested Relations:**

```typescript
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  {
    category: {
      parent: true,  // Load category's parent
    },
    reviews: {
      author: true,  // Load each review's author
    },
  }
);

if (product) {
  console.log(product.category.name);
  console.log(product.category.parent?.name);  // Parent category

  for (const review of product.reviews) {
    console.log(review.rating);
    console.log(review.author.name);           // Review author
  }
}
```

**Performance Note:**

> **Tip:** Only load relations you need. Each relation adds database joins and increases query time.

```typescript
// ❌ Loading unnecessary relations
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  {
    category: true,
    reviews: true,
    tags: true,
    // ... loading everything
  }
);

// ✅ Load only what you need
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  { category: true }  // Only category needed
);
```

**Related Methods:**

- [`findAllWithRelations`](#findallwithrelations) - Find multiple with relations
- [`findOne`](#findone) - Find without relations

---

### findAllWithRelations

Finds multiple entities with specified relations populated, with pagination support.

**Signature:**

```typescript
async findAllWithRelations(
  relations: Record<string, boolean | Record<string, unknown>>,
  where: Record<string, unknown> = {},
  options: PaginatedListOptions = {}
): Promise<{ items: TEntity[]; total: number }>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `relations` | `Record<string, boolean \| Record<string, unknown>>` | Yes | Relations to include |
| `where` | `Record<string, unknown>` | No | Filter criteria (default: `{}`) |
| `options` | `PaginatedListOptions` | No | Pagination options |
| `options.page` | `number` | No | Page number (default: 1) |
| `options.pageSize` | `number` | No | Items per page (default: 20) |

**Returns:**

```typescript
Promise<{
  items: TEntity[];  // Array of entities with relations
  total: number;     // Total count across all pages
}>
```

**Basic Usage:**

```typescript
// Find all products with category
const result = await productModel.findAllWithRelations(
  { category: true }
);

console.log(result.items);   // Products with category populated
console.log(result.total);   // Total count

for (const product of result.items) {
  console.log(product.name);
  console.log(product.category.name);
}
```

**With Filters:**

```typescript
// Find active products with relations
const result = await productModel.findAllWithRelations(
  { category: true, reviews: true },
  { isActive: true, isFeatured: true }
);

console.log(result.items);   // Filtered products with relations
console.log(result.total);   // Count of filtered products
```

**With Pagination:**

```typescript
// Get first page
const page1 = await productModel.findAllWithRelations(
  { category: true },
  { isActive: true },
  { page: 1, pageSize: 10 }
);

console.log(page1.items.length);  // 10 (or less)
console.log(page1.total);         // Total matching products (e.g., 156)

// Get next page
const page2 = await productModel.findAllWithRelations(
  { category: true },
  { isActive: true },
  { page: 2, pageSize: 10 }
);
```

**Nested Relations:**

```typescript
const result = await productModel.findAllWithRelations(
  {
    category: {
      parent: true,
    },
    reviews: {
      author: true,
    },
  },
  { isActive: true },
  { page: 1, pageSize: 20 }
);

for (const product of result.items) {
  console.log(product.category.name);
  console.log(product.category.parent?.name);

  for (const review of product.reviews) {
    console.log(review.author.name);
  }
}
```

**Fallback Behavior:**

If no relations are actually requested (all values are `false` or empty objects), the method automatically falls back to `findAll()` for better performance.

```typescript
// These all fall back to findAll()
await productModel.findAllWithRelations({}, { isActive: true });
await productModel.findAllWithRelations({ category: false });
```

**Performance Considerations:**

```typescript
// ❌ N+1 problem - fetching relations in loop
const products = await productModel.findAll({ isActive: true });
for (const product of products.items) {
  const category = await categoryModel.findById(product.categoryId);
  // This makes N database queries!
}

// ✅ Eager loading - single query with relations
const products = await productModel.findAllWithRelations(
  { category: true },
  { isActive: true }
);
// Single query with JOIN
```

**Related Methods:**

- [`findWithRelations`](#findwithrelations) - Find single with relations
- [`findAll`](#findall) - Find without relations

---

### count

Counts entities matching filter criteria.

**Signature:**

```typescript
async count(
  where: Record<string, unknown>,
  tx?: NodePgDatabase<typeof schema>
): Promise<number>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `where` | `Record<string, unknown>` | Yes | Filter object |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<number>  // Count of matching entities
```

**Usage:**

```typescript
// Count all products
const totalProducts = await productModel.count({});

// Count with filter
const activeProducts = await productModel.count({ isActive: true });

// Count by category
const categoryProducts = await productModel.count({
  categoryId: 'cat-uuid',
  isActive: true,
});
```

**Common Patterns:**

```typescript
// Check existence
const count = await productModel.count({ slug: 'test-product' });
const exists = count > 0;

// Pagination calculations
const total = await productModel.count({ isActive: true });
const pageSize = 20;
const totalPages = Math.ceil(total / pageSize);

// Conditional logic
const activeCount = await productModel.count({ isActive: true });
if (activeCount === 0) {
  console.log('No active products available');
}
```

**With Transaction:**

```typescript
await db.transaction(async (trx) => {
  const count = await productModel.count({ categoryId: 'cat-uuid' }, trx);

  if (count === 0) {
    // Delete empty category
    await categoryModel.hardDelete({ id: 'cat-uuid' }, trx);
  }
});
```

**Performance:**

Count queries are optimized and only count rows without fetching data.

```typescript
// ✅ Efficient - uses COUNT(*)
const count = await productModel.count({ isActive: true });

// ❌ Inefficient - fetches all data just to count
const result = await productModel.findAll({ isActive: true });
const count = result.items.length;  // Wasteful!
```

**Related Methods:**

- [`findAll`](#findall) - Also returns total count

---

## Write Methods

### create

Creates a new entity.

**Signature:**

```typescript
async create(
  data: Partial<TEntity>,
  tx?: NodePgDatabase<typeof schema>
): Promise<TEntity>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `data` | `Partial<TEntity>` | Yes | Entity data to insert |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<TEntity>  // The created entity (with generated fields like id, createdAt)
```

**Usage:**

```typescript
// Create product
const product = await productModel.create({
  name: 'Smartphone X',
  slug: 'smartphone-x',
  price: 699.99,
  categoryId: 'cat-uuid',
  isActive: true,
});

console.log(product.id);         // Generated UUID
console.log(product.createdAt);  // Generated timestamp
console.log(product.name);       // 'Smartphone X'
```

**With Default Values:**

```typescript
// Database provides defaults for omitted fields
const product = await productModel.create({
  name: 'Test Product',
  slug: 'test-product',
  price: 29.99,
  // isActive defaults to false
  // createdAt defaults to NOW()
});

console.log(product.isActive);   // false (default)
console.log(product.createdAt);  // Current timestamp
```

**With Transaction:**

```typescript
await db.transaction(async (trx) => {
  // Create category first
  const category = await categoryModel.create({
    name: 'Electronics',
    slug: 'electronics',
  }, trx);

  // Create products in category
  const product1 = await productModel.create({
    name: 'Product 1',
    categoryId: category.id,
  }, trx);

  const product2 = await productModel.create({
    name: 'Product 2',
    categoryId: category.id,
  }, trx);

  // All committed together or rolled back on error
});
```

**Validation:**

```typescript
// Validate before create
const schema = createProductSchema;
const validatedData = schema.parse(rawData);

const product = await productModel.create(validatedData);
```

**Error Handling:**

```typescript
try {
  const product = await productModel.create({
    name: 'Test',
    slug: 'existing-slug',  // Duplicate slug
  });
} catch (error) {
  if (error instanceof DbError) {
    console.error(`Failed to create product: ${error.message}`);
    // Handle unique constraint violation, etc.
  }
}
```

**Related Methods:**

- [`update`](#update) - Update existing entity
- [`findOne`](#findone) - Check existence before create

---

### update

Updates entities matching filter criteria.

**Signature:**

```typescript
async update(
  where: Record<string, unknown>,
  data: Partial<TEntity>,
  tx?: NodePgDatabase<typeof schema>
): Promise<TEntity | null>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `where` | `Record<string, unknown>` | Yes | Filter to identify entities to update |
| `data` | `Partial<TEntity>` | Yes | Fields to update |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<TEntity | null>  // First updated entity, or null if no match
```

> **Note:** This method returns only the **first** updated entity, even if multiple records match. For bulk updates, check the return value.

**Usage:**

```typescript
// Update by ID
const updated = await productModel.update(
  { id: 'uuid-123' },
  { price: 799.99, updatedAt: new Date() }
);

if (updated) {
  console.log(updated.price);  // 799.99
}

// Update by other criteria
const updated = await productModel.update(
  { slug: 'smartphone-x' },
  { isActive: false }
);
```

**Partial Updates:**

```typescript
// Only update specified fields
const updated = await productModel.update(
  { id: 'uuid-123' },
  { price: 599.99 }  // Only price changes
);

// name, slug, etc. remain unchanged
```

**With Transaction:**

```typescript
await db.transaction(async (trx) => {
  const product = await productModel.findById('uuid-123', trx);
  if (!product) throw new Error('Not found');

  await productModel.update(
    { id: product.id },
    { stock: product.stock - 1 },
    trx
  );
});
```

**Multiple Field Update:**

```typescript
const updated = await productModel.update(
  { id: 'uuid-123' },
  {
    name: 'Smartphone X Pro',
    price: 899.99,
    description: 'Updated description',
    updatedAt: new Date(),
    updatedById: 'user-uuid',
  }
);
```

**Conditional Update:**

```typescript
// Update only if conditions met
const product = await productModel.findById('uuid-123');
if (!product) throw new Error('Not found');

if (product.stock > 0) {
  await productModel.update(
    { id: product.id },
    { stock: product.stock - 1 }
  );
}
```

**Related Methods:**

- [`updateById`](#updatebyid) - Convenience method for ID updates
- [`create`](#create) - Create new entity

---

### updateById

Updates an entity by its unique ID. Convenience method that calls `update()`.

**Signature:**

```typescript
async updateById(
  id: string,
  data: Partial<TEntity>,
  tx?: NodePgDatabase<typeof schema>
): Promise<void>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | UUID of entity to update |
| `data` | `Partial<TEntity>` | Yes | Fields to update |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<void>  // No return value
```

> **Note:** Unlike `update()`, this method does not return the updated entity. Use `update()` if you need the result.

**Usage:**

```typescript
// Update product by ID
await productModel.updateById('uuid-123', {
  price: 699.99,
  updatedAt: new Date(),
});

// With transaction
await db.transaction(async (trx) => {
  await productModel.updateById('uuid-123', { isActive: false }, trx);
});
```

**When to Use:**

```typescript
// ✅ Use updateById when you have the ID and don't need result
await productModel.updateById('uuid-123', { price: 599.99 });

// ✅ Use update when you need the updated entity
const updated = await productModel.update(
  { id: 'uuid-123' },
  { price: 599.99 }
);
console.log(updated.price);  // 599.99

// ✅ Use update when filtering by non-ID field
const updated = await productModel.update(
  { slug: 'smartphone-x' },
  { price: 599.99 }
);
```

**Related Methods:**

- [`update`](#update) - Update with flexible filters

---

## Delete Methods

### softDelete

Marks entities as deleted by setting `deletedAt` timestamp, without removing from database.

**Signature:**

```typescript
async softDelete(
  where: Record<string, unknown>,
  tx?: NodePgDatabase<typeof schema>
): Promise<number>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `where` | `Record<string, unknown>` | Yes | Filter to identify entities to soft delete |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<number>  // Number of entities soft deleted
```

**Behavior:**

- Sets `deletedAt` field to current timestamp
- Records remain in database
- Can be restored with [`restore()`](#restore)
- Queries should filter out soft-deleted records

**Usage:**

```typescript
// Soft delete by ID
const count = await productModel.softDelete({ id: 'uuid-123' });
console.log(`Soft deleted ${count} product(s)`);

// Soft delete by criteria
const count = await productModel.softDelete({
  categoryId: 'cat-uuid',
  isActive: false,
});
console.log(`Soft deleted ${count} inactive products`);
```

**With Transaction:**

```typescript
await db.transaction(async (trx) => {
  // Soft delete product
  await productModel.softDelete({ id: 'uuid-123' }, trx);

  // Soft delete related reviews
  await reviewModel.softDelete({ productId: 'uuid-123' }, trx);
});
```

**Why Soft Delete:**

```typescript
// ✅ Soft delete preserves data
await productModel.softDelete({ id: 'uuid-123' });
// Product still in database, can be restored or audited

// ❌ Hard delete removes permanently
await productModel.hardDelete({ id: 'uuid-123' });
// Product gone forever, no recovery possible
```

**Filtering Soft-Deleted Records:**

```typescript
// Most queries should exclude soft-deleted records
const activeProducts = await productModel.findAll({
  deletedAt: null,  // Only non-deleted
  isActive: true,
});

// Find soft-deleted records
const deletedProducts = await productModel.findAll({
  deletedAt: { not: null },  // Only deleted
});
```

**Audit Trail:**

```typescript
// Track who deleted and when
const count = await productModel.update(
  { id: 'uuid-123' },
  {
    deletedAt: new Date(),
    deletedById: currentUser.id,
  }
);
```

**Related Methods:**

- [`hardDelete`](#harddelete) - Permanent deletion
- [`restore`](#restore) - Undo soft delete

---

### hardDelete

Permanently deletes entities from the database.

**Signature:**

```typescript
async hardDelete(
  where: Record<string, unknown>,
  tx?: NodePgDatabase<typeof schema>
): Promise<number>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `where` | `Record<string, unknown>` | Yes | Filter to identify entities to delete |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<number>  // Number of entities permanently deleted
```

**Behavior:**

- Permanently removes records from database
- **Cannot be restored**
- May fail if foreign key constraints exist
- Should be used sparingly

> **Warning:** Hard delete is permanent and cannot be undone. Use [`softDelete`](#softdelete) by default.

**Usage:**

```typescript
// Hard delete by ID
const count = await productModel.hardDelete({ id: 'uuid-123' });
console.log(`Permanently deleted ${count} product(s)`);

// Hard delete by criteria
const count = await productModel.hardDelete({
  deletedAt: { not: null },  // Delete soft-deleted records
  createdAt: { lt: '2020-01-01' },  // Older than 2020
});
```

**With Foreign Key Constraints:**

```typescript
// ❌ This may fail if products reference this category
try {
  await categoryModel.hardDelete({ id: 'cat-uuid' });
} catch (error) {
  // Foreign key constraint violation
  console.error('Cannot delete category with products');
}

// ✅ Delete related records first
await db.transaction(async (trx) => {
  await productModel.hardDelete({ categoryId: 'cat-uuid' }, trx);
  await categoryModel.hardDelete({ id: 'cat-uuid' }, trx);
});
```

**When to Use Hard Delete:**

```typescript
// ✅ Cleanup old soft-deleted records (GDPR compliance)
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

await productModel.hardDelete({
  deletedAt: { lt: oneYearAgo },
});

// ✅ Remove test data
await productModel.hardDelete({
  name: { like: 'TEST_%' },
});

// ❌ Regular deletion - use soft delete instead
await productModel.softDelete({ id: 'uuid-123' });
```

**Related Methods:**

- [`softDelete`](#softdelete) - Reversible deletion
- [`restore`](#restore) - Restore soft-deleted records

---

### restore

Restores soft-deleted entities by clearing the `deletedAt` timestamp.

**Signature:**

```typescript
async restore(
  where: Record<string, unknown>,
  tx?: NodePgDatabase<typeof schema>
): Promise<number>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `where` | `Record<string, unknown>` | Yes | Filter to identify entities to restore |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<number>  // Number of entities restored
```

**Behavior:**

- Sets `deletedAt` field to `null`
- Only affects soft-deleted records
- Does not restore hard-deleted records (impossible)

**Usage:**

```typescript
// Restore by ID
const count = await productModel.restore({ id: 'uuid-123' });
console.log(`Restored ${count} product(s)`);

// Restore by criteria
const count = await productModel.restore({
  categoryId: 'cat-uuid',
  deletedAt: { not: null },  // Only soft-deleted
});
```

**With Transaction:**

```typescript
await db.transaction(async (trx) => {
  // Restore product
  await productModel.restore({ id: 'uuid-123' }, trx);

  // Restore related reviews
  await reviewModel.restore({ productId: 'uuid-123' }, trx);
});
```

**Verify Before Restore:**

```typescript
// Check if product exists and is soft-deleted
const product = await productModel.findOne({
  id: 'uuid-123',
  deletedAt: { not: null },
});

if (product) {
  await productModel.restore({ id: product.id });
  console.log('Product restored successfully');
} else {
  console.log('Product not found or not deleted');
}
```

**Restore with Metadata:**

```typescript
// Track who restored and when
await productModel.update(
  { id: 'uuid-123' },
  {
    deletedAt: null,
    restoredAt: new Date(),
    restoredById: currentUser.id,
  }
);
```

**Related Methods:**

- [`softDelete`](#softdelete) - Soft delete records
- [`hardDelete`](#harddelete) - Cannot be restored

---

## Utility Methods

### getClient

Gets the database client, using transaction if provided or global connection otherwise.

**Signature:**

```typescript
protected getClient(
  tx?: NodePgDatabase<typeof schema>
): NodePgDatabase<typeof schema>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
NodePgDatabase<typeof schema>  // Database client
```

**Usage (Internal):**

This is a protected method used internally by all query methods. You typically don't call it directly unless implementing custom methods.

```typescript
export class ProductModel extends BaseModel<Product> {
  async customQuery(tx?: NodePgDatabase<typeof schema>) {
    const db = this.getClient(tx);

    // Use db for queries
    const result = await db.select().from(this.table);
    return result;
  }
}
```

---

### getTableName

Returns the table name as a string for dynamic relation queries.

**Signature:**

```typescript
protected abstract getTableName(): string;
```

**Returns:**

```typescript
string  // Table name
```

**Usage:**

Must be implemented in all models.

```typescript
export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'product';

  protected getTableName(): string {
    return 'products';  // Must match Drizzle schema name
  }
}
```

**Purpose:**

Used internally by `findAllWithRelations()` to dynamically access the Drizzle query API.

---

### raw

Executes a raw SQL query. Use sparingly when Drizzle query builder is insufficient.

**Signature:**

```typescript
async raw(
  query: SQL,
  tx?: NodePgDatabase<typeof schema>
): Promise<unknown>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `SQL` | Yes | Raw SQL query (use Drizzle `sql` template tag) |
| `tx` | `NodePgDatabase<typeof schema>` | No | Transaction client |

**Returns:**

```typescript
Promise<unknown>  // Raw query result
```

> **Warning:** Use raw SQL only when necessary. Prefer Drizzle query builder for type safety and SQL injection protection.

**Usage:**

```typescript
import { sql } from 'drizzle-orm';

// Simple raw query
const result = await productModel.raw(
  sql`SELECT COUNT(*) as total FROM products WHERE is_active = true`
);

// With parameters (safe from SQL injection)
const categoryId = 'cat-uuid';
const result = await productModel.raw(
  sql`SELECT * FROM products WHERE category_id = ${categoryId}`
);

// Complex aggregation
const result = await productModel.raw(sql`
  SELECT
    category_id,
    COUNT(*) as product_count,
    AVG(price) as avg_price
  FROM products
  WHERE is_active = true
  GROUP BY category_id
  ORDER BY product_count DESC
  LIMIT 10
`);
```

**When to Use:**

```typescript
// ✅ Complex aggregations not supported by query builder
const result = await productModel.raw(sql`
  SELECT
    date_trunc('month', created_at) as month,
    COUNT(*) as count
  FROM products
  GROUP BY month
  ORDER BY month DESC
`);

// ✅ Database-specific features
const result = await productModel.raw(sql`
  SELECT * FROM products
  WHERE tsv @@ to_tsquery('electronics & smartphone')
`);

// ❌ Simple queries - use query builder instead
// Don't do this:
const result = await productModel.raw(
  sql`SELECT * FROM products WHERE id = ${id}`
);

// Do this instead:
const product = await productModel.findById(id);
```

**Safety:**

```typescript
// ✅ Safe - uses parameterized query
const searchTerm = userInput;
const result = await productModel.raw(
  sql`SELECT * FROM products WHERE name ILIKE ${`%${searchTerm}%`}`
);

// ❌ DANGEROUS - SQL injection vulnerability
const result = await productModel.raw(
  sql`SELECT * FROM products WHERE name ILIKE '%${userInput}%'`
);
// If userInput is: "'; DROP TABLE products; --"
```

**Related Methods:**

- [`findAll`](#findall) - Type-safe queries
- [`count`](#count) - Type-safe counting

---

## Complete Examples

### Basic CRUD Operations

```typescript
import { ProductModel } from '@repo/db';
import type { Product } from '@repo/schemas';

const productModel = new ProductModel();

// CREATE
const newProduct = await productModel.create({
  name: 'Smartphone X',
  slug: 'smartphone-x',
  description: 'Latest smartphone',
  price: 699.99,
  categoryId: 'cat-uuid',
  isActive: true,
});

console.log('Created:', newProduct.id);

// READ - by ID
const product = await productModel.findById(newProduct.id);
console.log('Found:', product?.name);

// READ - by criteria
const activeProduct = await productModel.findOne({
  slug: 'smartphone-x',
  isActive: true,
});

// READ - multiple with pagination
const { items, total } = await productModel.findAll(
  { isActive: true },
  { page: 1, pageSize: 10 }
);

console.log(`Found ${items.length} of ${total} products`);

// UPDATE
const updated = await productModel.update(
  { id: newProduct.id },
  { price: 599.99 }
);

console.log('Updated price:', updated?.price);

// SOFT DELETE
await productModel.softDelete({ id: newProduct.id });
console.log('Product soft deleted');

// RESTORE
await productModel.restore({ id: newProduct.id });
console.log('Product restored');

// HARD DELETE (permanent)
await productModel.hardDelete({ id: newProduct.id });
console.log('Product permanently deleted');
```

### Working with Relations

```typescript
// Find product with category and reviews
const product = await productModel.findWithRelations(
  { slug: 'smartphone-x' },
  {
    category: true,
    reviews: {
      author: true,  // Nested: load author for each review
    },
    tags: true,
  }
);

if (product) {
  console.log('Product:', product.name);
  console.log('Category:', product.category.name);

  console.log(`Reviews (${product.reviews.length}):`);
  for (const review of product.reviews) {
    console.log(`- ${review.rating}/5 by ${review.author.name}`);
  }

  console.log('Tags:', product.tags.map(t => t.name).join(', '));
}

// Find multiple with relations and pagination
const { items, total } = await productModel.findAllWithRelations(
  {
    category: true,
    reviews: true,
  },
  { isActive: true, isFeatured: true },
  { page: 1, pageSize: 20 }
);

console.log(`Featured products: ${items.length} of ${total}`);
```

### Transaction Example

```typescript
import { getDb } from '@repo/db';

const db = getDb();

await db.transaction(async (trx) => {
  // Create category
  const category = await categoryModel.create({
    name: 'Electronics',
    slug: 'electronics',
  }, trx);

  // Create products in category
  const product1 = await productModel.create({
    name: 'Smartphone',
    slug: 'smartphone',
    categoryId: category.id,
    price: 699.99,
  }, trx);

  const product2 = await productModel.create({
    name: 'Tablet',
    slug: 'tablet',
    categoryId: category.id,
    price: 499.99,
  }, trx);

  // Update category with product count
  await categoryModel.update(
    { id: category.id },
    { productCount: 2 },
    trx
  );

  // All operations committed together
  // If any fail, entire transaction rolls back
});
```

### Custom Model Implementation

```typescript
import { BaseModel } from '@repo/db/base';
import { products } from '@repo/db/schemas';
import type { Product } from '@repo/schemas';
import { ilike, or, and } from 'drizzle-orm';

export class ProductModel extends BaseModel<Product> {
  protected table = products;
  protected entityName = 'product';

  protected getTableName(): string {
    return 'products';
  }

  /**
   * Override findAll to add full-text search
   */
  async findAll(
    where: Record<string, unknown>,
    options?: { page?: number; pageSize?: number },
    tx?: NodePgDatabase<typeof schema>
  ): Promise<{ items: Product[]; total: number }> {
    const { q, ...otherFilters } = where;

    // If no search query, use base implementation
    if (!q || typeof q !== 'string') {
      return super.findAll(where, options, tx);
    }

    // Custom search logic
    const db = this.getClient(tx);
    const searchTerm = `%${q.trim()}%`;

    const searchClause = or(
      ilike(products.name, searchTerm),
      ilike(products.description, searchTerm)
    );

    const baseWhere = buildWhereClause(otherFilters, this.table as unknown);
    const finalWhere = baseWhere
      ? and(baseWhere, searchClause)
      : searchClause;

    // Apply pagination if provided
    if (options?.page && options?.pageSize) {
      const offset = (options.page - 1) * options.pageSize;
      const [items, totalResult] = await Promise.all([
        db.select().from(this.table).where(finalWhere)
          .limit(options.pageSize).offset(offset),
        db.select({ count: count() }).from(this.table).where(finalWhere)
      ]);

      return {
        items: items as Product[],
        total: Number(totalResult[0]?.count ?? 0)
      };
    }

    // No pagination
    const items = await db.select().from(this.table).where(finalWhere);
    return { items: items as Product[], total: items.length };
  }

  /**
   * Find products by category slug
   */
  async findByCategorySlug(
    categorySlug: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<{ items: Product[]; total: number }> {
    const db = this.getClient();

    const result = await db
      .select()
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(categories.slug, categorySlug));

    // Apply pagination...
    return { items: result as Product[], total: result.length };
  }

  /**
   * Increment view count
   */
  async incrementViews(id: string): Promise<void> {
    const db = this.getClient();

    await db
      .update(products)
      .set({ views: sql`${products.views} + 1` })
      .where(eq(products.id, id));
  }
}
```

---

## Error Handling

All BaseModel methods throw `DbError` on failure.

**DbError Structure:**

```typescript
class DbError extends Error {
  constructor(
    public entityName: string,
    public operation: string,
    public context: unknown,
    message: string
  ) {
    super(message);
    this.name = 'DbError';
  }
}
```

**Catching Errors:**

```typescript
import { DbError } from '@repo/db/utils';

try {
  await productModel.create({ name: 'Test' });
} catch (error) {
  if (error instanceof DbError) {
    console.error('Database error:');
    console.error('Entity:', error.entityName);     // 'product'
    console.error('Operation:', error.operation);   // 'create'
    console.error('Context:', error.context);       // { name: 'Test' }
    console.error('Message:', error.message);       // Database-specific error
  }
  throw error;
}
```

**Common Error Scenarios:**

```typescript
// Unique constraint violation
try {
  await productModel.create({ slug: 'existing-slug' });
} catch (error) {
  if (error instanceof DbError && error.message.includes('unique')) {
    console.error('Product with this slug already exists');
  }
}

// Foreign key violation
try {
  await productModel.create({ categoryId: 'invalid-uuid' });
} catch (error) {
  if (error instanceof DbError && error.message.includes('foreign key')) {
    console.error('Category not found');
  }
}

// Not found
const product = await productModel.findById('uuid-123');
if (!product) {
  throw new Error('Product not found');
}
```

---

## Best Practices

### 1. Always Use Models

```typescript
// ✅ Use model
const product = await productModel.findById('uuid-123');

// ❌ Don't query tables directly
const product = await db.select().from(products).where(eq(products.id, 'uuid-123'));
```

### 2. Use Transactions for Multi-Step Operations

```typescript
// ✅ Atomic operation
await db.transaction(async (trx) => {
  await productModel.create({ name: 'A' }, trx);
  await productModel.create({ name: 'B' }, trx);
  // Both committed together or rolled back
});

// ❌ Non-atomic - second may fail leaving first committed
await productModel.create({ name: 'A' });
await productModel.create({ name: 'B' });
```

### 3. Soft Delete by Default

```typescript
// ✅ Soft delete allows recovery
await productModel.softDelete({ id: 'uuid-123' });

// ❌ Hard delete is permanent
await productModel.hardDelete({ id: 'uuid-123' });
```

### 4. Load Relations Only When Needed

```typescript
// ✅ Load minimal data
const product = await productModel.findById('uuid-123');

// ❌ Loading unnecessary relations
const product = await productModel.findWithRelations(
  { id: 'uuid-123' },
  { category: true, reviews: true, tags: true }
);
```

### 5. Override findAll for Custom Search

```typescript
export class ProductModel extends BaseModel<Product> {
  async findAll(where: Record<string, unknown>, ...args) {
    // Add full-text search, filtering, etc.
    if (where.q) {
      return this.searchByText(where.q as string);
    }
    return super.findAll(where, ...args);
  }
}
```

### 6. Use Pagination for Large Result Sets

```typescript
// ✅ Paginated
const page1 = await productModel.findAll(
  {},
  { page: 1, pageSize: 20 }
);

// ❌ Loading all records
const all = await productModel.findAll({});  // Could be thousands!
```

### 7. Validate Before Insert/Update

```typescript
// ✅ Validate with Zod schema
const validData = createProductSchema.parse(rawData);
await productModel.create(validData);

// ❌ Insert without validation
await productModel.create(rawData);  // May have invalid fields
```

### 8. Handle Null Returns

```typescript
// ✅ Check for null
const product = await productModel.findById('uuid-123');
if (!product) {
  throw new Error('Product not found');
}

// ❌ Assume always exists
const product = await productModel.findById('uuid-123');
console.log(product.name);  // May crash if null!
```

### 9. Use findOne for Uniqueness Checks

```typescript
// ✅ Check before create
const existing = await productModel.findOne({ slug: newSlug });
if (existing) {
  throw new Error('Slug already exists');
}
await productModel.create({ slug: newSlug, ... });
```

### 10. Log Operations in Production

All methods automatically log queries and errors via the internal logger. Review logs to monitor database performance and catch issues.

---

## See Also

- [Query Methods Guide](./query-methods.md) - Deep dive into querying
- [Relations Guide](./relations.md) - Complete guide to relations
- [Quick Start Guide](../quick-start.md) - Getting started
- [Package CLAUDE.md](../CLAUDE.md) - Package overview

---

*Last updated: 2025-11-05*
