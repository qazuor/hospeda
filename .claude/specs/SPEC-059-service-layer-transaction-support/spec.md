# SPEC-059: Service-Layer Transaction Support & Concurrency Safety

> **Status**: draft
> **Priority**: P1
> **Complexity**: High
> **Origin**: SPEC-053 gaps (GAP-010, GAP-013/025, GAP-014, GAP-029, GAP-034, GAP-055, GAP-057, GAP-058, GAP-063, GAP-064, GAP-065)
> **Created**: 2026-04-01
> **Updated**: 2026-04-02 (audit pass 6: fixed section numbering 9→8/8→9; added _getAndValidateEntity to ctx threading plan; fixed dependency header -- SPEC-060 is not a dependent; fixed hookState collision caveat explanation; added idle_in_transaction_session_timeout as explicit Phase 1 step; removed unnecessary ServiceContext_DEPRECATED alias per YAGNI)
> **ADR**: ADR-018 (Transaction Propagation via Context Object Pattern)
> **Depends on**: SPEC-058 (BaseModel interface alignment, defines `QueryContext` and `DrizzleClient`)
> **Dependents**: SPEC-061 (Integration tests), SPEC-064 (Billing transaction safety)
> **Coordinates with**: SPEC-060 (Model-layer tx propagation -- runs in parallel for Phases 1-3; SPEC-059 Phase 4 depends on SPEC-060 completion)

---

## Problem Statement

`BaseCrudService` has zero transaction support. No service method accepts or propagates a transaction context. This causes four categories of bugs:

### 1. Non-atomic multi-writes

Lifecycle hooks (`_afterCreate`, `_afterUpdate`, `_afterSoftDelete`, `_afterRestore`) perform cross-entity writes (stats recalculation, accommodation count updates, descendant path cascades) that can partially fail, leaving the database in an inconsistent state.

**Example**: `DestinationService._afterUpdate` schedules revalidation after `_beforeUpdate` sets `_pendingPathUpdate`. If the descendant path cascade in the overridden `update()` method (`destination.service.ts:516`) fails after the parent update has already committed, the parent has a new path but its descendants still reference the old path.

### 2. Singleton mutable state under concurrent requests

Six services store mutable state in `private` instance fields to pass data between `_before*` and `_after*` hooks. Since Node.js services are singletons (one instance per process), concurrent requests interleave on the event loop. Request A writes to `_lastDeletedEntity`, then yields at an `await`. Request B overwrites `_lastDeletedEntity` with its own value. Request A resumes and reads Request B's data.

### 3. Error swallowing prevents transaction rollback

`runWithLoggingAndValidation` in `base.service.ts:103-107` catches `ServiceError` and returns `{ error }` instead of rethrowing:

```typescript
// base.service.ts:103-106
catch (error) {
    if (error instanceof ServiceError) {
        logError(`${this.entityName}.${methodName}`, error, params, actor);
        return { error };  // <-- Swallows the error, prevents tx rollback
    }
```

When a service method runs inside a `withTransaction` block, this catch prevents the error from propagating to the transaction wrapper, so the transaction commits partial writes instead of rolling back.

### 4. TOCTOU races

`softDelete` and `hardDelete` perform check-then-act without atomicity: they fetch the entity, verify permissions, then issue the delete. Between the check and the act, another request could modify or delete the same entity. While this is lower severity (the delete is idempotent in most cases), a transaction context would eliminate the race.

---

## Affected Services (Singleton Mutable State)

All mutable instance fields that are written in a `_before*` hook and read in the corresponding `_after*` hook. These MUST be migrated to `ctx.hookState`.

| Service | File (relative to `packages/service-core/src/services/`) | Mutable Field | Type | Written In | Read In | Concurrency Risk |
|---------|----------------------------------------------------------|---------------|------|-----------|---------|-----------------|
| AccommodationService | `accommodation/accommodation.service.ts` | `_lastDeletedEntity` | `{ destinationId?: string; slug: string; type?: string }` | `_beforeSoftDelete` | `_afterSoftDelete` | Wrong entity revalidated |
| AccommodationService | `accommodation/accommodation.service.ts` | `_lastRestoredAccommodation` | `{ slug: string; destinationId?: string; type?: string }` | `_beforeRestore` | `_afterRestore` | Wrong entity revalidated |
| AccommodationReviewService | `accommodationReview/accommodationReview.service.ts` | `_lastDeletedAccommodationId` | `string` | `_beforeSoftDelete`, `_beforeHardDelete` | `_afterSoftDelete`, `_afterHardDelete` | Wrong stats recalculation |
| AccommodationReviewService | `accommodationReview/accommodationReview.service.ts` | `_lastRestoredAccommodationId` | `string` | `_beforeRestore` | `_afterRestore` | Wrong stats recalculation |
| DestinationReviewService | `destinationReview/destinationReview.service.ts` | `_lastDeletedDestinationId` | `string` | `_beforeSoftDelete`, `_beforeHardDelete` | `_afterSoftDelete`, `_afterHardDelete` | Wrong stats recalculation |
| DestinationReviewService | `destinationReview/destinationReview.service.ts` | `_lastRestoredDestinationIdForReview` | `string` | `_beforeRestore` | `_afterRestore` | Wrong stats recalculation |
| DestinationService | `destination/destination.service.ts` | `_lastDeletedDestinationSlug` | `string` | `_beforeSoftDelete`, `_beforeHardDelete` | `_afterSoftDelete`, `_afterHardDelete` | Wrong revalidation target |
| DestinationService | `destination/destination.service.ts` | `_lastRestoredDestinationSlug` | `string` | `_beforeRestore` | `_afterRestore` | Wrong revalidation target |
| DestinationService | `destination/destination.service.ts` | `_updateId` | `string` | overridden `update()` | `_beforeUpdate` | Wrong entity updated |
| DestinationService | `destination/destination.service.ts` | `_pendingPathUpdate` | `{ parentId: string; oldPath: string; newPath: string }` | `_beforeUpdate` | overridden `update()` | Wrong descendant paths cascaded |
| EventService | `event/event.service.ts` | `_lastRestoredEvent` | `{ slug: string; category?: string }` | `_beforeRestore` | `_afterRestore` | Wrong revalidation target |
| EventService | `event/event.service.ts` | `_lastDeletedEvent` | `{ slug: string; category?: string }` | `_beforeSoftDelete` | `_afterSoftDelete` | Wrong revalidation target |
| PostService | `post/post.service.ts` | `_lastRestoredPost` | `{ slug: string; tagSlugs?: string[] }` | `_beforeRestore` | `_afterRestore` | Wrong revalidation target |
| PostService | `post/post.service.ts` | `_lastDeletedPost` | `{ slug: string; tagSlugs?: string[] }` | `_beforeSoftDelete` | `_afterSoftDelete` | Wrong revalidation target |
| PostService | `post/post.service.ts` | `_updateId` | `string` | overridden `update()` | `_beforeUpdate` | Wrong entity updated |

**BaseCrudService subclasses WITHOUT mutable state** (no hookState migration needed, but hook signatures must be updated): TagService, AmenityService, AttractionService, FeatureService, UserService, EventOrganizerService, EventLocationService, PostSponsorService, PostSponsorshipService, OwnerPromotionService, SponsorshipLevelService, SponsorshipService, SponsorshipPackageService, UserBookmarkService.

> **Note**: `FeatureService`, `AmenityService`, `TagService`, and `AttractionService` extend `BaseCrudRelatedService` (in `base.crud.related.service.ts`), not `BaseCrudService` directly. `BaseCrudRelatedService` inherits from `BaseCrudService`, so ctx threading applies transitively, but implementers should verify that `BaseCrudRelatedService` does not override any methods in a way that drops the `ctx` parameter.

**Other services (no CRUD hooks, not applicable)**: `PromoCodeService`, `BillingSettingsService`, `NotificationRetentionService` (standalone classes, no base class). `ExchangeRateConfigService`, `PermissionService` (extend `BaseService` only, no CRUD hooks). `AddonLimitRecalculationService` (module with exported functions, not a class). These do not participate in the hookState migration or ctx threading.

---

## Proposed Solution

### 1. Import `QueryContext` from `@repo/db`

SPEC-058 defines these types in `@repo/db/src/types.ts`:

```typescript
// Defined by SPEC-058 in @repo/db/src/types.ts
export type DrizzleClient = PgDatabase<
    NodePgQueryResultHKT,
    typeof schema,
    ExtractTablesWithRelations<typeof schema>
>;

export interface QueryContext {
    tx?: DrizzleClient;
}
```

SPEC-059 imports `QueryContext` from `@repo/db` and builds `ServiceContext` on top of it.

