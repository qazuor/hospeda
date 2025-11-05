# Transactions

Complete guide to transaction handling with Drizzle ORM in the Hospeda project.

## Introduction

Transactions ensure data consistency by grouping multiple database operations into a single atomic unit. Either all operations succeed, or none do.

### What are Transactions

A transaction is a sequence of database operations that are executed as a single logical unit:

```typescript
// Without transaction (risky)
await createOrder(orderData);        // ✅ Success
await createPayment(paymentData);    // ❌ Fails
// Result: Order created but no payment (inconsistent state!)

// With transaction (safe)
await db.transaction(async (trx) => {
  await createOrder(orderData, trx);     // ✅ Success
  await createPayment(paymentData, trx); // ❌ Fails
  // Result: Both rolled back (consistent state!)
});
```

### ACID Properties

Transactions guarantee ACID properties:

- **Atomicity**: All operations succeed or all fail
- **Consistency**: Database remains in valid state
- **Isolation**: Concurrent transactions don't interfere
- **Durability**: Committed changes are permanent

## Basic Transactions

### Transaction Syntax

```typescript
import { getDb } from '@repo/db';

const db = getDb();

await db.transaction(async (trx) => {
  // All operations within this function use 'trx'
  await trx.insert(productsTable).values({ /* ... */ });
  await trx.insert(inventoryTable).values({ /* ... */ });

  // If any operation fails, entire transaction rolls back
});
```

### Example: Create Product with Inventory

```typescript
import { getDb } from '@repo/db';
import { products, inventory } from '@repo/db/schemas';

async function createProductWithInventory(
  productData: InsertProduct,
  inventoryData: InsertInventory
): Promise<{ product: Product; inventory: Inventory }> {
  const db = getDb();

  return await db.transaction(async (trx) => {
    // Create product
    const [product] = await trx
      .insert(products)
      .values(productData)
      .returning();

    // Create inventory with product ID
    const [inv] = await trx
      .insert(inventory)
      .values({
        ...inventoryData,
        productId: product.id
      })
      .returning();

    return { product, inventory: inv };
  });
}
```

### Automatic Rollback

Transactions automatically rollback on errors:

```typescript
try {
  await db.transaction(async (trx) => {
    await trx.insert(products).values({ /* ... */ });

    // Error occurs
    throw new Error('Something went wrong');

    // This never executes
    await trx.insert(inventory).values({ /* ... */ });
  });
} catch (error) {
  console.error('Transaction rolled back:', error);
}
// Database state unchanged - product was not created
```

## Using with Models

### Pass Transaction to Model Methods

```typescript
import { getDb } from '@repo/db';
import { productModel, inventoryModel } from '@repo/db';

async function createProductWithInventory(
  productData: CreateProductInput,
  inventoryData: CreateInventoryInput
): Promise<Product> {
  const db = getDb();

  return await db.transaction(async (trx) => {
    // Pass transaction to model methods
    const product = await productModel.create(productData, trx);

    await inventoryModel.create({
      ...inventoryData,
      productId: product.id
    }, trx);

    return product;
  });
}
```

### Coordinate Multiple Models

```typescript
async function transferStock(
  fromProductId: string,
  toProductId: string,
  quantity: number
): Promise<void> {
  const db = getDb();

  await db.transaction(async (trx) => {
    // Check source has enough stock
    const sourceProduct = await productModel.findById(fromProductId, trx);
    if (!sourceProduct || sourceProduct.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    // Decrement source
    await productModel.decrementStock(fromProductId, quantity, trx);

    // Increment destination
    await productModel.incrementStock(toProductId, quantity, trx);

    // Log transfer
    await transferLogModel.create({
      fromProductId,
      toProductId,
      quantity,
      timestamp: new Date()
    }, trx);
  });
}
```

### BaseModel Transaction Support

All BaseModel methods accept optional transaction parameter:

```typescript
export abstract class BaseModel<T> {
  async create(
    data: Partial<T>,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<T> {
    const db = this.getClient(tx);
    // Use transaction if provided, otherwise use global connection
  }

  async update(
    where: Record<string, unknown>,
    data: Partial<T>,
    tx?: NodePgDatabase<typeof schema>
  ): Promise<T | null> {
    const db = this.getClient(tx);
    // ...
  }

  // All methods support transactions
}
```

