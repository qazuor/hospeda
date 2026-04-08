# SPEC-052: Type-Safe Entity Filters via Generics

> **Status**: draft
> **Priority**: P2
> **Complexity**: Medium
> **Origin**: SPEC-049 GAP-049-036
> **Created**: 2026-03-21
> **Updated**: 2026-04-02 (added SPEC-059 cross-dependency)

## Problem Statement

In `adminList()` (defined in `BaseCrudRead`, file `packages/service-core/src/base/base.crud.read.ts`), the Zod-parsed params are immediately cast to `Record<string, unknown>`:

```ts
const validParams = parseResult.data as Record<string, unknown>;
```

Then, when base fields are destructured out, the remaining `entityFilters` inherits `Record<string, unknown>` due to the index signature `[key: string]: unknown` in the type assertion. This means:

1. Every service that overrides `_executeAdminSearch()` must manually `as`-cast `entityFilters` to access entity-specific fields.
2. TypeScript cannot verify that a service correctly accesses fields that exist in the schema.
3. Typos in field names (e.g., `entityFilters.mniPrice` instead of `minPrice`) compile silently.
4. The `AdminSearchExecuteParams` type defines `entityFilters: Record<string, unknown>`, propagating the lack of type safety.

### Where Type Safety Is Lost (3 points)

1. **`adminSearchSchema` property** (`base.crud.permissions.ts:42`): Declared as `protected adminSearchSchema?: ZodType` .. bare `ZodType` loses all shape information.
2. **`adminList()` cast** (`base.crud.read.ts:~322`): `parseResult.data as Record<string, unknown>` discards the Zod-inferred type.
3. **`AdminSearchExecuteParams` type** (`service-core/src/types/index.ts:~200`): `entityFilters: Record<string, unknown>` propagates untyped filters to all overrides.

## Proposed Solution (Option B: Method-Level Generics)

Make `AdminSearchExecuteParams` generic over the entity filter type, and export a utility type `EntityFilters<TSchema>` from `@repo/schemas` that computes `Omit<z.infer<TSchema>, AdminSearchBaseKeys>`. Each service override specifies its concrete entity filter type. No changes to the BaseCrud class hierarchy generic signature (stays at 5 generics).

### Why Not Class-Level Generic (Option A)

Adding a 6th generic `TAdminSearchSchema` to the class hierarchy would require propagating it through 7 base classes (`BaseCrudPermissions` -> `BaseCrudHooks` -> `BaseCrudRead` -> `BaseCrudWrite` -> `BaseCrudAdmin` -> `BaseCrudService` -> `BaseCrudRelatedService`) AND updating all 16 service declarations. The type safety benefit is identical to Option B, but with ~5x more churn.

## Scope

### In Scope

1. Create `EntityFilters<TSchema>` utility type in `@repo/schemas`
2. Make `AdminSearchExecuteParams` generic: `AdminSearchExecuteParams<TEntityFilters>`
3. Update the 6 services that override `_executeAdminSearch()` to use typed filters (remove `as` casts)
4. Upgrade `adminSearchSchema` property type from `ZodType` to `ZodObject<ZodRawShape>` for better type narrowing
5. Export `ADMIN_SEARCH_BASE_KEYS` readonly array and `AdminSearchBaseKeys` type from `@repo/schemas` for documentation/utility purposes

### Out of Scope

- Changing the AdminSearchSchema definitions themselves (Zod schemas stay as-is)
- Runtime validation changes (Zod already handles this at runtime)
- Frontend type changes
- Changing the 5-generic class hierarchy signature
- Changing the `adminList()` public method signature (it still receives `Record<string, unknown>` from route handlers)
- The 10 services that use the default `_executeAdminSearch()` (they need no changes .. the base implementation merges `entityFilters` into `where` via spread, which works with any type)
- Exhaustive field handling enforcement (see Non-Goals below)

### Non-Goals

**Compile-time exhaustive field handling is NOT a goal.** TypeScript does not error when an object property is unused. If a schema adds a field and a service override doesn't destructure it, there is no TS error. Achieving this would require a fundamentally different pattern (e.g., mapped handler objects). What this spec DOES guarantee:

- Accessing a property that doesn't exist in the schema produces a TS error
- No more manual `as` casts needed in overrides
- IDE autocompletion for entity filter fields
- Typos are caught at compile time

## Technical Design

### Step 1: Create `EntityFilters<TSchema>` Utility Type

**File**: `packages/schemas/src/common/admin-search.schema.ts`

Add after the existing `AdminSearchBase` type export:

