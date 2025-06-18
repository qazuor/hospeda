# @repo/service-core

## Overview

`@repo/service-core` provides a robust, extensible, and type-safe foundation for implementing service-layer logic in a modular monorepo. It centralizes CRUD, permission, validation, and error handling patterns, allowing concrete services to remain minimal and focused on domain-specific logic.

---

## Architecture & Service Pattern

- **BaseService**: Abstract class encapsulating all common service logic (CRUD, permissions, logging, error handling, input normalization).
- **Concrete Services**: Extend `BaseService`, only override what is truly domain-specific (e.g., custom permissions, input normalization).
- **Strong Typing**: All inputs/outputs are fully typed and validated with Zod.
- **Error Handling**: All errors are handled via `ServiceError` and returned in a consistent `ServiceOutput<T>` shape.
- **Permission Helpers**: Common permission logic is centralized and reusable.

---

## How to Implement a New Service

1. **Extend `BaseService`** with the correct type parameters for your entity.
2. **Define the model** (`protected model`) and the Zod schema (`protected inputSchema`).
3. **Override permission methods** only if you need custom logic.
4. **(Optional) Override normalization or domain methods** if you need to transform input or add custom queries.
5. **Use the provided execution helper** (`runWithLoggingAndValidation`) for all public methods.

### Example: Minimal Service

```ts
import { BaseService } from '@repo/service-core';
import { MyEntityModel } from '@repo/db';
import { MyEntityType, NewMyEntityInputType, UpdateMyEntityInputType } from '@repo/types';
import { MyEntityInputSchema } from './my-entity.schemas';

export class MyEntityService extends BaseService<
  MyEntityType,
  NewMyEntityInputType,
  UpdateMyEntityInputType,
  unknown,
  MyEntityType[]
> {
  protected model = new MyEntityModel();
  protected inputSchema = MyEntityInputSchema;

  // Custom permission logic (optional)
  protected async canViewEntity(actor, entity) {
    if (entity.isPublic) return { canView: true, reason: 'PERMISSION_GRANTED' };
    return this.defaultCanView(actor, entity);
  }
}
```

---

## Permissions & Access Control

- **Permission methods** (`canViewEntity`, `canUpdateEntity`, etc.) must be implemented in each service.
- Use the provided helpers (`defaultCanView`, `defaultCanUpdate`, `isAdmin`, `isOwner`) for standard cases.
- Override only if you need custom logic (e.g., public/featured entities).

### Example: Custom Permission

```ts
protected async canViewEntity(actor, entity) {
  if (entity.isFeatured) return { canView: true, reason: 'PERMISSION_GRANTED' };
  return this.defaultCanView(actor, entity);
}
```

---

## Input Validation

- All public methods validate input using Zod schemas.
- Define schemas in `@repo/schemas` and use `z.infer` for type safety.
- Validation errors are always returned as `ServiceError` with code `VALIDATION_ERROR`.

### Example: Zod Schema

```ts
import { z } from 'zod';

export const NewEntityInputSchema = z.object({
  name: z.string().min(1),
  // ... other fields
});
```

---

## Error Handling

- All errors are handled via `ServiceError` and returned in a consistent `ServiceOutput<T>` shape.
- Use `runWithLoggingAndValidation` to ensure all errors are caught and logged.
- Never throw raw `Error`—always use `ServiceError` or let the base handle it.

### Example: ServiceOutput

```ts
type ServiceOutput<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string } };
```

---

## Extension Points & Customization

- **Input Normalization**: Override `normalizeCreateInput`, `normalizeUpdateInput`, or `normalizeListInput` to transform or enrich input before DB operations.
- **Custom Queries**: Add new public methods using `runWithLoggingAndValidation` and your own model methods.
- **Hooks**: You can add hooks (e.g., `beforeCreate`, `afterUpdate`) by overriding or extending the base methods.

---

## Testing

- Use AAA (Arrange, Act, Assert) in all tests.
- Use mocks for models and permission helpers.
- Test only domain logic in your service, not the base logging/validation.
- Write Given-When-Then style for integration/acceptance tests.