## Error Handling

### Try-Catch Pattern

```typescript
try {
  await db.transaction(async (trx) => {
    await productModel.create(productData, trx);
    await inventoryModel.create(inventoryData, trx);
  });

  console.log('Transaction successful');
} catch (error) {
  console.error('Transaction failed:', error);

  if (error instanceof DbError) {
    // Handle database error
    console.error('Database error:', error.message);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

### Validation Before Transaction

```typescript
async function createOrder(orderData: CreateOrderInput): Promise<Order> {
  // Validate BEFORE starting transaction
  if (!orderData.items || orderData.items.length === 0) {
    throw new Error('Order must have at least one item');
  }

  if (orderData.total <= 0) {
    throw new Error('Order total must be positive');
  }

  // Now start transaction
  const db = getDb();

  return await db.transaction(async (trx) => {
    // Transaction operations
    const order = await orderModel.create(orderData, trx);

    for (const item of orderData.items) {
      await orderItemModel.create({
        orderId: order.id,
        ...item
      }, trx);
    }

    return order;
  });
}
```

### Custom Error Messages

```typescript
await db.transaction(async (trx) => {
  const product = await productModel.findById(productId, trx);

  if (!product) {
    throw new Error('Product not found');
  }

  if (product.stock < quantity) {
    throw new Error(`Insufficient stock. Available: ${product.stock}, requested: ${quantity}`);
  }

  await productModel.decrementStock(productId, quantity, trx);
});
```

## Advanced Patterns

### Nested Transactions (Savepoints)

PostgreSQL supports savepoints within transactions:

```typescript
await db.transaction(async (trx) => {
  // Main transaction
  await trx.insert(products).values({ /* ... */ });

  // Savepoint
  try {
    // This might fail, but we want to continue
    await trx.execute(sql`SAVEPOINT optional_operation`);

    await trx.insert(optionalData).values({ /* ... */ });

    await trx.execute(sql`RELEASE SAVEPOINT optional_operation`);
  } catch (error) {
    // Rollback to savepoint, continue main transaction
    await trx.execute(sql`ROLLBACK TO SAVEPOINT optional_operation`);
    console.warn('Optional operation failed, continuing:', error);
  }

  // Main transaction continues
  await trx.insert(moreData).values({ /* ... */ });
});
```

### Long-Running Transactions

**❌ Avoid:**

```typescript
// Bad: Long-running transaction holds locks
await db.transaction(async (trx) => {
  await productModel.create(data, trx);

  // External API call inside transaction (slow!)
  await fetch('https://api.example.com/notify');

  // Complex calculation (slow!)
  const result = await heavyComputation();

  await orderModel.create(result, trx);
});
```

**✅ Better:**

```typescript
// Good: Keep transactions short
const product = await db.transaction(async (trx) => {
  return await productModel.create(data, trx);
});

// Do slow operations outside transaction
await fetch('https://api.example.com/notify', {
  body: JSON.stringify(product)
});

const result = await heavyComputation();

await db.transaction(async (trx) => {
  await orderModel.create(result, trx);
});
```

### Batch Operations

```typescript
async function createManyProducts(
  products: CreateProductInput[]
): Promise<Product[]> {
  const db = getDb();

  return await db.transaction(async (trx) => {
    const created: Product[] = [];

    // Process in batches to avoid long transaction
    const batchSize = 100;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const result = await trx
        .insert(productsTable)
        .values(batch)
        .returning();

      created.push(...result);
    }

    return created;
  });
}
```

### Transaction Retry Logic

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable (e.g., serialization failure)
      if (isRetryableError(error) && attempt < maxRetries) {
        console.warn(`Transaction failed (attempt ${attempt}/${maxRetries}), retrying...`);

        // Exponential backoff
        await delay(Math.pow(2, attempt) * 100);
        continue;
      }

      throw error;
    }
  }

  throw lastError!;
}

// Usage
await executeWithRetry(async () => {
  return await db.transaction(async (trx) => {
    // Transaction operations
  });
});

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // PostgreSQL serialization failure
    return error.message.includes('could not serialize');
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Distributed Transactions (2PC)

For operations across multiple databases:

```typescript
// Simplified two-phase commit pattern
async function distributedTransaction() {
  const db1 = getDb();  // Database 1
  const db2 = getDb2(); // Database 2

  // Phase 1: Prepare
  try {
    await db1.execute(sql`BEGIN`);
    await db2.execute(sql`BEGIN`);

    // Perform operations
    await db1.insert(table1).values({ /* ... */ });
    await db2.insert(table2).values({ /* ... */ });

    // Phase 2: Commit
    await db1.execute(sql`COMMIT`);
    await db2.execute(sql`COMMIT`);
  } catch (error) {
    // Rollback both
    await db1.execute(sql`ROLLBACK`);
    await db2.execute(sql`ROLLBACK`);
    throw error;
  }
}
```

> **Warning**: True distributed transactions are complex. Consider using a saga pattern or message queue for cross-database operations.

## Best Practices

### 1. Keep Transactions Short

```typescript
// ✅ Good: Short transaction
await db.transaction(async (trx) => {
  await productModel.create(data, trx);
  await inventoryModel.create(inventoryData, trx);
});