```ts
import type { ZodObject, ZodRawShape } from 'zod';

/**
 * Union type of all base admin search field names.
 * Auto-derived from AdminSearchBaseSchema to stay in sync automatically.
 * If a field is added to AdminSearchBaseSchema, it is automatically excluded
 * from EntityFilters without any manual update.
 */
export type AdminSearchBaseKeys = keyof z.infer<typeof AdminSearchBaseSchema>;

/**
 * Runtime array of base admin search keys.
 * Derived from AdminSearchBaseSchema.shape to stay in sync with the type.
 * Useful for documentation, runtime utilities, or dynamic key filtering.
 */
export const ADMIN_SEARCH_BASE_KEYS: readonly AdminSearchBaseKeys[] =
    Object.keys(AdminSearchBaseSchema.shape) as AdminSearchBaseKeys[];

/**
 * Extracts entity-specific filter fields from a full AdminSearchSchema.
 * Strips out base fields (page, pageSize, search, sort, status, includeDeleted, createdAfter, createdBefore)
 * leaving only the entity-specific filter fields with their inferred types.
 *
 * @example
 * ```ts
 * type AccommodationFilters = EntityFilters<typeof AccommodationAdminSearchSchema>;
 * // => { type?: AccommodationType; destinationId?: string; ownerId?: string; isFeatured?: boolean; minPrice?: number; maxPrice?: number }
 * ```
 */
export type EntityFilters<TSchema extends ZodObject<ZodRawShape>> =
    Omit<z.infer<TSchema>, AdminSearchBaseKeys>;
```

**Notes**:
- `AdminSearchBaseKeys` is **derived from the schema type** (`keyof z.infer<typeof AdminSearchBaseSchema>`), NOT a manually maintained list. This eliminates the risk of the key list drifting out of sync with the schema. If someone adds a field to `AdminSearchBaseSchema`, it's automatically excluded from `EntityFilters`.
- `ADMIN_SEARCH_BASE_KEYS` runtime array is derived from `AdminSearchBaseSchema.shape` via `Object.keys()`. The `.shape` property is available on `ZodObject` and contains the raw field definitions.
- The `ZodObject<ZodRawShape>` constraint is sufficient because all 16 AdminSearchSchemas are produced by `AdminSearchBaseSchema.extend({...})`, which returns `ZodObject`.
- `Omit<>` preserves optionality. If a field is `z.string().optional()`, the inferred type `string | undefined` is preserved after `Omit`. This works because `z.infer` produces TypeScript **type aliases** (not interfaces), and `Omit` is defined through `Pick`, which TypeScript's compiler treats as modifier-preserving when the key set derives from `keyof T`. The `?` optional marker is retained on all surviving properties.
- The `ZodObject` and `ZodRawShape` imports must come from `'zod'` (add to existing import: `import { z, type ZodObject, type ZodRawShape } from 'zod'` or use `z.ZodObject<z.ZodRawShape>` to avoid separate import).
- **Alternative to `Object.keys()`**: Zod also offers `AdminSearchBaseSchema.keyof().options` as a more "official" way to get field names. `Object.keys(schema.shape)` is widely used and works correctly, but `schema.keyof()` is the Zod-idiomatic alternative. Either approach is acceptable.
- **Export chain**: The file is at `packages/schemas/src/common/admin-search.schema.ts`. It is re-exported via `packages/schemas/src/common/index.ts` (line 20: `export * from './admin-search.schema.js'`), which chains up to `packages/schemas/src/index.ts`. Any new `export` added to the schema file is automatically available as `import { ... } from '@repo/schemas'`. No barrel file changes needed.

### Step 2: Make `AdminSearchExecuteParams` Generic

**File**: `packages/service-core/src/types/index.ts`

Change from:
```ts
export type AdminSearchExecuteParams = {
    readonly where: Record<string, unknown>;
    readonly entityFilters: Record<string, unknown>;
    readonly pagination: { readonly page: number; readonly pageSize: number };
    readonly sort: { readonly sortBy: string; readonly sortOrder: 'asc' | 'desc' };
    readonly search?: SQL;
    readonly extraConditions?: SQL[];
    readonly actor: Actor;
};
```

Change to:
```ts
export type AdminSearchExecuteParams<TEntityFilters = Record<string, unknown>> = {
    readonly where: Record<string, unknown>;
    readonly entityFilters: TEntityFilters;
    readonly pagination: { readonly page: number; readonly pageSize: number };
    readonly sort: { readonly sortBy: string; readonly sortOrder: 'asc' | 'desc' };
    readonly search?: SQL;
    readonly extraConditions?: SQL[];
    readonly actor: Actor;
};
```

**Notes**:
- The default `= Record<string, unknown>` ensures backward compatibility. All existing code that uses `AdminSearchExecuteParams` without a type argument continues to work identically.
- The `adminList()` method in `BaseCrudRead` will continue to use `AdminSearchExecuteParams` (without type arg), which resolves to the default `Record<string, unknown>`. This is correct because `adminList()` dynamically destructures the parsed params and doesn't know the entity type at that level.

### Step 3: Upgrade `adminSearchSchema` Property Type

**File**: `packages/service-core/src/base/base.crud.permissions.ts`

Change from:
```ts
protected adminSearchSchema?: ZodType;
```

Change to:
```ts
protected adminSearchSchema?: ZodObject<ZodRawShape>;
```