### Example: Unit Test

```ts
describe('MyEntityService', () => {
  it('should allow admin to view any entity', async () => {
    // Arrange
    const service = new MyEntityService();
    const actor = { id: 'admin-id', role: 'ADMIN' };
    const entity = { id: 'entity-id', isPublic: false };
    // Act
    const result = await service.canViewEntity(actor, entity);
    // Assert
    expect(result.canView).toBe(true);
  });
});
```

---

## Best Practices

- **Keep services thin**: Only add logic that is truly domain-specific.
- **Use base helpers**: Prefer the provided permission and normalization helpers.
- **Always use `runWithLoggingAndValidation`**: Ensures consistent error handling and logging.
- **Favor composition**: If you need to add cross-cutting logic, prefer helpers or utility functions over inheritance.
- **Document custom logic**: If you override a base method, explain why in a comment.
- **Strong typing everywhere**: Never use `any` or implicit types.
- **Early returns**: Flatten logic and avoid deep nesting.
- **Re-export from `index.ts`**: All services and types should be accessible from the package entrypoint.

---

## Example: Full Service Implementation

```ts
import { BaseService } from '@repo/service-core';
import { AccommodationModel } from '@repo/db';
import { AccommodationType, NewAccommodationInputType, UpdateAccommodationInputType } from '@repo/types';
import { NewAccommodationInputSchema } from './accommodation.schemas';

export class AccommodationService extends BaseService<
  AccommodationType,
  NewAccommodationInputType,
  UpdateAccommodationInputType,
  unknown,
  AccommodationType[]
> {
  protected model = new AccommodationModel();
  protected inputSchema = NewAccommodationInputSchema;

  protected async canViewEntity(actor, entity) {
    if (entity.isFeatured) return { canView: true, reason: 'PERMISSION_GRANTED' };
    return this.defaultCanView(actor, entity);
  }
}
```

---

## FAQ

**Q: How do I add a new service?**
A: Extend `BaseService`, define your model and schema, override permission methods if needed, and use the base helpers for everything else.

**Q: How do I handle custom errors?**
A: Always throw or return `ServiceError` with a clear code and message. Never throw raw `Error`.

**Q: How do I test my service?**
A: Use mocks for models and permission helpers, and test only your domain logic.

---

## Contributing

If you have questions or want to propose improvements, open an issue or contact the maintainers.

## Features

- Base service class with common CRUD operations
- Permission management
- Input validation
- Logging utilities
- Type-safe service implementations

## Installation

```bash
pnpm add @repo/service-core
```

## Usage

### Creating a Service

```typescript
import { BaseService } from '@repo/service-core';

class MyService extends BaseService<MyEntity, CreateInput, UpdateInput, ListInput, ListOutput> {
  constructor() {
    super('my-entity');
  }

  // Implement abstract methods...
}
```

### Using Validation

```typescript
import { validateInput } from '@repo/service-core';

const result = validateInput(mySchema, input, 'context');
```

### Using Logging

```typescript
import { logMethodStart, logMethodEnd } from '@repo/service-core';

logMethodStart('methodName', input, actor);
// ... do something
logMethodEnd('methodName', output);
```

## API Reference

### BaseService

The `BaseService` class provides a foundation for implementing services with common CRUD operations and permission checks.

#### Methods

- `getById`: Get an entity by ID
- `list`: List entities with pagination and filtering
- `create`: Create a new entity
- `update`: Update an existing entity
- `softDelete`: Soft delete an entity
- `restore`: Restore a soft-deleted entity
- `hardDelete`: Hard delete an entity

#### Abstract Methods

- `canViewEntity`: Check if an actor can view an entity
- `canUpdateEntity`: Check if an actor can update an entity
- `canDeleteEntity`: Check if an actor can delete an entity
- `canCreateEntity`: Check if an actor can create an entity
- `canRestoreEntity`: Check if an actor can restore an entity
- `normalizeCreateInput`: Normalize input for creating an entity
- `normalizeUpdateInput`: Normalize input for updating an entity
- `normalizeListInput`: Normalize input for listing entities