// ❌ Bad: Long transaction with external calls
await db.transaction(async (trx) => {
  await productModel.create(data, trx);
  await sendEmail(data.email);  // Slow external call!
  await notifyWebhook(data);    // Another slow call!
  await inventoryModel.create(inventoryData, trx);
});
```

### 2. Validate Before Transaction

```typescript
// ✅ Good: Validate first
if (!isValidProduct(data)) {
  throw new Error('Invalid product data');
}

await db.transaction(async (trx) => {
  // Transaction operations
});

// ❌ Bad: Validate inside transaction
await db.transaction(async (trx) => {
  if (!isValidProduct(data)) {
    throw new Error('Invalid product data');
  }
  // Wasted transaction resources
});
```

### 3. Use Transactions for Multi-Step Operations

```typescript
// ✅ Good: Transaction for related operations
await db.transaction(async (trx) => {
  const order = await orderModel.create(orderData, trx);
  await paymentModel.create({ orderId: order.id, ...paymentData }, trx);
});

// ❌ Bad: Separate operations (can be inconsistent)
const order = await orderModel.create(orderData);
await paymentModel.create({ orderId: order.id, ...paymentData });
// If second operation fails, order exists without payment!
```

### 4. Always Handle Errors

```typescript
// ✅ Good: Handle errors
try {
  await db.transaction(async (trx) => {
    // Operations
  });
} catch (error) {
  console.error('Transaction failed:', error);
  // Handle error appropriately
}

// ❌ Bad: Unhandled errors
await db.transaction(async (trx) => {
  // Operations
});
// Errors crash the application
```

### 5. Don't Nest Transactions Manually

```typescript
// ❌ Bad: Manual nested transactions
await db.transaction(async (trx) => {
  await trx.insert(products).values({ /* ... */ });

  // Don't start another transaction!
  await db.transaction(async (trx2) => {
    await trx2.insert(inventory).values({ /* ... */ });
  });
});

// ✅ Good: Single transaction or use savepoints
await db.transaction(async (trx) => {
  await trx.insert(products).values({ /* ... */ });
  await trx.insert(inventory).values({ /* ... */ });
});
```

### 6. Use Appropriate Isolation Levels

```typescript
// Default: READ COMMITTED (good for most cases)
await db.transaction(async (trx) => {
  // Operations
});