**Notes**:
- The file currently imports `ZodObject` and `ZodType` from `zod` at line 2 (`import type { ZodObject, ZodType } from 'zod';`). `ZodObject` is already imported.. only `ZodRawShape` needs to be added. Change to: `import type { ZodObject, ZodRawShape, ZodType } from 'zod';`. `ZodType` may be removable if it's no longer used elsewhere in the file after this change (check first.. it is referenced in other properties or method signatures beyond `adminSearchSchema`).
- All 16 services assign schemas produced by `AdminSearchBaseSchema.extend({...})` which returns `ZodObject`. This change is safe.
- The `DestinationReviewAdminSearchSchema` overrides `status` with `z.unknown().transform(...)`. This is a **field-level** transform, not an object-level one. When `.extend()` is called on `AdminSearchBaseSchema` (a `ZodObject`), individual field transforms do NOT change the container type. The result is still a `ZodObject`, NOT a `ZodEffects`. This has been verified against Zod's source code and documentation. Object-level transforms (e.g., `schema.transform(...)` or `schema.refine(...)`) would return `ZodEffects`, but field-level ones do not.

### Step 4: Verify Base `_executeAdminSearch()` Signature (NO CODE CHANGES)

**File**: `packages/service-core/src/base/base.crud.read.ts`

**No changes to this file.** The default implementation already uses the unparameterized `AdminSearchExecuteParams`, which resolves to `AdminSearchExecuteParams<Record<string, unknown>>` after Step 2. This is a verification checkpoint, not an implementation step.

Verify that:
- The base `_executeAdminSearch` signature still compiles after Steps 1-3
- The `adminList()` method still compiles (it passes `entityFilters: Record<string, unknown>` from the rest spread)

### Step 5: Update the 6 Service Overrides

Each of the 6 services that override `_executeAdminSearch()` gets a typed signature. The `as` cast on `entityFilters` is removed.

**Import pattern for all 6 services**:
- `EntityFilters`: Add to the existing `import { ... } from '@repo/schemas'` block (each service already imports its `XxxAdminSearchSchema` from there)
- `AdminSearchExecuteParams`: Already imported from `'../../types'` (relative path within service-core). No import changes needed for this type.

#### 5a. AccommodationService

**File**: `packages/service-core/src/services/accommodation/accommodation.service.ts`

**Before**:
```ts
protected override async _executeAdminSearch(
    params: AdminSearchExecuteParams
): Promise<PaginatedListOutput<Accommodation>> {
    const { entityFilters, ...rest } = params;
    const { minPrice, maxPrice, ...simpleFilters } = entityFilters as {
        minPrice?: number;
        maxPrice?: number;
        [key: string]: unknown;
    };
    // ...
}
```

**After**:
```ts
// Add EntityFilters to the EXISTING @repo/schemas import block (do NOT create a new import line).
// The service already imports AccommodationAdminSearchSchema from '@repo/schemas'.
// Just add EntityFilters to that same import statement.

type AccommodationEntityFilters = EntityFilters<typeof AccommodationAdminSearchSchema>;

protected override async _executeAdminSearch(
    params: AdminSearchExecuteParams<AccommodationEntityFilters>
): Promise<PaginatedListOutput<Accommodation>> {
    const { entityFilters, ...rest } = params;
    const { minPrice, maxPrice, ...simpleFilters } = entityFilters;
    // minPrice is number | undefined (inferred from schema)
    // maxPrice is number | undefined (inferred from schema)
    // simpleFilters is { type?: AccommodationType; destinationId?: string; ownerId?: string; isFeatured?: boolean }

    const extraConditions: SQL[] = [...(params.extraConditions ?? [])];
    if (minPrice !== undefined) {
        extraConditions.push(sql`(${accommodations.price}->>'price')::numeric >= ${minPrice}`);
    }
    if (maxPrice !== undefined) {
        extraConditions.push(sql`(${accommodations.price}->>'price')::numeric <= ${maxPrice}`);
    }

    return super._executeAdminSearch({
        ...rest,
        entityFilters: simpleFilters,
        extraConditions
    });
}
```

**Entity-specific fields** (6): `type`, `destinationId`, `ownerId`, `isFeatured`, `minPrice`, `maxPrice`
**Override reason**: `minPrice`/`maxPrice` require raw SQL for JSONB `price->>'price'` extraction.

#### 5b. EventService

**File**: `packages/service-core/src/services/event/event.service.ts`

