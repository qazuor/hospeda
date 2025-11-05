# BaseCrudService API Reference

Complete API documentation for the `BaseCrudService` class, the foundation of all service classes in the Hospeda platform.

## Table of Contents

- [Overview](#overview)
- [Class Signature](#class-signature)
- [Constructor](#constructor)
- [Public Methods](#public-methods)
  - [CRUD Operations](#crud-operations)
  - [Retrieval Methods](#retrieval-methods)
  - [Deletion and Restoration](#deletion-and-restoration)
  - [Search and Count](#search-and-count)
  - [Special Operations](#special-operations)
- [Protected Methods](#protected-methods)
  - [Permission Hooks](#permission-hooks)
  - [Lifecycle Hooks](#lifecycle-hooks)
  - [Core Logic Methods](#core-logic-methods)
- [Properties](#properties)
- [Type Parameters](#type-parameters)

## Overview

`BaseCrudService` is an abstract base class that provides a complete, standardized implementation for all CRUD (Create, Read, Update, Delete) operations in the service layer. It orchestrates the entire service lifecycle including:

- Input validation using Zod schemas
- Permission checking via abstract hooks
- Data normalization
- Lifecycle hooks (before/after operations)
- Error handling with `ServiceOutput<T>` pattern
- Automatic logging

All concrete service classes extend `BaseCrudService` and implement the required abstract methods to define entity-specific behavior.

**Key Features:**

- Type-safe operations with full TypeScript inference
- Consistent error handling (never throws, returns `ServiceOutput`)
- Extensible via hooks and normalizers
- Permission system integration
- Soft delete support with restoration
- Paginated list and search operations
- Admin metadata management

## Class Signature

```typescript
export abstract class BaseCrudService<
  TEntity extends { id: string; deletedAt?: Date | null },
  TModel extends BaseModel<TEntity>,
  TCreateSchema extends ZodObject,
  TUpdateSchema extends ZodObject,
  TSearchSchema extends ZodObject
> extends BaseService<CrudNormalizers<z.infer<TCreateSchema>, z.infer<TUpdateSchema>, z.infer<TSearchSchema>>>
```

### Generic Type Parameters

| Type | Constraint | Description |
|------|------------|-------------|
| `TEntity` | `{ id: string; deletedAt?: Date \| null }` | The entity type (database row). Must have `id` and optional `deletedAt` for soft delete support |
| `TModel` | `BaseModel<TEntity>` | The model class that provides database operations |
| `TCreateSchema` | `ZodObject` | Zod schema for validating create operations |
| `TUpdateSchema` | `ZodObject` | Zod schema for validating update operations |
| `TSearchSchema` | `ZodObject` | Zod schema for validating search/filter operations |

## Constructor

```typescript
constructor(ctx: ServiceContext, entityName: string)
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| ctx | ServiceContext | Yes | Service context containing logger and optional configuration |
| entityName | string | Yes | Name of the entity (used in logs and error messages) |

**Example:**

```typescript
import { BaseCrudService } from '@repo/service-core';
import { AccommodationModel } from '@repo/db';
import type { Accommodation } from '@repo/db';
import { CreateAccommodationSchema, UpdateAccommodationSchema, SearchAccommodationSchema } from '@repo/schemas';

export class AccommodationService extends BaseCrudService<
  Accommodation,
  AccommodationModel,
  typeof CreateAccommodationSchema,
  typeof UpdateAccommodationSchema,
  typeof SearchAccommodationSchema
> {
  protected readonly model: AccommodationModel;
  protected readonly createSchema = CreateAccommodationSchema;
  protected readonly updateSchema = UpdateAccommodationSchema;
  protected readonly searchSchema = SearchAccommodationSchema;

  constructor(ctx: ServiceContext, model?: AccommodationModel) {
    super(ctx, 'Accommodation');
    this.model = model ?? new AccommodationModel();
  }

  // Implement abstract methods...
}
```

## Public Methods

### CRUD Operations

#### create

Creates a new entity following the full lifecycle pipeline.

**Signature:**

```typescript
async create(
  actor: Actor,
  data: z.infer<TCreateSchema>
): Promise<ServiceOutput<TEntity>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| data | z.infer\<TCreateSchema\> | Yes | Input data matching the create schema |

**Returns:**

`Promise<ServiceOutput<TEntity>>` - Result containing the created entity or an error.

**Lifecycle:**

1. Validates input against `createSchema`
2. Calls `_canCreate` permission hook
3. Applies `create` normalizer (if defined)
4. Calls `_beforeCreate` lifecycle hook
5. Creates entity in database
6. Calls `_afterCreate` lifecycle hook

**Example:**

```typescript
const result = await service.create(actor, {
  name: 'Hotel Paradise',
  description: 'A beautiful beachfront hotel',
  city: 'Concepción del Uruguay',
  priceRange: '$$'
});

if (result.data) {
  console.log('Created:', result.data.id);
} else {
  console.error('Error:', result.error.message);
}
```

**Errors:**

- `VALIDATION_ERROR` - Input validation failed
- `FORBIDDEN` - Actor lacks create permission
- `INTERNAL_ERROR` - Database operation failed

---

#### update

Updates an existing entity by ID.

**Signature:**

```typescript
async update(
  actor: Actor,
  id: string,
  data: z.infer<TUpdateSchema>
): Promise<ServiceOutput<TEntity>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| id | string | Yes | UUID of the entity to update |
| data | z.infer\<TUpdateSchema\> | Yes | Update data matching the update schema |

**Returns:**

`Promise<ServiceOutput<TEntity>>` - Result containing the updated entity or an error.

**Lifecycle:**

1. Validates input against `updateSchema`
2. Fetches entity by ID
3. Calls `_canUpdate` permission hook
4. Applies `update` normalizer (if defined)
5. Calls `_beforeUpdate` lifecycle hook
6. Updates entity in database
7. Calls `_afterUpdate` lifecycle hook

**Example:**

```typescript
const result = await service.update(actor, 'accommodation-uuid', {
  name: 'Hotel Paradise Beach',
  priceRange: '$$$'
});

if (result.data) {
  console.log('Updated:', result.data.name);
} else if (result.error.code === ServiceErrorCode.NOT_FOUND) {
  console.error('Accommodation not found');
} else {
  console.error('Error:', result.error.message);
}
```

**Errors:**

- `VALIDATION_ERROR` - Input validation failed or no valid fields provided
- `NOT_FOUND` - Entity does not exist
- `FORBIDDEN` - Actor lacks update permission
- `INTERNAL_ERROR` - Database operation failed

**Notes:**

- Audit fields (`createdAt`, `updatedAt`, etc.) are automatically filtered
- If no valid fields are provided (after filtering), returns `VALIDATION_ERROR`
- `updatedById` is automatically set to `actor.id`

---

### Retrieval Methods

#### getByField

Generic method to fetch an entity by any field.

**Signature:**

```typescript
async getByField(
  actor: Actor,
  field: string,
  value: unknown
): Promise<ServiceOutput<TEntity | null>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| field | string | Yes | Database field name to query (e.g., 'id', 'slug') |
| value | unknown | Yes | Value to match for the field |

**Returns:**

`Promise<ServiceOutput<TEntity | null>>` - Result containing the found entity, null if not found, or an error.

**Lifecycle:**

1. Applies `view` normalizer to field/value (if defined)
2. Calls `_beforeGetByField` hook
3. Queries database
4. Calls `_canView` permission hook if entity found
5. Calls `_afterGetByField` hook

**Example:**

```typescript
// Fetch by slug
const result = await service.getByField(actor, 'slug', 'hotel-paradise');

if (result.data) {
  console.log('Found:', result.data.name);
} else if (result.error.code === ServiceErrorCode.NOT_FOUND) {
  console.log('Entity not found');
}
```

**Errors:**

- `NOT_FOUND` - Entity does not exist
- `FORBIDDEN` - Actor lacks view permission

**Breaking Change Note:**

> **[2024-06-27]** This method now throws `NOT_FOUND` error instead of returning `{ data: null }` when entity is not found. This ensures consistent error handling across all service methods.

---

#### getById

Convenience method to fetch an entity by ID.

**Signature:**

```typescript
async getById(
  actor: Actor,
  id: string
): Promise<ServiceOutput<TEntity | null>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| id | string | Yes | UUID of the entity |

**Returns:**

`Promise<ServiceOutput<TEntity | null>>` - Result containing the entity or an error.

**Example:**

```typescript
const result = await service.getById(actor, 'uuid-here');
```

**Note:** This is a wrapper around `getByField(actor, 'id', id)`.

---

#### getBySlug

Convenience method to fetch an entity by slug.

**Signature:**

```typescript
async getBySlug(
  actor: Actor,
  slug: string
): Promise<ServiceOutput<TEntity | null>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| slug | string | Yes | URL-friendly slug of the entity |

**Returns:**

`Promise<ServiceOutput<TEntity | null>>` - Result containing the entity or an error.

**Example:**

```typescript
const result = await service.getBySlug(actor, 'hotel-paradise-beach');
```

**Note:** This is a wrapper around `getByField(actor, 'slug', slug)`.

---

#### getByName

Convenience method to fetch an entity by name.

**Signature:**

```typescript
async getByName(
  actor: Actor,
  name: string
): Promise<ServiceOutput<TEntity | null>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| name | string | Yes | Name of the entity |

**Returns:**

`Promise<ServiceOutput<TEntity | null>>` - Result containing the entity or an error.

**Example:**

```typescript
const result = await service.getByName(actor, 'Hotel Paradise');
```

**Note:** This is a wrapper around `getByField(actor, 'name', name)`.

---

#### list

Fetches a paginated list of all entities.

**Signature:**

```typescript
async list(
  actor: Actor,
  options: { page?: number; pageSize?: number; relations?: ListRelationsConfig } = {}
): Promise<ServiceOutput<PaginatedListOutput<TEntity>>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| options | object | No | Pagination and relations configuration |
| options.page | number | No | Page number (default: 1) |
| options.pageSize | number | No | Items per page |
| options.relations | ListRelationsConfig | No | Relations to include (overrides defaults) |

**Returns:**

`Promise<ServiceOutput<PaginatedListOutput<TEntity>>>` - Result containing paginated list or an error.

**Return Type:**

```typescript
type PaginatedListOutput<T> = {
  items: T[];
  total: number;
}
```

**Lifecycle:**

1. Validates input
2. Calls `_canList` permission hook
3. Applies `list` normalizer (if defined)
4. Calls `_beforeList` hook
5. Fetches entities from database (with relations if specified)
6. Calls `_afterList` hook

**Example:**

```typescript
const result = await service.list(actor, {
  page: 1,
  pageSize: 20,
  relations: { creator: true, category: true }
});

if (result.data) {
  console.log(`Found ${result.data.items.length} of ${result.data.total} items`);
  result.data.items.forEach(item => console.log(item.name));
}
```

**Errors:**

- `VALIDATION_ERROR` - Invalid pagination parameters
- `FORBIDDEN` - Actor lacks list permission

**Notes:**

- If `relations` is not provided, uses `getDefaultListRelations()`
- If no relations are specified, uses standard `findAll` (more efficient)

---

### Deletion and Restoration

#### softDelete

Marks an entity as deleted without removing it from the database.

**Signature:**

```typescript
async softDelete(
  actor: Actor,
  id: string
): Promise<ServiceOutput<{ count: number }>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| id | string | Yes | UUID of the entity to soft-delete |

**Returns:**

`Promise<ServiceOutput<{ count: number }>>` - Result containing count of affected rows (0 or 1).

**Lifecycle:**

1. Fetches entity by ID
2. Calls `_canSoftDelete` permission hook
3. Returns early if entity already deleted (count: 0)
4. Calls `_beforeSoftDelete` hook
5. Sets `deletedAt` timestamp
6. Calls `_afterSoftDelete` hook

**Example:**

```typescript
const result = await service.softDelete(actor, 'uuid-here');

if (result.data) {
  if (result.data.count === 1) {
    console.log('Entity deleted');
  } else {
    console.log('Entity was already deleted');
  }
}
```

**Errors:**

- `NOT_FOUND` - Entity does not exist
- `FORBIDDEN` - Actor lacks soft-delete permission

**Notes:**

- Soft-deleted entities can be restored using `restore()`
- Entities retain all data and can be queried with `deletedAt` filter

---

#### hardDelete

Permanently removes an entity from the database.

**Signature:**

```typescript
async hardDelete(
  actor: Actor,
  id: string
): Promise<ServiceOutput<{ count: number }>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| id | string | Yes | UUID of the entity to permanently delete |

**Returns:**

`Promise<ServiceOutput<{ count: number }>>` - Result containing count of affected rows.

**Lifecycle:**

1. Fetches entity by ID
2. Calls `_canHardDelete` permission hook
3. Returns early if entity already deleted (count: 0)
4. Calls `_beforeHardDelete` hook
5. Deletes entity from database
6. Calls `_afterHardDelete` hook

**Example:**

```typescript
const result = await service.hardDelete(actor, 'uuid-here');

if (result.data?.count === 1) {
  console.log('Entity permanently deleted');
}
```

**Errors:**

- `NOT_FOUND` - Entity does not exist
- `FORBIDDEN` - Actor lacks hard-delete permission

**Warning:** This operation is irreversible. All entity data is permanently lost.

---

#### restore

Restores a soft-deleted entity.

**Signature:**

```typescript
async restore(
  actor: Actor,
  id: string
): Promise<ServiceOutput<{ count: number }>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| id | string | Yes | UUID of the entity to restore |

**Returns:**

`Promise<ServiceOutput<{ count: number }>>` - Result containing count of affected rows.

**Lifecycle:**

1. Fetches entity by ID
2. Calls `_canRestore` permission hook
3. Returns early if entity not deleted (count: 0)
4. Calls `_beforeRestore` hook
5. Clears `deletedAt` timestamp
6. Calls `_afterRestore` hook

**Example:**

```typescript
const result = await service.restore(actor, 'uuid-here');

if (result.data?.count === 1) {
  console.log('Entity restored');
} else {
  console.log('Entity was not deleted');
}
```

**Errors:**

- `NOT_FOUND` - Entity does not exist
- `FORBIDDEN` - Actor lacks restore permission
- `INTERNAL_ERROR` - Hook or database operation failed

---

### Search and Count

#### search

Performs a search for entities based on filters, sorting, and pagination.

**Signature:**

```typescript
async search(
  actor: Actor,
  params: z.infer<TSearchSchema>
): Promise<ServiceOutput<PaginatedListOutput<TEntity>>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| params | z.infer\<TSearchSchema\> | Yes | Search parameters (filters, sorting, pagination) |

**Returns:**

`Promise<ServiceOutput<PaginatedListOutput<TEntity>>>` - Result containing paginated search results.

**Lifecycle:**

1. Validates input against `searchSchema`
2. Calls `_canSearch` permission hook
3. Applies `search` normalizer (if defined)
4. Calls `_beforeSearch` hook
5. Delegates to `_executeSearch` (implemented by child service)
6. Calls `_afterSearch` hook

**Example:**

```typescript
const result = await service.search(actor, {
  q: 'beach hotel',
  city: 'Concepción',
  minPrice: 100,
  maxPrice: 500,
  page: 1,
  pageSize: 20,
  sortBy: 'rating',
  sortOrder: 'desc'
});

if (result.data) {
  console.log(`Found ${result.data.total} results`);
  result.data.items.forEach(item => console.log(item.name));
}
```

**Errors:**

- `VALIDATION_ERROR` - Invalid search parameters
- `FORBIDDEN` - Actor lacks search permission

**Notes:**

- Concrete services must implement `_executeSearch` to define search logic
- Search parameters are fully customizable per entity type

---

#### count

Counts entities matching the search criteria.

**Signature:**

```typescript
async count(
  actor: Actor,
  params: z.infer<TSearchSchema>
): Promise<ServiceOutput<{ count: number }>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| params | z.infer\<TSearchSchema\> | Yes | Search parameters (only filters are used) |

**Returns:**

`Promise<ServiceOutput<{ count: number }>>` - Result containing entity count.

**Lifecycle:**

1. Validates input against `searchSchema`
2. Calls `_canCount` permission hook
3. Calls `_beforeCount` hook
4. Delegates to `_executeCount` (implemented by child service)
5. Calls `_afterCount` hook

**Example:**

```typescript
const result = await service.count(actor, {
  city: 'Concepción',
  isActive: true
});

if (result.data) {
  console.log(`Total: ${result.data.count} entities`);
}
```

**Errors:**

- `VALIDATION_ERROR` - Invalid search parameters
- `FORBIDDEN` - Actor lacks count permission

**Notes:**

- Concrete services must implement `_executeCount`
- Pagination parameters are ignored (only filters matter)

---

### Special Operations

#### updateVisibility

Updates the visibility status of an entity.

**Signature:**

```typescript
async updateVisibility(
  actor: Actor,
  id: string,
  visibility: VisibilityEnum
): Promise<ServiceOutput<TEntity>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| actor | Actor | Yes | The user or system performing the action |
| id | string | Yes | UUID of the entity |
| visibility | VisibilityEnum | Yes | New visibility state |

**Returns:**

`Promise<ServiceOutput<TEntity>>` - Result containing updated entity.

**Lifecycle:**

1. Fetches entity by ID
2. Calls `_canUpdateVisibility` permission hook
3. Calls `_beforeUpdateVisibility` hook
4. Updates visibility in database
5. Calls `_afterUpdateVisibility` hook

**Example:**

```typescript
import { VisibilityEnum } from '@repo/schemas';

const result = await service.updateVisibility(
  actor,
  'uuid-here',
  VisibilityEnum.PRIVATE
);

if (result.data) {
  console.log(`Visibility updated to ${result.data.visibility}`);
}
```

**Errors:**

- `NOT_FOUND` - Entity does not exist
- `FORBIDDEN` - Actor lacks visibility update permission
- `INTERNAL_ERROR` - Hook or database operation failed

---

#### setFeaturedStatus

Sets the featured status of an entity.

**Signature:**

```typescript
async setFeaturedStatus(
  input: ServiceInput<{ id: string; isFeatured: boolean }>
): Promise<ServiceOutput<{ updated: boolean }>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | ServiceInput\<{ id: string; isFeatured: boolean }\> | Yes | Input containing actor, id, and featured status |

**Returns:**

`Promise<ServiceOutput<{ updated: boolean }>>` - Result indicating if update occurred.

**Example:**

```typescript
const result = await service.setFeaturedStatus({
  actor,
  id: 'uuid-here',
  isFeatured: true
});

if (result.data?.updated) {
  console.log('Featured status changed');
} else {
  console.log('Status was already set');
}
```

**Errors:**

- `NOT_FOUND` - Entity does not exist
- `FORBIDDEN` - Actor lacks update permission

**Notes:**

- Returns `{ updated: false }` if status already matches
- Requires entity to have `isFeatured` property

---

#### getAdminInfo

Retrieves admin metadata for an entity.

**Signature:**

```typescript
async getAdminInfo(
  input: ServiceInput<{ id: string }>
): Promise<ServiceOutput<{ adminInfo: unknown }>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | ServiceInput\<{ id: string }\> | Yes | Input containing actor and entity id |

**Returns:**

`Promise<ServiceOutput<{ adminInfo: unknown }>>` - Result containing admin metadata.

**Example:**

```typescript
const result = await service.getAdminInfo({ actor, id: 'uuid-here' });

if (result.data) {
  console.log('Admin info:', result.data.adminInfo);
}
```

**Errors:**

- `NOT_FOUND` - Entity does not exist
- `FORBIDDEN` - Actor lacks update permission (admin info requires update access)

---

#### setAdminInfo

Sets admin metadata for an entity.

**Signature:**

```typescript
async setAdminInfo(
  input: ServiceInput<{ id: string; adminInfo: AdminInfoType }>
): Promise<ServiceOutput<{ adminInfo: AdminInfoType }>>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| input | ServiceInput\<{ id: string; adminInfo: AdminInfoType }\> | Yes | Input containing actor, id, and admin info |

**Returns:**

`Promise<ServiceOutput<{ adminInfo: AdminInfoType }>>` - Result containing normalized admin info.

**Example:**

```typescript
const result = await service.setAdminInfo({
  actor,
  id: 'uuid-here',
  adminInfo: {
    notes: 'Verified provider',
    flags: ['premium'],
    metadata: { source: 'import' }
  }
});

if (result.data) {
  console.log('Admin info updated:', result.data.adminInfo);
}
```

**Errors:**

- `NOT_FOUND` - Entity does not exist
- `VALIDATION_ERROR` - Invalid admin info format
- `FORBIDDEN` - Actor lacks update permission

**Notes:**

- Admin info is automatically normalized before storage
- Only users with update permission can access admin info

---

## Protected Methods

### Permission Hooks

These abstract methods must be implemented by concrete services to define permission logic.

#### _canCreate

```typescript
protected abstract _canCreate(
  actor: Actor,
  data: z.infer<TCreateSchema>
): Promise<void> | void
```

Checks if actor has permission to create an entity with the given data.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

#### _canUpdate

```typescript
protected abstract _canUpdate(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

Checks if actor has permission to update the given entity.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

#### _canSoftDelete

```typescript
protected abstract _canSoftDelete(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

Checks if actor has permission to soft-delete the given entity.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

#### _canHardDelete

```typescript
protected abstract _canHardDelete(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

Checks if actor has permission to permanently delete the given entity.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

#### _canRestore

```typescript
protected abstract _canRestore(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

Checks if actor has permission to restore the given entity.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

#### _canView

```typescript
protected abstract _canView(
  actor: Actor,
  entity: TEntity
): Promise<void> | void
```

Checks if actor has permission to view the given entity.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

**Note:** Called after entity is fetched, allowing property-based checks (ownership, visibility, etc.).

---

#### _canList

```typescript
protected abstract _canList(
  actor: Actor
): Promise<void> | void
```

Checks if actor has permission to list entities.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

#### _canSearch

```typescript
protected abstract _canSearch(
  actor: Actor
): Promise<void> | void
```

Checks if actor has permission to search entities.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

#### _canCount

```typescript
protected abstract _canCount(
  actor: Actor
): Promise<void> | void
```

Checks if actor has permission to count entities.

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

#### _canUpdateVisibility

```typescript
protected abstract _canUpdateVisibility(
  actor: Actor,
  entity: TEntity,
  newVisibility: VisibilityEnum
): Promise<void> | void
```

Checks if actor has permission to update entity visibility.

**Parameters:**

- `actor` - User performing the action
- `entity` - Entity being updated
- `newVisibility` - Target visibility state

**When to throw:** When permission is denied
**Error code:** `FORBIDDEN`

---

### Lifecycle Hooks

These methods can be overridden to add custom logic at specific points in the operation lifecycle.

#### _beforeCreate

```typescript
protected async _beforeCreate(
  data: z.infer<TCreateSchema>,
  _actor: Actor
): Promise<Partial<TEntity>>
```

Executed after normalization but before database insertion.

**Use cases:**

- Generate slugs
- Hash passwords
- Calculate derived fields
- Set default values

**Example:**

```typescript
protected async _beforeCreate(data: CreateAccommodation, actor: Actor) {
  return {
    ...data,
    slug: slugify(data.name),
    status: 'draft',
    createdAt: new Date()
  };
}
```

---

#### _afterCreate

```typescript
protected async _afterCreate(
  entity: TEntity,
  _actor: Actor
): Promise<TEntity>
```

Executed after entity is created and fetched from database.

**Use cases:**

- Send notifications
- Create audit logs
- Trigger webhooks
- Index for search

**Example:**

```typescript
protected async _afterCreate(entity: Accommodation, actor: Actor) {
  await this.notificationService.send({
    type: 'accommodation.created',
    data: entity
  });
  return entity;
}
```

---

#### _beforeUpdate

```typescript
protected async _beforeUpdate(
  data: z.infer<TUpdateSchema>,
  _actor: Actor
): Promise<Partial<TEntity>>
```

Executed after normalization but before database update.

**Use cases:**

- Validate business rules
- Update computed fields
- Handle special field logic

**Example:**

```typescript
protected async _beforeUpdate(data: UpdateAccommodation, actor: Actor) {
  const updates: Partial<Accommodation> = { ...data };

  // Update slug if name changed
  if (data.name) {
    updates.slug = slugify(data.name);
  }

  return updates;
}
```

---

#### _afterUpdate

```typescript
protected async _afterUpdate(
  entity: TEntity,
  _actor: Actor
): Promise<TEntity>
```

Executed after entity is updated.

**Use cases:**

- Clear caches
- Send notifications
- Update search index

---

#### _beforeGetByField

```typescript
protected async _beforeGetByField(
  field: string,
  value: unknown,
  _actor: Actor
): Promise<{ field: string; value: unknown }>
```

Executed before fetching entity by field.

**Use cases:**

- Transform query values
- Modify query field

---

#### _afterGetByField

```typescript
protected async _afterGetByField(
  entity: TEntity | null,
  _actor: Actor
): Promise<TEntity | null>
```

Executed after entity is fetched.

**Use cases:**

- Enrich entity data
- Transform fields

---

#### _beforeList

```typescript
protected async _beforeList(
  options: { page?: number; pageSize?: number; relations?: ListRelationsConfig },
  _actor: Actor
): Promise<{ page?: number; pageSize?: number; relations?: ListRelationsConfig }>
```

Executed before listing entities.

**Use cases:**

- Modify pagination
- Add filters based on actor

---

#### _afterList

```typescript
protected async _afterList(
  result: PaginatedListOutput<TEntity>,
  _actor: Actor
): Promise<PaginatedListOutput<TEntity>>
```

Executed after entities are listed.

**Use cases:**

- Filter results based on permissions
- Enrich entity data

---

#### _beforeSearch / _afterSearch

Similar to list hooks but for search operations.

---

#### _beforeSoftDelete / _afterSoftDelete

Executed before/after soft delete operations.

---

#### _beforeHardDelete / _afterHardDelete

Executed before/after hard delete operations.

---

#### _beforeRestore / _afterRestore

Executed before/after restore operations.

---

#### _beforeCount / _afterCount

Executed before/after count operations.

---

#### _beforeUpdateVisibility / _afterUpdateVisibility

Executed before/after visibility update.

---

### Core Logic Methods

#### _executeSearch

```typescript
protected abstract _executeSearch(
  params: z.infer<TSearchSchema>,
  actor: Actor
): Promise<PaginatedListOutput<TEntity>>
```

**Must be implemented by concrete services.**

Executes the actual database search query with filters, sorting, and pagination.

**Example:**

```typescript
protected async _executeSearch(
  params: SearchAccommodation,
  actor: Actor
): Promise<PaginatedListOutput<Accommodation>> {
  const { q, city, minPrice, maxPrice, page = 1, pageSize = 20 } = params;

  const where: Record<string, unknown> = { isActive: true };

  if (city) where.city = city;
  if (minPrice) where.minPrice = minPrice;
  if (maxPrice) where.maxPrice = maxPrice;

  return this.model.findAll(where, { page, pageSize });
}
```

---

#### _executeCount

```typescript
protected abstract _executeCount(
  params: z.infer<TSearchSchema>,
  actor: Actor
): Promise<{ count: number }>
```

**Must be implemented by concrete services.**

Executes the actual count query based on search filters.

**Example:**

```typescript
protected async _executeCount(
  params: SearchAccommodation,
  actor: Actor
): Promise<{ count: number }> {
  const { city, isActive = true } = params;

  const where: Record<string, unknown> = { isActive };
  if (city) where.city = city;

  const count = await this.model.count(where);
  return { count };
}
```

---

#### getDefaultListRelations

```typescript
protected abstract getDefaultListRelations(): ListRelationsConfig
```

**Must be implemented by concrete services.**

Defines which relations should be included by default when listing entities.

**Returns:** Relations configuration object or `undefined` for no relations.

**Example:**

```typescript
protected getDefaultListRelations(): ListRelationsConfig {
  return {
    creator: true,
    category: true,
    tags: { columns: { id: true, name: true } }
  };
}

// Or for no default relations:
protected getDefaultListRelations(): undefined {
  return undefined;
}
```

---

## Properties

### Protected Properties

#### model

```typescript
protected abstract readonly model: TModel
```

The model instance used for database operations. Must be initialized in the constructor.

---

#### createSchema

```typescript
protected abstract readonly createSchema: TCreateSchema
```

Zod schema for validating create operations.

---

#### updateSchema

```typescript
protected abstract readonly updateSchema: TUpdateSchema
```

Zod schema for validating update operations.

---

#### searchSchema

```typescript
protected abstract readonly searchSchema: TSearchSchema
```

Zod schema for validating search operations.

---

#### normalizers

```typescript
protected normalizers?: CrudNormalizers<
  z.infer<TCreateSchema>,
  z.infer<TUpdateSchema>,
  z.infer<TSearchSchema>
>
```

Optional normalizers for transforming input data before validation.

**Type:**

```typescript
type CrudNormalizers<TCreate, TUpdate, TSearch> = {
  create?: (data: TCreate, actor: Actor) => TCreate | Promise<TCreate>;
  update?: (data: TUpdate, actor: Actor) => TUpdate | Promise<TUpdate>;
  list?: (params: ListOptions, actor: Actor) => ListOptions | Promise<ListOptions>;
  view?: (field: string, value: unknown, actor: Actor) =>
    { field: string; value: unknown } | Promise<{ field: string; value: unknown }>;
  search?: (params: TSearch, actor: Actor) => TSearch | Promise<TSearch>;
}
```

---

#### logger

```typescript
protected readonly logger: ServiceLogger
```

Logger instance from service context. Inherited from `BaseService`.

---

#### entityName

```typescript
protected readonly entityName: string
```

Name of the entity (used in logs and error messages). Inherited from `BaseService`.

---

## Complete Example

Here's a complete example showing how to extend `BaseCrudService`:

```typescript
import { BaseCrudService } from '@repo/service-core';
import { AccommodationModel } from '@repo/db';
import type { Accommodation } from '@repo/db';
import {
  CreateAccommodationSchema,
  UpdateAccommodationSchema,
  SearchAccommodationSchema,
  PermissionEnum
} from '@repo/schemas';
import type { ServiceContext, Actor } from '@repo/service-core/types';

export class AccommodationService extends BaseCrudService<
  Accommodation,
  AccommodationModel,
  typeof CreateAccommodationSchema,
  typeof UpdateAccommodationSchema,
  typeof SearchAccommodationSchema
> {
  protected readonly model: AccommodationModel;
  protected readonly createSchema = CreateAccommodationSchema;
  protected readonly updateSchema = UpdateAccommodationSchema;
  protected readonly searchSchema = SearchAccommodationSchema;

  constructor(ctx: ServiceContext, model?: AccommodationModel) {
    super(ctx, 'Accommodation');
    this.model = model ?? new AccommodationModel();
  }

  // Permission hooks
  protected async _canCreate(actor: Actor, data: any): Promise<void> {
    if (!actor.permissions.includes(PermissionEnum.CREATE_ACCOMMODATION)) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'No permission to create accommodations'
      );
    }
  }

  protected async _canUpdate(actor: Actor, entity: Accommodation): Promise<void> {
    if (
      entity.createdById !== actor.id &&
      !actor.permissions.includes(PermissionEnum.UPDATE_ANY_ACCOMMODATION)
    ) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'No permission to update this accommodation'
      );
    }
  }

  protected async _canSoftDelete(actor: Actor, entity: Accommodation): Promise<void> {
    if (entity.createdById !== actor.id && actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'No permission to delete this accommodation'
      );
    }
  }

  protected async _canHardDelete(actor: Actor, entity: Accommodation): Promise<void> {
    if (actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only admins can permanently delete accommodations'
      );
    }
  }

  protected async _canRestore(actor: Actor, entity: Accommodation): Promise<void> {
    if (entity.createdById !== actor.id && actor.role !== RoleEnum.ADMIN) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'No permission to restore this accommodation'
      );
    }
  }

  protected async _canView(actor: Actor, entity: Accommodation): Promise<void> {
    if (entity.visibility === VisibilityEnum.PRIVATE && entity.createdById !== actor.id) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'No permission to view this accommodation'
      );
    }
  }

  protected async _canList(actor: Actor): Promise<void> {
    // List is public
  }

  protected async _canSearch(actor: Actor): Promise<void> {
    // Search is public
  }

  protected async _canCount(actor: Actor): Promise<void> {
    // Count is public
  }

  protected async _canUpdateVisibility(
    actor: Actor,
    entity: Accommodation,
    newVisibility: VisibilityEnum
  ): Promise<void> {
    if (entity.createdById !== actor.id) {
      throw new ServiceError(
        ServiceErrorCode.FORBIDDEN,
        'Only owner can change visibility'
      );
    }
  }

  // Lifecycle hooks
  protected async _beforeCreate(data: any, actor: Actor): Promise<Partial<Accommodation>> {
    return {
      ...data,
      slug: slugify(data.name),
      status: 'draft'
    };
  }

  protected async _afterCreate(entity: Accommodation, actor: Actor): Promise<Accommodation> {
    // Send notification
    await this.notificationService.sendAccommodationCreated(entity);
    return entity;
  }

  // Search implementation
  protected async _executeSearch(params: any, actor: Actor): Promise<PaginatedListOutput<Accommodation>> {
    const { q, city, minPrice, maxPrice, page = 1, pageSize = 20 } = params;

    const where: Record<string, unknown> = { isActive: true };
    if (city) where.city = city;
    if (minPrice) where.minPrice = minPrice;
    if (maxPrice) where.maxPrice = maxPrice;

    return this.model.findAll(where, { page, pageSize });
  }

  protected async _executeCount(params: any, actor: Actor): Promise<{ count: number }> {
    const { city, isActive = true } = params;
    const where: Record<string, unknown> = { isActive };
    if (city) where.city = city;
    const count = await this.model.count(where);
    return { count };
  }

  protected getDefaultListRelations() {
    return {
      creator: true,
      category: true
    };
  }
}
```

---

## See Also

- [ServiceOutput API Reference](./ServiceOutput.md) - Result type and error handling
- [Error Handling Guide](./errors.md) - Error codes and patterns
- [Service Guide](../guides/services.md) - How to create services
- [CLAUDE.md](../CLAUDE.md) - Complete usage examples