> **Drizzle Type Hierarchy Note** (verified against `drizzle-orm@0.44.7` source in `node_modules`): In Drizzle ORM v0.44+, the `tx` parameter inside a `db.transaction()` callback is typed as `NodePgTransaction` (from `node-postgres/session.d.ts`), NOT `NodePgDatabase`. The hierarchy is: `NodePgTransaction extends PgTransaction extends PgDatabase` (from `pg-core/session.d.ts`), and `NodePgDatabase extends PgDatabase` (from `node-postgres/driver.d.ts`). Since both share `PgDatabase` as their common ancestor, `DrizzleClient` (typed as `PgDatabase<...>`) correctly accepts BOTH the normal db client and the transaction client. This is intentional and is the community-recommended pattern (see [Drizzle Discussion #3271](https://github.com/drizzle-team/drizzle-orm/discussions/3271)). Using `PgDatabase` as the common type means we lose access to `tx.rollback()` and `tx.transaction()` (nested transactions/savepoints), but these are not needed for our use case. Errors thrown inside the callback trigger automatic rollback.
>
> **Existing `withTransaction` type bug**: The current `withTransaction` in `packages/db/src/client.ts:108` types its callback parameter as `(tx: NodePgDatabase<typeof schema>)`, but `db.transaction()` actually passes a `PgTransaction`, not `NodePgDatabase`. This compiles due to TypeScript structural typing (both extend `PgDatabase`), but the type annotation is technically incorrect. SPEC-058's introduction of `DrizzleClient = PgDatabase<...>` as the common type will fix this annotation as part of its scope.

### 2. Redefine `ServiceContext` in `@repo/service-core`

The current `ServiceContext` type (`packages/service-core/src/types/index.ts:22-24`) is used for two purposes:

1. **Construction-time config**: Passed to the `BaseService` constructor to configure the logger.
2. **Runtime context**: (Does not exist yet) Passed through methods/hooks to carry tx, hookState, etc.

These two purposes must be separated:

#### Step 2a: Rename the construction-time type to `ServiceConfig`

**File**: `packages/service-core/src/types/index.ts`

```typescript
// BEFORE (line 22-24)
export type ServiceContext = {
    logger?: ServiceLogger;
};

// AFTER
/**
 * Configuration for service construction. Passed to the BaseService constructor.
 * @property {ServiceLogger} logger - Optional logger override. Falls back to default serviceLogger.
 */
export type ServiceConfig = {
    logger?: ServiceLogger;
};
```

Update the `BaseService` constructor (`base.service.ts:25`):

```typescript
// BEFORE
constructor(ctx: ServiceContext, entityName: string) {
    this.logger = ctx.logger ?? serviceLogger;

// AFTER
constructor(config: ServiceConfig, entityName: string) {
    this.logger = config.logger ?? serviceLogger;
```

Update `BaseCrudService` constructor (`base.crud.service.ts:111`):

```typescript
// BEFORE
constructor(ctx: ServiceContext, entityName: string) {
    super(ctx, entityName);

// AFTER
constructor(config: ServiceConfig, entityName: string) {
    super(config, entityName);
```

All concrete service constructors that accept `ServiceContext` (e.g., `AccommodationService`, `DestinationService`, etc.) must be updated to accept `ServiceConfig` instead. Since the type alias name changes but the shape is identical, this is a search-and-replace operation with no runtime changes. Callers that pass `{ logger: someLogger }` or `{}` continue working without modification.

##### Blast radius of the `ServiceConfig` rename

The `ServiceContext` type is currently imported in all 21 concrete service constructors, the `BaseCrudService` base class, and associated test files. The rename to `ServiceConfig` is a mechanical find-and-replace across approximately 30-40 files.

**Files affected**: All files in `packages/service-core/src/services/*/` that import `ServiceContext` for constructor typing, plus `packages/service-core/src/types/index.ts` (definition), `packages/service-core/src/base/base.crud.service.ts` (base class), and test files in `packages/service-core/test/`.

**Recommended approach**: This rename MUST be done as a single atomic commit to avoid intermediate states where some files use the old name and some use the new name. Use a codebase-wide find-and-replace: rename the type definition, then update all imports and usages in one pass.

#### Step 2b: Define the new runtime `ServiceContext` with generic `hookState`

**File**: `packages/service-core/src/types/index.ts`

```typescript
import type { QueryContext } from '@repo/db';

/**
 * Runtime context passed through service methods and lifecycle hooks.
 *
 * Carries the optional transaction client (`tx`) from QueryContext,
 * plus per-request hook state that replaces singleton mutable fields.
 *
 * @template THookState - Type of the hookState bag. Defaults to Record<string, unknown>.
 *                        Concrete services should narrow this to their specific state shape.
 */
export interface ServiceContext<THookState = Record<string, unknown>> extends QueryContext {
    /**
     * Per-request mutable state bag for passing data between _before and _after hooks.
     * Replaces singleton instance fields that are unsafe under concurrent requests.
     */
    hookState?: THookState;
}
```

This design means:

- `ServiceContext` (no type arg) = `{ tx?: DrizzleClient; hookState?: Record<string, unknown> }`
- `ServiceContext<AccommodationHookState>` = `{ tx?: DrizzleClient; hookState?: AccommodationHookState }`
- All fields are optional, so callers that don't pass a ctx get default behavior.

> **TypeScript Covariance Note**: When concrete services override hooks using `ServiceContext<SpecificHookState>` (e.g., `_beforeSoftDelete(id: string, _actor: Actor, ctx: ServiceContext<AccommodationHookState>)`), the type narrowing is safe. The base hook signature uses `ServiceContext` (defaults to `ServiceContext<Record<string, unknown>>`). Since `hookState` is only used for internal communication between `_before*` and `_after*` hooks of the SAME service, there is no contravariance issue. The narrowed generic constrains what the service itself writes/reads, without affecting the caller (who passes `ServiceContext` with the default generic).

### 3. Thread `ctx` through BaseCrudService public methods

Every public method on the CRUD base classes gains an **optional** `ctx?: ServiceContext` parameter as the **last** parameter. This preserves backward compatibility: existing callers that don't pass `ctx` continue to work.

> **Calling pattern for methods with optional middle parameters**: Some methods have optional parameters before `ctx` (e.g., `list(actor, options?, ctx?)`). When a caller wants to pass `ctx` without specifying the optional middle parameter, it must pass `undefined` explicitly: `service.list(actor, undefined, ctx)`. This is standard TypeScript behavior and cannot be avoided without restructuring the API. The alternative (wrapping all params in an object) would break backward compatibility. Callers should use this `undefined` placeholder pattern when needed.

The `ctx` flows:

1. Public method receives `ctx?: ServiceContext`
2. Public method initializes `ctx` if undefined: `const resolvedCtx = ctx ?? { hookState: {} };`
3. `resolvedCtx` is passed to `runWithLoggingAndValidation` via the `input` bag
4. `runWithLoggingAndValidation` extracts `ctx` and passes it to `execute`
5. `execute` passes `ctx` to lifecycle hooks and model methods

#### Complete method signature changes

**BaseCrudRead** (`base.crud.read.ts`):

| Method | Current Signature | New Signature |
|--------|-------------------|---------------|
| `getByField` | `(actor: Actor, field: string, value: unknown)` | `(actor: Actor, field: string, value: unknown, ctx?: ServiceContext)` |
| `getById` | `(actor: Actor, id: string)` | `(actor: Actor, id: string, ctx?: ServiceContext)` |
| `getBySlug` | `(actor: Actor, slug: string)` | `(actor: Actor, slug: string, ctx?: ServiceContext)` |
| `getByName` | `(actor: Actor, name: string)` | `(actor: Actor, name: string, ctx?: ServiceContext)` |
| `list` | `(actor: Actor, options?: {...})` | `(actor: Actor, options?: {...}, ctx?: ServiceContext)` |
| `search` | `(actor: Actor, params: z.infer<TSearchSchema>)` | `(actor: Actor, params: z.infer<TSearchSchema>, ctx?: ServiceContext)` |
| `adminList` | `(actor: Actor, params: Record<string, unknown>)` | `(actor: Actor, params: Record<string, unknown>, ctx?: ServiceContext)` |
| `count` | `(actor: Actor, params: z.infer<TSearchSchema>)` | `(actor: Actor, params: z.infer<TSearchSchema>, ctx?: ServiceContext)` |

**BaseCrudWrite** (`base.crud.write.ts`):

| Method | Current Signature | New Signature |
|--------|-------------------|---------------|
| `create` | `(actor: Actor, data: z.infer<TCreateSchema>)` | `(actor: Actor, data: z.infer<TCreateSchema>, ctx?: ServiceContext)` |
| `update` | `(actor: Actor, id: string, data: z.infer<TUpdateSchema>)` | `(actor: Actor, id: string, data: z.infer<TUpdateSchema>, ctx?: ServiceContext)` |
| `softDelete` | `(actor: Actor, id: string)` | `(actor: Actor, id: string, ctx?: ServiceContext)` |
| `hardDelete` | `(actor: Actor, id: string)` | `(actor: Actor, id: string, ctx?: ServiceContext)` |
| `restore` | `(actor: Actor, id: string)` | `(actor: Actor, id: string, ctx?: ServiceContext)` |
| `updateVisibility` | `(actor: Actor, id: string, visibility: VisibilityEnum)` | `(actor: Actor, id: string, visibility: VisibilityEnum, ctx?: ServiceContext)` |
| `setFeaturedStatus` | `(input: ServiceInput<{id: string; isFeatured: boolean}>)` | `(input: ServiceInput<{id: string; isFeatured: boolean}>, ctx?: ServiceContext)` |

**BaseCrudAdmin** (`base.crud.admin.ts`):

| Method | Current Signature | New Signature |
|--------|-------------------|---------------|
| `getAdminInfo` | `(input: ServiceInput<{id: string}>)` | `(input: ServiceInput<{id: string}>, ctx?: ServiceContext)` |
| `setAdminInfo` | `(input: ServiceInput<{id: string; adminInfo: AdminInfoType}>)` | `(input: ServiceInput<{id: string; adminInfo: AdminInfoType}>, ctx?: ServiceContext)` |

#### Context initialization pattern

Inside each public method, before any logic:

```typescript
public async create(
    actor: Actor,
    data: z.infer<TCreateSchema>,
    ctx?: ServiceContext
): Promise<ServiceOutput<TEntity>> {
    // Spread ensures hookState is always present, even if caller passes { tx } without hookState.
    // If ctx is undefined, defaults to { hookState: {} }.
    // If ctx has hookState, preserves it. If ctx lacks hookState, adds empty {}.
    const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };

    return this.runWithLoggingAndValidation({
        methodName: 'create',
        input: { actor, ...data },
        schema: this.createSchema,
        ctx: resolvedCtx,  // <-- new field on the input type
        execute: async (validatedData, validatedActor, execCtx) => {
            // execCtx is the resolvedCtx, threaded through
            await this._canCreate(validatedActor, validatedData);
            const processedData = await this._beforeCreate(normalizedData, validatedActor, execCtx);
            const entity = await this.model.create(payload as any, execCtx.tx);
            return this._afterCreate(entity, validatedActor, execCtx);
        }
    });
}
```

### 4. Thread `ctx` through all 20 lifecycle hooks and 3 execute methods

All 20 hooks in `BaseCrudHooks` (`base.crud.hooks.ts`) receive `ctx: ServiceContext` as their **last** parameter (after `_actor: Actor`). The default no-op implementations simply ignore it. Additionally, the 3 execute methods (`_executeSearch`, `_executeCount`, `_executeAdminSearch`) also receive `ctx`.

**Note**: Permission hooks (`_canCreate`, `_canUpdate`, `_canList`, `_canSearch`, `_canCount`, `_canSoftDelete`, `_canHardDelete`, `_canRestore`, `_canView`, `_canUpdateVisibility`) intentionally do **NOT** receive `ctx`. Permission checks are in-memory operations against `PermissionEnum` and do not require transaction context. If a future service needs database access during permission checks, that would be a separate enhancement.

**Note**: Normalizers (`this.normalizers?.create?.()`, `this.normalizers?.update?.()`) also do **NOT** receive `ctx`. Normalizers are pure data transformations (trimming strings, normalizing slugs, setting defaults) and do not perform database operations. If a future normalizer requires database access, the normalizer signature should be extended in a separate spec.

#### Complete hook signature table

| # | Hook | Current Signature | New Signature |
|---|------|-------------------|---------------|
| 1 | `_beforeCreate` | `(data: z.infer<TCreateSchema>, _actor: Actor): Promise<Partial<TEntity>>` | `(data: z.infer<TCreateSchema>, _actor: Actor, _ctx: ServiceContext): Promise<Partial<TEntity>>` |
| 2 | `_afterCreate` | `(entity: TEntity, _actor: Actor): Promise<TEntity>` | `(entity: TEntity, _actor: Actor, _ctx: ServiceContext): Promise<TEntity>` |
| 3 | `_beforeUpdate` | `(data: z.infer<TUpdateSchema>, _actor: Actor): Promise<Partial<TEntity>>` | `(data: z.infer<TUpdateSchema>, _actor: Actor, _ctx: ServiceContext): Promise<Partial<TEntity>>` |
| 4 | `_afterUpdate` | `(entity: TEntity, _actor: Actor): Promise<TEntity>` | `(entity: TEntity, _actor: Actor, _ctx: ServiceContext): Promise<TEntity>` |
| 5 | `_beforeGetByField` | `(field: string, value: unknown, _actor: Actor): Promise<{field: string; value: unknown}>` | `(field: string, value: unknown, _actor: Actor, _ctx: ServiceContext): Promise<{field: string; value: unknown}>` |
| 6 | `_afterGetByField` | `(entity: TEntity \| null, _actor: Actor): Promise<TEntity \| null>` | `(entity: TEntity \| null, _actor: Actor, _ctx: ServiceContext): Promise<TEntity \| null>` |
| 7 | `_beforeList` | `(options: ListOptions, _actor: Actor): Promise<ListOptions>` | `(options: ListOptions, _actor: Actor, _ctx: ServiceContext): Promise<ListOptions>` |
| 8 | `_afterList` | `(result: PaginatedListOutput<TEntity>, _actor: Actor): Promise<PaginatedListOutput<TEntity>>` | `(result: PaginatedListOutput<TEntity>, _actor: Actor, _ctx: ServiceContext): Promise<PaginatedListOutput<TEntity>>` |
| 9 | `_beforeSoftDelete` | `(id: string, _actor: Actor): Promise<string>` | `(id: string, _actor: Actor, _ctx: ServiceContext): Promise<string>` |
| 10 | `_afterSoftDelete` | `(result: {count: number}, _actor: Actor): Promise<{count: number}>` | `(result: {count: number}, _actor: Actor, _ctx: ServiceContext): Promise<{count: number}>` |
| 11 | `_beforeHardDelete` | `(id: string, _actor: Actor): Promise<string>` | `(id: string, _actor: Actor, _ctx: ServiceContext): Promise<string>` |
| 12 | `_afterHardDelete` | `(result: {count: number}, _actor: Actor): Promise<{count: number}>` | `(result: {count: number}, _actor: Actor, _ctx: ServiceContext): Promise<{count: number}>` |
| 13 | `_beforeRestore` | `(id: string, _actor: Actor): Promise<string>` | `(id: string, _actor: Actor, _ctx: ServiceContext): Promise<string>` |
| 14 | `_afterRestore` | `(result: {count: number}, _actor: Actor): Promise<{count: number}>` | `(result: {count: number}, _actor: Actor, _ctx: ServiceContext): Promise<{count: number}>` |
| 15 | `_beforeSearch` | `(params: z.infer<TSearchSchema>, _actor: Actor): Promise<z.infer<TSearchSchema>>` | `(params: z.infer<TSearchSchema>, _actor: Actor, _ctx: ServiceContext): Promise<z.infer<TSearchSchema>>` |
| 16 | `_afterSearch` | `(result: PaginatedListOutput<TEntity>, _actor: Actor): Promise<PaginatedListOutput<TEntity>>` | `(result: PaginatedListOutput<TEntity>, _actor: Actor, _ctx: ServiceContext): Promise<PaginatedListOutput<TEntity>>` |
| 17 | `_beforeCount` | `(params: z.infer<TSearchSchema>, _actor: Actor): Promise<z.infer<TSearchSchema>>` | `(params: z.infer<TSearchSchema>, _actor: Actor, _ctx: ServiceContext): Promise<z.infer<TSearchSchema>>` |
| 18 | `_afterCount` | `(result: {count: number}, _actor: Actor): Promise<{count: number}>` | `(result: {count: number}, _actor: Actor, _ctx: ServiceContext): Promise<{count: number}>` |
| 19 | `_beforeUpdateVisibility` | `(_entity: TEntity, newVisibility: VisibilityEnum, _actor: Actor): Promise<VisibilityEnum>` | `(_entity: TEntity, newVisibility: VisibilityEnum, _actor: Actor, _ctx: ServiceContext): Promise<VisibilityEnum>` |
| 20 | `_afterUpdateVisibility` | `(entity: TEntity, _actor: Actor): Promise<TEntity>` | `(entity: TEntity, _actor: Actor, _ctx: ServiceContext): Promise<TEntity>` |

Additionally, the abstract methods `_executeSearch` and `_executeCount` (declared in `BaseCrudPermissions`, implemented by each service) gain `ctx`:

| # | Method | Current Signature | New Signature |
|---|--------|-------------------|---------------|
| 21 | `_executeSearch` | `(params: z.infer<TSearchSchema>, actor: Actor): Promise<PaginatedListOutput<TEntity>>` | `(params: z.infer<TSearchSchema>, actor: Actor, ctx: ServiceContext): Promise<PaginatedListOutput<TEntity>>` |
| 22 | `_executeCount` | `(params: z.infer<TSearchSchema>, actor: Actor): Promise<{count: number}>` | `(params: z.infer<TSearchSchema>, actor: Actor, ctx: ServiceContext): Promise<{count: number}>` |

And the protected `_executeAdminSearch`:

| # | Method | Current Signature | New Signature |
|---|--------|-------------------|---------------|
| 23 | `_executeAdminSearch` | `(params: AdminSearchExecuteParams): Promise<PaginatedListOutput<TEntity>>` | `(params: AdminSearchExecuteParams, ctx: ServiceContext): Promise<PaginatedListOutput<TEntity>>` |

#### `_getAndValidateEntity` ctx threading

The protected method `_getAndValidateEntity` (`base.service.ts:137-153`) calls `model.findById(id)` and is invoked by 6 write methods (`update`, `softDelete`, `hardDelete`, `restore`, `updateVisibility`, `setFeaturedStatus`). It must accept `ctx?: ServiceContext` to propagate `tx` to the model layer.

**Current signature** (`base.service.ts:137`):

```typescript
protected async _getAndValidateEntity<
    TEntity,
    TModel extends { findById: (id: string) => Promise<TEntity | null> }
>(
    model: TModel,
    id: string,
    actor: Actor,
    entityName: string,
    permissionCheck: (actor: Actor, entity: TEntity) => Promise<void> | void
): Promise<TEntity>
```

**New signature**:

```typescript
protected async _getAndValidateEntity<
    TEntity,
    TModel extends { findById: (id: string, tx?: DrizzleClient) => Promise<TEntity | null> }
>(
    model: TModel,
    id: string,
    actor: Actor,
    entityName: string,
    permissionCheck: (actor: Actor, entity: TEntity) => Promise<void> | void,
    ctx?: ServiceContext
): Promise<TEntity>
```

**Internal change**:

```typescript
// Phase 3: No change to findById call (tx not propagated to models yet)
const entityOrNull = await model.findById(id);

// Phase 4 (after SPEC-060): Propagate tx
const entityOrNull = await model.findById(id, ctx?.tx);
```

**Call sites in `base.crud.write.ts`** (6 locations): All calls to `_getAndValidateEntity` inside `execute` callbacks must pass `execCtx` as the last argument:

```typescript
// Example: softDelete execute callback
const entity = await this._getAndValidateEntity(
    this.model, id, validActor, this.entityName,
    this._canSoftDelete.bind(this),
    execCtx  // <-- NEW: pass ctx for tx propagation
);
```

#### `adminList` ctx flow detail

`adminList()` in `base.crud.read.ts` constructs `AdminSearchExecuteParams` and delegates to `_executeAdminSearch`. The ctx flows as follows:

```typescript
public async adminList(
    actor: Actor,
    params: Record<string, unknown>,
    ctx?: ServiceContext
): Promise<ServiceOutput<PaginatedListOutput<TEntity>>> {
    const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };

    return this.runWithLoggingAndValidation({
        methodName: 'adminList',
        input: { actor, ...params },
        schema: this.adminListSchema,
        ctx: resolvedCtx,
        execute: async (validatedParams, validatedActor, execCtx) => {
            // ... builds searchParams from validatedParams ...
            return this._executeAdminSearch(searchParams, execCtx);
            //                                              ^^^^^^^ ctx passed here
        }
    });
}
```

Concrete `_executeAdminSearch` implementations should use `ctx.tx` when calling model methods (Phase 4, after SPEC-058/060).

### 5. Replace singleton mutable state with `ctx.hookState`

Each service with mutable state defines a typed `hookState` interface and uses it instead of instance fields. The `hookState` bag lives on the `ctx` object, which is per-request.

#### 5a. AccommodationService

**Define typed hookState**:

```typescript
// accommodation/accommodation.types.ts (new file)
export interface AccommodationHookState {
    /** Entity data captured in _beforeSoftDelete for use in _afterSoftDelete */
    deletedEntity?: { destinationId?: string; slug: string; type?: string };
    /** Entity data captured in _beforeRestore for use in _afterRestore */
    restoredAccommodation?: { slug: string; destinationId?: string; type?: string };
}
```

**Before** (`accommodation.service.ts:160-163`):

```typescript
private _lastDeletedEntity: { destinationId?: string; slug: string; type?: string } | undefined;
private _lastRestoredAccommodation:
    | { slug: string; destinationId?: string; type?: string }
    | undefined;
```

**After**: Delete both fields. Update hooks:

```typescript
// _beforeSoftDelete
protected async _beforeSoftDelete(id: string, _actor: Actor, ctx: ServiceContext<AccommodationHookState>): Promise<string> {
    // Phase 3: model.findById uses global db client.
    // Phase 4 (after SPEC-060): use this.model.findById(id, ctx.tx) for tx propagation.
    const entity = await this.model.findById(id);
    if (entity && ctx.hookState) {
        ctx.hookState.deletedEntity = {
            destinationId: entity.destinationId,
            slug: entity.slug,
            type: entity.type
        };
    }
    return id;
}

// _afterSoftDelete
protected async _afterSoftDelete(
    result: { count: number },
    _actor: Actor,
    ctx: ServiceContext<AccommodationHookState>
): Promise<{ count: number }> {
    const deleted = ctx.hookState?.deletedEntity;
    if (deleted) {
        // revalidation logic using `deleted.slug`, `deleted.destinationId`, etc.
    }
    return result;
}

// _beforeRestore
protected async _beforeRestore(id: string, _actor: Actor, ctx: ServiceContext<AccommodationHookState>): Promise<string> {
    const entity = await this.model.findById(id);
    if (entity && ctx.hookState) {
        ctx.hookState.restoredAccommodation = {
            slug: entity.slug,
            destinationId: entity.destinationId,
            type: entity.type
        };
    }
    return id;
}

// _afterRestore
protected async _afterRestore(
    result: { count: number },
    _actor: Actor,
    ctx: ServiceContext<AccommodationHookState>
): Promise<{ count: number }> {
    const restored = ctx.hookState?.restoredAccommodation;
    if (restored) {
        // revalidation logic using `restored.slug`, etc.
    }
    return result;
}
```

#### 5b. DestinationService

**Define typed hookState**:

```typescript
// destination/destination.types.ts (new file)
export interface DestinationHookState {
    /** Entity ID being updated, so _beforeUpdate can access it */
    updateId?: string;
    /** Pending descendant path cascade computed in _beforeUpdate, applied in update() */
    pendingPathUpdate?: { parentId: string; oldPath: string; newPath: string };
    /** Slug captured in _beforeSoftDelete/_beforeHardDelete for revalidation */
    deletedDestinationSlug?: string;
    /** Slug captured in _beforeRestore for revalidation */
    restoredDestinationSlug?: string;
}
```

**Before** (`destination.service.ts:90-91, 693, 747`):

```typescript
private _updateId: string | undefined;
private _pendingPathUpdate: { parentId: string; oldPath: string; newPath: string } | undefined;
private _lastDeletedDestinationSlug: string | undefined;
private _lastRestoredDestinationSlug: string | undefined;
```

**After**: Delete all four fields. Update the overridden `update()`:

```typescript
public async update(
    actor: Actor,
    id: string,
    data: DestinationUpdateInput,
    ctx?: ServiceContext<DestinationHookState>
): Promise<ServiceOutput<Destination>> {
    // Spread ensures hookState is always present (see pattern explanation in Section 3).
    const resolvedCtx: ServiceContext<DestinationHookState> = { hookState: {}, ...ctx };
    resolvedCtx.hookState!.updateId = id;
    resolvedCtx.hookState!.pendingPathUpdate = undefined;
    try {
        const result = await super.update(actor, id, data, resolvedCtx);

        if (resolvedCtx.hookState?.pendingPathUpdate) {
            const { parentId, oldPath, newPath } = resolvedCtx.hookState.pendingPathUpdate;
            // Phase 3: Maintains current withTransaction behavior while migrating hookState.
            // Phase 4 will replace this with ctx.tx propagation:
            //   const tx = resolvedCtx.tx;
            //   if (tx) { await this.model.updateDescendantPaths(parentId, oldPath, newPath, tx); }
            //   else { await withTransaction(async (newTx) => { ... }); }
            await withTransaction(async (tx) => {
                await this.model.updateDescendantPaths(parentId, oldPath, newPath, tx);
            });
        }

        return result;
    } finally {
        if (resolvedCtx.hookState) {
            resolvedCtx.hookState.updateId = undefined;
            resolvedCtx.hookState.pendingPathUpdate = undefined;
        }
    }
}
```

Update `_beforeUpdate` to read from `ctx.hookState.updateId` instead of `this._updateId`, and write to `ctx.hookState.pendingPathUpdate` instead of `this._pendingPathUpdate`.

#### 5c. Remaining services (mapping table)

| Service | HookState Interface Name | Fields |
|---------|--------------------------|--------|
| `AccommodationReviewService` | `AccommodationReviewHookState` | `deletedAccommodationId?: string`, `restoredAccommodationId?: string` |
| `DestinationReviewService` | `DestinationReviewHookState` | `deletedDestinationId?: string`, `restoredDestinationIdForReview?: string` |
| `EventService` | `EventHookState` | `restoredEvent?: { slug: string; category?: string }`, `deletedEvent?: { slug: string; category?: string }` |
| `PostService` | `PostHookState` | `restoredPost?: { slug: string; tagSlugs?: string[] }`, `deletedPost?: { slug: string; tagSlugs?: string[] }`, `updateId?: string` |

Each service follows the same pattern as AccommodationService above:

1. Define a typed hookState interface in a `<service>.types.ts` file
2. Delete `private` mutable fields
3. Update `_before*` hooks to write to `ctx.hookState`
4. Update `_after*` hooks to read from `ctx.hookState`
5. Update overridden `update()` (PostService, DestinationService) to use `ctx.hookState.updateId`

#### PostService update() migration detail

PostService (`post/post.service.ts:980-991`) has an overridden `update()` identical in structure to DestinationService's:

```typescript
// BEFORE (post.service.ts:980-991)
public async update(actor, id, data) {
    this._updateId = id;
    try {
        return await super.update(actor, id, data);
    } finally {
        this._updateId = undefined;
    }
}

// AFTER
public async update(
    actor: Actor,
    id: string,
    data: z.infer<typeof PostUpdateSchema>,
    ctx?: ServiceContext<PostHookState>
): Promise<ServiceOutput<Post>> {
    const resolvedCtx: ServiceContext<PostHookState> = { hookState: {}, ...ctx };
    resolvedCtx.hookState!.updateId = id;
    try {
        return await super.update(actor, id, data, resolvedCtx);
    } finally {
        if (resolvedCtx.hookState) {
            resolvedCtx.hookState.updateId = undefined;
        }
    }
}
```

The `_beforeUpdate` hook (`post.service.ts:184`) reads `ctx.hookState.updateId` instead of `this._updateId`.

#### Cross-service `ctx` propagation rule

When a lifecycle hook in Service A needs to call Service B (or its model), it MUST pass the same `ctx` to maintain transaction atomicity. This is critical for the following patterns:

| Hook Location | Cross-service Call | How to Propagate |
|--------------|-------------------|-----------------|
| `AccommodationReviewService._afterSoftDelete` | Recalculates accommodation stats | Pass `ctx.tx` to `accommodationModel.update(...)` (after SPEC-060) |
| `AccommodationReviewService._afterRestore` | Recalculates accommodation stats | Pass `ctx.tx` to `accommodationModel.update(...)` (after SPEC-060) |
| `DestinationReviewService._afterSoftDelete` | Recalculates destination stats | Pass `ctx.tx` to `destinationModel.update(...)` (after SPEC-060) |
| `DestinationReviewService._afterRestore` | Recalculates destination stats | Pass `ctx.tx` to `destinationModel.update(...)` (after SPEC-060) |
| `AccommodationReviewService._afterCreate` | Recalculates accommodation stats | Pass `ctx.tx` to `accommodationModel.update(...)` (after SPEC-060) |
| `AccommodationReviewService._afterUpdate` | Recalculates accommodation stats | Pass `ctx.tx` to `accommodationModel.update(...)` (after SPEC-060) |
| `DestinationReviewService._afterCreate` | Recalculates destination stats | Pass `ctx.tx` to `destinationModel.update(...)` (after SPEC-060) |
| `DestinationReviewService._afterUpdate` | Recalculates destination stats | Pass `ctx.tx` to `destinationModel.update(...)` (after SPEC-060) |
| `DestinationService.update()` | Updates descendant paths | Pass `ctx.tx` to `model.updateDescendantPaths(...)` (after SPEC-060) |

**Phase 3 rule**: Cross-service model calls continue using `getDb()` (no tx propagation) for two reasons:

1. **Base model methods** (findById, create, update, etc.) already accept a `tx` parameter, but it is typed as `NodePgDatabase<typeof schema>`. `ServiceContext.tx` is typed as `DrizzleClient` (`PgDatabase<...>`). These types are incompatible until SPEC-058 aligns the parameter types to `DrizzleClient`.
2. **Custom subclass methods** (e.g., `DestinationModel.updateDescendantPaths`) call `getDb()` directly and don't accept `tx` at all until SPEC-060 adds that parameter.

The `ctx` object is threaded through hooks in Phase 3 purely for `hookState` isolation. Phase 4 (post-SPEC-058 + SPEC-060) will switch model calls to use `ctx.tx`.

**Phase 4 rule**: If a hook calls another SERVICE (not just a model), pass the full `ctx`:

```typescript
// Example: _afterSoftDelete calling another service
protected async _afterSoftDelete(result, actor, ctx) {
    await otherService.update(actor, id, data, ctx);  // Same ctx = same transaction
}
```

> **hookState type collision caveat**: When ServiceA passes its `ctx` to ServiceB, both services share the SAME `hookState` object at runtime. ServiceA may have typed it as `ServiceContext<AHookState>` and ServiceB as `ServiceContext<BHookState>`, but the underlying object is shared. This is safe in the current codebase because:
>
> 1. All current cross-service calls from hooks go to **model** methods (not service methods), and models don't use hookState.
> 2. If a future hook calls another **service** method, the called service will call `{ hookState: {}, ...ctx }` to create its `resolvedCtx`. Because the spread operator overwrites the initial `hookState: {}` with `ctx.hookState` from the caller, both services share the SAME `hookState` object at runtime. This is acceptable because hookState keys are namespaced by convention (e.g., `deletedEntity` vs `deletedAccommodationId`) and services don't read keys they didn't write. If key collision becomes a concern, see point 3 below.
> 3. If key collision becomes a concern, namespace hookState keys (e.g., `accommodation.deletedEntity` instead of `deletedEntity`). This is not currently needed but is a viable escape hatch.

### 6. Fix `runWithLoggingAndValidation` error handling

**File**: `packages/service-core/src/base/base.service.ts`

The method signature changes to accept `ctx`:

```typescript
protected async runWithLoggingAndValidation<TInput extends ZodTypeAny, TOutput>({
    methodName,
    input,
    schema,
    ctx,       // <-- NEW
    execute
}: {
    methodName: string;
    input: { actor: Actor } & Record<string, unknown>;
    schema: TInput;
    ctx?: ServiceContext;  // <-- NEW
    execute: (data: z.infer<TInput>, actor: Actor, ctx: ServiceContext) => Promise<TOutput>;  // <-- ctx added
}): Promise<ServiceOutput<TOutput>>
```

The key fix is in the catch block (`base.service.ts:103-121`). The current implementation has THREE branches, and TWO of them swallow errors that would prevent transaction rollback:

```typescript
// BEFORE (line 103-121 -- COMPLETE catch block)
catch (error) {
    // Branch 1: ServiceError -- SWALLOWED (returned, not thrown)
    if (error instanceof ServiceError) {
        logError(`${this.entityName}.${methodName}`, error, params, actor);
        return { error };  // <-- Prevents tx rollback
    }

    // Branch 2: DbError -- Already correct (rethrown)
    if (error && typeof error === 'object' && 'name' in error && error.name === 'DbError') {
        throw error;
    }

    // Branch 3: Unknown errors -- ALSO SWALLOWED (wrapped in ServiceError, returned)
    const serviceError = new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
        error
    );
    logError(`${this.entityName}.${methodName}`, serviceError, params, actor);
    return { error: serviceError };  // <-- Also prevents tx rollback
}

// AFTER -- Both Branch 1 and Branch 3 must rethrow when inside a transaction
catch (error) {
    // Branch 1: ServiceError
    if (error instanceof ServiceError) {
        logError(`${this.entityName}.${methodName}`, error, params, actor);
        // When running inside a transaction, rethrow to trigger rollback.
        // When not in a transaction, return the error as before (backward compat).
        if (ctx?.tx) {
            throw error;
        }
        return { error };
    }

    // Branch 2: DbError -- unchanged, already rethrown
    if (error && typeof error === 'object' && 'name' in error && error.name === 'DbError') {
        throw error;
    }

    // Branch 3: Unknown errors -- ALSO rethrow inside transactions
    const serviceError = new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`,
        error
    );
    logError(`${this.entityName}.${methodName}`, serviceError, params, actor);
    if (ctx?.tx) {
        throw serviceError;  // <-- NEW: Rethrow to trigger tx rollback
    }
    return { error: serviceError };
}
```

And the execute call site (`base.service.ts:100`):

```typescript
// BEFORE
const result = await execute(validData, actor);