**After**:
```ts
// Add EntityFilters to the EXISTING @repo/schemas import block.
// The service already imports EventAdminSearchSchema (in a separate value import).

type EventEntityFilters = EntityFilters<typeof EventAdminSearchSchema>;

protected override async _executeAdminSearch(
    params: AdminSearchExecuteParams<EventEntityFilters>
): Promise<PaginatedListOutput<Event>> {
    const { entityFilters, ...rest } = params;
    const { startDateAfter, startDateBefore, endDateAfter, endDateBefore, ...simpleFilters } = entityFilters;
    // All 4 date fields are Date | undefined (inferred)
    // simpleFilters is { category?: EventCategory; locationId?: string; organizerId?: string; authorId?: string; isFeatured?: boolean }

    const extraConditions: SQL[] = [...(params.extraConditions ?? [])];
    if (startDateAfter) {
        extraConditions.push(sql`(${eventTable.date}->>'start')::timestamptz >= ${startDateAfter}`);
    }
    if (startDateBefore) {
        extraConditions.push(sql`(${eventTable.date}->>'start')::timestamptz <= ${startDateBefore}`);
    }
    if (endDateAfter) {
        extraConditions.push(sql`(${eventTable.date}->>'end')::timestamptz >= ${endDateAfter}`);
    }
    if (endDateBefore) {
        extraConditions.push(sql`(${eventTable.date}->>'end')::timestamptz <= ${endDateBefore}`);
    }

    return super._executeAdminSearch({
        ...rest,
        entityFilters: simpleFilters,
        extraConditions
    });
}
```

**Entity-specific fields** (9): `category`, `locationId`, `organizerId`, `authorId`, `isFeatured`, `startDateAfter`, `startDateBefore`, `endDateAfter`, `endDateBefore`
**Override reason**: Date fields require raw SQL for JSONB `date->>'start'` / `date->>'end'` extraction.

#### 5c. AccommodationReviewService

**File**: `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts`

**After**:
```ts
// Add EntityFilters to the EXISTING @repo/schemas import block.
// The service already imports AccommodationReviewAdminSearchSchema.

type AccommodationReviewEntityFilters = EntityFilters<typeof AccommodationReviewAdminSearchSchema>;

protected override async _executeAdminSearch(
    params: AdminSearchExecuteParams<AccommodationReviewEntityFilters>
): Promise<PaginatedListOutput<AccommodationReview>> {
    const { entityFilters, ...rest } = params;
    const { minRating, maxRating, ...simpleFilters } = entityFilters;
    // minRating is number | undefined, maxRating is number | undefined
    // simpleFilters is { accommodationId?: string; userId?: string }

    const extraConditions: SQL[] = [...(params.extraConditions ?? [])];
    if (minRating !== undefined) {
        extraConditions.push(gte(accommodationReviews.averageRating, minRating.toString()));
    }
    if (maxRating !== undefined) {
        extraConditions.push(lte(accommodationReviews.averageRating, maxRating.toString()));
    }

    return super._executeAdminSearch({
        ...rest,
        entityFilters: simpleFilters,
        extraConditions
    });
}
```

**Entity-specific fields** (4): `accommodationId`, `userId`, `minRating`, `maxRating`
**Override reason**: `minRating`/`maxRating` require `gte`/`lte` SQL on `averageRating` column (not equality).

#### 5d. DestinationReviewService

**File**: `packages/service-core/src/services/destinationReview/destinationReview.service.ts`

**After**:
```ts
// Add EntityFilters to the EXISTING @repo/schemas import block.
// The service already imports DestinationReviewAdminSearchSchema.

type DestinationReviewEntityFilters = EntityFilters<typeof DestinationReviewAdminSearchSchema>;

protected override async _executeAdminSearch(
    params: AdminSearchExecuteParams<DestinationReviewEntityFilters>
): Promise<PaginatedListOutput<DestinationReview>> {
    const { entityFilters, ...rest } = params;
    const { minRating, maxRating, ...simpleFilters } = entityFilters;

    const extraConditions: SQL[] = [...(params.extraConditions ?? [])];
    if (minRating !== undefined) {
        extraConditions.push(gte(destinationReviews.averageRating, minRating.toString()));
    }
    if (maxRating !== undefined) {
        extraConditions.push(lte(destinationReviews.averageRating, maxRating.toString()));
    }

    return super._executeAdminSearch({
        ...rest,
        entityFilters: simpleFilters,
        extraConditions
    });
}
```

**Entity-specific fields** (4): `destinationId`, `userId`, `minRating`, `maxRating`
**Override reason**: Same as AccommodationReview. Note: `status` is overridden at schema level to always be `'all'` (table has no `lifecycleState`), so it's handled as a base field, not an entity filter.

#### 5e. SponsorshipService

**File**: `packages/service-core/src/services/sponsorship/sponsorship.service.ts`

**After**:
```ts
// Add EntityFilters to the EXISTING @repo/schemas import block.
// The service already imports SponsorshipAdminSearchSchema.

type SponsorshipEntityFilters = EntityFilters<typeof SponsorshipAdminSearchSchema>;

protected override async _executeAdminSearch(
    params: AdminSearchExecuteParams<SponsorshipEntityFilters>
): Promise<PaginatedListOutput<Sponsorship>> {
    const { entityFilters, ...rest } = params;
    const { sponsorshipStatus, ...otherFilters } = entityFilters;
    // sponsorshipStatus is SponsorshipStatusEnum | undefined

    const mappedFilters: Record<string, unknown> = { ...otherFilters };
    if (sponsorshipStatus) {
        mappedFilters.status = sponsorshipStatus;
    }

    return super._executeAdminSearch({ ...rest, entityFilters: mappedFilters });
}
```

