# @repo/db Examples

This directory contains comprehensive TypeScript examples demonstrating the patterns and best practices for working with the `@repo/db` package.

## Overview

The examples are organized by complexity and demonstrate different aspects of database operations using Drizzle ORM and the BaseModel pattern.

## Files

### 1. basic-model.ts (~350 lines)

**Purpose**: Introduction to BaseModel fundamentals

**Topics Covered:**

- Extending BaseModel<T>
- Defining schemas with pgTable
- Type inference from schemas
- Basic CRUD operations
- Custom query methods
- Simple business logic
- Error handling
- Transaction support

**Key Patterns:**

- Product model with stock management
- Price range filtering
- Text search with ILIKE
- Stock increment/decrement operations

**When to Use:**

- Learning BaseModel basics
- Building simple models with basic queries
- Implementing straightforward business logic

### 2. with-relations.ts (~450 lines)

**Purpose**: Working with related entities

**Topics Covered:**

- Foreign key relationships
- One-to-many relations
- Many-to-one relations
- Many-to-many with junction tables
- Loading related data
- Nested relations
- Bidirectional relationships

**Key Patterns:**

- Product → Category (many-to-one)
- Product → Reviews (one-to-many)
- Product ↔ Tags (many-to-many)
- Reverse relations (Category → Products)

**When to Use:**

- Models with relationships
- Loading associated data
- Managing many-to-many relationships
- Building complex data structures

### 3. complex-queries.ts (~550 lines)

**Purpose**: Advanced querying and data operations

**Topics Covered:**

- Dynamic query building
- Multiple filter conditions
- Aggregations (COUNT, SUM, AVG)
- GROUP BY operations
- Pagination (offset-based and cursor-based)
- Date range queries
- Transaction handling
- Multi-table operations

**Key Patterns:**

- Order search with complex filters
- Order statistics and metrics
- Top products by order count
- Pending order cleanup
- Creating orders with line items
- Order cancellation workflow

**When to Use:**

- Complex search functionality
- Reporting and analytics
- Batch operations
- Multi-step transactions
- Performance-critical queries

### 4. advanced-patterns.ts (~550 lines)

**Purpose**: Optimization and advanced techniques

**Topics Covered:**

- Full-text search (PostgreSQL tsvector)
- Batch operations (bulk insert/update)
- In-memory caching
- Performance optimizations
- Lifecycle hooks (before/after operations)
- Query result estimation
- Lazy loading patterns
- Index usage

**Key Patterns:**

- Full-text search with ranking
- Batch create/update/delete
- Cache layer with TTL
- Popular posts ranking
- Related posts suggestions
- Fast count estimation
- Lifecycle event hooks
- Performance monitoring

**When to Use:**

- Search functionality
- High-traffic applications
- Bulk data operations
- Performance optimization
- Event-driven logic
- Caching strategies

## Quick Start

### Running Examples

These examples are for learning and reference. To use them in your application:

1. **Study the patterns**:

```typescript
// Read the examples to understand patterns
import { ProductModel } from './examples/basic-model';
```

2. **Adapt to your models**:

```typescript
// Apply patterns to your own models
export class MyModel extends BaseModel<MyEntity> {
  protected table = myTable;
  protected entityName = 'myEntity';

  // Add custom methods following example patterns
}
```

3. **Test thoroughly**:

```typescript
// Always test your implementations
describe('MyModel', () => {
  it('should follow the patterns correctly', async () => {
    // Test your implementation
  });
});
```

## Pattern Categories

### Basic Patterns

From `basic-model.ts`:

- ✅ Model setup and configuration
- ✅ CRUD operations
- ✅ Custom query methods
- ✅ Business logic methods
- ✅ Error handling
- ✅ Transaction support

### Relationship Patterns

From `with-relations.ts`:

- ✅ One-to-many relationships
- ✅ Many-to-one relationships
- ✅ Many-to-many relationships
- ✅ Loading single relations
- ✅ Loading multiple relations
- ✅ Reverse relationships
- ✅ Junction table management

### Query Patterns

From `complex-queries.ts`:

- ✅ Dynamic filtering
- ✅ Date range queries
- ✅ Aggregation functions
- ✅ GROUP BY operations
- ✅ Offset pagination
- ✅ Cursor pagination
- ✅ Multi-table transactions
- ✅ Batch operations

### Advanced Patterns

From `advanced-patterns.ts`:

- ✅ Full-text search
- ✅ Batch operations
- ✅ Caching strategies
- ✅ Performance optimization
- ✅ Lifecycle hooks
- ✅ Lazy loading
- ✅ Query estimation
- ✅ Index optimization

## Common Use Cases

### E-commerce Application

```typescript
// Product catalog with categories and tags
import { ProductModel, CategoryModel } from './with-relations';

// Complex order management
import { OrderModel } from './complex-queries';

// Product search
import { PostModel } from './advanced-patterns';
// (adapt full-text search pattern to products)
```

