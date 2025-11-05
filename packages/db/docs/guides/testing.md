# Testing

Comprehensive guide to testing database models and queries in the Hospeda project.

## Introduction

Testing is crucial for ensuring database operations work correctly. This guide covers:

- Unit testing models with mocks
- Integration testing with real database
- Test organization and structure
- Coverage requirements (90%+ minimum)
- Best practices and patterns

## Test Setup

### Test Environment

```typescript
// packages/db/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'test/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        'drizzle/**'
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90
      }
    }
  }
});
```

### Test Setup File

```typescript
// packages/db/test/setup.ts
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { getDb } from '../src/client';

// Setup test database connection
beforeAll(async () => {
  // Initialize database connection
  const db = getDb();
  console.log('Test database connected');
});

// Cleanup after all tests
afterAll(async () => {
  // Close database connection
  console.log('Test database disconnected');
});

// Clean up before each test (optional)
beforeEach(async () => {
  // Reset mocks
});
```

### Test Database

Use separate test database:

```bash
# .env.test
DATABASE_URL=postgresql://user:password@localhost:5432/hospeda_test
```

## Unit Tests

Unit tests mock database interactions to test logic in isolation.

### Basic Unit Test Structure

```typescript
// packages/db/test/models/product.model.test.ts
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
    // Create model instance
    model = new ProductModel();

    // Get mock functions
    getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
    logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
    logError = logger.logError as ReturnType<typeof vi.fn>;

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('findById', () => {
    it('should find product by ID', async () => {
      // Arrange
      const mockProduct = {
        id: '123',
        name: 'Test Product',
        price: 1000,
        stock: 10
      };

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockProduct])
      };

      getDb.mockReturnValue(mockDb);

      // Act
      const result = await model.findById('123');

      // Assert
      expect(result).toEqual(mockProduct);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
      expect(logQuery).toHaveBeenCalled();
    });

    it('should return null if product not found', async () => {
      // Arrange
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
      };

      getDb.mockReturnValue(mockDb);

      // Act
      const result = await model.findById('999');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create product', async () => {
      // Arrange
      const input = {
        name: 'New Product',
        slug: 'new-product',
        price: 2000,
        stock: 20
      };

      const mockProduct = {
        id: '456',
        ...input,
        createdAt: new Date()
      };

      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockProduct])
      };

      getDb.mockReturnValue(mockDb);

      // Act
      const result = await model.create(input);

      // Assert
      expect(result).toEqual(mockProduct);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(input);
      expect(mockDb.returning).toHaveBeenCalled();
      expect(logQuery).toHaveBeenCalledWith(
        'products',
        'create',
        input,
        [mockProduct]
      );
    });

    it('should throw error on insert failure', async () => {
      // Arrange
      const input = { name: 'Product', slug: 'product', price: 1000 };
      const error = new Error('Database error');

      const mockDb = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(error)
      };

      getDb.mockReturnValue(mockDb);

      // Act & Assert
      await expect(model.create(input)).rejects.toThrow();
      expect(logError).toHaveBeenCalledWith(
        'products',
        'create',
        input,
        error
      );
    });
  });

  describe('update', () => {
    it('should update product', async () => {
      // Arrange
      const where = { id: '123' };
      const data = { price: 3000, stock: 30 };
      const mockUpdated = { id: '123', ...data };

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockUpdated])
      };

      getDb.mockReturnValue(mockDb);

      // Act
      const result = await model.update(where, data);

      // Assert
      expect(result).toEqual(mockUpdated);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(data);
      expect(mockDb.returning).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete product', async () => {
      // Arrange
      const where = { id: '123' };

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: '123' }])
      };

      getDb.mockReturnValue(mockDb);

      // Act
      const result = await model.softDelete(where);

      // Assert
      expect(result).toBe(1);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: expect.any(Date) })
      );
    });
  });

  describe('restore', () => {
    it('should restore soft-deleted product', async () => {
      // Arrange
      const where = { id: '123' };

      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: '123' }])
      };

      getDb.mockReturnValue(mockDb);

      // Act
      const result = await model.restore(where);

      // Assert
      expect(result).toBe(1);
      expect(mockDb.set).toHaveBeenCalledWith({ deletedAt: null });
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete product', async () => {
      // Arrange
      const where = { id: '123' };

      const mockDb = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: '123' }])
      };

      getDb.mockReturnValue(mockDb);

      // Act
      const result = await model.hardDelete(where);

      // Assert
      expect(result).toBe(1);
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
```

