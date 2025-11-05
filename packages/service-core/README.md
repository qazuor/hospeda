# @repo/service-core

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Business logic layer providing services for all entities in the Hospeda platform. Services extend `BaseCrudService` and encapsulate business rules, validation, and orchestration between models.

## Key Features

- **Type-Safe Services** - Full TypeScript inference from schemas to database operations
- **Standardized CRUD Operations** - Built-in create, read, update, delete, search, and count methods
- **Permission System** - Fine-grained permission checks with role-based access control
- **Lifecycle Hooks** - Execute custom logic before/after any operation
- **Result Type Pattern** - Consistent error handling with discriminated unions
- **Service Composition** - Services can orchestrate multiple other services
- **Automatic Validation** - Zod schema validation for all inputs
- **Comprehensive Logging** - Built-in logging for all operations and errors

## Installation

```bash
pnpm add @repo/service-core
```

## Quick Start

```typescript
import { BaseCrudService } from '@repo/service-core';
import { ProductModel } from '@repo/db';
import { ProductCreateSchema, ProductUpdateSchema, ProductSearchSchema } from '@repo/schemas';
import type { Product } from '@repo/schemas';

// Define your service
export class ProductService extends BaseCrudService<
  Product,
  ProductModel,
  typeof ProductCreateSchema,
  typeof ProductUpdateSchema,
  typeof ProductSearchSchema
> {
  protected readonly model = new ProductModel();
  protected readonly createSchema = ProductCreateSchema;
  protected readonly updateSchema = ProductUpdateSchema;
  protected readonly searchSchema = ProductSearchSchema;

  constructor(ctx: ServiceContext) {
    super(ctx, 'product');
  }

  protected getDefaultListRelations() {
    return {}; // No relations by default
  }

  // Implement permission hooks
  protected _canCreate(actor: Actor, data: unknown): void {
    if (actor.role !== 'ADMIN') {
      throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Only admins can create products');
    }
  }

  // ... implement other permission hooks
}

// Use your service
const service = new ProductService({ logger });

const result = await service.create(
  { id: 'user-123', role: 'ADMIN', permissions: [] },
  { name: 'Premium Plan', description: 'Our best plan', basePrice: 99 }
);

if (result.data) {
  console.log('Created:', result.data);
} else {
  console.error('Error:', result.error.message);
}
```

## Core Concepts

### Service Architecture

Services act as the bridge between API routes and database models:

```
API Routes → Services → Models → Database
```

- **Routes** receive HTTP requests
- **Services** enforce business rules and permissions
- **Models** handle database operations
- **Database** persists data

### Result Type

All service methods return a `ServiceOutput<T>` type for consistent error handling:

```typescript
type ServiceOutput<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: ServiceErrorCode; message: string; details?: unknown } };
```

Success case:

```typescript
const result = await service.create(actor, data);
if (result.data) {
  // TypeScript knows result.data exists
  console.log(result.data.id);
}
```

Error case:

```typescript
if (result.error) {
  // TypeScript knows result.error exists
  console.log(result.error.code, result.error.message);
}
```

### Actor Context

Every service method requires an `Actor` that represents the user or system performing the action:

```typescript
type Actor = {
  id: string;
  role: RoleEnum;
  permissions: PermissionEnum[];
};
```

This enables permission checks at the service layer.

## What's Next?

- **[📚 Full Documentation](./docs/README.md)** - Complete guides, API reference, and examples
- **[🚀 Quick Start Tutorial](./docs/quick-start.md)** - Get started in 5 minutes
- **[📖 API Reference](./docs/api/)** - Detailed API documentation
- **[📝 Examples](./docs/examples/)** - Real-world usage examples

## Documentation Structure

```
docs/
├── README.md           # Documentation portal (start here)
├── quick-start.md      # 5-minute tutorial
├── api/                # API reference documentation
├── guides/             # Development guides
└── examples/           # Code examples
```

## Related Packages

- **[@repo/db](../db)** - Database models and schemas
- **[@repo/schemas](../schemas)** - Zod validation schemas
- **[@repo/logger](../logger)** - Logging utilities

## Development

```bash
# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build
pnpm build
```

## License

MIT © Hospeda
