# Service Implementation Guide

**How to create robust, type-safe, and extensible services in `@repo/service-core`.**

---

## 1. Overview

All services must:
- Extend `BaseService<TEntity, TModel, TCreateSchema, TUpdateSchema, TSearchSchema>`
- Use Zod schemas for all input validation, and infer TypeScript types from them
- Implement permission hooks, lifecycle hooks, and error handling as described below
- Be fully covered by robust, DRY, and type-safe tests

---

## 2. Step-by-Step: Creating a New Service

### 2.1. Define Zod Schemas and Types
- Place schemas in `@repo/schemas` or a local `schemas.ts` file.
- Always use Zod for validation.
- Infer TypeScript types from schemas.

```ts
// src/services/destination/destination.schemas.ts
import { z } from 'zod';

export const CreateDestinationSchema = z.object({
  name: z.string().min(3),
  country: z.string(),
  // ...other fields
});
export type CreateDestinationInput = z.infer<typeof CreateDestinationSchema>;

export const UpdateDestinationSchema = CreateDestinationSchema.deepPartial();
export type UpdateDestinationInput = z.infer<typeof UpdateDestinationSchema>;

export const SearchDestinationSchema = z.object({
  filters: z.object({
    country: z.string().optional(),
    // ...other filters
  }).optional()
});
export type SearchDestinationInput = z.infer<typeof SearchDestinationSchema>;
```

---

### 2.2. Implement the Service Class
- Extend `BaseService`.
- Implement all required abstract properties and hooks.
- Use the correct Zod schemas and types.

```ts
import { BaseService } from '../../base';
import type { DestinationModel } from '@repo/db';
import type { DestinationType } from '@repo/types';
import type { ServiceContext, ServiceLogger } from '../../types';
import {
  CreateDestinationSchema,
  UpdateDestinationSchema,
  SearchDestinationSchema
} from './destination.schemas';

export class DestinationService extends BaseService<
  DestinationType,
  DestinationModel,
  typeof CreateDestinationSchema,
  typeof UpdateDestinationSchema,
  typeof SearchDestinationSchema
> {
  protected readonly entityName = 'destination';
  protected readonly model: DestinationModel;
  protected readonly logger: ServiceLogger;
  protected readonly createSchema = CreateDestinationSchema;
  protected readonly updateSchema = UpdateDestinationSchema;
  protected readonly searchSchema = SearchDestinationSchema;

  constructor(ctx: ServiceContext, model?: DestinationModel) {
    super();
    this.logger = ctx.logger;
    this.model = model ?? new DestinationModel();
  }

  // --- Permission Hooks ---
  protected _canCreate(actor, data) { /* ... */ }
  protected _canUpdate(actor, entity) { /* ... */ }
  protected _canSoftDelete(actor, entity) { /* ... */ }
  protected _canHardDelete(actor, entity) { /* ... */ }
  protected _canRestore(actor, entity) { /* ... */ }
  protected _canView(actor, entity) { /* ... */ }
  protected _canList(actor) { /* ... */ }
  protected _canSearch(actor) { /* ... */ }
  protected _canCount(actor) { /* ... */ }
  protected _canUpdateVisibility(actor, entity, newVisibility) { /* ... */ }

  // --- Lifecycle Hooks (optional) ---
  protected async _beforeCreate(data, actor) { /* ... */ }
  protected async _afterCreate(entity, actor) { /* ... */ }
  // ...other hooks as needed

  // --- Custom Methods (optional) ---
  public async getSummary(actor, data) { /* ... */ }
  // ...other custom methods
}
```

---

### 2.3. Implement Permissions and Error Handling
- Use the provided `ServiceError` and `ServiceErrorCode` for all errors.
- Throw `ServiceError` in permission hooks if access is denied.
- Always validate input with the correct Zod schema.

#### Visual: Error Handling & Validation Flow

This diagram shows how a service method validates input, checks permissions, and handles errors in a robust, homogeneous way:

```mermaid
flowchart TD
  A["Service Method"] --> B["Validate input (Zod)"]
  B --> C["Check permissions"]
  C --> D{"Error?"}
  D -- Yes --> E["Throw ServiceError (with code, message)"]
  D -- No --> F["Run main logic"]
  F --> G{"Error?"}
  G -- Yes --> E
  G -- No --> H["Run hooks (before/after)"]
  H --> I["Return result"]
  E --> J["Test: Assert error type/code/message"]
  I --> K["Test: Assert result"]
```

---

