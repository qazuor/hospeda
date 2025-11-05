# Quick Start Guide

Get started with `@repo/service-core` in 5 minutes. This guide walks you through creating your first service with complete, working examples.

## Prerequisites

Before starting, make sure you have:

- Node.js 20+ installed
- Basic understanding of TypeScript
- Familiarity with Zod validation library
- A working PostgreSQL database

## Installation

Add the package and its dependencies:

```bash
pnpm add @repo/service-core @repo/db @repo/schemas @repo/logger zod
```

## Basic Concepts

Before we dive into code, let's understand three core concepts:

### 1. Service

A **service** is a class that encapsulates business logic for an entity. It extends `BaseCrudService` and provides:

- CRUD operations (create, read, update, delete)
- Permission checks
- Input validation
- Error handling
- Lifecycle hooks

### 2. Actor

An **actor** represents the user or system performing an action:

```typescript
type Actor = {
  id: string;                    // User ID
  role: RoleEnum;                // GUEST, USER, ADMIN, SUPER_ADMIN
  permissions: PermissionEnum[]; // Granted permissions
};
```

Every service method requires an actor to enable permission checks and audit logging.

### 3. Result Type

Services return a `ServiceOutput<T>` - a discriminated union representing success or failure:

```typescript
type ServiceOutput<T> =
  | { data: T; error?: never }              // Success
  | { data?: never; error: ErrorObject };   // Failure
```

This forces explicit error handling and provides type safety.

## Your First Service

Let's create a `ProductService` that manages products in an e-commerce platform.

### Step 1: Define Zod Schemas

First, define validation schemas for your entity:

```typescript
// packages/schemas/entities/product.ts
import { z } from 'zod';

/**
 * Schema for creating a new product
 */
export const ProductCreateInputSchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().min(10).max(2000),
  basePrice: z.number().positive(),
  category: z.string(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Schema for updating a product (all fields optional)
 */
export const ProductUpdateInputSchema = z.object({
  name: z.string().min(3).max(255).optional(),
  description: z.string().min(10).max(2000).optional(),
  basePrice: z.number().positive().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * Schema for searching/filtering products
 */
export const ProductSearchSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20)
});

// Infer TypeScript types from schemas
export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>;
export type ProductSearchInput = z.infer<typeof ProductSearchSchema>;
```

### Step 2: Create the Service Class

Now create your service by extending `BaseCrudService`:

```typescript
// packages/service-core/src/services/product/product.service.ts
import { ProductModel } from '@repo/db';
import { RoleEnum, PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import type { Product } from '@repo/schemas';
import {
  ProductCreateInputSchema,
  ProductUpdateInputSchema,
  ProductSearchSchema
} from '@repo/schemas/entities/product';
import { BaseCrudService } from '../../base/base.crud.service';
import type { Actor, ServiceContext, PaginatedListOutput } from '../../types';
import { ServiceError } from '../../types';

/**
 * Service for managing products.
 * Handles business logic, permissions, and validation for Product entities.
 */
export class ProductService extends BaseCrudService<
  Product,                           // Entity type
  ProductModel,                      // Model class
  typeof ProductCreateInputSchema,   // Create schema
  typeof ProductUpdateInputSchema,   // Update schema
  typeof ProductSearchSchema         // Search schema
> {
  // Entity name for logging and error messages
  static readonly ENTITY_NAME = 'product';
  protected readonly entityName = ProductService.ENTITY_NAME;

  // Database model instance
  public readonly model: ProductModel;

  // Zod schemas for validation
  public readonly createSchema = ProductCreateInputSchema;
  public readonly updateSchema = ProductUpdateInputSchema;
  public readonly searchSchema = ProductSearchSchema;

  /**
   * Initialize the service
   * @param ctx - Service context with optional logger
   * @param model - Optional model instance (useful for testing)
   */
  constructor(ctx: ServiceContext, model?: ProductModel) {
    super(ctx, ProductService.ENTITY_NAME);
    this.model = model ?? new ProductModel();
  }

  /**
   * Define default relations to include when listing products
   */
  protected getDefaultListRelations() {
    return {}; // No relations for now
  }

  // ============================================================================
  // PERMISSION HOOKS
  // ============================================================================

  /**
   * Check if actor can create a product
   * Rule: Only ADMIN users can create products
   */
  protected _canCreate(actor: Actor, data: unknown): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can create products'
      );
    }
  }

  /**
   * Check if actor can update a product
   * Rule: Only ADMIN users can update products
   */
  protected _canUpdate(actor: Actor, entity: Product): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can update products'
      );
    }
  }

  /**
   * Check if actor can soft-delete a product
   * Rule: Only ADMIN users can delete products
   */
  protected _canSoftDelete(actor: Actor, entity: Product): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can delete products'
      );
    }
  }

  /**
   * Check if actor can hard-delete a product
   * Rule: Only SUPER_ADMIN can permanently delete
   */
  protected _canHardDelete(actor: Actor, entity: Product): void {
    if (actor.role !== RoleEnum.SUPER_ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only super administrators can permanently delete products'
      );
    }
  }

  /**
   * Check if actor can restore a deleted product
   * Rule: Only ADMIN can restore
   */
  protected _canRestore(actor: Actor, entity: Product): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can restore products'
      );
    }
  }

  /**
   * Check if actor can view a specific product
   * Rule: Authenticated users can view products
   */
  protected _canView(actor: Actor, entity: Product): void {
    if (!actor || !actor.id) {
      throw new ServiceError(
        ServiceErrorCode.UNAUTHORIZED,
        'Authentication required to view products'
      );
    }
  }

  /**
   * Check if actor can list products
   * Rule: Authenticated users can list products
   */
  protected _canList(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new ServiceError(
        ServiceErrorCode.UNAUTHORIZED,
        'Authentication required to list products'
      );
    }
  }

  /**
   * Check if actor can search products
   * Rule: Authenticated users can search
   */
  protected _canSearch(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new ServiceError(
        ServiceErrorCode.UNAUTHORIZED,
        'Authentication required to search products'
      );
    }
  }

  /**
   * Check if actor can count products
   * Rule: Authenticated users can count
   */
  protected _canCount(actor: Actor): void {
    if (!actor || !actor.id) {
      throw new ServiceError(
        ServiceErrorCode.UNAUTHORIZED,
        'Authentication required to count products'
      );
    }
  }

  /**
   * Check if actor can update product visibility
   * Rule: Only ADMIN can change visibility
   */
  protected _canUpdateVisibility(actor: Actor, entity: Product, newVisibility: unknown): void {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only administrators can update product visibility'
      );
    }
  }

  // ============================================================================
  // SEARCH & COUNT IMPLEMENTATION
  // ============================================================================

  /**
   * Execute the database search query
   */
  protected async _executeSearch(
    params: Record<string, unknown>,
    actor: Actor
  ): Promise<PaginatedListOutput<Product>> {
    const { page = 1, pageSize = 20, ...filters } = params;
    return this.model.findAll(filters, { page, pageSize });
  }

  /**
   * Execute the database count query
   */
  protected async _executeCount(
    params: Record<string, unknown>,
    actor: Actor
  ): Promise<{ count: number }> {
    const count = await this.model.count(params);
    return { count };
  }
}
```

## Using the Service

Now let's use the service we just created:

### Create a Product

```typescript
import { ProductService } from '@repo/service-core';
import { RoleEnum, PermissionEnum } from '@repo/schemas';

// Create service instance
const productService = new ProductService({ logger });

// Define the actor (current user)
const actor = {
  id: 'user-123',
  role: RoleEnum.ADMIN,
  permissions: [PermissionEnum.PRODUCT_CREATE]
};

// Create a product
const result = await productService.create(actor, {
  name: 'Premium Subscription',
  description: 'Our best subscription plan with all features included',
  basePrice: 99.99,
  category: 'subscription',
  isActive: true,
  isFeatured: true
});

// Handle result
if (result.data) {
  console.log('Product created:', result.data);
  // Output: { id: '...', name: 'Premium Subscription', ... }
} else {
  console.error('Error:', result.error.code, result.error.message);
}
```

### Read Operations