**Entity-specific fields** (4): `sponsorUserId`, `targetType`, `targetId`, `sponsorshipStatus`
**Override reason**: `sponsorshipStatus` must be remapped to DB column `status` (name collision with base `status` field which maps to `lifecycleState`).

#### 5f. UserService

**File**: `packages/service-core/src/services/user/user.service.ts`

**After**:
```ts
// Add EntityFilters to the EXISTING @repo/schemas import block.
// The service already imports UserAdminSearchSchema.

type UserEntityFilters = EntityFilters<typeof UserAdminSearchSchema>;

protected override async _executeAdminSearch(
    params: AdminSearchExecuteParams<UserEntityFilters>
): Promise<PaginatedListOutput<User>> {
    const { where, entityFilters, pagination, sort, search, extraConditions } = params;
    const { email, ...simpleFilters } = entityFilters;
    // email is string | undefined

    const additionalConditions: SQL[] = [...(extraConditions ?? [])];
    if (search) additionalConditions.push(search);

    if (email) {
        additionalConditions.push(ilike(userTable.email, `%${email}%`));
    }

    const mergedWhere = { ...where, ...simpleFilters };
    return this.model.findAll(
        mergedWhere,
        { ...pagination, sortBy: sort.sortBy, sortOrder: sort.sortOrder },
        additionalConditions.length > 0 ? additionalConditions : undefined
    );
}
```

**Entity-specific fields** (3): `role`, `email`, `authProvider`
**Override reason**: `email` requires ILIKE partial match instead of equality. Note: this override does NOT call `super._executeAdminSearch()` .. it handles the full query itself (calls `this.model.findAll` directly). This is because it also needs custom `search` condition handling.
**Security note**: The `ilike(userTable.email, `%${email}%`)` pattern is vulnerable to LIKE wildcard injection (e.g., `%` or `_` in user input). This is a pre-existing issue tracked by SPEC-055 (Like Wildcard Escaping) and is NOT in scope for this spec. Do not fix it here.

### Step 6: Verify the `super._executeAdminSearch()` Call Compatibility

When a typed override calls `super._executeAdminSearch({ ...rest, entityFilters: simpleFilters })`, the `simpleFilters` type is a subset of the original entity filters (after destructuring out the handled fields). The base `_executeAdminSearch` expects `AdminSearchExecuteParams` (default = `Record<string, unknown>`).

TypeScript allows passing a more specific type where a less specific one is expected (covariance). The `simpleFilters` object is assignable to `Record<string, unknown>` because `z.infer` produces **type aliases** (not interfaces), and type aliases have an implicit index signature in TypeScript. This is a key distinction: `interface Foo { a: string }` is NOT assignable to `Record<string, unknown>`, but `type Foo = { a: string }` IS. Since all our entity filter types come from `z.infer` (which always produces type aliases), this covariance works reliably. No additional casts are needed when calling `super._executeAdminSearch()`.

### Services That Use Default `_executeAdminSearch()` (No Changes Needed)

These 10 services do NOT override `_executeAdminSearch()`. The base implementation merges `entityFilters` directly into the `where` clause via `{ ...where, ...entityFilters }`. They work correctly because their entity-specific fields are simple equality filters that match DB column names directly.

| # | Service | Schema | Entity-Specific Fields |
|---|---------|--------|----------------------|
| 1 | `TagService` | `TagAdminSearchSchema` | `color` |
| 2 | `PostService` | `PostAdminSearchSchema` | `category`, `authorId`, `isFeatured`, `isNews`, `relatedAccommodationId`, `relatedDestinationId`, `isFeaturedInWebsite` |
| 3 | `PostSponsorService` | `PostSponsorAdminSearchSchema` | `type` |
| 4 | `OwnerPromotionService` | `OwnerPromotionAdminSearchSchema` | `accommodationId`, `ownerId`, `discountType`, `isActive` |
| 5 | `FeatureService` | `FeatureAdminSearchSchema` | `isBuiltin` |
| 6 | `AttractionService` | `AttractionAdminSearchSchema` | `isFeatured` |
| 7 | `AmenityService` | `AmenityAdminSearchSchema` | `type`, `isBuiltin` |
| 8 | `EventLocationService` | `EventLocationAdminSearchSchema` | `city` |
| 9 | `EventOrganizerService` | `EventOrganizerAdminSearchSchema` | *(none .. empty extend)* |
| 10 | `DestinationService` | `DestinationAdminSearchSchema` | `parentDestinationId`, `destinationType`, `level`, `isFeatured` |

**No changes required** for these services. The base `_executeAdminSearch` already receives `AdminSearchExecuteParams` (with default `Record<string, unknown>` for `entityFilters`), and the flat merge into `where` works identically.