### Testing Custom Methods

```typescript
describe('ProductModel - Custom Methods', () => {
  let model: ProductModel;
  let getDb: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    model = new ProductModel();
    getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
    vi.clearAllMocks();
  });

  describe('findBySlug', () => {
    it('should find product by slug', async () => {
      const mockProduct = {
        id: '123',
        slug: 'test-product',
        name: 'Test Product'
      };

      vi.spyOn(model, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await model.findBySlug('test-product');

      expect(result).toEqual(mockProduct);
      expect(model.findOne).toHaveBeenCalledWith(
        { slug: 'test-product' },
        undefined
      );
    });
  });

  describe('findLowStock', () => {
    it('should find products with low stock', async () => {
      const mockProducts = [
        { id: '1', stock: 3 },
        { id: '2', stock: 5 }
      ];

      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockProducts)
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
      const mockProduct = { id: '1', stock: 20 };
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
    });

    it('should throw error if insufficient stock', async () => {
      const mockProduct = { id: '1', stock: 3 };
      vi.spyOn(model, 'findById').mockResolvedValue(mockProduct as any);

      await expect(
        model.decrementStock('1', 5)
      ).rejects.toThrow('Insufficient stock');
    });

    it('should throw error if product not found', async () => {
      vi.spyOn(model, 'findById').mockResolvedValue(null);

      await expect(
        model.decrementStock('999', 5)
      ).rejects.toThrow('Product not found');
    });
  });
});
```

## Integration Tests

Integration tests use a real database to test actual database operations.

### Setup Test Database

```typescript
// test/integration/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from '../../src/client';

let db: ReturnType<typeof getDb>;

beforeAll(async () => {
  db = getDb();

  // Run migrations
  await runMigrations();

  console.log('Integration test database ready');
});

afterAll(async () => {
  // Cleanup: Drop all tables
  await db.execute(sql`DROP SCHEMA public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);

  console.log('Integration test database cleaned');
});
```

### Integration Test Example

```typescript
// test/integration/product.model.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '../../src/client';
import { ProductModel } from '../../src/models/product.model';
import { products as productsTable } from '../../src/schemas/catalog/product.dbschema';