// AFTER
const resolvedCtx = ctx ?? { hookState: {} };
const result = await execute(validData, actor, resolvedCtx);
```

### 7. Add `withServiceTransaction` utility

**File**: `packages/service-core/src/utils/transaction.ts` (new file)

This utility wraps `@repo/db`'s `withTransaction` to create a properly initialized `ServiceContext` with a transaction client and empty hookState.

```typescript
import { sql } from 'drizzle-orm';
import { withTransaction } from '@repo/db';
import type { ServiceContext } from '../types';

/**
 * Executes a function within a database transaction, providing a ServiceContext
 * with the transaction client attached.
 *
 * If the function throws, the transaction is rolled back automatically.
 * If it returns successfully, the transaction is committed.
 *
 * @param fn - Function to execute within the transaction. Receives a ServiceContext with `tx` set.
 * @param baseCtx - Optional base context to merge. Useful for carrying existing hookState or other fields.
 * @returns The result of the function.
 *
 * @example
 * ```typescript
 * const result = await withServiceTransaction(async (ctx) => {
 *     const created = await accommodationService.create(actor, data, ctx);
 *     if (!created.data) throw created.error;
 *     await reviewService.create(actor, reviewData, ctx);
 *     return created.data;
 * });
 * ```
 */
export async function withServiceTransaction<T>(
    fn: (ctx: ServiceContext) => Promise<T>,
    baseCtx?: Partial<ServiceContext>,
    options?: { timeoutMs?: number }
): Promise<T> {
    return withTransaction(async (tx) => {
        // Guard against long-running transactions holding locks indefinitely.
        // SET LOCAL scopes the timeout to this transaction only and auto-resets
        // on commit/rollback. Do NOT use Promise.race -- it resolves the promise
        // while leaving the transaction open on the database.
        const timeout = options?.timeoutMs ?? 30_000;
        // NOTE: PostgreSQL SET/SET LOCAL does NOT accept parameterized values ($1).
        // Using sql.raw() to emit the timeout as a literal. Safe because timeout
        // is always a number (from options?.timeoutMs ?? 30_000), never user input.
        await tx.execute(sql`SET LOCAL statement_timeout = ${sql.raw(String(timeout))}`);

        const ctx: ServiceContext = {
            ...baseCtx,
            tx,
            hookState: baseCtx?.hookState ?? {},
        };
        return fn(ctx);
    });
}
```

Export from `packages/service-core/src/utils/index.ts` and `packages/service-core/src/index.ts`.

### 8. Custom public methods on concrete services

Some concrete services define additional public methods beyond the inherited CRUD operations. These methods also perform database operations and MUST accept `ctx?: ServiceContext` as their last parameter to participate in transactions.

**Known custom public methods requiring ctx**:

| Service | Method | Current Signature | DB Operations |
|---------|--------|-------------------|---------------|
| `ExchangeRateService` | `getLatestRate` | `(actor: Actor, params: { fromCurrency: PriceCurrencyEnum; toCurrency: PriceCurrencyEnum; rateType?: ExchangeRateTypeEnum })` | Read (model query) |
| `ExchangeRateService` | `getLatestRates` | `(actor: Actor)` | Read (model query) |
| `ExchangeRateService` | `createManualOverride` | `(actor: Actor, data: ExchangeRateCreateInput)` | Write (model create) |
| `ExchangeRateService` | `removeManualOverride` | `(actor: Actor, params: { id: string })` | Write (model update) |
| `DestinationService` | `update` (override) | `(actor, id, data)` | Write + cascade (already detailed in Section 5b) |
| `PostService` | `update` (override) | `(actor, id, data)` | Write (already detailed in Section 5c) |

**Implementation rule**: During Phase 2-3, the implementer must check all 21 concrete services listed in the Phase 2 table (Section "Phase 2: Base class ctx threading") for additional public methods beyond the inherited CRUD set. Each custom public method that calls `this.model.*`, `getDb()`, or `runWithLoggingAndValidation` must gain `ctx?: ServiceContext` as its last parameter and propagate `ctx.tx` to its model calls (Phase 4). The table above lists the 4 known custom methods on `ExchangeRateService`; the 2 overridden `update()` methods on `DestinationService` and `PostService` are already covered in Sections 5b and 5c.

**How to find additional ones**: `grep -n 'public async' packages/service-core/src/services/*/*.service.ts` and filter out inherited method names (create, update, softDelete, hardDelete, restore, list, search, adminList, count, getById, getBySlug, getByName, getByField, updateVisibility, setFeaturedStatus, getAdminInfo, setAdminInfo).

---

### 9. Route integration pattern

Routes (Hono handlers in `apps/api`) do **NOT** need to change by default. The `ctx` parameter on all service methods is optional. Existing route code like:

```typescript
const result = await service.create(actor, data);
```

continues to work exactly as before. A fresh `ServiceContext` with `{ hookState: {} }` is created internally.

> **Important behavior change inside transactions**: When a service method runs inside `withServiceTransaction`, ALL caught errors (both `ServiceError` and unknown errors wrapped in `ServiceError`) are **rethrown** instead of being returned as `{ error }`. This is by design .. the thrown error triggers automatic transaction rollback via Drizzle's auto-rollback mechanism. Callers inside `withServiceTransaction` should use try/catch or let errors propagate naturally. The `if (result.error) throw result.error` pattern shown below is defensive .. in practice, errors inside a tx will have already been rethrown before reaching that check. It exists for TypeScript type narrowing only.

When a route needs transactional atomicity across multiple service calls, it uses `withServiceTransaction`:

```typescript
import { withServiceTransaction } from '@repo/service-core';

app.post('/accommodations-with-review', async (c) => {
    const actor = getActor(c);
    const { accommodationData, reviewData } = await c.req.json();

    const result = await withServiceTransaction(async (ctx) => {
        const accommodation = await accommodationService.create(actor, accommodationData, ctx);
        if (accommodation.error) throw accommodation.error;

        const review = await reviewService.create(actor, reviewData, ctx);
        if (review.error) throw review.error;

        return { accommodation: accommodation.data, review: review.data };
    });

    return c.json({ data: result });
});
```

---

## Implementation Phases

### Phase 1: Types and Utilities

**Goal**: Establish the type foundation without breaking any existing code.

**Files to change**:

1. `packages/service-core/src/types/index.ts` -- Rename `ServiceContext` to `ServiceConfig`, define new `ServiceContext<THookState>` interface
2. `packages/service-core/src/base/base.service.ts` -- Update constructor to accept `ServiceConfig`
3. `packages/service-core/src/base/base.crud.service.ts` -- Update constructor to accept `ServiceConfig`
4. `packages/service-core/src/base/base.crud.permissions.ts` -- Update constructor (line 65-68) to accept `ServiceConfig` instead of `ServiceContext`
5. `packages/service-core/src/base/base.crud.related.service.ts` -- Update constructor (line 35) to accept `ServiceConfig` instead of `ServiceContext`. This class does not override any methods or hooks, so only the constructor type rename is needed.
6. `packages/service-core/src/utils/transaction.ts` -- Create `withServiceTransaction` utility (new file)
7. `packages/service-core/src/utils/index.ts` -- Export `withServiceTransaction`
8. `packages/service-core/src/index.ts` -- Export new types and utility

**Files to update (constructor type rename, search-and-replace)**:

- All concrete services in `packages/service-core/src/services/*/` that reference `ServiceContext` in their constructor
- All callers in `apps/api/` that construct services with `{ logger }` or `{}`

9. `packages/db/src/client.ts` -- Add `idle_in_transaction_session_timeout: 30000` to the PostgreSQL `Pool` constructor options as a safety net for transactions that escape `withServiceTransaction`'s `SET LOCAL statement_timeout`. This catches direct `withTransaction` callers and any code path that opens a transaction without the service-layer timeout guard. Alternatively, configure `idle_in_transaction_session_timeout=30000` in `docker-compose.yml` PostgreSQL command args (`-c idle_in_transaction_session_timeout=30000`). Choose ONE location (pool config preferred for deployment portability).

**Verification**: `pnpm typecheck` passes across all packages. Zero runtime changes.

### Phase 2: Base class ctx threading

**Goal**: Thread `ctx` through all base class methods, hooks, and `runWithLoggingAndValidation`. Fix the error swallowing bug.

**Files to change**:

1. `packages/service-core/src/base/base.service.ts` -- Add `ctx` to `runWithLoggingAndValidation`, fix catch block
2. `packages/service-core/src/base/base.crud.hooks.ts` -- Add `_ctx: ServiceContext` to all 20 lifecycle hook signatures
3. `packages/service-core/src/base/base.crud.read.ts` -- Add `ctx` to `getByField`, `getById`, `getBySlug`, `getByName`, `list`, `search`, `adminList`, `count`, `_executeAdminSearch`
4. `packages/service-core/src/base/base.crud.write.ts` -- Add `ctx` to `create`, `update`, `softDelete`, `hardDelete`, `restore`, `updateVisibility`, `setFeaturedStatus`
5. `packages/service-core/src/base/base.crud.admin.ts` -- Add `ctx` to `getAdminInfo`, `setAdminInfo`
6. `packages/service-core/src/base/base.crud.permissions.ts` -- Add `ctx` to `_executeSearch`, `_executeCount` abstract declarations
7. `packages/service-core/src/base/base.crud.read.ts` -- Update `_executeAdminSearch` (line 421) to accept `ctx: ServiceContext` as a **separate** second parameter (NOT added to `AdminSearchExecuteParams`). `AdminSearchExecuteParams` remains unchanged in this phase. Note: `_executeAdminSearch` is a protected method with a default implementation in `base.crud.read.ts`, NOT an abstract declaration in `base.crud.permissions.ts`.
8. `packages/service-core/src/base/base.crud.related.service.ts` -- No method or hook overrides to update (constructor already handled in Phase 1). Include here as a verification checkpoint: confirm it compiles cleanly after base class changes.

**Additionally**: All concrete service implementations of `_executeSearch`, `_executeCount`, and `_executeAdminSearch` must update their signatures to include the new `ctx` parameter. TypeScript will flag missing parameters during `pnpm typecheck`.

**Complete list of concrete services requiring signature updates** (21 files with `_executeSearch` implementations):

| # | Service File (relative to `packages/service-core/src/services/`) | Extends BaseCrudService | Has Hook Overrides |
|---|------------------------------------------------------------------|------------------------|--------------------|
| 1 | `accommodation/accommodation.service.ts` | Yes | Yes (stateful) |
| 2 | `accommodationReview/accommodationReview.service.ts` | Yes | Yes (stateful) |
| 3 | `amenity/amenity.service.ts` | Yes (via BaseCrudRelatedService) | No lifecycle hooks, permission hooks only |
| 4 | `attraction/attraction.service.ts` | Yes (via BaseCrudRelatedService) | No lifecycle hooks, permission hooks only |
| 5 | `destination/destination.service.ts` | Yes | Yes (stateful) |
| 6 | `destinationReview/destinationReview.service.ts` | Yes | Yes (stateful) |
| 7 | `event/event.service.ts` | Yes | Yes (stateful) |
| 8 | `eventLocation/eventLocation.service.ts` | Yes | No lifecycle hooks, permission hooks only |
| 9 | `eventOrganizer/eventOrganizer.service.ts` | Yes | No lifecycle hooks, permission hooks only |
| 10 | `exchange-rate/exchange-rate.service.ts` | Yes | No lifecycle hooks; has 4 custom public methods (see Section 9) |
| 11 | `feature/feature.service.ts` | Yes (via BaseCrudRelatedService) | No lifecycle hooks, permission hooks only |
| 12 | `owner-promotion/ownerPromotion.service.ts` | Yes | No lifecycle hooks, permission hooks only |
| 13 | `post/post.service.ts` | Yes | Yes (stateful) |
| 14 | `postSponsor/postSponsor.service.ts` | Yes | No lifecycle hooks, permission hooks only |
| 15 | `postSponsorship/postSponsorship.service.ts` | Yes | No lifecycle hooks, permission hooks only |
| 16 | `sponsorship/sponsorship.service.ts` | Yes | No lifecycle hooks, permission hooks only |
| 17 | `sponsorship/sponsorshipLevel.service.ts` | Yes | No lifecycle hooks, permission hooks only |
| 18 | `sponsorship/sponsorshipPackage.service.ts` | Yes | No lifecycle hooks, permission hooks only |
| 19 | `tag/tag.service.ts` | Yes (via BaseCrudRelatedService) | No lifecycle hooks, permission hooks only |
| 20 | `user/user.service.ts` | Yes | Yes: `_beforeCreate`, `_beforeUpdate` (stateless, slug normalization) |
| 21 | `userBookmark/userBookmark.service.ts` | Yes | No lifecycle hooks, permission hooks only |

**Note**: The "Has Hook Overrides" column above has been fully resolved. Only UserService (#20) has lifecycle hook overrides among the stateless services (`_beforeCreate` for slug generation, `_beforeUpdate` for normalization). All other stateless services only override permission hooks (`_can*`), which do NOT receive `ctx`. Services marked "via BaseCrudRelatedService" extend `BaseCrudRelatedService` which inherits from `BaseCrudService` .. `BaseCrudRelatedService` does not override any methods or hooks, so ctx threading applies transitively without additional changes to that intermediate class (its constructor rename to `ServiceConfig` IS required in Phase 1).

**Verification**: `pnpm typecheck` passes. All existing tests pass (ctx is optional, defaults to `{}`).

### Phase 3: Service hookState migrations

**Goal**: Replace all singleton mutable state in the 6 affected services with `ctx.hookState`.

**Services to migrate** (in suggested order):

1. **DestinationService** -- Most complex: `_updateId`, `_pendingPathUpdate`, `_lastDeletedDestinationSlug`, `_lastRestoredDestinationSlug`. Create `destination.types.ts`.
2. **AccommodationService** -- `_lastDeletedEntity`, `_lastRestoredAccommodation`. Create `accommodation.types.ts`.
3. **PostService** -- `_updateId`, `_lastDeletedPost`, `_lastRestoredPost`. Create `post.types.ts`.
4. **EventService** -- `_lastDeletedEvent`, `_lastRestoredEvent`. Create `event.types.ts`.
5. **AccommodationReviewService** -- `_lastDeletedAccommodationId`, `_lastRestoredAccommodationId`. Create `accommodationReview.types.ts`.
6. **DestinationReviewService** -- `_lastDeletedDestinationId`, `_lastRestoredDestinationIdForReview`. Create `destinationReview.types.ts`.

For each service:

1. Create `<service>.types.ts` with the typed hookState interface
2. Delete `private` mutable instance fields
3. Update `_before*` hooks to accept `ctx` and write to `ctx.hookState`
4. Update `_after*` hooks to accept `ctx` and read from `ctx.hookState`
5. Update overridden `update()` (DestinationService, PostService) to initialize and read `ctx.hookState`
6. Update all hook overrides in ALL concrete services (even stateless ones) to accept the new `_ctx` parameter

**Important**: ALL concrete services that override hooks (even stateless ones like TagService, AmenityService, etc.) must update their override signatures to include `_ctx: ServiceContext`. TypeScript will flag any signature mismatches during `pnpm typecheck`. This includes:

- Hook overrides (`_beforeCreate`, `_afterCreate`, etc.) .. add `_ctx: ServiceContext` as last param
- `_executeSearch` implementations .. add `ctx: ServiceContext` as last param (not prefixed with `_` since some implementations may use it)
- `_executeCount` implementations .. add `ctx: ServiceContext` as last param
- `_executeAdminSearch` overrides .. add `ctx: ServiceContext` as second param

**Caution**: Some existing hook overrides omit intermediate parameters that the base signature includes. For example, `AccommodationReviewService._afterCreate` and `_afterUpdate` (and similarly `DestinationReviewService._afterCreate` and `_afterUpdate`) currently omit the `_actor: Actor` parameter. TypeScript allows fewer parameters in an override, but when adding `_ctx: ServiceContext` as the last parameter, these overrides MUST first add `_actor: Actor` as the preceding parameter. Otherwise the `_ctx` parameter would be positionally mapped to `_actor`, causing type errors or silent bugs. Implementers should check all hook overrides for missing intermediate parameters before adding `_ctx`.

**Test file locations**: New tests should follow existing project conventions:

- Unit tests for base classes: `packages/service-core/test/base/`
- Unit tests for hookState isolation: `packages/service-core/test/services/<service-name>/`
- `withServiceTransaction` tests: `packages/service-core/test/utils/transaction.test.ts`

**Verification**: `pnpm typecheck` passes. All existing tests pass. Write new unit tests for concurrency safety.

### Phase 4: Cross-entity transaction wrapping

**Goal**: Wrap hooks that perform cross-entity writes in transactions using the `ctx.tx`.

**Key locations**:

1. `DestinationService.update()` -- Descendant path cascade (`updateDescendantPaths`) should use `ctx.tx` instead of creating a separate `withTransaction` call
2. `AccommodationReviewService._afterSoftDelete` / `_afterRestore` -- Stats recalculation should propagate `ctx.tx` to the accommodation model
3. `DestinationReviewService._afterSoftDelete` / `_afterRestore` -- Stats recalculation should propagate `ctx.tx` to the destination model
4. Any other hooks that call model methods should propagate `ctx.tx`

**Note**: This phase depends on SPEC-060 (model-layer tx support) being at least partially complete, since models need to accept `tx` parameters. If SPEC-060 is not ready, Phase 4 can be deferred, and the tx will be available on ctx but not yet propagated to models.

> **Independence note**: Phases 1-3 are fully self-contained and have ZERO dependency on SPEC-060. They depend only on SPEC-058 (for `QueryContext` type import). SPEC-060 is only needed for Phase 4, where `ctx.tx` is actually propagated to model methods. This means Phases 1-3 can be implemented and merged independently, providing full concurrency safety (hookState isolation) and the error-handling fix, without waiting for model-layer changes.

**Verification**: Integration tests (SPEC-061) verify multi-service transaction rollback.

---

## Acceptance Criteria

### Type System

- [ ] `ServiceConfig` type exported from `@repo/service-core` and used by all constructors
- [ ] `ServiceContext<THookState>` interface exported from `@repo/service-core` extending `QueryContext` from `@repo/db`
- [ ] `withServiceTransaction` utility exported from `@repo/service-core`, includes `SET LOCAL statement_timeout` guard with configurable timeout (default 30s)
- [ ] `pnpm typecheck` passes across all packages with zero `any` types introduced

### Method Signatures

- [ ] All 17 public methods on BaseCrud* classes accept `ctx?: ServiceContext` as last param
- [ ] All 20 lifecycle hooks in `BaseCrudHooks` accept `_ctx: ServiceContext` as last param
- [ ] `_executeSearch`, `_executeCount`, `_executeAdminSearch` accept `ctx: ServiceContext`
- [ ] `runWithLoggingAndValidation` accepts `ctx?: ServiceContext` and passes it to `execute`

### Error Handling

- [ ] `runWithLoggingAndValidation` rethrows `ServiceError` when `ctx.tx` is truthy (`base.service.ts` catch block)
- [ ] `runWithLoggingAndValidation` returns `{ error }` when `ctx.tx` is falsy (backward compat)

### Mutable State Migration

- [ ] AccommodationService: `_lastDeletedEntity` and `_lastRestoredAccommodation` replaced with `ctx.hookState`
- [ ] AccommodationReviewService: `_lastDeletedAccommodationId` and `_lastRestoredAccommodationId` replaced
- [ ] DestinationReviewService: `_lastDeletedDestinationId` and `_lastRestoredDestinationIdForReview` replaced
- [ ] DestinationService: `_updateId`, `_pendingPathUpdate`, `_lastDeletedDestinationSlug`, `_lastRestoredDestinationSlug` replaced
- [ ] EventService: `_lastRestoredEvent` and `_lastDeletedEvent` replaced
- [ ] PostService: `_updateId`, `_lastRestoredPost`, `_lastDeletedPost` replaced
- [ ] Zero `private _last*` or `private _update*` or `private _pending*` instance fields remain in any service

### Cross-service Propagation

- [ ] Hooks that call other services or models pass `ctx` (or `ctx.tx`) to maintain transaction scope
- [ ] Phase 3: Cross-service model calls still use `getDb()` (documented as intentional, pending SPEC-060)
- [ ] Phase 4: Cross-service model calls use `ctx.tx` when available

### Concrete Implementations

- [ ] All concrete `_executeSearch` implementations across all services accept `ctx: ServiceContext`
- [ ] All concrete `_executeCount` implementations across all services accept `ctx: ServiceContext`
- [ ] All concrete `_executeAdminSearch` overrides accept `ctx: ServiceContext` as second parameter
- [ ] All custom public methods on concrete services that perform DB operations accept `ctx?: ServiceContext` as last parameter (see Section 9 for known list)

### Backward Compatibility

- [ ] All existing route handlers in `apps/api` compile without changes (ctx is optional)
- [ ] All existing tests pass without modification
- [ ] All concrete service constructors that previously accepted `ServiceContext` now accept `ServiceConfig` with the same shape

### Tests

- [ ] `pnpm test` passes across all packages
- [ ] New unit tests verify hookState isolation under simulated concurrent requests
- [ ] New unit tests verify `runWithLoggingAndValidation` rethrows inside tx context
- [ ] New unit tests verify `withServiceTransaction` commits on success and rolls back on error

---

## Testing Strategy

### 1. hookState concurrency isolation

Simulate two concurrent requests to a service with mutable state and verify they don't interfere:

```typescript
describe('AccommodationService hookState isolation', () => {
    it('should not leak state between concurrent softDelete calls', async () => {
        const service = new AccommodationService({ logger: mockLogger });

        // Create two accommodations
        const entity1 = { id: '1', slug: 'hotel-a', destinationId: 'dest-1' };
        const entity2 = { id: '2', slug: 'hotel-b', destinationId: 'dest-2' };

        // Mock model to return different entities
        vi.spyOn(service['model'], 'findById')
            .mockResolvedValueOnce(entity1 as any)
            .mockResolvedValueOnce(entity2 as any);

        // Track revalidation calls
        const revalidationCalls: string[] = [];
        vi.spyOn(revalidationService, 'scheduleRevalidation')
            .mockImplementation(({ slug }) => { revalidationCalls.push(slug); });

        // Execute both soft deletes concurrently
        const [result1, result2] = await Promise.all([
            service.softDelete(adminActor, '1'),
            service.softDelete(adminActor, '2'),
        ]);

        // Each should revalidate its OWN entity, not the other's
        expect(revalidationCalls).toContain('hotel-a');
        expect(revalidationCalls).toContain('hotel-b');
        expect(revalidationCalls).toHaveLength(2);
    });
});
```

### 2. Transaction rollback on ServiceError

```typescript
describe('runWithLoggingAndValidation tx behavior', () => {
    it('should rethrow ServiceError when ctx.tx is present', async () => {
        const service = new AccommodationService({ logger: mockLogger });

        await expect(
            withServiceTransaction(async (ctx) => {
                // This will throw a ServiceError internally
                const result = await service.create(actor, invalidData, ctx);
                // Should NOT reach here -- error should propagate
                return result;
            })
        ).rejects.toThrow(); // Transaction rolled back
    });

    it('should return { error } when ctx.tx is absent (backward compat)', async () => {
        const service = new AccommodationService({ logger: mockLogger });
        const result = await service.create(actor, invalidData);
        expect(result.error).toBeDefined();
        // No throw -- backward compatible
    });
});
```

### 3. withServiceTransaction commit/rollback

```typescript
describe('withServiceTransaction', () => {
    it('should commit when function succeeds', async () => {
        const result = await withServiceTransaction(async (ctx) => {
            expect(ctx.tx).toBeDefined();
            expect(ctx.hookState).toEqual({});
            return 'success';
        });
        expect(result).toBe('success');
    });

    it('should rollback when function throws', async () => {
        await expect(
            withServiceTransaction(async (_ctx) => {
                throw new Error('deliberate failure');
            })
        ).rejects.toThrow('deliberate failure');
        // Verify no data was committed (check DB state)
    });
});
```

### 4. DestinationService update with hookState

```typescript
describe('DestinationService update hookState', () => {
    it('should store updateId and pendingPathUpdate on ctx.hookState', async () => {
        const service = new DestinationService({ logger: mockLogger });
        const ctx: ServiceContext<DestinationHookState> = { hookState: {} };

        // Mock model
        vi.spyOn(service['model'], 'findById').mockResolvedValue(mockDestination);
        vi.spyOn(service['model'], 'update').mockResolvedValue(updatedDestination);

        await service.update(actor, 'dest-id', updateData, ctx);

        // hookState should have been used, not instance fields
        expect((service as any)._updateId).toBeUndefined(); // Field no longer exists
        expect((service as any)._pendingPathUpdate).toBeUndefined(); // Field no longer exists
    });
});
```

### 5. Backward compatibility (existing code without ctx)

```typescript
describe('backward compatibility', () => {
    it('should work without ctx parameter (existing callers)', async () => {
        const service = new AccommodationService({ logger: mockLogger });

        // Mock model
        vi.spyOn(service['model'], 'findById').mockResolvedValue(mockAccommodation);

        // Call WITHOUT ctx -- must continue working exactly as before
        const result = await service.getById(adminActor, 'some-id');

        expect(result.data).toBeDefined();
        // ServiceError should be returned (not thrown) since there's no tx
    });

    it('should return { error } for validation failure without ctx', async () => {
        const service = new AccommodationService({ logger: mockLogger });

        const result = await service.create(adminActor, invalidData);

        // Without ctx (no tx), ServiceError is returned, not thrown
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });
});
```

### 6. hookState initialization edge case

```typescript
describe('hookState initialization', () => {
    it('should initialize hookState when ctx is provided without hookState', async () => {
        const service = new AccommodationService({ logger: mockLogger });
        vi.spyOn(service['model'], 'findById').mockResolvedValue(mockAccommodation);
        vi.spyOn(service['model'], 'softDelete').mockResolvedValue(1);

        // Pass ctx with tx but WITHOUT hookState -- should NOT crash
        const ctx: ServiceContext = { tx: mockTx };
        const result = await service.softDelete(adminActor, 'some-id', ctx);

        // Should succeed -- hookState is initialized internally via spread pattern
        expect(result.data).toBeDefined();
    });
});
```

### 7. Unknown error rethrow inside transaction

```typescript
describe('unknown error handling inside tx', () => {
    it('should rethrow unknown errors when ctx.tx is present', async () => {
        const service = new AccommodationService({ logger: mockLogger });

        // Force an unexpected error (not ServiceError, not DbError)
        vi.spyOn(service['model'], 'create').mockRejectedValue(
            new TypeError('unexpected type error')
        );

        await expect(
            withServiceTransaction(async (ctx) => {
                return service.create(adminActor, validData, ctx);
            })
        ).rejects.toThrow(); // Wrapped ServiceError is rethrown, tx rolls back
    });
});
```

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Touches every service's hook signatures** -- breaking change for any external overrides | HIGH | All parameters are additive (new last param), default no-op hooks accept and ignore `_ctx`. Concrete service hooks get `_ctx` added. TypeScript compiler catches any missed overrides. |
| **`ServiceContext` rename to `ServiceConfig`** -- import path changes across codebase | MEDIUM | Provide deprecated alias. Use search-and-replace. The type shape is identical. |
| **hookState bag is loosely typed at base class level** | LOW | Generic `THookState` parameter lets concrete services define strict types. Base class uses `Record<string, unknown>` default. Services that need strict typing narrow the generic. |
| **Phase 4 depends on SPEC-060** (model tx propagation) | MEDIUM | Phases 1-3 are self-contained and provide full concurrency safety. Phase 4 adds atomicity for cross-entity writes and can be deferred. |
| **Error swallowing fix changes behavior inside transactions** | MEDIUM | Only changes behavior when `ctx.tx` is truthy (inside transactions). Outside transactions, behavior is identical. No existing code passes `ctx` today, so no existing behavior changes. |
| **Performance overhead of creating `ctx` object per request** | LOW | One small object allocation per request. Negligible compared to DB I/O. |
| **Non-ServiceError handling in catch block** | MEDIUM | The catch block has three branches: (1) ServiceError .. swallowed, (2) DbError .. rethrown, (3) unknown errors .. wrapped in ServiceError and swallowed. Both branches 1 and 3 must rethrow when `ctx.tx` is truthy. See Section 6 for the complete fix. |
| **SPEC-052 implementation order ambiguity** | LOW | Spec recommends SPEC-059 first, then SPEC-052. If reversed, SPEC-052 makes `AdminSearchExecuteParams` generic first, then SPEC-059 adds `ctx` to the already-generic signature. Both orders work. The final signature is identical: `_executeAdminSearch(params: AdminSearchExecuteParams<TEntityFilters>, ctx: ServiceContext)`. |
| **Invalid transaction connection state** | MEDIUM | When a method receives `ctx?.tx` and the transaction connection is invalid (closed, timed out), the error from the underlying database driver is propagated unchanged. It is NOT caught or retried by the service layer. Callers should implement retry logic at the API route level if needed. `withServiceTransaction()` calls should be wrapped in explicit error handling for transaction-specific errors: `TransactionRollbackError`, connection timeouts, deadlocks. Log the error with context (entity ID, operation type) for debugging. |
| **Transaction timeout / long-running tx holding locks** | MEDIUM | Drizzle ORM does NOT expose a transaction timeout config. `PgTransactionConfig` only supports `isolationLevel`, `accessMode`, and `deferrable` (verified in <drizzle-orm@0.44.x> source: `pg-core/session.d.ts`). A long-running transaction could hold row/table locks indefinitely, degrading concurrent request performance. **Mitigation (implemented in Section 7)**: `withServiceTransaction` executes `SET LOCAL statement_timeout = ${timeout}` as its first statement (default 30s, configurable via `options.timeoutMs`). `SET LOCAL` scopes the timeout to the current transaction only and auto-resets on commit/rollback. Do NOT use `Promise.race` as it can resolve the promise while leaving the transaction open on the database. **Safety net**: Set `idle_in_transaction_session_timeout = 30000` at the PostgreSQL connection pool level in `packages/db/src/client.ts` (the `Pool` constructor options) or in `docker-compose.yml` PostgreSQL configuration (`-c idle_in_transaction_session_timeout=30000`). This catches cases where code uses `withTransaction` directly instead of `withServiceTransaction`. |

---

## Parallel Execution Guide for Agents

> **CRITICAL**: This section is the authoritative reference for any agent implementing SPEC-058, SPEC-059, SPEC-060, or SPEC-061. Read this ENTIRELY before starting work.

### SPEC-059's Position in the Transaction Safety Chain

```
SPEC-058 ── MUST complete first (provides DrizzleClient, QueryContext)
    │
    ├──► SPEC-060 (model tx)        ┐
    │                               ├─ CAN RUN IN PARALLEL
    └──► SPEC-059 Phases 1-3 ◄─────┘
                │
                │   SPEC-060 must be merged
                │          │
                ▼          ▼
         SPEC-059 Phase 4 (needs BOTH 059 Phases 1-3 AND 060 done)
                │
                ▼
         SPEC-061 (integration tests, validates everything)