## Affected Files (Complete List)

### New Code
| File | Change |
|------|--------|
| `packages/schemas/src/common/admin-search.schema.ts` | Add `ADMIN_SEARCH_BASE_KEYS`, `AdminSearchBaseKeys`, `EntityFilters<T>` |

### Modified Code
| File | Change |
|------|--------|
| `packages/service-core/src/types/index.ts` | Make `AdminSearchExecuteParams` generic |
| `packages/service-core/src/base/base.crud.permissions.ts` | Change `adminSearchSchema` type from `ZodType` to `ZodObject<ZodRawShape>` |
| `packages/service-core/src/services/accommodation/accommodation.service.ts` | Typed override, remove `as` cast |
| `packages/service-core/src/services/event/event.service.ts` | Typed override, remove `as` cast |
| `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` | Typed override, remove `as` cast |
| `packages/service-core/src/services/destinationReview/destinationReview.service.ts` | Typed override, remove `as` cast |
| `packages/service-core/src/services/sponsorship/sponsorship.service.ts` | Typed override, remove `as` cast |
| `packages/service-core/src/services/user/user.service.ts` | Typed override, remove `as` cast |

### Unchanged (explicitly no modifications)
| File | Reason |
|------|--------|
| `packages/service-core/src/base/base.crud.read.ts` | `adminList()` and default `_executeAdminSearch()` keep using unparameterized `AdminSearchExecuteParams` |
| `packages/service-core/src/base/base.crud.service.ts` | No generic parameter added |
| `packages/service-core/src/base/base.crud.related.service.ts` | No generic parameter added |
| All 10 non-override services | No changes needed (see table above) |
| All AdminSearchSchema files | Schema definitions stay as-is |
| All API route files | No changes (they pass `Record<string, unknown>` to `adminList()`) |
| Admin frontend | No changes |

## Acceptance Criteria

- [ ] `EntityFilters<TSchema>` utility type is exported from `@repo/schemas` and correctly computes `Omit<z.infer<TSchema>, AdminSearchBaseKeys>` for all 16 schemas
- [ ] `AdminSearchExecuteParams<TEntityFilters>` is generic with default `= Record<string, unknown>`
- [ ] `adminSearchSchema` property type is `ZodObject<ZodRawShape>` (not bare `ZodType`)
- [ ] All 6 service overrides use `AdminSearchExecuteParams<EntityFilters<typeof XxxAdminSearchSchema>>` and compile WITHOUT `as` casts on `entityFilters`
- [ ] IDE autocompletion works for entity filter fields in all 6 overrides
- [ ] Accessing a non-existent property on `entityFilters` (e.g., `entityFilters.nonExistent`) produces a TS compile error in typed overrides
- [ ] `super._executeAdminSearch()` calls from typed overrides compile without additional casts
- [ ] All 10 non-override services continue to work unchanged
- [ ] `pnpm typecheck` passes across the entire monorepo
- [ ] `pnpm test` passes with no regressions (zero runtime behavior changes)
- [ ] No new `as` type assertions introduced

## Edge Cases and Gotchas

### DestinationReviewAdminSearchSchema Status Override