### 2.4. Ensure Strong Typing and Extensibility
- Never use `any`.
- Always infer types from Zod schemas.
- Use the RO-RO pattern (Receive Object / Return Object).
- Prefer composition and utility functions for shared logic.

---

### 2.5. Checklist Before Committing
- [ ] All Zod schemas and types are defined and in sync.
- [ ] All required hooks and properties are implemented.
- [ ] All errors use `ServiceError` and codes.
- [ ] No `any` or implicit types.
- [ ] All public methods are documented with JSDoc.
- [ ] Tests are written and pass (see [Testing Guide](../../test/README.testing.md)).

---

## 3. Advanced Patterns & Anti-Patterns

### Patterns
- Use base permission helpers (`defaultCanView`, etc.) unless you need custom logic.
- Use `runWithLoggingAndValidation` for all public methods.
- Use composition for cross-cutting logic (e.g., hooks, utilities).
- Keep services thin—domain logic only.

### Anti-Patterns & Common Mistakes
- Duplicating logic already in `BaseService` or helpers.
- Using `any` or implicit types.
- Throwing raw errors (always use `ServiceError`).
- Hand-rolling mocks or test data (always use factories/builders).
- Skipping validation or permission checks.
- Not documenting custom logic or overrides.
- Mixing business logic with infrastructure (DB, API calls) in the service.
- Not using the RO-RO pattern (passing primitives instead of objects).
- Forgetting to update tests after changing service logic.

---

## 4. Security & Validation
- Always validate all input with Zod schemas before any logic or DB call.
- Never trust client input—validate and sanitize.
- Use permission hooks for every action (create, update, delete, view, etc.).
- Never expose sensitive data in errors or logs.
- Use strong typing to prevent injection or unsafe operations.
- Document all security-sensitive logic and edge cases.

---

## 5. Performance & Scalability
- Use batch operations for bulk updates/deletes.
- Avoid N+1 queries—fetch related data efficiently.
- Use hooks for async side effects (e.g., notifications) to keep main flow fast.
- Profile and test performance for large datasets.
- Prefer stateless, idempotent methods for scalability.
- Document any known performance bottlenecks or trade-offs.

---

## 6. Large Refactors & Migrations
- Plan refactors in phases: types/schemas, logic, tests, docs.
- Use feature flags or toggles for risky changes.
- Update all tests and docs after any breaking change.
- Communicate changes to the team and review with seniors.
- Always run typecheck, lint, and full test suite after each phase.
- Document migration steps and rationale in the PR or migration guide.

---

## 7. Visual Checklist: Building a Service

1. **Define Zod schemas and infer types**
2. **Extend BaseService** with correct generics
3. **Implement permission hooks** (use base helpers if possible)
4. **Implement lifecycle hooks** (optional, for side effects)
5. **Add custom methods if needed**
6. **Validate all input and actor**
7. **Use runWithLoggingAndValidation for all public methods**
8. **Throw ServiceError for all errors**
9. **Write/Update robust, DRY, type-safe tests**
10. **Document all public methods and custom logic**
11. **Run typecheck, lint, and tests**
12. **Ask for review if unsure!**

---

## 8. Complete Example: AccommodationService

```ts
// 1. Define schemas and types
import { z } from 'zod';
export const NewAccommodationInputSchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  type: z.enum(['HOTEL', 'HOSTEL', 'APARTMENT']),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
});
export type NewAccommodationInput = z.infer<typeof NewAccommodationInputSchema>;

// 2. Implement the service
import { BaseService, ServiceError } from '@repo/service-core';
import { AccommodationModel } from '@repo/db';
import type { AccommodationType } from '@repo/types';

export class AccommodationService extends BaseService<
  AccommodationType,
  AccommodationModel,
  typeof NewAccommodationInputSchema,
  typeof NewAccommodationInputSchema,
  unknown
> {
  protected readonly entityName = 'accommodation';
  protected readonly model: AccommodationModel;
  protected readonly createSchema = NewAccommodationInputSchema;
  protected readonly updateSchema = NewAccommodationInputSchema;
  protected readonly searchSchema = undefined;

  constructor(model?: AccommodationModel) {
    super();
    this.model = model ?? new AccommodationModel();
  }

  protected _canCreate(actor, data) {
    if (!actor || actor.role !== 'ADMIN') throw new ServiceError('FORBIDDEN', 'Only admins can create.');
    return true;
  }
  protected _canView(actor, entity) {
    if (entity.visibility === 'PUBLIC') return true;
    if (actor && actor.role === 'ADMIN') return true;
    throw new ServiceError('FORBIDDEN', 'Not allowed to view.');
  }

  public async create(actor, input) {
    this._canCreate(actor, input);
    const validated = this.createSchema.parse(input);
    return await this.model.create(validated);
  }

  public async getById(actor, { id }) {
    const entity = await this.model.findById(id);
    this._canView(actor, entity);
    return entity;
  }
}
```