```

### Pre-Conditions (MUST verify before starting)

- [ ] SPEC-058 PR is **merged to `main`**
- [ ] `DrizzleClient` type is exported from `@repo/db`
- [ ] `QueryContext` interface is exported from `@repo/db`
- [ ] `pnpm typecheck` passes on clean `main`

**If ANY of these fail, STOP. Do not start SPEC-059.**

### Phase-by-Phase Execution Rules

#### Phases 1-3: INDEPENDENT of SPEC-060

Phases 1-3 have **ZERO dependency on SPEC-060**. They can run in parallel with SPEC-060 on separate branches.

- **Phase 1**: Rename `ServiceContext` → `ServiceConfig`, define new `ServiceContext<THookState>`, create `withServiceTransaction()`. Pure type/utility work.
- **Phase 2**: Thread `ctx?: ServiceContext` through all 17 public methods and 20 lifecycle hooks in base classes. Mechanical signature changes.
- **Phase 3**: Migrate 6 services from mutable instance fields (`_lastDeletedEntity` etc.) to `ctx.hookState`. Concurrency safety fix.

**After Phases 1-3 are done**:

1. `pnpm typecheck` must pass
2. `pnpm test` must pass
3. All existing service tests work (ctx is optional, defaults to `{}`)
4. **Merge Phases 1-3 to `main`** -- do NOT wait for Phase 4

#### Phase 4: DEPENDS ON SPEC-060

Phase 4 propagates `ctx.tx` to model method calls inside lifecycle hooks. This requires model methods to ACCEPT `tx` (which SPEC-060 adds).

**Pre-conditions for Phase 4**:

- [ ] SPEC-059 Phases 1-3 are **merged to `main`**
- [ ] SPEC-060 is **merged to `main`**
- [ ] `pnpm typecheck` passes on clean `main` with both merged

**What Phase 4 does**:

- In `DestinationService.update()`: pass `ctx.tx` to descendant path cascade model calls
- In `AccommodationReviewService._afterSoftDelete/_afterRestore`: pass `ctx.tx` to stats recalculation
- In `DestinationReviewService._afterSoftDelete/_afterRestore`: pass `ctx.tx` to stats recalculation
- In any hook calling model methods: pass `ctx.tx` as the `tx` parameter

**If SPEC-060 is NOT merged yet**: STOP after Phase 3. Document progress. Phase 4 will be picked up after SPEC-060 merges.

### What SPEC-059 Produces (Other Specs Consume These)

| Artifact | File | Consumer Specs |
|----------|------|---------------|
| `ServiceConfig` type (renamed from old ServiceContext) | `packages/service-core/src/types/index.ts` | All 21 service constructors |
| `ServiceContext<THookState>` runtime type | `packages/service-core/src/types/index.ts` | SPEC-064 (extends pattern) |
| `withServiceTransaction()` utility | `packages/service-core/src/utils/transaction.ts` | SPEC-064 (billing uses this) |
| `ctx` parameter on all 17 public methods | `packages/service-core/src/base/*.ts` | SPEC-064 (billing services thread ctx) |
| hookState pattern (replaces singleton fields) | 6 service files | Pattern reference for future services |

### What SPEC-059 Does NOT Do (Boundaries)

- Does NOT add `tx` parameter to model subclass methods (that's SPEC-060)
- Does NOT touch `@repo/db` package at all (only `@repo/service-core`)
- Does NOT create integration test infrastructure (that's SPEC-061)
- Does NOT touch billing service files (that's SPEC-064)
- Does NOT touch API route files

### Cross-Spec Merge Conflict Risk

| Spec | Risk | Affected Files | Mitigation |
|------|------|---------------|------------|
| SPEC-051 | Low | Different methods in `base.crud.permissions.ts` | Independent. SPEC-051 adds `_canAdminList()`, SPEC-059 threads `ctx` through existing hooks. **NOTE (GAP-051-005)**: `_canAdminList()` is NOT in SPEC-059's 11-hook ctx threading list. When implementing SPEC-059, include `_canAdminList` (and any future `_canAdminGetInfo`/`_canAdminSetInfo` hooks from GAP-051-003) in the signature update sweep. |
| SPEC-052 | Low | `_executeAdminSearch()` signature in 6 services | Both modify the same method signature. Final combined form: `_executeAdminSearch(params: AdminSearchExecuteParams<TEntityFilters>, _ctx: ServiceContext)`. Order doesn't matter -- whoever goes second adds their parameter. |
| SPEC-055 | None | No shared files | SPEC-055 is DB layer, SPEC-059 is service layer. |
| SPEC-060 | None (parallel) | No shared files | SPEC-060 is DB layer (`@repo/db`), SPEC-059 is service layer (`@repo/service-core`). Phase 4 depends on 060 being DONE, but there are no merge conflicts. |
| SPEC-063 | None | No shared files | Lifecycle state changes are orthogonal to transaction threading. |

### Communication Protocol for Parallel Agents

If SPEC-059 and SPEC-060 agents are running in parallel:

1. **SPEC-059 agent**: Implement Phases 1-3. Merge. Then CHECK if SPEC-060 is merged.
   - If YES → proceed with Phase 4
   - If NO → STOP. Document "Phase 4 pending SPEC-060 merge" and return
2. **SPEC-060 agent**: Implement all phases. Merge. Then CHECK if SPEC-059 Phases 1-3 are merged.
   - If YES → notify that Phase 4 can proceed (or a new agent can pick it up)
   - If NO → nothing to do, SPEC-060 is complete regardless
3. **Phase 4 pickup**: Whichever finishes SECOND should check if both are merged and start Phase 4, OR a new agent is launched specifically for Phase 4.

---

## Out of Scope

- **Model-layer tx propagation**: Adding `tx` parameter to `BaseModel.findById()`, `BaseModel.create()`, etc. is SPEC-060.
- **BaseModel interface changes**: `QueryContext` type definition and model method signatures are SPEC-058.
- **Integration tests**: End-to-end multi-service transaction tests are SPEC-061.
- **Billing services**: `BillingSettingsService`, `ExchangeRateService`, and all 7 billing files in `packages/service-core/src/services/billing/` are explicitly OUT OF SCOPE for SPEC-059. The `ctx?: QueryContext` threading for these 7 files is owned by SPEC-064 Phase 0. SPEC-059 Phase 4 covers ONLY the 6 `BaseCrudService` hook migrations listed in the Acceptance Criteria (AccommodationService, AccommodationReviewService, DestinationReviewService, DestinationService, EventService, PostService). **Verification**: After SPEC-059 Phase 4 is complete, confirm that SPEC-064 Phase 0 has processed (or will process) the 7 billing service-core files independently.
- **Request-scoped context injection**: Automatic injection of `ServiceContext` from Hono middleware (e.g., `c.get('serviceCtx')`) is a future enhancement, not part of this spec.
- **Optimistic locking / version columns**: Not addressed here. TOCTOU races are mitigated by transaction isolation but not fully eliminated without row-level locking.
- **Distributed transactions**: Cross-database or cross-service transactions (e.g., billing + hospeda) are out of scope.

---

## Estimated Effort

- **Phase 1**: 1 day (types, utility, constructor rename)
- **Phase 2**: 3 days (7 base class files + 21 concrete service signature updates + error handling fix + tests)
- **Phase 3**: 2 days (6 service hookState migrations + tests)
- **Phase 4**: 1 day (cross-entity transaction wrapping, depends on SPEC-058/SPEC-060)

**Total**: 6-7 days