### Validation Utilities

- `validateInput`: Validate input against a Zod schema
- `validateActor`: Validate that an actor is provided
- `validateEntity`: Validate that an entity exists

### Logging Utilities

- `logMethodStart`: Log the start of a method execution
- `logMethodEnd`: Log the successful completion of a method execution
- `logError`: Log an error that occurred during method execution
- `logPermission`: Log a permission check
- `logDenied`: Log when access is denied
- `logGrant`: Log when access is granted

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Service Pattern and Usage Guide

This package provides a robust, extensible, and DRY foundation for implementing service-layer logic in a modular monorepo. The core of this system is the `BaseService` class, which encapsulates common CRUD, permission, validation, and logging patterns, allowing concrete services to remain minimal and focused on domain-specific logic.

---

## 🏗️ **How to Implement a Service**

A typical service should:

1. **Extend `BaseService`** with the correct type parameters for your entity.
2. **Define the model** (`protected model`) and the Zod schema (`protected inputSchema`).
3. **Implement or override permission methods** (using the provided helpers for standard cases).
4. **(Optional) Add custom methods** (e.g., `getBySlug`, `search`) using the generic helpers from the base.
5. **Use the provided execution helper** (`runWithLoggingAndValidation`) for all public methods.

---

## ✨ **Minimal Example**

```ts
import { BaseService } from '@repo/service-core';
import { MyEntityModel } from '@repo/db';
import { MyEntityType, NewMyEntityInputType, UpdateMyEntityInputType } from '@repo/types';
import { MyEntityInputSchema } from './my-entity.schemas';

export class MyEntityService extends BaseService<
  MyEntityType,
  NewMyEntityInputType,
  UpdateMyEntityInputType,
  unknown,
  MyEntityType[]
> {
  protected model = new MyEntityModel();
  protected inputSchema = MyEntityInputSchema;

  // Permissions: use base helpers unless you need custom logic
  protected async canViewEntity(actor, entity) {
    return this.defaultCanView(actor, entity);
  }
  protected async canUpdateEntity(actor, entity) {
    return this.defaultCanUpdate(actor, entity);
  }
  protected async canDeleteEntity(actor, entity) {
    return this.defaultCanDelete(actor, entity);
  }
  protected async canCreateEntity(actor) {
    return this.defaultCanCreate(actor);
  }
  protected async canRestoreEntity(actor, entity) {
    return this.defaultCanRestore(actor, entity);
  }

  // Public methods: use runWithLoggingAndValidation for all
  public async getById(input) {
    return this.runWithLoggingAndValidation('getById', input, async (_actor, input) => {
      return (await this.getByField('id', input.id, input)).data!;
    });
  }

  public async getBySlug(input) {
    return this.runWithLoggingAndValidation('getBySlug', input, async (_actor, input) => {
      return (await this.getByField('slug', input.slug, input)).data!;
    });
  }

  public async list(input) {
    return this.runWithLoggingAndValidation('list', input, async (_actor, input) => {
      const normalizedInput = await this.normalizeListInput(input);
      return await this.model.findAll(normalizedInput as Record<string, unknown>);
    });
  }

  public async create(input) {
    return this.runWithLoggingAndValidation('create', input, async (actor, input) => {
      const canCreate = await this.canCreateEntity(actor);
      if (!canCreate.canCreate) {
        throw new Error('Cannot create entity');
      }
      const normalizedInput = await this.normalizeCreateInput(input);
      return await this.model.create(normalizedInput as Partial<MyEntityType>);
    }, this.inputSchema);
  }

  public async update(input) {
    return this.runWithLoggingAndValidation('update', input, async (actor, input) => {
      if (!input.id) throw new Error('Missing id');
      const entity = await this.model.findById(input.id);
      if (!entity) throw new Error('Entity not found');
      const canUpdate = await this.canUpdateEntity(actor, entity);
      if (!canUpdate.canUpdate) throw new Error('Cannot update entity');
      const normalizedInput = await this.normalizeUpdateInput(input);
      const updated = await this.model.update({ id: input.id }, normalizedInput as Partial<MyEntityType>);
      if (!updated) throw new Error('Entity not found after update');
      return updated;
    }, this.inputSchema);
  }
}
```