`DestinationReviewAdminSearchSchema` overrides the base `status` field with `z.unknown().transform(() => 'all' as const)` because the `destination_reviews` table has no `lifecycleState` column. After `Omit<..., AdminSearchBaseKeys>`, the overridden `status` is correctly excluded (it's still a key named `status`). Verify that this `.transform()` doesn't cause `AdminSearchBaseSchema.extend({...})` to return a `ZodEffects` instead of `ZodObject`. It should not, because `.extend()` only wraps individual field schemas, not the top-level object.

### EventOrganizerAdminSearchSchema Empty Extend

`EventOrganizerAdminSearchSchema = AdminSearchBaseSchema.extend({})` has zero entity-specific fields. `EntityFilters<typeof EventOrganizerAdminSearchSchema>` resolves to `{}` (empty object). This is correct. The EventOrganizerService uses the default `_executeAdminSearch()` and has no override, so this type is never referenced explicitly.

### `queryBooleanParam()` Inferred Type

Fields using `queryBooleanParam()` (e.g., `isFeatured`, `isBuiltin`, `isActive`) infer as `boolean | undefined`. The actual Zod structure is `ZodOptional<ZodEffects<ZodOptional<ZodBoolean>>>` (the outer `.optional()` wraps a `z.preprocess()` which returns `ZodEffects`, not a plain `ZodOptional`). Despite the complex structure, `z.infer` resolves to `boolean | undefined` because TypeScript simplifies `T | undefined | undefined` to `T | undefined`. Verify that `EntityFilters` correctly preserves this as `boolean | undefined` (it should, since `Omit` doesn't alter property types).

### UserService Full Override Pattern

`UserService._executeAdminSearch()` does NOT call `super._executeAdminSearch()`. It directly calls `this.model.findAll()`. This is intentional because it needs custom handling for both `email` (ILIKE) and the `search` condition merging. The typed signature still works identically .. it just means the `simpleFilters` (`role`, `authProvider`) are merged into `where` manually instead of via the base class.

### Covariance of `AdminSearchExecuteParams<Specific>` vs `AdminSearchExecuteParams<Record>`

TypeScript method override rules require parameter types to be compatible. When a subclass override narrows `AdminSearchExecuteParams` to `AdminSearchExecuteParams<SpecificType>`, this technically narrows the parameter (contravariance violation). However, TypeScript allows this because:
- **Class method bivariance**: TypeScript 2.6 introduced `strictFunctionTypes`, but explicitly exempted methods declared with method syntax (as opposed to function-typed properties). Class methods remain bivariant. This is by design (not a bug) because making methods contravariant would break core types like `Array<T>`. See [TypeScript 2.6 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-6.html). **Confirmed**: This project has `strict: true` in `packages/typescript-config/base.json` (line 10), which enables `strictFunctionTypes`.. but method bivariance still applies as described.
- The method is `protected` and called only internally by `adminList()` which always passes `entityFilters: Record<string, unknown>` (produced by rest spread)
- The runtime value IS the specific type (Zod already validated it against the entity's AdminSearchSchema)
- The `override` keyword only verifies method existence in the parent class, it does NOT affect variance rules

**Fallback approach** (only if the generic parameter approach somehow causes issues):

Keep the base parameter as `AdminSearchExecuteParams` (unparameterized) and cast `params.entityFilters` at the TOP of each override using the utility type. This gives one cast, in one location, fully typed from that point forward:

```ts
protected override async _executeAdminSearch(
    params: AdminSearchExecuteParams  // keeps default Record<string, unknown>
): Promise<PaginatedListOutput<Accommodation>> {
    const entityFilters = params.entityFilters as EntityFilters<typeof AccommodationAdminSearchSchema>;
    const { minPrice, maxPrice, ...simpleFilters } = entityFilters;
    // ...
}
```

Try the generic parameter approach first. The fallback trades one `as` cast per override (unavoidable but scoped) for guaranteed compilation.

## Implementation Order

1. **Step 1**: Add utility types to `@repo/schemas` (`EntityFilters`, `AdminSearchBaseKeys`, `ADMIN_SEARCH_BASE_KEYS`)
2. **Step 2**: Make `AdminSearchExecuteParams` generic in `@repo/service-core`
3. **Step 3**: Change `adminSearchSchema` property type in `base.crud.permissions.ts`
4. **Checkpoint**: Run `pnpm typecheck` .. expect it to pass (all changes are backward-compatible so far). If it fails, stop and investigate before proceeding.
5. **Step 5**: Update the 6 service overrides one by one, running typecheck after each. If the generic parameter approach causes a TS error on any override, use the fallback single-cast approach documented in "Edge Cases and Gotchas > Covariance".
6. **Step 6**: Run full `pnpm test` to verify zero runtime regressions

## Testing Strategy

### No New Unit Tests Required

This spec is a pure type-level refactor with zero runtime behavior changes. All existing tests must continue to pass unchanged. The validation is:

1. **`pnpm typecheck`** across the monorepo (the primary verification)
2. **`pnpm test`** across the monorepo (regression check)
3. **Manual type verification** (do this after Step 1, before proceeding to Step 5):
   - In a scratch/temporary file, verify that `EntityFilters` computes correctly:
     ```ts
     import type { EntityFilters } from '@repo/schemas';
     import type { AccommodationAdminSearchSchema } from '@repo/schemas';
     type Test = EntityFilters<typeof AccommodationAdminSearchSchema>;
     // Hover over Test in IDE. Should show: { type?: AccommodationType; destinationId?: string; ownerId?: string; isFeatured?: boolean; minPrice?: number; maxPrice?: number }
     ```
   - Verify negative case: `entityFilters.nonExistentField` in one typed override should produce a TS error. Then remove it.
   - Verify `EntityFilters<typeof EventOrganizerAdminSearchSchema>` resolves to `{}` (empty object).

### Existing Test Coverage

The 6 services with overrides already have tests covering their `adminList()` / `_executeAdminSearch()` behavior from SPEC-049. These tests exercise the runtime paths and will catch any accidental behavioral changes.

## Execution Order & Agent Safety Guide

> **For agents**: Read this section before implementing. If prerequisites are not met, STOP and report to the user.

### Prerequisites

**None.** SPEC-052 is a pure type-level refactor with zero runtime changes. It can be implemented at any time.

### Position in the Dependency Graph

```
SPEC-052 is INDEPENDENT -- no blockers, no dependents
```

### Coordination with SPEC-059 (Service-Layer Transaction Support)

Both SPEC-052 and SPEC-059 modify the `_executeAdminSearch()` signature in 6 services. **Order does not matter** -- the final signature is identical regardless of which lands first:

```typescript
protected override async _executeAdminSearch(
  params: AdminSearchExecuteParams<AccommodationEntityFilters>,  // SPEC-052 adds generic
  _ctx: ServiceContext                                           // SPEC-059 adds ctx
): Promise<PaginatedResult<Accommodation>> {
```

**If SPEC-052 is implemented first**: SPEC-059 appends `_ctx: ServiceContext` as a second parameter.
**If SPEC-059 is implemented first**: SPEC-052 adds the generic type parameter to the first parameter only.

**Affected services** (all 6):

| Service | SPEC-052 Change | SPEC-059 Change |
|---------|----------------|-----------------|
| AccommodationService | `AdminSearchExecuteParams<AccommodationEntityFilters>` | adds `_ctx: ServiceContext` |
| EventService | `AdminSearchExecuteParams<EventEntityFilters>` | adds `_ctx: ServiceContext` |
| AccommodationReviewService | `AdminSearchExecuteParams<AccommodationReviewEntityFilters>` | adds `_ctx: ServiceContext` |
| DestinationReviewService | `AdminSearchExecuteParams<DestinationReviewEntityFilters>` | adds `_ctx: ServiceContext` |
| SponsorshipService | `AdminSearchExecuteParams<SponsorshipEntityFilters>` | adds `_ctx: ServiceContext` |
| UserService | `AdminSearchExecuteParams<UserEntityFilters>` | adds `_ctx: ServiceContext` |

### Parallel Safety

| Spec | Conflict Risk | Details |
|------|--------------|---------|
| SPEC-051 | None | Different files entirely. |
| SPEC-055 | None | Different layers (DB vs schemas/services). |
| SPEC-058 | Low | Both touch `packages/service-core/src/types/index.ts`. SPEC-058 removes `BaseModel<T>` interface. SPEC-052 makes `AdminSearchExecuteParams` generic. Different parts of the file. |
| SPEC-059 | Low | Both modify `_executeAdminSearch()` in 6 services. See coordination section above. |

### Agent Instructions

1. Verify `pnpm typecheck` passes on current `main` before starting
2. Implement all changes (1 new file, 8 modified files)
3. Run `pnpm typecheck` (this is a type-only refactor, no runtime tests needed beyond existing)
4. If SPEC-059 has already merged, include `_ctx: ServiceContext` in the 6 service signatures
5. If SPEC-059 has NOT merged, ignore it -- SPEC-059 will add `_ctx` later

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `strictFunctionTypes` rejects narrowed override parameter | Very Low | Low | Use fallback single-cast approach (see Edge Cases section). TypeScript class method parameters are bivariant by default even with `strictFunctionTypes: true` (methods declared with method syntax are exempt from strict checks per TS 2.6 release notes). Project confirms `strict: true` in `packages/typescript-config/base.json`, which enables `strictFunctionTypes`.. but method bivariance still applies, making this risk purely theoretical. |
| `DestinationReviewAdminSearchSchema` `.transform()` on status creates `ZodEffects` | Very Low | Medium | Verified: field-level transforms inside `.extend()` do NOT change the container type. Only object-level `.transform()`/`.refine()` return `ZodEffects`. Still, verify with typecheck after Step 3. |
| `queryBooleanParam()` double-optional infers unexpected type | Low | Low | Verified: actual structure is `ZodOptional<ZodEffects<ZodOptional<ZodBoolean>>>` but `z.infer` resolves to `boolean | undefined`. Verify with `type Test = EntityFilters<typeof AttractionAdminSearchSchema>` in a scratch file. |
| Circular import between `@repo/schemas` and `@repo/service-core` | None | N/A | `EntityFilters` is defined in `@repo/schemas`, `AdminSearchExecuteParams` is in `@repo/service-core`. No circular dependency. |
| Future `strictMethodType` TS option breaks bivariance | Very Low | Medium | There is an open feature request ([TS #57783](https://github.com/microsoft/TypeScript/issues/57783)) for a `strictMethodType` option that would enforce contravariance on method parameters. If TypeScript ships this and the project enables it, the narrowed override parameters would fail. Mitigation: switch to the fallback single-cast approach documented in "Edge Cases and Gotchas > Covariance". This risk is theoretical and unlikely to materialize soon. |
| Zod v4 migration changes `.shape` or transform behavior | Low | Low | Zod v4 restructures internals: refinements become "checks" inside schemas, transforms use `ZodTransform` class. If the project upgrades to Zod v4, verify that (1) `.shape` still works on `ZodObject`, (2) field-level transforms still keep `ZodObject` container, (3) `Object.keys(schema.shape)` still returns field names. The `schema.keyof()` alternative may be more future-proof. |

## Complexity Assessment

**Revised from High to Medium**. The Option B approach avoids class hierarchy changes entirely. The actual changes are:
- 1 new utility type (3 lines)
- 1 type made generic (1 line change)
- 1 property type upgraded (1 line change)
- 6 service overrides updated (remove `as` cast, add import + type alias)

Total estimated LoC changed: ~60 lines across 8 files. No runtime code changes.