### Blog/CMS Platform

```typescript
// Post management with caching
import { PostModel } from './advanced-patterns';

// Comment system
import { commentTable } from './advanced-patterns';

// Full-text search
// Use PostModel.fullTextSearch pattern
```

### Analytics Dashboard

```typescript
// Order statistics
import { OrderModel } from './complex-queries';
// Use getOrderStats() pattern

// Aggregations
// Use getTopProducts() pattern

// Date range filtering
// Use findByDateRange() pattern
```

## Best Practices

### 1. Model Organization

```typescript
// Always extend BaseModel
export class MyModel extends BaseModel<MyEntity> {
  protected table = myTable;
  protected entityName = 'myEntity';

  protected getTableName(): string {
    return 'my_entities';
  }

  // Group methods by functionality
  // 1. Query methods
  // 2. Business logic
  // 3. Lifecycle hooks (if needed)
}
```

### 2. Error Handling

```typescript
// Always wrap in try-catch
try {
  const result = await model.customMethod(input);
  logQuery(this.entityName, 'methodName', input, result);
  return result;
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  logError(this.entityName, 'methodName', input, err);
  throw new DbError(this.entityName, 'methodName', input, err.message);
}
```

### 3. Transaction Usage

```typescript
// Use transactions for multi-step operations
const db = getDb();

await db.transaction(async (trx) => {
  const entity1 = await model1.create(data1, trx);
  const entity2 = await model2.create(data2, trx);
  // Both succeed or both fail
});
```

### 4. Type Safety

```typescript
// Always use proper types
export type MyEntity = typeof myTable.$inferSelect;

// Use RO-RO pattern for methods
async myMethod(input: {
  param1: string;
  param2?: number;
  tx?: NodePgDatabase<typeof schema>;
}): Promise<MyEntity | null> {
  // Implementation
}
```

### 5. Performance Optimization

```typescript
// Use indexes for common queries
export const myTable = pgTable(
  'my_entities',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id'),
    status: varchar('status'),
  },
  (table) => ({
    userIdx: index('my_entities_user_idx').on(table.userId),
    statusIdx: index('my_entities_status_idx').on(table.status),
  })
);

// Use pagination for large result sets
const result = await model.findAll(
  filters,
  { page: 1, pageSize: 20 }
);

// Consider caching for frequently accessed data
// See advanced-patterns.ts for caching implementation
```

## Testing Examples

Each pattern should be thoroughly tested:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { ProductModel } from './basic-model';

describe('ProductModel', () => {
  let model: ProductModel;

  beforeAll(() => {
    model = new ProductModel();
  });

  it('should create product', async () => {
    const product = await model.create({
      name: 'Test Product',
      slug: 'test-product',
      price: '29.99',
      stock: 10,
    });

    expect(product.id).toBeDefined();
    expect(product.name).toBe('Test Product');
  });

  it('should find by slug', async () => {
    const product = await model.findBySlug({
      slug: 'test-product'
    });

    expect(product).toBeDefined();
    expect(product?.slug).toBe('test-product');
  });

  it('should check stock availability', async () => {
    const inStock = await model.isInStock({
      productId: 'product-uuid'
    });

    expect(typeof inStock).toBe('boolean');
  });
});
```

## Migration Path

### From Simple to Complex

1. **Start with basic-model.ts**
   - Understand BaseModel fundamentals
   - Implement basic CRUD
   - Add simple custom methods

2. **Add relations (with-relations.ts)**
   - Define foreign keys
   - Set up relations
   - Load related data

3. **Implement complex queries (complex-queries.ts)**
   - Add search functionality
   - Implement pagination
   - Use transactions

4. **Optimize (advanced-patterns.ts)**
   - Add full-text search
   - Implement caching
   - Use lifecycle hooks
   - Optimize queries

## Additional Resources

- [Package Documentation](../CLAUDE.md)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [BaseModel Source](../src/base/base.model.ts)
- [Project Standards](../../../.claude/docs/standards/)

## Getting Help

If you need assistance:

1. Review the example that matches your use case
2. Check the inline comments and JSDoc
3. Refer to the usage examples at the end of each file
4. Consult the package CLAUDE.md documentation
5. Review test files in the `test/` directory

## Contributing

When adding new examples:

1. Follow the established pattern structure
2. Include comprehensive JSDoc comments
3. Provide usage examples at the end
4. Add type definitions
5. Demonstrate error handling
6. Show transaction usage
7. Include performance considerations

## Notes

- These examples use fictional schemas (products, orders, posts)
- Adapt patterns to your actual domain models
- Always test implementations thoroughly
- Consider performance implications
- Follow project code standards
- Use TypeScript strict mode
- Maintain 90%+ test coverage

## License

Part of the Hospeda project - see project root for license information.