// Serializable (strongest isolation, use for critical operations)
await db.execute(sql`BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
try {
  await db.insert(products).values({ /* ... */ });
  await db.execute(sql`COMMIT`);
} catch (error) {
  await db.execute(sql`ROLLBACK`);
  throw error;
}
```

## Testing Transactions

### Unit Tests with Mocks

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Transaction Tests', () => {
  it('should rollback on error', async () => {
    const mockTransaction = vi.fn().mockImplementation(async (callback) => {
      try {
        await callback(mockTrx);
      } catch (error) {
        // Simulate rollback
        console.log('Transaction rolled back');
        throw error;
      }
    });

    const mockTrx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockRejectedValue(new Error('Insert failed')),
      returning: vi.fn()
    };

    const mockDb = {
      transaction: mockTransaction
    };

    getDb.mockReturnValue(mockDb);

    await expect(
      createProductWithInventory(productData, inventoryData)
    ).rejects.toThrow('Insert failed');

    expect(mockTransaction).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@repo/db';

describe('Transaction Integration Tests', () => {
  let db: ReturnType<typeof getDb>;

  beforeEach(async () => {
    db = getDb();
    await db.delete(productsTable);
    await db.delete(inventoryTable);
  });

  it('should commit transaction on success', async () => {
    await db.transaction(async (trx) => {
      await trx.insert(productsTable).values({
        name: 'Test Product',
        slug: 'test-product',
        price: 1000,
        stock: 10
      });

      await trx.insert(inventoryTable).values({
        productId: 'test-id',
        location: 'Warehouse A',
        quantity: 10
      });
    });

    // Verify data was committed
    const products = await db.select().from(productsTable);
    const inventory = await db.select().from(inventoryTable);

    expect(products.length).toBe(1);
    expect(inventory.length).toBe(1);
  });

  it('should rollback transaction on error', async () => {
    try {
      await db.transaction(async (trx) => {
        await trx.insert(productsTable).values({
          name: 'Test Product',
          slug: 'test-product',
          price: 1000,
          stock: 10
        });

        // Force error
        throw new Error('Test rollback');

        // This should not execute
        await trx.insert(inventoryTable).values({
          productId: 'test-id',
          location: 'Warehouse A',
          quantity: 10
        });
      });
    } catch (error) {
      // Expected
    }

    // Verify nothing was committed
    const products = await db.select().from(productsTable);
    const inventory = await db.select().from(inventoryTable);

    expect(products.length).toBe(0);
    expect(inventory.length).toBe(0);
  });
});
```

## Troubleshooting

### Deadlocks

**Cause**: Two transactions waiting for each other's locks.

**Example:**

```typescript
// Transaction 1: Locks product A, then B
await db.transaction(async (trx) => {
  await trx.update(productsTable).set({ stock: 10 }).where(eq(productsTable.id, 'A'));
  await trx.update(productsTable).set({ stock: 10 }).where(eq(productsTable.id, 'B'));
});

// Transaction 2: Locks product B, then A (DEADLOCK!)
await db.transaction(async (trx) => {
  await trx.update(productsTable).set({ stock: 20 }).where(eq(productsTable.id, 'B'));
  await trx.update(productsTable).set({ stock: 20 }).where(eq(productsTable.id, 'A'));
});
```

**Solution**: Always acquire locks in same order:

```typescript
// Both transactions lock in same order (A → B)
await db.transaction(async (trx) => {
  await trx.update(productsTable).set({ stock: 10 }).where(eq(productsTable.id, 'A'));
  await trx.update(productsTable).set({ stock: 10 }).where(eq(productsTable.id, 'B'));
});
```

### Transaction Timeout

**Cause**: Transaction takes too long, times out.

**Solution**: Keep transactions short, increase timeout if necessary:

```typescript
// Increase timeout
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  statement_timeout: 10000  // 10 seconds
});
```

### Serialization Failures

**Cause**: Concurrent transactions conflict at SERIALIZABLE isolation level.

**Solution**: Implement retry logic (see Advanced Patterns above).

### Lost Updates

**Cause**: Concurrent transactions overwrite each other's changes.

**Solution**: Use optimistic locking:

```typescript
await db.transaction(async (trx) => {
  // Read current version
  const product = await trx
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, id))
    .limit(1);

  const currentVersion = product[0].version;

  // Update with version check
  const result = await trx
    .update(productsTable)
    .set({
      stock: newStock,
      version: currentVersion + 1
    })
    .where(
      and(
        eq(productsTable.id, id),
        eq(productsTable.version, currentVersion)
      )
    )
    .returning();

  if (result.length === 0) {
    throw new Error('Concurrent update detected');
  }
});
```

## Performance Considerations

### Transaction Overhead

- Transactions have overhead (lock acquisition, logging)
- Don't use for single operations
- Batch related operations together

### Lock Contention

- Long transactions hold locks longer
- Can block other transactions
- Keep transactions as short as possible

### Connection Pooling

- Transactions hold connections from pool
- Ensure adequate pool size
- Release connections promptly

## Related Guides

- [Creating Models](./creating-models.md) - Model methods with transactions
- [Testing](./testing.md) - Test transaction behavior
- [Optimization](./optimization.md) - Transaction performance

## Additional Resources

- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Drizzle Transactions](https://orm.drizzle.team/docs/transactions)
