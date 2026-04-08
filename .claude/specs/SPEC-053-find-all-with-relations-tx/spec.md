# SPEC-053: Transaction Support in findAllWithRelations

> **Status**: completed
> **Priority**: P2
> **Complexity**: Low
> **Origin**: SPEC-049 GAP-049-048
> **Created**: 2026-03-21
> **Updated**: 2026-03-23 (exhaustive review: fixed test bug, added JSDoc requirements, error handling notes, behavioral clarifications)

## Problem Statement

`BaseModel.findAllWithRelations()` does not accept a transaction (`tx`) parameter, unlike `findAll()` which does. It always uses the global database connection via `this.getClient()` (line 490 of `base.model.ts`). When called within a transaction context (e.g., during bulk operations or transaction-wrapped tests), it reads data outside the transaction, breaking atomicity and causing flaky test failures.

Additionally, the internal `this.count()` call within `findAllWithRelations` (line 610) does not propagate the transaction either, meaning the total count query also runs outside the transaction.

## Proposed Solution

Add an optional `tx` parameter to `findAllWithRelations()` and propagate it to:

1. `this.getClient(tx)` .. for the main query
2. `this.count(where, { additionalConditions, tx })` .. for the total count query
3. `this.findAll(where, options, additionalConditions, tx)` .. for the fallback path when no relations are requested

This follows the exact same pattern already used by `findAll()`, `count()`, `findById()`, `findOne()`, `create()`, `update()`, and all other BaseModel methods.

**Why the service layer is out of scope**: This is a foundational (model-layer) change. Services like `list()` and `_executeAdminSearch()` do not currently receive `tx` from routes, so there is nothing to propagate yet. Adding service-layer transaction support is a separate concern that would require API routes to create and pass transactions down. This spec provides the necessary model-layer plumbing that such future work would depend on.

## Scope

### In Scope

- Add optional `tx` parameter to `findAllWithRelations()` signature in `BaseModel` implementation
- Update the `BaseModel<T>` interface in service-core types to include the `tx` parameter
- Propagate `tx` to `this.getClient(tx)` in the main query path
- Propagate `tx` to the internal `this.count()` call
- Propagate `tx` to the `this.findAll()` fallback path (when no relations are requested)
- Unit tests verifying transaction propagation

### Out of Scope

- Adding transaction support to other methods that may also lack it
- Changing the transaction API itself (e.g., `withTransaction()` in `@repo/db`)
- Adding transaction support at the service layer (services accepting `tx` from routes)
- Modifying service-level override methods (e.g., entity-specific `_executeAdminSearch` overrides)

## Affected Files

### Must Change

1. **`packages/db/src/base/base.model.ts`** .. `findAllWithRelations()` method
2. **`packages/service-core/src/types/index.ts`** .. `BaseModel<T>` interface definition (line 181-186)

### No Changes Required