```typescript
// Get by ID
const productResult = await productService.getById(actor, 'product-id-123');

if (productResult.data) {
  console.log('Found product:', productResult.data.name);
}

// Get by slug (if your entity has a slug field)
const slugResult = await productService.getBySlug(actor, 'premium-subscription');

// List all products (paginated)
const listResult = await productService.list(actor, {
  page: 1,
  pageSize: 20
});

if (listResult.data) {
  console.log(`Found ${listResult.data.items.length} products`);
  console.log(`Total: ${listResult.data.total}`);
}

// Search with filters
const searchResult = await productService.search(actor, {
  category: 'subscription',
  minPrice: 50,
  maxPrice: 150,
  isActive: true,
  page: 1,
  pageSize: 10
});

// Count products
const countResult = await productService.count(actor, {
  category: 'subscription',
  isActive: true
});

if (countResult.data) {
  console.log(`Total active subscriptions: ${countResult.data.count}`);
}
```

### Update a Product

```typescript
const updateResult = await productService.update(
  actor,
  'product-id-123',
  {
    basePrice: 89.99,  // Reduced price
    isFeatured: false
  }
);

if (updateResult.data) {
  console.log('Product updated:', updateResult.data);
}
```

### Delete Operations

```typescript
// Soft delete (marks as deleted, can be restored)
const deleteResult = await productService.softDelete(actor, 'product-id-123');

if (deleteResult.data) {
  console.log(`Deleted ${deleteResult.data.count} product(s)`);
}

// Restore a soft-deleted product
const restoreResult = await productService.restore(actor, 'product-id-123');

// Hard delete (permanent, requires SUPER_ADMIN)
const superAdmin = { id: 'admin-1', role: RoleEnum.SUPER_ADMIN, permissions: [] };
const hardDeleteResult = await productService.hardDelete(superAdmin, 'product-id-123');
```

## Error Handling

Services return errors as values, not exceptions. Always check for errors:

```typescript
const result = await productService.create(actor, data);

if (result.error) {
  switch (result.error.code) {
    case 'VALIDATION_ERROR':
      console.error('Invalid input:', result.error.message);
      // Handle validation errors
      break;

    case 'FORBIDDEN':
      console.error('Permission denied:', result.error.message);
      // Handle permission errors
      break;

    case 'NOT_FOUND':
      console.error('Entity not found:', result.error.message);
      // Handle not found errors
      break;

    default:
      console.error('Unexpected error:', result.error.message);
      // Handle other errors
  }
  return;
}

// Safe to use result.data here
console.log('Success!', result.data);
```

## Adding Custom Logic

Beyond standard CRUD operations, you can add custom business methods:

```typescript
export class ProductService extends BaseCrudService<...> {
  // ... existing code ...

  /**
   * Get all active, featured products
   * Custom business method
   */
  public async getFeaturedProducts(actor: Actor): Promise<ServiceOutput<Product[]>> {
    return this.runWithLoggingAndValidation({
      methodName: 'getFeaturedProducts',
      input: { actor },
      schema: z.object({}), // No input data
      execute: async (validatedData, validatedActor) => {
        // Permission check
        this._canList(validatedActor);

        // Custom query logic
        const products = await this.model.findAll({
          isActive: true,
          isFeatured: true
        }, {
          page: 1,
          pageSize: 10
        });

        return products.items;
      }
    });
  }

  /**
   * Apply a discount to a product
   * Business rule: Only active products can have discounts
   */
  public async applyDiscount(
    actor: Actor,
    productId: string,
    discountPercent: number
  ): Promise<ServiceOutput<Product>> {
    return this.runWithLoggingAndValidation({
      methodName: 'applyDiscount',
      input: { actor, productId, discountPercent },
      schema: z.object({
        productId: z.string(),
        discountPercent: z.number().min(0).max(100)
      }),
      execute: async (validatedData, validatedActor) => {
        // Get the product
        const productResult = await this.getById(validatedActor, validatedData.productId);

        if (!productResult.data) {
          throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Product not found'
          );
        }

        const product = productResult.data;

        // Business rule: Only active products can have discounts
        if (!product.isActive) {
          throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Cannot apply discount to inactive products'
          );
        }

        // Calculate new price
        const discountAmount = product.basePrice * (validatedData.discountPercent / 100);
        const newPrice = product.basePrice - discountAmount;

        // Update product
        const updateResult = await this.update(validatedActor, validatedData.productId, {
          basePrice: newPrice,
          metadata: {
            ...product.metadata,
            originalPrice: product.basePrice,
            discountPercent: validatedData.discountPercent
          }
        });

        if (!updateResult.data) {
          throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Failed to apply discount'
          );
        }

        return updateResult.data;
      }
    });
  }
}
```