describe('ProductModel Integration Tests', () => {
  let model: ProductModel;
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    db = getDb();
    model = new ProductModel();

    // Clear products table before each test
    await db.delete(productsTable);
  });

  describe('CRUD Operations', () => {
    it('should create product', async () => {
      // Arrange
      const input = {
        name: 'Integration Test Product',
        slug: 'integration-test-product',
        description: 'Test description',
        price: 1000,
        stock: 10,
        isActive: true
      };

      // Act
      const product = await model.create(input);

      // Assert
      expect(product.id).toBeDefined();
      expect(product.name).toBe(input.name);
      expect(product.slug).toBe(input.slug);
      expect(product.price).toBe(input.price);
      expect(product.createdAt).toBeInstanceOf(Date);
    });

    it('should find product by ID', async () => {
      // Arrange
      const created = await model.create({
        name: 'Test Product',
        slug: 'test-product',
        description: 'Description',
        price: 2000,
        stock: 20,
        isActive: true
      });

      // Act
      const found = await model.findById(created.id);

      // Assert
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(created.name);
    });

    it('should update product', async () => {
      // Arrange
      const created = await model.create({
        name: 'Original Name',
        slug: 'original-slug',
        description: 'Description',
        price: 1000,
        stock: 10,
        isActive: true
      });

      // Act
      const updated = await model.update(
        { id: created.id },
        { name: 'Updated Name', price: 2000 }
      );

      // Assert
      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('Updated Name');
      expect(updated?.price).toBe(2000);
      expect(updated?.slug).toBe('original-slug'); // Unchanged
    });

    it('should soft delete product', async () => {
      // Arrange
      const created = await model.create({
        name: 'To Be Deleted',
        slug: 'to-be-deleted',
        description: 'Description',
        price: 1000,
        stock: 10,
        isActive: true
      });

      // Act
      const count = await model.softDelete({ id: created.id });

      // Assert
      expect(count).toBe(1);

      // Should not be found by normal queries
      const found = await model.findById(created.id);
      expect(found).toBeNull();

      // But should exist in database
      const raw = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, created.id))
        .limit(1);

      expect(raw[0]).toBeDefined();
      expect(raw[0].deletedAt).not.toBeNull();
    });

    it('should restore soft-deleted product', async () => {
      // Arrange
      const created = await model.create({
        name: 'To Be Restored',
        slug: 'to-be-restored',
        description: 'Description',
        price: 1000,
        stock: 10,
        isActive: true
      });

      await model.softDelete({ id: created.id });

      // Act
      const count = await model.restore({ id: created.id });

      // Assert
      expect(count).toBe(1);

      // Should be found by normal queries
      const found = await model.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.deletedAt).toBeNull();
    });

    it('should hard delete product', async () => {
      // Arrange
      const created = await model.create({
        name: 'To Be Hard Deleted',
        slug: 'to-be-hard-deleted',
        description: 'Description',
        price: 1000,
        stock: 10,
        isActive: true
      });

      // Act
      const count = await model.hardDelete({ id: created.id });

      // Assert
      expect(count).toBe(1);

      // Should not exist at all
      const raw = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, created.id))
        .limit(1);

      expect(raw[0]).toBeUndefined();
    });
  });

  describe('Pagination', () => {
    beforeEach(async () => {
      // Create 25 test products
      for (let i = 1; i <= 25; i++) {
        await model.create({
          name: `Product ${i}`,
          slug: `product-${i}`,
          description: 'Description',
          price: i * 100,
          stock: i,
          isActive: true
        });
      }
    });

    it('should paginate results', async () => {
      // Act
      const page1 = await model.findAll({}, { page: 1, pageSize: 10 });
      const page2 = await model.findAll({}, { page: 2, pageSize: 10 });
      const page3 = await model.findAll({}, { page: 3, pageSize: 10 });

      // Assert
      expect(page1.total).toBe(25);
      expect(page1.items.length).toBe(10);

      expect(page2.total).toBe(25);
      expect(page2.items.length).toBe(10);

      expect(page3.total).toBe(25);
      expect(page3.items.length).toBe(5);

      // Items should be different
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });

    it('should return all items without pagination', async () => {
      // Act
      const result = await model.findAll({});

      // Assert
      expect(result.items.length).toBe(25);
      expect(result.total).toBe(25);
    });
  });

  describe('Transactions', () => {
    it('should rollback on error', async () => {
      // Arrange
      const db = getDb();

      // Act & Assert
      await expect(async () => {
        await db.transaction(async (trx) => {
          // Create product
          await model.create({
            name: 'Transaction Test',
            slug: 'transaction-test',
            description: 'Description',
            price: 1000,
            stock: 10,
            isActive: true
          }, trx);

          // Throw error to trigger rollback
          throw new Error('Rollback test');
        });
      }).rejects.toThrow('Rollback test');

      // Product should not exist
      const products = await model.findAll({});
      expect(products.items.length).toBe(0);
    });

    it('should commit on success', async () => {
      // Arrange
      const db = getDb();

      // Act
      await db.transaction(async (trx) => {
        await model.create({
          name: 'Transaction Test',
          slug: 'transaction-test',
          description: 'Description',
          price: 1000,
          stock: 10,
          isActive: true
        }, trx);
      });

      // Assert
      const products = await model.findAll({});
      expect(products.items.length).toBe(1);
    });
  });
});
```

## Testing Relations

```typescript
describe('ProductModel - Relations', () => {
  let productModel: ProductModel;
  let categoryModel: CategoryModel;
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    db = getDb();
    productModel = new ProductModel();
    categoryModel = new CategoryModel();

    // Clear tables
    await db.delete(productsTable);
    await db.delete(categoriesTable);
  });

  it('should load product with category', async () => {
    // Arrange
    const category = await categoryModel.create({
      name: 'Electronics',
      slug: 'electronics'
    });

    const product = await productModel.create({
      name: 'Laptop',
      slug: 'laptop',
      description: 'Gaming laptop',
      price: 100000,
      stock: 5,
      categoryId: category.id,
      isActive: true
    });

    // Act
    const found = await productModel.findWithRelations(
      { id: product.id },
      { category: true }
    );

    // Assert
    expect(found).not.toBeNull();
    expect(found?.category).toBeDefined();
    expect(found?.category.id).toBe(category.id);
    expect(found?.category.name).toBe('Electronics');
  });

  it('should load multiple relations', async () => {
    // Arrange - create category, owner, and product
    const category = await categoryModel.create({
      name: 'Books',
      slug: 'books'
    });

    const owner = await userModel.create({
      email: 'owner@example.com',
      name: 'Owner'
    });

    const product = await productModel.create({
      name: 'Novel',
      slug: 'novel',
      description: 'Fiction novel',
      price: 2000,
      stock: 100,
      categoryId: category.id,
      ownerId: owner.id,
      isActive: true
    });

    // Act
    const found = await productModel.findWithRelations(
      { id: product.id },
      { category: true, owner: true }
    );

    // Assert
    expect(found?.category).toBeDefined();
    expect(found?.owner).toBeDefined();
    expect(found?.category.name).toBe('Books');
    expect(found?.owner.email).toBe('owner@example.com');
  });
});
```

## Coverage

### Check Coverage

```bash
cd packages/db
pnpm test:coverage
```

### Coverage Requirements

Minimum 90% coverage for:

- Lines
- Functions
- Branches
- Statements

### Excluded from Coverage

- Test files (`*.test.ts`, `*.spec.ts`)
- Index files (`index.ts`)
- Migration files (`drizzle/migrations/**`)
- Type definitions

### Improve Coverage

**Check uncovered lines:**

```bash
pnpm test:coverage
# Open coverage/index.html in browser
```

**Add tests for:**

- ❌ Red lines: Not executed
- ❌ Yellow branches: Partially covered
- ✅ Green: Fully covered

## Best Practices

### 1. AAA Pattern (Arrange, Act, Assert)

```typescript
it('should create product', async () => {
  // Arrange: Set up test data
  const input = {
    name: 'Test Product',
    slug: 'test-product',
    price: 1000
  };

  // Act: Execute the operation
  const result = await model.create(input);

  // Assert: Verify the outcome
  expect(result.id).toBeDefined();
  expect(result.name).toBe(input.name);
});
```

### 2. One Assertion Per Test (Guideline)

```typescript
// ✅ Good: Focused test
it('should return product ID', async () => {
  const product = await model.create(input);
  expect(product.id).toBeDefined();
});

it('should return product name', async () => {
  const product = await model.create(input);
  expect(product.name).toBe(input.name);
});

// ❌ Bad: Testing too much
it('should create product with all fields', async () => {
  const product = await model.create(input);
  expect(product.id).toBeDefined();
  expect(product.name).toBe(input.name);
  expect(product.slug).toBe(input.slug);
  expect(product.price).toBe(input.price);
  // ... 10 more assertions
});
```

### 3. Test Edge Cases

```typescript
describe('decrementStock edge cases', () => {
  it('should handle zero stock', async () => {
    vi.spyOn(model, 'findById').mockResolvedValue({
      id: '1',
      stock: 0
    } as any);

    await expect(
      model.decrementStock('1', 1)
    ).rejects.toThrow('Insufficient stock');
  });

  it('should handle exact stock match', async () => {
    vi.spyOn(model, 'findById').mockResolvedValue({
      id: '1',
      stock: 5
    } as any);

    await expect(
      model.decrementStock('1', 5)
    ).resolves.not.toThrow();
  });

  it('should handle large quantities', async () => {
    vi.spyOn(model, 'findById').mockResolvedValue({
      id: '1',
      stock: 10000
    } as any);

    await expect(
      model.decrementStock('1', 9999)
    ).resolves.not.toThrow();
  });
});
```

### 4. Clean Up After Tests

```typescript
beforeEach(async () => {
  // Clear database before each test
  await db.delete(productsTable);
  await db.delete(categoriesTable);
});

afterEach(async () => {
  // Reset mocks
  vi.clearAllMocks();
});
```

### 5. Use Descriptive Test Names

```typescript
// ✅ Good: Clear intent
it('should throw error when product not found', async () => { /* ... */ });
it('should return null when searching with invalid ID', async () => { /* ... */ });