- **`packages/service-core/src/base/base.crud.read.ts`** .. `list()` and `_executeAdminSearch()` call `findAllWithRelations` but do NOT have a `tx` parameter at the service layer. They continue passing no `tx` (defaults to `undefined`). No code changes needed.
- Entity-specific service overrides of `_executeAdminSearch()` (they call `this.model.findAll()`, not `findAllWithRelations()` directly)
- API route files (they don't call `findAllWithRelations` directly)
- **No model subclass overrides `findAllWithRelations()`** .. verified across all 26 services. `AccommodationModel` has a separate `findWithRelations()` (single-record) method that is unrelated.

## Implementation Details

### Step 1: Update `findAllWithRelations` signature and implementation

**File**: `packages/db/src/base/base.model.ts`

**Current signature** (line 484-489):

```typescript
async findAllWithRelations(
    relations: Record<string, boolean | Record<string, unknown>>,
    where: Record<string, unknown> = {},
    options: PaginatedListOptions = {},
    additionalConditions?: SQL[]
): Promise<{ items: T[]; total: number }>
```

**New signature**:

```typescript
async findAllWithRelations(
    relations: Record<string, boolean | Record<string, unknown>>,
    where: Record<string, unknown> = {},
    options: PaginatedListOptions = {},
    additionalConditions?: SQL[],
    tx?: NodePgDatabase<typeof schema>
): Promise<{ items: T[]; total: number }>
```

**JSDoc update**: Add `@param tx` to the existing JSDoc block (lines 471-482):

```typescript
/**
 * ...existing params...
 * @param tx - Optional transaction client for atomic operations. When provided,
 *   all queries (main query, count, and fallback findAll) execute within this transaction.
 *   When omitted or undefined, the global database connection is used (existing behavior).
 */
```

**Changes inside the method body**:

1. Line 490: Change `const db = this.getClient();` to `const db = this.getClient(tx);`

2. Line 523 (fallback path): Change:

   ```typescript
   return this.findAll(safeWhere, options, additionalConditions);
   ```

   to:

   ```typescript
   return this.findAll(safeWhere, options, additionalConditions, tx);
   ```

3. Line 610 (count call): Change:

   ```typescript
   this.count(safeWhere, { additionalConditions })
   ```

   to:

   ```typescript
   this.count(safeWhere, { additionalConditions, tx })
   ```

**Note on `tx` type**: The `tx` parameter type is `NodePgDatabase<typeof schema>`, imported from `drizzle-orm/node-postgres` and the local schema. This is the same type used by all other methods in BaseModel (see `getClient` signature at line 48). Technically, Drizzle's `db.transaction()` callback receives a `NodePgTransaction<...>` (which extends `PgTransaction`, which in turn extends `PgDatabase`). However, the codebase consistently types `tx` as `NodePgDatabase<typeof schema>` everywhere .. including `withTransaction()` in `client.ts` (line 108), `getClient()` (line 48), and all model methods (`findAll`, `findById`, `findOne`, `count`, `create`, `update`). This works at runtime because `NodePgTransaction` inherits from `PgDatabase`, making it structurally compatible with `NodePgDatabase`. Follow this established convention. No imports need to be added in `base.model.ts` since `NodePgDatabase` and `schema` are already imported (lines 4 and 6).

**Note on Drizzle relational queries inside transactions**: The `findAllWithRelations` method uses `db.query[tableName].findMany(queryConfig)` (the Drizzle relational query builder). This API is fully supported on transaction objects. Drizzle's official documentation explicitly shows `tx.query.users.findMany({ with: { accounts: true } })` inside transactions. No workaround or adaptation is needed.. passing `tx` where `db` was used works identically.

**Note on error handling**: If any query within `findAllWithRelations` throws (e.g., `DbError` from the `catch` block at lines 627-640), and the method is running inside a transaction, the error will propagate up and Drizzle/PostgreSQL will automatically roll back the transaction. No special error handling is needed in this method.. the existing `try/catch` that wraps the query body already throws `DbError`, which is the correct behavior for transaction callers.

### Step 2: Update `BaseModel<T>` interface

**File**: `packages/service-core/src/types/index.ts`

**Current interface** (line 181-186):

```typescript
findAllWithRelations(
    relations: Record<string, boolean | Record<string, unknown>>,
    where?: Record<string, unknown>,
    options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
    additionalConditions?: SQL[]
): Promise<PaginatedListOutput<T>>;
```

**New interface**:

```typescript
findAllWithRelations(
    relations: Record<string, boolean | Record<string, unknown>>,
    where?: Record<string, unknown>,
    options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
    additionalConditions?: SQL[],
    tx?: NodePgDatabase<typeof schema>
): Promise<PaginatedListOutput<T>>;
```

**JSDoc**: Add a JSDoc comment above the `findAllWithRelations` signature in the interface:

```typescript
/** @param tx - Optional transaction client for atomic operations */
```

**Required import additions** (these do NOT exist in the file currently):

```typescript
// Add to existing imports at the top of the file:
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { schema } from '@repo/db';
```

The file currently imports `SQL` and `Table` from `drizzle-orm`, but NOT `NodePgDatabase` or `schema`. Both must be added explicitly.

**Import verification**: `@repo/db` is already a dependency of `packages/service-core` (listed in `package.json` as `"@repo/db": "workspace:*"`). The `schema` const is exported from `@repo/db` via `packages/db/src/client.ts` (line 116) and re-exported through `packages/db/src/index.ts`. The `import type` syntax is correct here.. we only need the type of the `schema` object for the `typeof schema` generic parameter.

**Note on interface-level `tx` gap**: The `BaseModel<T>` interface currently does NOT include `tx` on ANY method (`findAll`, `findById`, `findOne`, `count`, `create`, `update`, etc.), even though their implementations in `base.model.ts` all accept `tx`. This is a pre-existing gap.. the interface serves as a simplified contract for the service layer, which currently never passes `tx`. This spec adds `tx` to `findAllWithRelations` for completeness with its implementation change. Aligning the remaining methods is explicitly out of scope (see "Out of Scope" section) and can be addressed in a future spec if service-layer transaction support is needed.

## Testing Requirements

### Unit Tests

**File**: `packages/db/test/models/find-all-with-relations-tx.test.ts` (new file)

> **Note**: The `test/base/` directory does not exist. All model tests are in `packages/db/test/models/`. Place the new test file there for consistency.

Tests must verify:

1. **`tx` parameter is optional**: Call `findAllWithRelations` without `tx` .. should work exactly as before (regression test)
2. **`tx` is forwarded to `getClient`**: When `tx` is provided, `getClient` receives it (use `vi.spyOn(model, 'getClient')`)
3. **`tx` is forwarded to `count`**: When `tx` is provided, the internal `count()` call receives `tx` in the options object (use `vi.spyOn(model, 'count')` and assert `expect(countSpy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tx: mockTx }))`)
4. **`tx` is forwarded to `findAll` fallback**: When called with empty relations `{}` and `tx`, the fallback `findAll` receives `tx` as its 4th argument (use `vi.spyOn(model, 'findAll')`)
5. **Signature type-compatibility**: The `tx` parameter accepts the same type as `findAll`, `findById`, etc. (verified implicitly by TypeScript compilation)

#### Test setup approach

Follow the established test pattern from `packages/db/test/models/accommodation.model.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { schema } from '../../src/schemas';
import * as dbUtils from '../../src/client';
import { AccommodationModel } from '../../src/models/accommodation.model';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/client', () => ({
    getDb: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

describe('findAllWithRelations - transaction propagation', () => {
    let model: AccommodationModel;
    let getDb: ReturnType<typeof vi.fn>;
    const mockTx = {} as NodePgDatabase<typeof schema>;

    beforeEach(() => {
        model = new AccommodationModel();
        getDb = dbUtils.getDb as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
    });

    // Test 1: Regression - works without tx
    it('works without tx parameter (regression)', async () => {
        const mockFindMany = vi.fn().mockResolvedValue([{ id: '1' }]);
        const mockCount = vi.spyOn(model, 'count').mockResolvedValue(1);
        getDb.mockReturnValue({
            query: { accommodations: { findMany: mockFindMany } }
        });

        const result = await model.findAllWithRelations({ destination: true });
        expect(result.items).toHaveLength(1);
        mockCount.mockRestore();
    });

    // Test 2: tx forwarded to getClient
    // Note: `as any` is required to spy on the protected `getClient` method.
    // This is the standard pattern for testing protected methods in this codebase.
    it('forwards tx to getClient', async () => {
        const getClientSpy = vi.spyOn(model as any, 'getClient').mockReturnValue({
            query: { accommodations: { findMany: vi.fn().mockResolvedValue([]) } }
        });
        vi.spyOn(model, 'count').mockResolvedValue(0);

        await model.findAllWithRelations({ destination: true }, {}, {}, undefined, mockTx);
        expect(getClientSpy).toHaveBeenCalledWith(mockTx);
        getClientSpy.mockRestore();
    });

    // Test 3: tx forwarded to count
    // IMPORTANT: When tx is provided, getClient(tx) returns tx directly (not getDb()).
    // So we must mock getClient to return a usable db object, otherwise mockTx ({})
    // would crash on db.query[tableName] access. Do NOT rely on getDb.mockReturnValue here.
    it('forwards tx to count via options object', async () => {
        const getClientSpy = vi.spyOn(model as any, 'getClient').mockReturnValue({
            query: { accommodations: { findMany: vi.fn().mockResolvedValue([]) } }
        });
        const countSpy = vi.spyOn(model, 'count').mockResolvedValue(0);

        await model.findAllWithRelations({ destination: true }, {}, {}, undefined, mockTx);
        expect(countSpy).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ tx: mockTx })
        );
        getClientSpy.mockRestore();
        countSpy.mockRestore();
    });

    // Test 4: tx forwarded to findAll fallback
    it('forwards tx to findAll when no relations', async () => {
        const findAllSpy = vi.spyOn(model, 'findAll').mockResolvedValue({
            items: [],
            total: 0
        });

        await model.findAllWithRelations({}, {}, {}, undefined, mockTx);
        expect(findAllSpy).toHaveBeenCalledWith(
            expect.anything(),  // where
            expect.anything(),  // options
            undefined,          // additionalConditions
            mockTx              // tx as 4th argument
        );
        findAllSpy.mockRestore();
    });
});
```

This approach verifies that `tx` is FORWARDED to the correct internal calls without needing a real database connection. The `mockTx` object is sufficient because no actual queries execute through it.

### Minimum Coverage

- All 3 propagation paths tested (getClient, count, findAll fallback)
- Regression test for the no-tx path (backward compatibility)
- Note: The `packages/db` vitest config enforces 70% line/function/statement coverage (60% branches). The 4 tests above cover all modified code paths comprehensively

## Acceptance Criteria

- [ ] `findAllWithRelations()` accepts an optional `tx` parameter of type `NodePgDatabase<typeof schema>`
- [ ] When `tx` is provided, `this.getClient(tx)` is used for the main query
- [ ] When `tx` is provided, `this.count()` receives `tx` via `options.tx`
- [ ] When `tx` is provided and no relations are requested, `this.findAll()` receives `tx`
- [ ] When `tx` is omitted, behavior is unchanged (uses global client) .. verified by regression tests
- [ ] The `BaseModel<T>` interface in `service-core/types` is updated to include `tx` parameter
- [ ] Existing callers (`list()`, `_executeAdminSearch()`) continue to work without changes (they pass no `tx`)
- [ ] Unit tests cover all 3 transaction propagation paths plus backward-compatibility regression
- [ ] `pnpm typecheck` passes across all packages
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes with no regressions

## Cross-Spec Coordination

### No conflicts with SPEC-050 through SPEC-057

This spec has been verified against all sibling specs:

- ~~**SPEC-050**~~ (deleted, superseded by SPEC-063 Lifecycle State Standardization): Originally modified `adminList()` WHERE clause construction. No conflict.. different code paths.
- **SPEC-051** (Admin Permission Hook): Modifies `adminList()` permission checks. No conflict.. different code paths.
- **SPEC-052** (Type-Safe Entity Filters): Adds type safety to `_executeAdminSearch` overrides. Those overrides call `this.model.findAll()`, NOT `findAllWithRelations()`. No conflict. **Coordination note**: SPEC-052 also modifies `packages/service-core/src/types/index.ts` (adds generics to `AdminSearchExecuteParams`). Both changes to this file are independent .. SPEC-053 adds a parameter to `findAllWithRelations` in the `BaseModel<T>` interface, while SPEC-052 modifies `AdminSearchExecuteParams`. No merge conflicts expected, but if implementing concurrently, apply both sets of import additions together.
- **SPEC-054** (Default Filters UI Indicator): Frontend-only changes. No conflict.
- **SPEC-055** (Like Wildcard Escaping): Modifies `buildSearchCondition()`. No conflict.
- **SPEC-056** (Numeric Column Coercion): Modifies numeric type handling. No conflict.
- **SPEC-057** (Admin Response Schema Consistency): Modifies response schemas. No conflict.

### Post-SPEC-058 Type Harmonization

> **Added 2026-04-04** (cross-spec conflict resolution)

SPEC-053 typed `tx` as `NodePgDatabase<typeof schema>` (the only available type at the time of implementation). SPEC-058 introduces `DrizzleClient` as the common base type for both regular connections and transaction handles. When SPEC-058 is implemented:

1. The `findAllWithRelations()` method signature in `base.model.ts` must be updated from `tx?: NodePgDatabase<typeof schema>` to `tx?: DrizzleClient`
2. The `BaseModel<T>` interface entry for `findAllWithRelations` must also be updated
3. This is a TYPE WIDENING (not a breaking change) .. `NodePgDatabase` is assignable to `DrizzleClient`

**This update is explicitly included in SPEC-058 section 2b.** No separate migration needed. Implementers should verify SPEC-058 section 2b was applied correctly.

### Implementation Order

This spec has no dependencies and can be implemented in any order relative to ~~SPEC-050~~ (deleted) through SPEC-057. It is a purely additive change (adding an optional parameter) that does not affect any code that the sibling specs modify.

## Dependencies

- None (purely additive optional parameter)

## Behavioral Notes

- **`tx` omission equivalence**: Passing `undefined` as `tx` and omitting the parameter entirely are functionally identical. In both cases, `getClient(undefined)` falls through to `getDb()` via the `??` operator. Callers can safely omit the parameter.
- **`findAll` fallback argument order**: When the fallback path is taken (empty `relations`), `tx` is passed as the **4th positional argument** to `findAll()`: `this.findAll(safeWhere, options, additionalConditions, tx)`. This matches `findAll`'s existing signature: `findAll(where, options, additionalConditions, tx)`.

## Risks

- **Minimal**: The parameter is optional and follows the exact same pattern used by 10+ other BaseModel methods
- **No breaking changes**: All existing callers continue to work without modification
- **No behavioral changes**: When `tx` is omitted (which is all current cases), behavior is identical to before