---

## 9. Advanced Examples

### Batch Operations
```ts
public async batchUpdateVisibility(actor: Actor, ids: string[], visibility: VisibilityEnum) {
  this._canUpdateVisibility(actor, null, visibility);
  // Validate all IDs, fetch entities, check permissions in bulk
  // Perform batch update in the model
  return await this.model.updateMany({ id: { in: ids } }, { visibility });
}
```

### Custom Queries
```ts
public async findByCustomCriteria(actor: Actor, criteria: CustomCriteria) {
  this._canSearch(actor);
  // Compose query based on criteria
  return await this.model.findCustom(criteria);
}
```

### Advanced Hooks
```ts
protected async _beforeCreate(data, actor) {
  // Enrich data, audit, or trigger side effects
  if (!data.slug) data.slug = slugify(data.name);
  return data;
}

protected async _afterCreate(entity, actor) {
  // Trigger async jobs, notifications, etc.
  await this.notificationService.sendCreatedNotification(entity, actor);
}
```

### Composing Permissions
```ts
protected _canUpdate(actor, entity) {
  if (this.isAdmin(actor)) return true;
  if (this.isOwner(actor, entity)) return true;
  if (entity.visibility === 'PUBLIC') return true;
  return false;
}
```

### Integrating with Other Services
```ts
public async createWithRelated(actor, input) {
  this._canCreate(actor, input);
  const entity = await this.create(actor, input);
  await this.relatedService.linkToEntity(entity.id, input.relatedId);
  return entity;
}
```

---

## 10. Troubleshooting & FAQ

**Q: My service throws a raw error or returns inconsistent errors.**
A: Always throw `ServiceError` with a code. Never throw raw errors.

**Q: How do I add a new permission or lifecycle hook?**
A: Override the relevant method in your service, and document why.

**Q: How do I keep Zod schemas and TypeScript types in sync?**
A: Always infer types from Zod schemas (`z.infer<typeof MySchema>`).

**Q: How do I test my service?**
A: See [Testing Guide](../../test/README.testing.md) for full patterns, helpers, and coverage checklist.

**Q: How do I extend the pattern for batch/custom operations?**
A: Add new helpers to `BaseService` or utility modules, and document them.

---

## 11. Extending & Scaling
- For advanced use cases (batch ops, custom queries), add helpers to `BaseService` or utility modules.
- Compose permission helpers for complex logic.
- Document all customizations and deviations from the base pattern.

---

## 12. Resources & References
- [Testing Guide](../../test/README.testing.md)
- [BaseService API](../base/base.service.ts)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Zod Documentation](https://zod.dev/)

---

## 13. Quality Checklist
- [ ] All Zod schemas and types are defined and in sync
- [ ] All required hooks and properties are implemented
- [ ] All errors use `ServiceError` and codes
- [ ] No `any` or implicit types
- [ ] All public methods are documented with JSDoc
- [ ] Tests are written and pass (see [Testing Guide](../../test/README.testing.md))
- [ ] All code follows naming and architectural conventions
- [ ] All logic is robust, DRY, and type-safe

---

## 14. Glossary
- **Service:** Class encapsulating business logic for a domain entity
- **BaseService:** Abstract class all services extend, providing common logic
- **Factory/Builder:** Utility for generating test data or mocks in a DRY, type-safe way
- **Zod:** Runtime validation library used for all schemas
- **RO-RO Pattern:** Receive Object / Return Object—public methods always take and return objects
- **SOLID:** Set of design principles for maintainable, extensible code
- **Batch Operation:** Performing an action on multiple entities in a single call (e.g., updateMany)
- **Custom Query:** Querying the model with non-standard or dynamic criteria
- **Lifecycle Hook:** Method called before/after a main action (e.g., _beforeCreate, _afterUpdate)
- **Permission Composition:** Combining multiple permission checks for flexible access control
- **Integration:** Calling or coordinating with other services or modules
- **Audit Trail:** Recording actions or changes for traceability
- **Side Effect:** An action triggered as a result of a service method (e.g., sending notifications)
- **Feature Flag:** Mechanism to enable/disable features or code paths at runtime
- **Idempotent:** An operation that can be performed multiple times without changing the result
- **Stateless:** Service methods that do not rely on internal state between calls 