---

## 🧩 **Key BaseService Features**

### **Generic Field Lookup**
- Use `getByField(field, value, input)` for any unique field (e.g., `id`, `slug`, `name`).
- Example:
  ```ts
  public async getBySlug(input) {
    return this.getByField('slug', input.slug, input);
  }
  ```

### **Permission Helpers**
- `isAdmin(actor)` — Returns true if the actor is an admin.
- `isOwner(actor, entity)` — Returns true if the actor owns the entity.
- `defaultCanView`, `defaultCanUpdate`, `defaultCanDelete`, `defaultCanCreate`, `defaultCanRestore` — Standard permission checks for most use cases.
- Override only if you need custom logic (e.g., public/featured entities).

### **Input Normalization**
- By default, `normalizeCreateInput`, `normalizeUpdateInput`, and `normalizeListInput` just return the input.
- Override only if you need to transform or enrich the input before DB operations.

### **Centralized Logging & Validation**
- Use `runWithLoggingAndValidation` for all public methods:
  - Handles logging (start, end, error)
  - Validates actor and (optionally) input schema
  - Catches and formats errors
  - Returns a consistent `ServiceOutput` type

---

## 🚦 **Best Practices**

- **Keep services thin:** Only add logic that is truly domain-specific.
- **Use base helpers:** Prefer the provided permission and normalization helpers.
- **Always use `runWithLoggingAndValidation`:** This ensures consistent error handling and logging.
- **Favor composition:** If you need to add cross-cutting logic, prefer helpers or utility functions over inheritance.
- **Document custom logic:** If you override a base method, explain why in a comment.

---

## 📝 **ServiceOutput Type**

All service methods should return a `ServiceOutput<T>`, which is:
```ts
type ServiceOutput<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string } };
```
Use the `makeErrorOutput` helper for error returns.

---

## 🧪 **Testing**

- Test only the domain logic in your service, not the base logging/validation (already covered).
- Use mocks for the model and permission helpers if needed.

---

## 📚 **Extending the Pattern**

- For advanced use cases (e.g., batch operations, custom queries), you can add new helpers to `BaseService` or utility modules.
- If you need to support more complex permission logic, consider composing permission helpers.

---

## Example: Minimal AccommodationService

```ts
import { AccommodationModel } from '@repo/db';
import { AccommodationType, NewAccommodationInputType, UpdateAccommodationInputType, AccommodationId } from '@repo/types';
import { NewAccommodationInputSchema } from './accommodation.schemas';
import { BaseService } from '@repo/service-core';

export class AccommodationService extends BaseService<
  AccommodationType,
  NewAccommodationInputType,
  UpdateAccommodationInputType,
  unknown,
  AccommodationType[]
> {
  protected model = new AccommodationModel();
  protected inputSchema = NewAccommodationInputSchema;

  protected async canViewEntity(actor, entity) {
    if (entity.isFeatured) return { canView: true, reason: 'PERMISSION_GRANTED' };
    return this.defaultCanView(actor, entity);
  }
  protected async canUpdateEntity(actor, entity) {
    return this.defaultCanUpdate(actor, entity);
  }
  protected async canDeleteEntity(actor, entity) {
    return this.defaultCanDelete(actor, entity);
  }
  protected async canCreateEntity(actor) {
    return this.defaultCanCreate(actor);
  }
  protected async canRestoreEntity(actor, entity) {
    return this.defaultCanRestore(actor, entity);
  }

  public async getById(input: ServiceInput<{ id: AccommodationId }>) {
    return this.runWithLoggingAndValidation('getById', input, async (_actor, input) => {
      return (await this.getByField('id', input.id, input)).data!;
    });
  }
  // ...
}
```

---

## 💬 **Questions?**
If you have questions or want to propose improvements, open an issue or contact the maintainers. 
