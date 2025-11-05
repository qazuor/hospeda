# @repo/service-core Documentation

Welcome to the comprehensive documentation for the Service Core package. This is the business logic layer for the Hospeda platform, providing a robust foundation for building type-safe, permission-controlled services.

## Overview

The `@repo/service-core` package provides a standardized architecture for implementing business logic in the Hospeda platform. Services extend `BaseCrudService` and handle:

- **Business Rules Enforcement** - Validate and enforce domain-specific rules
- **Permission Management** - Fine-grained access control for all operations
- **Data Validation** - Zod schema validation for inputs and outputs
- **Error Handling** - Consistent error responses with typed error codes
- **Lifecycle Hooks** - Execute custom logic before/after operations
- **Service Orchestration** - Compose multiple services for complex workflows
- **Audit Logging** - Automatic logging of all operations

**Key Philosophy**: Services are the single source of truth for business logic. All database access should go through services, not directly to models.

## Quick Navigation

### 🚀 Getting Started

| Document | Description | Time |
|----------|-------------|------|
| [Quick Start](./quick-start.md) | Complete tutorial to build your first service | 5 min |
| [Installation](#installation) | How to add service-core to your package | 2 min |
| [Core Concepts](#core-concepts) | Understand the fundamental patterns | 10 min |

### 📖 API Reference

| Document | Description |
|----------|-------------|
| [BaseCrudService](./api/base-crud-service.md) | Base class API and all available methods |
| [Result Types](./api/result-types.md) | ServiceOutput and error handling patterns |
| [Service Context](./api/service-context.md) | Actor, permissions, and context management |
| [Error Handling](./api/error-handling.md) | ServiceError codes and error patterns |

### 📚 Development Guides

| Document | Description |
|----------|-------------|
| [Creating Services](./guides/creating-services.md) | Step-by-step guide to create new services |
| [Permission System](./guides/permissions.md) | Implementing permission checks |
| [Lifecycle Hooks](./guides/lifecycle-hooks.md) | Using before/after hooks effectively |
| [Custom Business Logic](./guides/custom-logic.md) | Adding methods beyond CRUD |
| [Service Composition](./guides/service-composition.md) | Orchestrating multiple services |
| [Testing Services](./guides/testing.md) | Comprehensive testing strategies |

### 💡 Examples

| Document | Description |
|----------|-------------|
| [Basic CRUD](./examples/basic-crud.md) | Simple create, read, update, delete operations |
| [Custom Methods](./examples/custom-methods.md) | Adding business-specific methods |
| [Service Composition](./examples/composition.md) | Using multiple services together |
| [Permission Patterns](./examples/permissions.md) | Common permission check patterns |
| [Testing Examples](./examples/testing.md) | Complete test suite examples |

## Installation

Add the package to your dependencies:

```bash
pnpm add @repo/service-core
```

Install peer dependencies if not already present:

```bash
pnpm add @repo/db @repo/schemas @repo/logger zod
```

## Core Concepts

### Service Architecture

Services form the business logic layer between API routes and database models:

```
┌─────────────────────────────────────────────────┐
│              API Layer (Hono)                   │
│  • HTTP Request/Response                        │
│  • Route Handlers                               │
└────────────────┬────────────────────────────────┘
                 │
                 │ Calls service methods
                 │ with Actor context
                 ▼
┌─────────────────────────────────────────────────┐
│          Service Layer (@repo/service-core)     │
│  • Business Logic                               │
│  • Permission Checks                            │
│  • Validation (Zod)                             │
│  • Error Handling                               │
│  • Lifecycle Hooks                              │
└────────────────┬────────────────────────────────┘
                 │
                 │ Calls model methods
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│          Data Access Layer (@repo/db)           │
│  • Models (CRUD operations)                     │
│  • Drizzle ORM queries                          │
│  • Database transactions                        │
└────────────────┬────────────────────────────────┘
                 │
                 │ SQL queries
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│            Database (PostgreSQL)                │
└─────────────────────────────────────────────────┘
```

### BaseCrudService Hierarchy

```typescript
export abstract class BaseCrudService<
  TEntity,        // The database entity type (e.g., Product)
  TModel,         // The model class (e.g., ProductModel)
  TCreateSchema,  // Zod schema for create input
  TUpdateSchema,  // Zod schema for update input
  TSearchSchema   // Zod schema for search/filter input
> extends BaseService
```

**What BaseCrudService Provides:**

- Standard CRUD operations (create, update, delete, restore)
- Read operations (getById, getBySlug, getByName, list)
- Search and count operations
- Permission hooks for all operations
- Lifecycle hooks (before/after each operation)
- Automatic validation using Zod schemas
- Error handling with Result type
- Logging for all operations

### Service Context and Actor

Every service method requires an `Actor` representing the user or system performing the action:

```typescript
type Actor = {
  id: string;                    // Unique identifier
  role: RoleEnum;                // User role (GUEST, USER, ADMIN, SUPER_ADMIN)
  permissions: PermissionEnum[]; // Array of granted permissions
};

type ServiceContext = {
  logger?: ServiceLogger; // Optional logger instance
};
```

**Why Actor is Required:**

- Enables permission checks at service layer
- Provides audit trail (createdById, updatedById)
- Allows row-level security (e.g., users can only edit their own content)

### Result Type Pattern

All service methods return `ServiceOutput<T>` - a discriminated union that represents either success or failure:

```typescript
type ServiceOutput<T> =
  | {
      data: T;
      error?: never;
    }
  | {
      data?: never;
      error: {
        code: ServiceErrorCode;
        message: string;
        details?: unknown;
      };
    };
```

**Benefits:**

- **Type Safety**: TypeScript knows which properties exist based on success/failure
- **Explicit Error Handling**: Forces you to handle errors
- **Consistent API**: All services use the same pattern
- **No Exceptions**: Errors are values, not thrown exceptions

**Usage:**

```typescript
const result = await productService.create(actor, data);

if (result.data) {
  // Success case - TypeScript knows data exists
  console.log('Created product:', result.data.id);
} else {
  // Error case - TypeScript knows error exists
  console.error(`Error ${result.error.code}: ${result.error.message}`);
}
```

### Permission System

Services implement fine-grained permission checks through hooks:

**Permission Hooks:**

- `_canCreate(actor, data)` - Check if actor can create with given data
- `_canUpdate(actor, entity)` - Check if actor can update specific entity
- `_canSoftDelete(actor, entity)` - Check if actor can soft-delete entity
- `_canHardDelete(actor, entity)` - Check if actor can permanently delete entity
- `_canRestore(actor, entity)` - Check if actor can restore deleted entity
- `_canView(actor, entity)` - Check if actor can view specific entity
- `_canList(actor)` - Check if actor can list entities
- `_canSearch(actor)` - Check if actor can search entities
- `_canCount(actor)` - Check if actor can count entities
- `_canUpdateVisibility(actor, entity, newVisibility)` - Check if actor can change visibility

**Common Patterns:**

```typescript
// Role-based check
protected _canCreate(actor: Actor, data: unknown): void {
  if (actor.role !== RoleEnum.ADMIN) {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Only admins can create products');
  }
}

// Permission-based check
protected _canUpdate(actor: Actor, entity: Product): void {
  if (!actor.permissions.includes(PermissionEnum.PRODUCT_UPDATE)) {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Missing PRODUCT_UPDATE permission');
  }
}

// Ownership check
protected _canUpdate(actor: Actor, entity: Post): void {
  if (entity.createdById !== actor.id && actor.role !== RoleEnum.ADMIN) {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'You can only update your own posts');
  }
}
```

### Lifecycle Hooks

Services provide hooks to execute custom logic before and after operations:

**Create Lifecycle:**

1. Validate input with `createSchema`
2. `_canCreate(actor, data)` - Permission check
3. `_beforeCreate(data, actor)` - Pre-processing
4. Database insert
5. `_afterCreate(entity, actor)` - Post-processing

**Update Lifecycle:**

1. Validate input with `updateSchema`
2. Fetch entity from database
3. `_canUpdate(actor, entity)` - Permission check
4. `_beforeUpdate(data, actor)` - Pre-processing
5. Database update
6. `_afterUpdate(entity, actor)` - Post-processing

**Common Use Cases:**

```typescript
// Generate slug before creating
protected async _beforeCreate(data: CreateProduct, actor: Actor): Promise<Partial<Product>> {
  return {
    ...data,
    slug: slugify(data.name)
  };
}

// Send notification after creating
protected async _afterCreate(entity: Product, actor: Actor): Promise<Product> {
  await this.notificationService.send({
    userId: actor.id,
    message: `Product ${entity.name} created successfully`
  });
  return entity;
}

// Validate business rules before update
protected async _beforeUpdate(data: UpdateProduct, actor: Actor): Promise<Partial<Product>> {
  if (data.basePrice && data.basePrice < 0) {
    throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Price cannot be negative');
  }
  return data;
}
```

### Service Composition

Services can orchestrate other services to implement complex workflows:

```typescript
export class OrderService extends BaseCrudService<...> {
  private productService: ProductService;
  private inventoryService: InventoryService;
  private paymentService: PaymentService;

  constructor(ctx: ServiceContext) {
    super(ctx, 'order');
    this.productService = new ProductService(ctx);
    this.inventoryService = new InventoryService(ctx);
    this.paymentService = new PaymentService(ctx);
  }

  public async placeOrder(
    actor: Actor,
    items: OrderItem[]
  ): Promise<ServiceOutput<Order>> {
    return this.runWithLoggingAndValidation({
      methodName: 'placeOrder',
      input: { actor, items },
      schema: PlaceOrderSchema,
      execute: async (validatedData, validatedActor) => {
        // 1. Validate product availability
        for (const item of items) {
          const product = await this.productService.getById(validatedActor, item.productId);
          if (!product.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Product ${item.productId} not found`);
          }
        }

        // 2. Reserve inventory
        const reservation = await this.inventoryService.reserve(validatedActor, items);
        if (!reservation.data) {
          throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Insufficient inventory');
        }

        // 3. Create order
        const order = await this.model.create({
          userId: validatedActor.id,
          items,
          status: 'PENDING'
        });

        // 4. Process payment
        const payment = await this.paymentService.charge(validatedActor, {
          orderId: order.id,
          amount: order.total
        });

        if (!payment.data) {
          // Rollback inventory
          await this.inventoryService.release(validatedActor, reservation.data.id);
          throw new ServiceError(ServiceErrorCode.PAYMENT_FAILED, 'Payment failed');
        }

        return order;
      }
    });
  }
}
```

## Best Practices (Top 10)

1. **Always Use Services** - Never call models directly from routes
2. **Return Result Type** - Use `ServiceOutput<T>` for consistent error handling
3. **Validate at Service Layer** - Use Zod schemas for all inputs
4. **Check Permissions** - Implement all permission hooks based on business requirements
5. **Use Lifecycle Hooks** - Add custom logic in hooks, not in main methods
6. **Keep Services Focused** - One service per entity (Single Responsibility Principle)
7. **Test All Methods** - Include tests for success, validation errors, and permission errors
8. **Document Complex Logic** - Use JSDoc for business rules and edge cases
9. **Compose Services** - Inject other services for complex workflows
10. **Handle Errors Gracefully** - Provide meaningful error messages with proper error codes

## Error Codes

Services use standardized error codes from `ServiceErrorCode` enum:

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `NOT_FOUND` | Entity not found | 404 |
| `FORBIDDEN` | Permission denied | 403 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `CONFLICT` | Resource conflict (e.g., duplicate) | 409 |
| `INTERNAL_ERROR` | Unexpected server error | 500 |
| `DATABASE_ERROR` | Database operation failed | 500 |

## Related Documentation

### Internal Packages

- **[@repo/db](../../db/docs/README.md)** - Database models and ORM
- **[@repo/schemas](../../schemas/docs/README.md)** - Zod validation schemas and types
- **[@repo/logger](../../logger/docs/README.md)** - Logging utilities

### External References

- [Zod Documentation](https://zod.dev/) - Schema validation library
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) - TypeScript reference
- [Drizzle ORM](https://orm.drizzle.team/) - Database ORM

## Package Structure

```
src/
├── base/                          # Base classes
│   ├── base.service.ts           # Base service with logging/validation
│   ├── base.crud.service.ts      # CRUD operations base class
│   ├── base.crud.related.service.ts # For services with relations
│   └── index.ts
├── services/                      # Entity services
│   ├── product/
│   │   ├── product.service.ts
│   │   └── index.ts
│   ├── accommodation/
│   ├── user/
│   └── ...
├── types/                         # Type definitions
│   ├── service-context.ts        # Actor, ServiceOutput types
│   └── index.ts
├── utils/                         # Utilities
│   ├── service-logger.ts
│   └── validation.ts
└── index.ts                       # Main exports
```

## Contributing

When adding new services:

1. Extend `BaseCrudService` with proper generic types
2. Implement all abstract permission hooks
3. Define `createSchema`, `updateSchema`, `searchSchema`
4. Implement `_executeSearch` and `_executeCount` methods
5. Add custom business methods as needed
6. Write comprehensive tests (unit + integration)
7. Document complex business rules with JSDoc

## Support

- **Issues**: [GitHub Issues](https://github.com/hospeda/hospeda/issues)
- **Documentation**: This directory
- **Examples**: [./examples/](./examples/)

---

**Next Steps:**

- **New to service-core?** Start with the [Quick Start Guide](./quick-start.md)
- **Building a service?** Check out [Creating Services Guide](./guides/creating-services.md)
- **Need examples?** Browse the [Examples Directory](./examples/)