Usage:

```typescript
// Get featured products
const featuredResult = await productService.getFeaturedProducts(actor);

if (featuredResult.data) {
  console.log(`Found ${featuredResult.data.length} featured products`);
}

// Apply discount
const discountResult = await productService.applyDiscount(actor, 'product-123', 20);

if (discountResult.data) {
  console.log(`New price: $${discountResult.data.basePrice}`);
}
```

## What's Next?

Congratulations! You've created your first service. Here's what to explore next:

### Learn More

- **[Permission System Guide](./guides/permissions.md)** - Implement fine-grained permissions
- **[Lifecycle Hooks Guide](./guides/lifecycle-hooks.md)** - Use before/after hooks effectively
- **[Service Composition Guide](./guides/service-composition.md)** - Orchestrate multiple services
- **[Testing Guide](./guides/testing.md)** - Write comprehensive tests

### Examples

- **[Basic CRUD Examples](./examples/basic-crud.md)** - More CRUD patterns
- **[Custom Methods Examples](./examples/custom-methods.md)** - Advanced business logic
- **[Permission Patterns](./examples/permissions.md)** - Common permission scenarios

### API Reference

- **[BaseCrudService API](./api/base-crud-service.md)** - Complete API documentation
- **[Result Types API](./api/result-types.md)** - Error handling patterns
- **[Service Context API](./api/service-context.md)** - Actor and context details

## Common Gotchas

### 1. Forgetting to Check Errors

```typescript
// ❌ BAD: Assuming success
const result = await service.create(actor, data);
console.log(result.data.id); // TypeScript error if result.error exists

// ✅ GOOD: Always check
if (result.data) {
  console.log(result.data.id);
} else {
  console.error(result.error.message);
}
```

### 2. Using Wrong Actor

```typescript
// ❌ BAD: Using guest actor for admin operation
const guestActor = { id: '', role: RoleEnum.GUEST, permissions: [] };
await service.create(guestActor, data); // Will fail permission check

// ✅ GOOD: Use appropriate actor
const adminActor = { id: 'admin-1', role: RoleEnum.ADMIN, permissions: [] };
await service.create(adminActor, data); // Success
```

### 3. Not Implementing All Permission Hooks

```typescript
// ❌ BAD: Forgetting to implement a hook
protected _canCreate(actor: Actor, data: unknown): void {
  // Missing implementation - will throw error
}

// ✅ GOOD: Implement all hooks
protected _canCreate(actor: Actor, data: unknown): void {
  if (actor.role !== RoleEnum.ADMIN) {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Admin only');
  }
}
```

## Troubleshooting

### TypeScript Errors

**Problem**: "Type '...' is not assignable to type 'ZodObject'"

**Solution**: Make sure you're passing the schema type, not the inferred type:

```typescript
// ❌ Wrong
typeof ProductCreateInputSchema  // Type

// ✅ Correct
ProductCreateInputSchema          // Actual schema
```

### Permission Denied Errors

**Problem**: All operations fail with FORBIDDEN error

**Solution**: Check that your actor has the correct role or permissions:

```typescript
// Debug actor
console.log('Actor:', actor.id, actor.role, actor.permissions);

// Make sure role matches permission requirements
if (actor.role !== RoleEnum.ADMIN) {
  console.log('User is not admin, operation will fail');
}
```

### Validation Errors

**Problem**: Create/update fails with VALIDATION_ERROR

**Solution**: Check that your input matches the schema:

```typescript
// Test schema directly
const testResult = ProductCreateInputSchema.safeParse(data);

if (!testResult.success) {
  console.log('Validation errors:', testResult.error.errors);
}
```

## Next Steps

Ready to dive deeper? Here are your next steps:

1. **Read the [Full Documentation](./README.md)** - Comprehensive guide with advanced topics
2. **Explore [Examples](./examples/)** - Real-world code examples
3. **Review [Best Practices](./README.md#best-practices-top-10)** - Follow established patterns
4. **Write Tests** - See [Testing Guide](./guides/testing.md) for strategies

Happy coding! 🚀