// ❌ Bad: Vague
it('should work', async () => { /* ... */ });
it('test 1', async () => { /* ... */ });
```

### 6. Test Error Handling

```typescript
it('should throw DbError on database failure', async () => {
  // Arrange
  const mockDb = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockRejectedValue(new Error('Connection lost'))
  };

  getDb.mockReturnValue(mockDb);

  // Act & Assert
  await expect(
    model.create({ name: 'Test' })
  ).rejects.toThrow(DbError);

  expect(logError).toHaveBeenCalled();
});
```

### 7. Mock Only External Dependencies

```typescript
// ✅ Good: Mock database and logger
vi.mock('../../src/client');
vi.mock('../../src/utils/logger');

// ❌ Bad: Don't mock the code under test
vi.mock('../../src/models/product.model');
```

## Common Patterns

### Testing Pagination

```typescript
it('should paginate correctly', async () => {
  // Create 25 products
  for (let i = 1; i <= 25; i++) {
    await model.create({ name: `Product ${i}`, /* ... */ });
  }

  const page1 = await model.findAll({}, { page: 1, pageSize: 10 });
  const page2 = await model.findAll({}, { page: 2, pageSize: 10 });
  const page3 = await model.findAll({}, { page: 3, pageSize: 10 });

  expect(page1.items.length).toBe(10);
  expect(page2.items.length).toBe(10);
  expect(page3.items.length).toBe(5);
  expect(page1.total).toBe(25);
});
```

### Testing Transactions

```typescript
it('should rollback transaction on error', async () => {
  await expect(async () => {
    await db.transaction(async (trx) => {
      await model.create({ /* ... */ }, trx);
      throw new Error('Test rollback');
    });
  }).rejects.toThrow();

  // Verify nothing was created
  const products = await model.findAll({});
  expect(products.items.length).toBe(0);
});
```

### Testing Soft Delete

```typescript
it('should exclude soft-deleted from queries', async () => {
  const product = await model.create({ /* ... */ });
  await model.softDelete({ id: product.id });

  const found = await model.findById(product.id);
  expect(found).toBeNull();

  // But exists in DB
  const raw = await db.select().from(productsTable)
    .where(eq(productsTable.id, product.id));
  expect(raw[0]).toBeDefined();
  expect(raw[0].deletedAt).not.toBeNull();
});
```

## Troubleshooting

### Tests Failing with "getDb is not a function"

Ensure proper mocking:

```typescript
vi.mock('../../src/client', () => ({
  getDb: vi.fn()
}));
```

### Database Connection Errors

Check test database URL:

```bash
# .env.test
DATABASE_URL=postgresql://user:password@localhost:5432/hospeda_test
```

### Flaky Tests

- Clear database between tests
- Don't rely on execution order
- Mock time-dependent functions
- Use deterministic test data

### Low Coverage

- Check `coverage/index.html` for uncovered lines
- Add tests for error paths
- Test edge cases
- Test all public methods

## Related Guides

- [Creating Models](./creating-models.md) - Build testable models
- [Soft Delete](./soft-delete.md) - Test soft delete
- [Transactions](./transactions.md) - Test transactions

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Mocking with Vitest](https://vitest.dev/guide/mocking.html)
