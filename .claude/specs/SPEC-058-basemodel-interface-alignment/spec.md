# SPEC-058: Align BaseModel Interface with Implementation

> **Status**: in-progress
> **Priority**: P1
> **Complexity**: Medium-High
> **Origin**: SPEC-053 gaps (GAP-003, GAP-004, GAP-018, GAP-019, GAP-071, GAP-072)
> **Created**: 2026-04-01
> **Updated**: 2026-04-02 (ninth pass: corrected ServiceContext description in Out of Scope section -- it carries hookState + tx, not user/permissions/locale; eighth pass: fixed findWithRelations base implementation description -- it is a fallback that returns entity without relations, NOT a stub that returns null; added updateById silent-failure note; added create() parameter naming alignment note; added PaginatedListOutput export verification; clarified findAllWithRelations type-change vs new-param in step 4e; fixed import path extension consistency)
> **ADR**: ADR-018 (Transaction Propagation via Context Object Pattern)
> **Dependencies**: None (foundation for SPEC-059, SPEC-060)
> **Dependents**: SPEC-059, SPEC-060, SPEC-061, SPEC-064 (SPEC-060 uses QueryContext directly from this spec)
> **Post-implementation note**: When this spec is completed, update SPEC-061's `packages/db/test/integration/helpers.ts` type alias `TestDb` from `NodePgDatabase<typeof schema>` to the new `DrizzleClient` type exported by `@repo/db`

## Problem Statement

The `BaseModel<T>` interface in `packages/service-core/src/types/index.ts` has six gaps vs the concrete class in `packages/db/src/base/base.model.ts`:

1. **GAP-003**: 9 of 13 implementation methods lack the `tx` parameter in their interface declarations (`findById`, `findOne`, `create`, `update`, `softDelete`, `restore`, `hardDelete`, `count`, `findAll`)
2. **GAP-004**: 3 public methods exist in the concrete class but not in the interface (`findWithRelations`, `updateById`, `raw`)
3. **GAP-018**: `withTransaction` callback is typed as `NodePgDatabase<typeof schema>` but Drizzle's `db.transaction()` passes `NodePgTransaction<typeof schema, ...>` at runtime
4. **GAP-019**: No `implements` clause on the concrete class linking it to the interface. Additionally, both the interface and class are named `BaseModel`, creating a naming collision. The interface will be relocated to `@repo/db` (alongside the implementation) to avoid circular cross-package type imports
5. **GAP-071**: `getClient()` parameter and return type are `NodePgDatabase<typeof schema>`, but when a transaction is passed in, the actual runtime type is `NodePgTransaction` (a subclass of `PgDatabase`, not `NodePgDatabase`)
6. **GAP-072**: `BaseModel<T>` has no generic constraint on `T` in either the interface or the class, allowing invalid types (string, number, null) to be used as `T`

### Context: SPEC-053 Completed Work

SPEC-053 (completed) already added the `tx` parameter to `findAllWithRelations()` in both the interface and implementation. However, SPEC-053 typed `tx` as `NodePgDatabase<typeof schema>` (the only available type at the time). This spec updates that parameter type to the new `DrizzleClient` type for consistency with all other methods.

### Context: Naming Collision and Interface Location

The interface (`packages/service-core/src/types/index.ts`) and the concrete class (`packages/db/src/base/base.model.ts`) are BOTH named `BaseModel`. This prevents adding an `implements` clause (a class cannot implement an interface of the same name from a different package without confusion). This spec resolves it by:

1. **Renaming** the concrete class to `BaseModelImpl`
2. **Moving** the `BaseModel<T>` interface definition from `@repo/service-core` to `@repo/db` (in `packages/db/src/types.ts`, alongside `DrizzleClient`), so the `implements` clause uses a same-package import with zero circular dependency risk
3. **Re-exporting** the interface from `@repo/service-core` for backward compatibility (existing code that imports `BaseModel` from `@repo/service-core` continues working)

## Proposed Solution

Nine coordinated changes to align the interface with the existing implementation:

### 1. Define `DrizzleClient` type, `QueryContext` interface, and `BaseModel<T>` interface in `@repo/db`

Create a new file `packages/db/src/types.ts` containing the `DrizzleClient` type alias, the `QueryContext` interface, AND the `BaseModel<T>` interface definition. Colocating the interface with the implementation in `@repo/db` eliminates any circular dependency between packages.

```typescript
// packages/db/src/types.ts
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { ExtractTablesWithRelations, SQL } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import type { schema } from './client.ts';
import type { PaginatedListOutput } from '@repo/schemas';

/**
 * Common base type for both regular Drizzle database clients and
 * transaction clients. Use this wherever you accept or return
 * a database connection that might be inside a transaction.
 *
 * Why a common base type instead of a union:
 * Both `NodePgDatabase` and `NodePgTransaction` extend `PgDatabase`.
 * Using the common ancestor means:
 * - `PgTransaction` (what `db.transaction()` passes to callbacks at the TS level)
 *   is directly assignable without relying on method bivariance
 * - `NodePgDatabase` (regular connections from `getDb()`) is also assignable
 * - `NodePgTransaction` (runtime transaction type) is also assignable
 *
 * Drizzle type hierarchy (v0.44.x, node-postgres driver):
 * ```
 * PgDatabase<TQueryResult, TFullSchema, TSchema>        <-- DrizzleClient
 *   |-- NodePgDatabase<TSchema>                          (regular connection)
 *   |-- PgTransaction<TQueryResult, TFullSchema, TSchema>(TS-level tx type)
 *         |-- NodePgTransaction<TFullSchema, TSchema>    (runtime tx type)
 * ```
 */
export type DrizzleClient = PgDatabase<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Extensible context bag for propagating transaction handles and
 * request-scoped metadata through model and service methods.
 *
 * All new model and service methods accept `ctx?: QueryContext` as their
 * last parameter. When `ctx.tx` is provided, methods use that transaction
 * handle instead of the module-level db instance from `getDb()`.
 *
 * See ADR-018 for the full rationale behind the Context Object pattern.
 */
export interface QueryContext {
  /**
   * Active transaction handle. When omitted (undefined), methods use `getDb()`.
   *
   * Semantics: `undefined` and `null` are treated identically (both fall back
   * to `getDb()`). Callers should omit the property or pass `undefined` --
   * never pass `null`. The implementation uses `tx ?? getDb()` internally.
   *
   * This interface is intentionally minimal. SPEC-059 extends it with
   * `ServiceContext` (adding user, permissions, locale) for service-layer use.
   */
  tx?: DrizzleClient;
}

/**
 * Contract for all entity model classes. The concrete implementation
 * is `BaseModelImpl` in `./base/base.model.ts`.
 *
 * All methods accept an optional `tx` parameter (or `tx` inside `options`
 * for `count()`) to participate in an existing database transaction.
 * When `tx` is omitted, methods use the default connection from `getDb()`.
 */
export interface BaseModel<T extends Record<string, unknown>> {
  /** Find a single entity by its primary key (UUID). */
  findById(id: string, tx?: DrizzleClient): Promise<T | null>;

  /** Find a single entity matching the given filter conditions. */
  findOne(where: Record<string, unknown>, tx?: DrizzleClient): Promise<T | null>;

  /** Insert a new entity and return the created record. */
  create(data: Partial<T>, tx?: DrizzleClient): Promise<T>;

  /**
   * Update entities matching `where` conditions. Returns the first
   * updated entity, or null if no rows matched.
   */
  update(where: Record<string, unknown>, data: Partial<T>, tx?: DrizzleClient): Promise<T | null>;

  /**
   * Update a single entity by ID. Unlike `update()`, returns void.
   * Useful for fire-and-forget updates where the caller does not need the result.
   */
  updateById(id: string, data: Partial<T>, tx?: DrizzleClient): Promise<void>;

  /** Soft-delete entities matching `where` (sets `deletedAt`). Returns count of affected rows. */
  softDelete(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number>;

  /** Restore soft-deleted entities matching `where` (clears `deletedAt`). Returns count of affected rows. */
  restore(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number>;

  /** Permanently delete entities matching `where`. Returns count of deleted rows. */
  hardDelete(where: Record<string, unknown>, tx?: DrizzleClient): Promise<number>;

  /**
   * Count entities matching `where` conditions.
   * NOTE: `tx` is nested inside `options` (not a positional parameter) to match
   * the implementation signature where `additionalConditions` and `tx` share
   * the same options object.
   */
  count(
    where: Record<string, unknown>,
    options?: { additionalConditions?: SQL[]; tx?: DrizzleClient }
  ): Promise<number>;

  /**
   * Find all entities matching `where` with pagination and optional sorting.
   * Returns `{ items: T[], total: number }`.
   */
  findAll(
    where: Record<string, unknown>,
    options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
    additionalConditions?: SQL[],
    tx?: DrizzleClient
  ): Promise<PaginatedListOutput<T>>;

  /**
   * Find all entities with specified relations populated.
   * Uses Drizzle's relational query API (`db.query[table].findMany()`).
   */
  findAllWithRelations(
    relations: Record<string, boolean | Record<string, unknown>>,
    where?: Record<string, unknown>,
    options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
    additionalConditions?: SQL[],
    tx?: DrizzleClient
  ): Promise<PaginatedListOutput<T>>;

  /**
   * Find a single entity with its relations loaded.
   *
   * IMPORTANT: The base class implementation is a FALLBACK that executes
   * a plain `db.select().from(table).where(clause).limit(1)` query,
   * completely IGNORING the `relations` parameter. It returns the entity
   * without any relations populated (not null). Subclasses with relation
   * support (Accommodation, Event, Destination, Sponsorship, Amenity,
   * EventOrganizer) MUST override this method to actually load relations
   * using Drizzle's relational query API.
   * The interface includes it because it IS part of the public API contract
   * and callers use it through the interface.
   */
  findWithRelations(
    where: Record<string, unknown>,
    relations: Record<string, boolean | Record<string, unknown>>,
    tx?: DrizzleClient
  ): Promise<T | null>;

  /**
   * Execute a raw SQL query against the database.
   * Use sparingly -- prefer typed query methods when possible.
   */
  raw(query: SQL, tx?: DrizzleClient): Promise<unknown>;

  /** Returns the Drizzle table schema for this model. */
  getTable(): Table;
}
```

**Why `PgDatabase` base instead of a `NodePgDatabase | NodePgTransaction` union**: Drizzle's `PgDatabase.transaction()` method types its callback parameter as `PgTransaction` (not `NodePgTransaction`). A union of `NodePgDatabase | NodePgTransaction` does not include `PgTransaction`, so it would only compile due to TypeScript's method bivariance -- technically unsound. Using the common base `PgDatabase` is fully type-safe: `NodePgDatabase`, `PgTransaction`, and `NodePgTransaction` are ALL assignable to it.

**Import paths** (verified against drizzle-orm v0.44.7 `.d.ts` files installed in this project):
- `PgDatabase` -- from `drizzle-orm/pg-core` (exported via `db.js` in `pg-core/index.d.ts`)
- `NodePgQueryResultHKT` -- from `drizzle-orm/node-postgres` (exported via `session.js` in `node-postgres/index.d.ts`)
- `ExtractTablesWithRelations` -- from `drizzle-orm` (root, exported from `relations.d.ts`)
- `SQL` -- from `drizzle-orm` (root, for `raw()` method signature)
- `Table` -- from `drizzle-orm` (root, for `getTable()` return type)
- `PaginatedListOutput` -- from `@repo/schemas` (defined in `packages/schemas/src/common/relations.schema.ts` as `{ items: T[]; total: number }`)

### 2. Add `tx?: DrizzleClient` to all 9 missing interface methods

Add the optional `tx` parameter to match the existing implementation signatures. This is a pure alignment change -- the implementation already accepts `tx` on all these methods.

**Methods to update in the interface** (defined in `packages/db/src/types.ts`, re-exported from `packages/service-core/src/types/index.ts`):

| Method | Current interface signature | Updated signature |
|--------|---------------------------|-------------------|
| `findById` | `(id: string)` | `(id: string, tx?: DrizzleClient)` |
| `findOne` | `(where: Record<string, unknown>)` | `(where: Record<string, unknown>, tx?: DrizzleClient)` |
| `create` | `(data: Partial<T>)` | `(data: Partial<T>, tx?: DrizzleClient)` |
| `update` | `(where: Record<string, unknown>, data: Partial<T>)` | `(where: Record<string, unknown>, data: Partial<T>, tx?: DrizzleClient)` |
| `softDelete` | `(where: Record<string, unknown>)` | `(where: Record<string, unknown>, tx?: DrizzleClient)` |
| `restore` | `(where: Record<string, unknown>)` | `(where: Record<string, unknown>, tx?: DrizzleClient)` |
| `hardDelete` | `(where: Record<string, unknown>)` | `(where: Record<string, unknown>, tx?: DrizzleClient)` |
| `count` | `(where, options?: { additionalConditions?: SQL[] })` | `(where, options?: { additionalConditions?: SQL[]; tx?: DrizzleClient })` |
| `findAll` | `(where, options?, additionalConditions?)` | `(where, options?, additionalConditions?, tx?: DrizzleClient)` |

**Note**: `count()` already nests `tx` inside its `options` object in the implementation, so the interface must match that pattern. All other methods use `tx` as a positional parameter.

**Note**: `findAllWithRelations` is handled separately in section 2b below (type update only, not a new parameter).

**Note**: The `create()` method parameter name changes from `input` (current interface in `service-core`) to `data` (matching the implementation in `base.model.ts`). Parameter names in interfaces have no runtime effect, but aligning them with the implementation improves readability and IDE hints.

### 2b. Update `findAllWithRelations` tx type to `DrizzleClient`

SPEC-053 added `tx?: NodePgDatabase<typeof schema>` to `findAllWithRelations()`. Now that `DrizzleClient` exists, update this parameter type for consistency with all other methods.

**Current** (from SPEC-053):
```typescript
findAllWithRelations(
  relations: Record<string, boolean | Record<string, unknown>>,
  where?: Record<string, unknown>,
  options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
  additionalConditions?: SQL[],
  tx?: NodePgDatabase<typeof schema>  // <-- old type
): Promise<PaginatedListOutput<T>>;
```

**Updated**:
```typescript
findAllWithRelations(
  relations: Record<string, boolean | Record<string, unknown>>,
  where?: Record<string, unknown>,
  options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
  additionalConditions?: SQL[],
  tx?: DrizzleClient  // <-- new type (compatible, not breaking)
): Promise<PaginatedListOutput<T>>;
```

This is NOT a new parameter (SPEC-053 already added it). It is a TYPE widening from `NodePgDatabase<typeof schema>` to `DrizzleClient` (which is a supertype, so all existing callers remain compatible).

The same type update must also be applied to the `findAllWithRelations` implementation in `packages/db/src/base/base.model.ts`.

**SPEC-053 reconciliation**: SPEC-053 (completed) added `tx?: NodePgDatabase<typeof schema>` to `findAllWithRelations()`. This spec changes that type to `tx?: DrizzleClient` (a type widening, not a breaking change). When implementing SPEC-058, update the `findAllWithRelations` signature in both the interface and implementation to use `DrizzleClient` instead of `NodePgDatabase<typeof schema>`. This is a one-line type change per location and does not affect runtime behavior.

### 3. Add 3 missing methods to interface

These public methods exist in the concrete class but are absent from the current interface. They are already included in the full `BaseModel<T>` interface definition in section 1 (see the code block in `packages/db/src/types.ts`):

- **`findWithRelations(where, relations, tx?)`** -- Returns `Promise<T | null>`. Base class implementation is a FALLBACK that queries the entity WITHOUT loading any relations (the `relations` parameter is completely ignored). It does NOT return null -- it returns the entity record found by `db.select().from(table).where(clause).limit(1)`. Subclasses with relation support (Accommodation, Event, Destination, Sponsorship, Amenity, EventOrganizer) MUST override it to load relations via Drizzle's relational query API.
- **`updateById(id, data, tx?)`** -- Returns `Promise<void>`. Fire-and-forget update by ID. Note: the implementation silently discards the `T | null` result from the internal `update()` call. If the ID doesn't match, the update silently does nothing. This is pre-existing behavior; changing the return type is out of scope for this spec.
- **`raw(query, tx?)`** -- Returns `Promise<unknown>`. Execute raw SQL via Drizzle's `SQL` type (from `drizzle-orm`), NOT a raw string. Callers must use Drizzle's `sql` tagged template literal for parameterized queries (e.g., `sql\`SELECT * FROM users WHERE id = ${id}\``). Use sparingly -- prefer typed query methods.

### 4. Rename concrete class to `BaseModelImpl` and add `implements` clause

The concrete class is currently named `BaseModel` (same as the interface). Rename it to `BaseModelImpl` and add the `implements` clause:

```typescript
// packages/db/src/base/base.model.ts
import type { BaseModel } from '../types';  // same package, zero circular dependency

export abstract class BaseModelImpl<T extends Record<string, unknown>>
  implements BaseModel<T> {
  // ... existing implementation unchanged
}
```

**Why same-package import**: The `BaseModel<T>` interface is defined in `packages/db/src/types.ts` (section 1). The `implements` clause uses an intra-package import, eliminating any circular dependency between `@repo/db` and `@repo/service-core`. This is the key architectural decision of this spec.

**Impact**: 38 model subclass files (after EventOrganizer consolidation -- see section 8) import and extend `BaseModel` from this file. Each must be updated:
- Import: `import { BaseModelImpl } from '../../base/base.model.ts';`
- Class: `export class FooModel extends BaseModelImpl<Foo> {`

This is a mechanical search-and-replace change. No logic changes required.

**Re-export for external consumers**: The file `packages/db/src/base/base.model.ts` should re-export as alias for any external code that imports `BaseModel` from `@repo/db`:

```typescript
// At the bottom of packages/db/src/base/base.model.ts
/** @deprecated Use BaseModelImpl directly. Alias kept for backward compatibility. */
export { BaseModelImpl as BaseModel };
```

This alias can be removed in a follow-up cleanup once all consumers are verified.

### 5. Add generic constraint `T extends Record<string, unknown>`

Both the interface and class must constrain `T`:

```typescript
// Interface (packages/db/src/types.ts, re-exported from service-core)
export interface BaseModel<T extends Record<string, unknown>> { ... }

// Class (packages/db/src/base/base.model.ts)
export abstract class BaseModelImpl<T extends Record<string, unknown>>
  implements BaseModel<T> { ... }
```

**Why `Record<string, unknown>` and not `object`**: The codebase uses `Record<string, unknown>` extensively for Drizzle ORM interop (where clauses, partial updates). Using `object` would be too permissive (allows arrays, functions). Additionally, this constraint aligns with Drizzle's `InferSelectModel<T>` output type -- all 39 model subclasses use Drizzle `InferSelectModel` outputs as their `T` parameter, which always produce `Record`-shaped objects. Verified: no model in the codebase uses primitives (`string`, `number`, `null`) as `T`. Verification command: `rg 'extends BaseModel(Impl)?<' packages/db/src/models/ --no-filename | sort -u` -- all type arguments should be Drizzle-inferred entity types.

### 6. Fix `getClient()` type

Currently typed as:
```typescript
protected getClient(tx?: NodePgDatabase<typeof schema>): NodePgDatabase<typeof schema>
```

Updated to use the new union type:
```typescript
protected getClient(tx?: DrizzleClient): DrizzleClient
```

This accurately reflects runtime behavior: `getClient()` returns a regular connection, `getClient(tx)` returns the transaction passed in.

> **Semantics clarification (added 2026-04-04, cross-spec conflict resolution MEDIUM-001)**: The `getClient(tx?: DrizzleClient)` method behavior is:
> - `getClient()` (no argument) → returns `getDb()` (the global database connection)
> - `getClient(undefined)` → same as above, returns `getDb()`
> - `getClient(tx)` where `tx` is defined → returns `tx` directly
> - Implementation uses `tx ?? getDb()` internally
> - Safe to call with `undefined`. Callers can transparently use either a transaction or the default connection without conditional logic.
> - **JSDoc required**: Add `/** Returns the provided tx if available, otherwise returns the default db connection from getDb(). Safe to call with undefined. */` to the method.

### 7. Fix `withTransaction` callback type

**File**: `packages/db/src/client.ts`

Currently typed as:
```typescript
export async function withTransaction<T>(
  callback: (tx: NodePgDatabase<typeof schema>) => Promise<T>
): Promise<T>
```

Updated to:
```typescript
export async function withTransaction<T>(
  callback: (tx: DrizzleClient) => Promise<T>
): Promise<T>
```

**Why this is type-safe with the `PgDatabase` base approach**: Drizzle's `PgDatabase.transaction()` method types the callback parameter as `PgTransaction<NodePgQueryResultHKT, S, E>`, which extends `PgDatabase<NodePgQueryResultHKT, S, E>` (i.e., `DrizzleClient`). So `PgTransaction` is directly assignable to `DrizzleClient` without relying on method bivariance. The actual runtime value IS a `NodePgTransaction` (which extends `PgTransaction` which extends `PgDatabase`), and all three are assignable to `DrizzleClient`.

**Why `DrizzleClient` and not `NodePgTransaction` specifically**: Using the common base type means the callback can safely pass `tx` to any method that accepts `DrizzleClient`, including `getClient()`. This avoids forcing callers to know the specific transaction type.

### 8. Consolidate duplicate EventOrganizer model

There are TWO `EventOrganizerModel` files that both extend `BaseModel<EventOrganizer>`:

| File | Lines | Status | Content |
|------|-------|--------|---------|
| `packages/db/src/models/event/eventOrganizer.model.ts` | 12 | **Active** (imported via `event/index.ts`) | Minimal: no custom methods, no logging, `getTableName()` returns `'eventOrganizers'` |
| `packages/db/src/models/eventOrganizer.model.ts` | 65 | **Orphaned** (not imported by any index file) | Complete: has `findWithRelations()` override with event relation support, proper error handling via `DbError`, logging via `logQuery`/`logError`, singleton export, `getTableName()` returns `'event_organizers'` |

**Problem**: The active file (event subdirectory) is the minimal stub. The orphaned file (root models directory) has the production-quality implementation with relation support. Neither is imported from `packages/db/src/models/index.ts` -- the active one is imported transitively via `event/index.ts`.

**Resolution** (executed during step 5 of the implementation order):

1. **Replace** the content of `packages/db/src/models/event/eventOrganizer.model.ts` with the complete implementation from the orphaned root-level file, adjusting the import path from `'../base/base.model.ts'` to `'../../base/base.model.ts'`
2. **Delete** the orphaned file `packages/db/src/models/eventOrganizer.model.ts`
3. **Update** the consolidated file to use `BaseModelImpl` (same as all other model files in step 5)
4. **CRITICAL: Fix `getTableName()`** -- The orphaned root-level file returns `'event_organizers'` (database table name), which is WRONG. The `findAllWithRelations()` method in `BaseModel` uses `getTableName()` as a key into `db.query[tableName]`, and Drizzle's `db.query` uses the **JavaScript variable name** as key: `'eventOrganizers'` (from `export const eventOrganizers = pgTable(...)` in `event_organizer.dbschema.ts`). The consolidated file MUST use `getTableName() { return 'eventOrganizers'; }` (matching the minimal file's value). Getting this wrong causes a runtime crash in `findAllWithRelations()`

**After consolidation**: 38 model subclass files (down from 39) need the mechanical `BaseModel` -> `BaseModelImpl` rename.

## Acceptance Criteria

- [ ] `DrizzleClient` type defined in `packages/db/src/types.ts` using `PgDatabase` common base (NOT a union type)
- [ ] `QueryContext` interface defined in `packages/db/src/types.ts` (same file as `DrizzleClient`) with `tx?: DrizzleClient` property
- [ ] `DrizzleClient`, `QueryContext`, and `BaseModel` exported from `@repo/db` via `packages/db/src/index.ts`
- [ ] `BaseModel<T>` interface defined in `packages/db/src/types.ts` (same file as `DrizzleClient`, same package as implementation)
- [ ] All 9 previously-missing `tx` parameters added to `BaseModel<T>` interface methods (see table in section 2)
- [ ] `findAllWithRelations` tx parameter type updated from `NodePgDatabase<typeof schema>` to `DrizzleClient` in both interface and implementation (section 2b)
- [ ] SPEC-053's deployed `findAllWithRelations()` signature updated from `tx?: NodePgDatabase<typeof schema>` to `tx?: DrizzleClient` (post-implementation harmonization)
- [ ] 3 missing methods added to interface: `findWithRelations`, `updateById`, `raw` (with `tx?` parameter and JSDoc)
- [ ] Concrete class renamed from `BaseModel` to `BaseModelImpl`
- [ ] `BaseModelImpl` has `implements BaseModel<T>` clause
- [ ] Backward-compatible re-export: `export { BaseModelImpl as BaseModel }` with `@deprecated` JSDoc in base.model.ts
- [ ] `T extends Record<string, unknown>` constraint on both interface and class
- [ ] `getClient()` parameter and return type changed to `DrizzleClient`
- [ ] `withTransaction` callback parameter type changed to `DrizzleClient`
- [ ] Duplicate `EventOrganizerModel` consolidated: orphaned root-level file deleted, complete implementation moved to `event/eventOrganizer.model.ts`
- [ ] All 38 model subclass files updated: import `BaseModelImpl`, extend `BaseModelImpl` (39 original minus 1 deleted duplicate)
- [ ] `BaseModel<T>` interface REMOVED from `service-core/src/types/index.ts` (replaced by re-export from `@repo/db`)
- [ ] Re-export added: `export type { BaseModel } from '@repo/db'` in `service-core/src/types/index.ts`
- [ ] `NodePgDatabase` and `schema` imports removed from service-core types (no longer needed)
- [ ] All existing callers compile without changes (backward compatible via re-export and type widening)
- [ ] `pnpm typecheck` passes across all packages
- [ ] `pnpm test` passes (no regressions)
- [ ] `pnpm lint` passes (no biome errors introduced)

## Files to Modify

### New Files

| File | Content |
|------|---------|
| `packages/db/src/types.ts` | `DrizzleClient` type alias, `QueryContext` interface (with `tx?: DrizzleClient`), AND `BaseModel<T>` interface definition (see full code block in section 1). **Imports**: `PgDatabase` from `drizzle-orm/pg-core`, `NodePgQueryResultHKT` from `drizzle-orm/node-postgres`, `ExtractTablesWithRelations` + `SQL` + `Table` from `drizzle-orm`, `schema` from `./client`, `PaginatedListOutput` from `@repo/schemas`. The `BaseModel<T>` interface includes all 14 members (13 methods with `tx?: DrizzleClient` where applicable + `getTable()`) with JSDoc and generic constraint `T extends Record<string, unknown>`. The `QueryContext` interface provides the extensible context bag for ADR-018's Context Object pattern |

### Modified Files -- Core Changes

| File | Change |
|------|--------|
| `packages/db/src/base/base.model.ts` | Rename class to `BaseModelImpl`, add `implements BaseModel<T>` (from `../types`, same package), add constraint `T extends Record<string, unknown>`, change `getClient()` type to `DrizzleClient`, update all 13 method `tx` parameter types from `NodePgDatabase<typeof schema>` to `DrizzleClient`, add backward-compat re-export. **Imports to add**: `import type { DrizzleClient, BaseModel } from '../types'`. **Imports to remove**: `NodePgDatabase` from `drizzle-orm/node-postgres` (if no longer used elsewhere in the file) |
| `packages/db/src/client.ts` | Change `withTransaction` callback type to `DrizzleClient`. **Imports to add**: `import type { DrizzleClient } from './types'`. **Imports to remove**: `NodePgDatabase` (if only used for `withTransaction`; verify before removing since `getDb()` return type also uses it) |
| `packages/db/src/index.ts` | Add `export type { DrizzleClient, QueryContext, BaseModel } from './types'` (the type, context interface, and model interface are now exported from `@repo/db`) |
| `packages/service-core/src/types/index.ts` | **Remove** the entire `BaseModel<T>` interface definition. **Add** re-export: `export type { BaseModel } from '@repo/db'`. **Remove** `NodePgDatabase` from `drizzle-orm/node-postgres` and `schema` from `@repo/db` (no longer needed). All other types in this file remain unchanged |

### Modified Files -- Test Files

**Impact analysis**: 20+ test files reference `BaseModel`. Thanks to the backward-compatible re-exports (`export { BaseModelImpl as BaseModel }` in `base.model.ts` and `export type { BaseModel } from '@repo/db'` in `service-core/types/index.ts`), **NO test files should require changes**. The `BaseModel` name remains importable from both `@repo/db` and `@repo/service-core`.

**Critical test files to verify** (import `BaseModel` as a VALUE, not just a type):

| File | Import | Usage | Expected Impact |
|------|--------|-------|-----------------|
| `packages/db/test/models/base.model.test.ts` | `import { BaseModel } from '../../src/base/base.model'` | `class DummyModel extends BaseModel<DummyType>` | **None** -- backward-compat alias in same file |
| `packages/service-core/test/utils/modelMockFactory.ts` | `import { BaseModel } from '@repo/db'` | `class MockBaseModel<T> extends BaseModel<T>` | **None** -- re-export from `@repo/db` |
| `packages/service-core/test/factories/baseServiceFactory.ts` | `import type { BaseModel } from '@repo/db'` | Type annotation for mock return | **None** -- type re-export |

**Test files using `BaseModel` as type annotation** (all safe via re-exports, no changes needed):

- `packages/service-core/test/base/crud/update.test.ts`
- `packages/service-core/test/base/crud/create.test.ts`
- `packages/service-core/test/base/crud/restore.test.ts`
- `packages/service-core/test/base/crud/softDelete.test.ts`
- `packages/service-core/test/base/crud/hardDelete.test.ts`
- `packages/service-core/test/base/crud/updateVisibility.test.ts`
- `packages/service-core/test/base/crud/list.test.ts`
- `packages/service-core/test/base/crud/getById.test.ts`
- `packages/service-core/test/base/crud/count.test.ts`
- `packages/service-core/test/base/crud/search.test.ts`
- `packages/service-core/test/base/crud/adminList.test.ts` (imports as `BaseModel as BaseModelDB`)
- `packages/service-core/test/base/crud/executeAdminSearch.test.ts` (imports as `BaseModel as BaseModelDB`)
- `packages/service-core/test/base/crud/crud.related.service.test.ts` (imports from `../../../src/types`)
- `packages/service-core/test/base/base/getters.test.ts`
- `packages/service-core/test/base/base/base.service.test.setup.ts` (imports as `BaseModel as BaseModelDB`)
- `packages/service-core/test/revalidation/service-hooks.test.ts`
- `packages/service-core/test/services/destination/*.test.ts` (4 files)
- `packages/service-core/test/services/accommodation/*.test.ts` (4 files)

**Verification**: After implementation, run `pnpm test --filter @repo/db --filter @repo/service-core` to confirm all tests pass without changes.

### Modified Files -- Model Subclass Rename (mechanical, 38 files after consolidation)

Each file below requires two changes: (1) update import from `BaseModel` to `BaseModelImpl`, (2) update `extends BaseModel<X>` to `extends BaseModelImpl<X>`.

**Note**: `packages/db/src/models/eventOrganizer.model.ts` (orphaned root-level duplicate) is DELETED as part of the EventOrganizer consolidation (section 8). Its complete implementation is merged into the `event/` subdirectory file.

| File |
|------|
| `packages/db/src/models/accommodation/accommodation.model.ts` |
| `packages/db/src/models/accommodation/accommodationFaq.model.ts` |
| `packages/db/src/models/accommodation/accommodationIaData.model.ts` |
| `packages/db/src/models/accommodation/accommodationReview.model.ts` |
| `packages/db/src/models/accommodation/amenity.model.ts` |
| `packages/db/src/models/accommodation/feature.model.ts` |
| `packages/db/src/models/accommodation/rAccommodationAmenity.model.ts` |
| `packages/db/src/models/accommodation/rAccommodationFeature.model.ts` |
| `packages/db/src/models/billing/billingAddonPurchase.model.ts` |
| `packages/db/src/models/billing/billingDunningAttempt.model.ts` |
| `packages/db/src/models/billing/billingNotificationLog.model.ts` |
| `packages/db/src/models/billing/billingSettings.model.ts` |
| `packages/db/src/models/billing/billingSubscriptionEvent.model.ts` |
| `packages/db/src/models/destination/attraction.model.ts` |
| `packages/db/src/models/destination/destination.model.ts` |
| `packages/db/src/models/destination/destinationReview.model.ts` |
| `packages/db/src/models/destination/rDestinationAttraction.model.ts` |
| `packages/db/src/models/event/event.model.ts` |
| `packages/db/src/models/event/eventLocation.model.ts` |
| `packages/db/src/models/event/eventOrganizer.model.ts` (consolidated -- content replaced from root-level file) |
| `packages/db/src/models/exchange-rate/exchange-rate-config.model.ts` |
| `packages/db/src/models/exchange-rate/exchange-rate.model.ts` |
| `packages/db/src/models/owner-promotion/ownerPromotion.model.ts` |
| `packages/db/src/models/post/post.model.ts` |
| `packages/db/src/models/post/postSponsor.model.ts` |
| `packages/db/src/models/post/postSponsorship.model.ts` |
| `packages/db/src/models/revalidation/revalidation-config.model.ts` |
| `packages/db/src/models/revalidation/revalidation-log.model.ts` |
| `packages/db/src/models/sponsorship/sponsorship.model.ts` |
| `packages/db/src/models/sponsorship/sponsorshipLevel.model.ts` |
| `packages/db/src/models/sponsorship/sponsorshipPackage.model.ts` |
| `packages/db/src/models/tag/rEntityTag.model.ts` |
| `packages/db/src/models/tag/tag.model.ts` |
| `packages/db/src/models/user/rRolePermission.model.ts` |
| `packages/db/src/models/user/rUserPermission.model.ts` |
| `packages/db/src/models/user/user.model.ts` |
| `packages/db/src/models/user/userBookmark.model.ts` |
| `packages/db/src/models/user/userIdentity.model.ts` |

## Pre-Implementation Verification

Run these checks BEFORE starting implementation to confirm the spec's assumptions match the current codebase state:

### SPEC-053 Completion Check

SPEC-053 is a prerequisite. Verify both interface and implementation were updated:

```bash
# Interface should have tx parameter on findAllWithRelations
rg 'findAllWithRelations' packages/service-core/src/types/index.ts
# Implementation should have tx parameter
rg 'findAllWithRelations' packages/db/src/base/base.model.ts
# Both should show tx?: NodePgDatabase (which this spec updates to DrizzleClient)
```

### Circular Dependency Analysis

This spec moves the `BaseModel<T>` interface from `@repo/service-core` to `@repo/db`. Verify no circular imports exist:

```bash
# @repo/db must NOT import from @repo/service-core (would create cycle)
rg "from '@repo/service-core'" packages/db/src/ --type ts  # Expected: 0 results

# @repo/service-core imports from @repo/db (expected, correct direction)
rg "from '@repo/db'" packages/service-core/src/ --type ts  # Expected: multiple results

# @repo/db imports from @repo/schemas (safe, schemas don't import db)
rg "from '@repo/schemas'" packages/db/src/ --type ts  # Expected: some results
rg "from '@repo/db'" packages/schemas/src/ --type ts   # Expected: 0 results (no cycle)
```

**Verified architecture**: `@repo/schemas` ← `@repo/db` ← `@repo/service-core`. No circular dependencies.

> **CONSTRAINT (added 2026-04-04, cross-spec conflict resolution CRITICAL-002)**: `packages/db/src/types.ts` imports `PaginatedListOutput` from `@repo/schemas`. This creates a dependency chain: `@repo/schemas` ← `@repo/db` ← `@repo/service-core`. To prevent circular dependencies:
> - `@repo/db` must NEVER import from `@repo/service-core`
> - `@repo/schemas` must NEVER import from `@repo/db`
> - If a future refactor needs types from both `@repo/schemas` and `@repo/service-core` in `@repo/db`, consider extracting shared types to a dedicated `@repo/types` package
> - **CI enforcement**: Add a pre-build check or ESLint rule to verify no circular imports exist between these three packages

### PaginatedListOutput Export

```bash
# Verify PaginatedListOutput is exported from @repo/schemas (needed by types.ts)
rg 'PaginatedListOutput' packages/schemas/src/common/relations.schema.ts  # Definition
rg 'PaginatedListOutput' packages/schemas/src/index.ts                     # Re-export
# @repo/schemas must NOT import from @repo/db (no cycle)
rg "from '@repo/db'" packages/schemas/src/ --type ts  # Expected: 0 results
```

### EventOrganizer Files

```bash
# Verify both files exist and check their getTableName values
rg 'getTableName' packages/db/src/models/event/eventOrganizer.model.ts    # Should return 'eventOrganizers'
rg 'getTableName' packages/db/src/models/eventOrganizer.model.ts           # Should return 'event_organizers' (WRONG, to be deleted)
```

### Model Subclass Count

```bash
# Count all BaseModel subclasses (should be 39 before EventOrganizer consolidation)
rg 'extends BaseModel<' packages/db/src/models/ --count-matches | wc -l

# Verify generic constraint safety: all T types should be Drizzle-inferred entity types
rg 'extends BaseModel<' packages/db/src/models/ --no-filename | sort -u
```

### Consumer Inventory

```bash
# All files importing BaseModel (for backward-compat verification after implementation)
rg "import.*BaseModel" packages/ --type ts --glob '!node_modules' --glob '!*.test.*'
rg "import.*BaseModel" packages/ --type ts --glob '!node_modules' --glob '*.test.*'
```

### findWithRelations Override Detection (prep for SPEC-060)

```bash
# All findWithRelations overrides that call getDb() directly (SPEC-060 scope, but verify count matches spec)
rg 'findWithRelations' packages/db/src/models/ --files-with-matches  # Expected: 14 files after consolidation
rg 'getDb\(\)' packages/db/src/models/ --files-with-matches           # These are the SPEC-060 targets
```

## Implementation Order

Execute changes in this exact order to maintain a compiling codebase at each step:

1. **Create `packages/db/src/types.ts`** with `DrizzleClient` type, `QueryContext` interface, AND `BaseModel<T>` interface
   - Import `PgDatabase` from `drizzle-orm/pg-core`
   - Import `NodePgQueryResultHKT` from `drizzle-orm/node-postgres`
   - Import `ExtractTablesWithRelations` from `drizzle-orm`
   - Import `schema` from `./client`
   - Import `SQL` from `drizzle-orm` (for `raw()` method signature)
   - Import `PaginatedListOutput` from `@repo/schemas` (for `findAll`/`findAllWithRelations` return types)
   - Import `Table` from `drizzle-orm` (for `getTable()` return type)
   - Define `QueryContext` interface with `tx?: DrizzleClient` property (ADR-018 Context Object pattern, used by SPEC-059 and SPEC-060)
   - Define the complete `BaseModel<T extends Record<string, unknown>>` interface with all 14 members (13 methods with `tx?: DrizzleClient` where applicable + `getTable()`), full JSDoc
2. **Export from `packages/db/src/index.ts`** -- add `export type { DrizzleClient, QueryContext, BaseModel } from './types'`
3. **Update `packages/db/src/client.ts`** -- change `withTransaction` callback type to `DrizzleClient`
   - Add `import type { DrizzleClient } from './types.ts'`
   - Keep `NodePgDatabase` import if still needed for `getDb()` return type
4. **Update `packages/db/src/base/base.model.ts`**:
   a. Add `import type { DrizzleClient } from '../types.ts'`
   b. Add generic constraint `T extends Record<string, unknown>`
   c. Rename class to `BaseModelImpl`
   d. Change `getClient()` parameter and return type to `DrizzleClient`
   e. Change all method `tx` parameter types from `NodePgDatabase<typeof schema>` to `DrizzleClient` (13 methods: `findById`, `findOne`, `create`, `update`, `updateById`, `softDelete`, `restore`, `hardDelete`, `count`, `findAll`, `findAllWithRelations`, `findWithRelations`, `raw`). Note: `findAllWithRelations` already HAS a `tx` parameter (added by SPEC-053) -- this is a TYPE change (`NodePgDatabase<typeof schema>` → `DrizzleClient`), not a new parameter
   f. Add backward-compat re-export `export { BaseModelImpl as BaseModel }` with `@deprecated` JSDoc
   g. Run `pnpm typecheck --filter @repo/db` -- should pass because of the re-export
5. **Consolidate duplicate EventOrganizer model AND update 38 model subclass files**:
   a. **Consolidate first**: Replace content of `packages/db/src/models/event/eventOrganizer.model.ts` with the complete implementation from `packages/db/src/models/eventOrganizer.model.ts`, adjusting the import path from `'../base/base.model.ts'` to `'../../base/base.model.ts'`
   b. **Delete** the orphaned `packages/db/src/models/eventOrganizer.model.ts`
   c. **Fix `getTableName()`**: The orphaned file returns `'event_organizers'` which is WRONG for `db.query` access. Must return `'eventOrganizers'` (the JS variable name from the schema export). See section 8 for details
   d. **Then rename all 38 files**: change import name AND `extends` clause from `BaseModel` to `BaseModelImpl`
   - Verify: `rg 'extends BaseModel<' packages/db/src/models/` should return 0 results after this step
6. **Update `packages/service-core/src/types/index.ts`**:
   a. **Remove** the entire `BaseModel<T>` interface definition from this file
   b. **Add** re-export: `export type { BaseModel } from '@repo/db'` (backward compatibility for all service-core consumers)
   c. Remove `import type { NodePgDatabase } from 'drizzle-orm/node-postgres'` and `import type { schema } from '@repo/db'` (no longer needed since the interface definition moved to `@repo/db`)
   d. Keep all other types in this file unchanged (`AdminSearchExecuteParams`, etc.)
7. **Add `implements` clause** to `BaseModelImpl` in `packages/db/src/base/base.model.ts`:
   - `import type { BaseModel } from '../types'` (same-package import, zero circular dependency)
   - This step CAN be done as part of step 4 since the interface is in the same package. However, doing it last allows intermediate typecheck steps to pass without the constraint. Either order works.
8. **Run full validation**: `pnpm typecheck && pnpm lint && pnpm test`

**Why step 7 can be flexible**: Unlike the original approach where the interface lived in `@repo/service-core` (requiring it to be finalized before `@repo/db` could use it), now both live in `@repo/db`. The `implements` clause can be added at any point after step 4 (when the interface is complete). Doing it last is still recommended to allow intermediate typecheck validation.

**Verification commands between steps** (optional but recommended):
- After step 4g: `pnpm typecheck --filter @repo/db`
- After step 5: `rg 'extends BaseModel<' packages/db/src/models/` (should return 0)
- After step 6: `pnpm typecheck --filter @repo/service-core`
- After step 7: `pnpm typecheck --filter @repo/db` (verifies implements clause)

## Estimated Effort

3-4 days

- Day 1: Steps 1-4 (types, client, base model)
- Day 2: Step 5 (EventOrganizer consolidation + 38 model files -- mechanical but requires care)
- Day 3: Steps 6-7 (interface update, implements clause)
- Day 4: Full test run, fix any regressions, PR review

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Rename ripple**: 38 model files change import/extends (after EventOrganizer consolidation). If any file is missed, build breaks | Medium | Mechanical search-and-replace. Verify with `rg 'extends BaseModel<' packages/db/src/models/` (should return 0 after step 5). `pnpm typecheck` catches any miss immediately |
| **External consumers of `BaseModel` from `@repo/service-core`**: Code importing `BaseModel` from `@repo/service-core` must continue working | Low | The re-export `export type { BaseModel } from '@repo/db'` in `service-core/types/index.ts` maintains full backward compatibility. No consumer needs to change their import source |
| **External consumers of `BaseModel` from `@repo/db`**: Code importing the CLASS `BaseModel` from `@repo/db` | Low | The deprecated re-export alias `export { BaseModelImpl as BaseModel }` in `base.model.ts` maintains backward compatibility |
| **Test mocks**: 20+ test files reference `BaseModel` by name across `@repo/db` and `@repo/service-core` test suites | Low | The backward-compat re-exports (`export { BaseModelImpl as BaseModel }` in `base.model.ts` and `export type { BaseModel } from '@repo/db'` in `service-core/types/index.ts`) keep the `BaseModel` name importable from both packages. Critical files to verify: `modelMockFactory.ts` (extends BaseModel as a class), `base.model.test.ts` (extends BaseModel). Full list in "Modified Files -- Test Files" section |
| **Generic constraint breaks existing models**: Some model subclass might use `T` in a way incompatible with `Record<string, unknown>` | Low | All entity types are Drizzle `InferSelectModel` outputs, which are always `Record`-shaped objects. Verified: no model uses primitives as `T` |
| **Duplicate EventOrganizer consolidation**: The root-level orphaned file has `findWithRelations()` and logging that the active file lacks. Merging incorrectly could lose relation support | Medium | Consolidation is explicitly scripted in section 8 and step 5. Verify `findWithRelations` works via existing tests after merge. Cross-check `getTableName()` against Drizzle schema key |
| **`getDb()` return type unchanged**: `getDb()` still returns `NodePgDatabase<typeof schema>`. Since `NodePgDatabase` extends `PgDatabase`, it is assignable to `DrizzleClient`. No change needed to `getDb()` | None | N/A -- informational, no action required |

## Rollback Plan

If issues are found after merging:

1. **Quick revert**: Remove the `implements` clause and re-export alias. The rename itself is safe and can stay.
2. **Full revert**: Single `git revert` of the merge commit. All changes are internal to `@repo/db` and `@repo/service-core` with no database migrations.

## Implementation Notes

### Import cleanup in `service-core/src/types/index.ts`

The current interface file defines `BaseModel<T>` inline and imports `NodePgDatabase` and `schema` to type `findAllWithRelations`. After this spec, the entire interface definition is REMOVED and replaced with a re-export:

```typescript
// BEFORE (current)
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { schema } from '@repo/db';

export interface BaseModel<T> {
  // ... full interface definition
}

// AFTER (this spec)
export type { BaseModel } from '@repo/db';
// NodePgDatabase and schema imports removed entirely
```

The interface definition now lives in `packages/db/src/types.ts`. Existing consumers importing `BaseModel` from `@repo/service-core` continue working via the re-export.

### Import cleanup in `db/src/base/base.model.ts`

The base model file currently imports `NodePgDatabase` for all method signatures. After this spec:

```typescript
// BEFORE
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// AFTER -- DrizzleClient and BaseModel from same package
import type { DrizzleClient, BaseModel } from '../types';  // same package, no circular dependency
```

Check whether `NodePgDatabase` is still referenced anywhere in the file after replacing all `tx` parameters. If not, remove the import.

### `getDb()` return type is intentionally unchanged

`getDb()` in `packages/db/src/client.ts` returns `NodePgDatabase<typeof schema>`. This is correct and intentional -- it always returns a regular (non-transaction) connection. Since `NodePgDatabase extends PgDatabase`, the return value is assignable to `DrizzleClient` wherever needed. Do NOT change `getDb()` return type.

### Transaction parameter convention across layers

- **Model layer** (`@repo/db`): Uses `tx?: DrizzleClient` as a direct positional parameter
- **Service layer** (`@repo/service-core`): Uses `ctx?: ServiceContext` which contains `tx` as a property (defined by SPEC-059)
- **Billing layer**: Uses `ctx?: QueryContext` which contains `tx` as a property (defined by SPEC-064)

This three-level nesting is intentional: models only need the transaction client, while services and billing need additional context (hookState, actor, etc.) alongside the transaction.

### Model subclass `findWithRelations` overrides -- FUNCTIONAL GAP

Several model subclasses override `findWithRelations` with narrower types (e.g., `relations: Record<string, boolean>` instead of `Record<string, boolean | Record<string, unknown>>`). Some also **drop the `tx` parameter entirely and call `getDb()` directly**, which means:

- **These overrides silently IGNORE transactions**. If a caller passes `tx` through the interface, the subclass override will NOT use it. The operation runs outside the transaction boundary, which can cause data inconsistency.
- This is a **functional bug**, not just a TypeScript technicality.
- These overrides will still **compile** because TypeScript allows covariant return types and contravariant parameter types in method overrides. The compiler will NOT flag the missing `tx` parameter.

**Affected subclasses** (verified against codebase -- 14 files after EventOrganizer consolidation, all call `getDb()` directly instead of `this.getClient(tx)`):
- `AccommodationModel` (`accommodation/accommodation.model.ts`)
- `AmenityModel` (`accommodation/amenity.model.ts`)
- `RAccommodationAmenityModel` (`accommodation/rAccommodationAmenity.model.ts`)
- `RAccommodationFeatureModel` (`accommodation/rAccommodationFeature.model.ts`)
- `DestinationModel` (`destination/destination.model.ts`)
- `RDestinationAttractionModel` (`destination/rDestinationAttraction.model.ts`)
- `EventModel` (`event/event.model.ts`)
- `EventOrganizerModel` (`event/eventOrganizer.model.ts`, after consolidation)
- `OwnerPromotionModel` (`owner-promotion/ownerPromotion.model.ts`)
- `PostSponsorshipModel` (`post/postSponsorship.model.ts`)
- `SponsorshipModel` (`sponsorship/sponsorship.model.ts`)
- `SponsorshipLevelModel` (`sponsorship/sponsorshipLevel.model.ts`)
- `SponsorshipPackageModel` (`sponsorship/sponsorshipPackage.model.ts`)
- `REntityTagModel` (`tag/rEntityTag.model.ts`)

**Note**: Two models (`RRolePermissionModel`, `RUserPermissionModel`) correctly accept `tx` and use `this.getClient(tx)`. These do NOT need SPEC-060 fixes.

**Resolution**: Fixing these overrides (adding `tx` parameter, replacing `getDb()` with `this.getClient(tx)`) is explicitly in **SPEC-060's scope** (not this spec). SPEC-058 adds `tx` to the interface signature, making the gap visible. SPEC-060 closes it.

## Out of Scope

- **`QueryContext` interface**: Now defined in THIS spec (SPEC-058) in `@repo/db/src/types.ts`, alongside `DrizzleClient`. SPEC-058 methods still use positional `tx` to match the current implementation; `QueryContext` is exported so SPEC-059 and SPEC-060 can use it immediately
- **`ServiceContext` interface** (extends `QueryContext`): Defined in SPEC-059. Adds per-request runtime context (`hookState` for lifecycle hook state isolation, plus the inherited `tx` from `QueryContext`) on top of the transaction handle
- **Migrating callers from positional `tx` to context object**: Handled by SPEC-060
- **Service-layer transaction propagation**: SPEC-059
- **Model subclass custom methods receiving `tx`**: SPEC-060 (covers 50+ custom methods in subclasses)
- **Integration tests**: SPEC-061
- **Billing transaction safety**: SPEC-064
- **Removing the backward-compat re-exports**: Follow-up cleanup task after all consumers verified (both the `BaseModel` class alias in `base.model.ts` and the re-export in `service-core/types/index.ts`)

### Known Remaining `NodePgDatabase` Usages After SPEC-058

The following files will still import `NodePgDatabase` directly after SPEC-058 completes. These are out of scope for this spec and are addressed by SPEC-060 (model subclass methods) or are intentionally kept (e.g., `getDb()` return type):

**Model subclass files** (custom methods with direct `NodePgDatabase` imports or `getDb()` calls in `findWithRelations` and other overrides, resolved by SPEC-060):
- `packages/db/src/models/accommodation/accommodation.model.ts` (findWithRelations, countByFilters, search)
- `packages/db/src/models/accommodation/amenity.model.ts` (findWithRelations)
- `packages/db/src/models/destination/destination.model.ts` (findWithRelations)
- `packages/db/src/models/event/event.model.ts` (findWithRelations)
- `packages/db/src/models/event/eventOrganizer.model.ts` (after consolidation -- findWithRelations)
- `packages/db/src/models/sponsorship/sponsorship.model.ts` (findWithRelations)
- `packages/db/src/models/accommodation/accommodationReview.model.ts` (custom methods)
- `packages/db/src/models/destination/destinationReview.model.ts` (custom methods)
- `packages/db/src/models/user/user.model.ts` (findAll, count overrides, findAllWithCounts custom method)
- `packages/db/src/models/exchange-rate/exchange-rate-config.model.ts` (getConfig and other custom methods)

**Service-core files** (resolved by SPEC-059/SPEC-060):
- `packages/service-core/src/services/addon-limit-recalculation.service.ts`

**Intentionally kept** (correct usage, not targeted):
- `packages/db/src/client.ts` (`getDb()` return type is correctly `NodePgDatabase`)
- `packages/db/src/billing/drizzle-adapter.ts` (billing-specific adapter)

## Parallel Execution Guide for Agents

> **CRITICAL**: This section is the authoritative reference for any agent implementing SPEC-058, SPEC-059, SPEC-060, or SPEC-061. Read this ENTIRELY before starting work.

### SPEC-058's Role in the Transaction Safety Chain

SPEC-058 is the **foundation spec**. It produces types and signatures that THREE other specs depend on. Nothing in the transaction chain can start until SPEC-058 is **fully merged to `main`**.

```
SPEC-058 (THIS SPEC) ─── MUST complete first
    │
    ├──► SPEC-060 (model tx propagation) ── BLOCKED until 058 merged
    │
    ├──► SPEC-059 Phases 1-3 (service ctx threading) ── BLOCKED until 058 merged
    │
    └──► SPEC-061 (integration tests) ── can start after 058, but validates 059+060
```

### What SPEC-058 Produces (Other Specs Consume These)

| Artifact | File | Consumer Specs |
|----------|------|---------------|
| `DrizzleClient` type | `packages/db/src/types.ts` | SPEC-059, SPEC-060, SPEC-061, SPEC-064, SPEC-066 |
| `QueryContext` interface (`{ tx?: DrizzleClient }`) | `packages/db/src/types.ts` | SPEC-059, SPEC-064 |
| `BaseModel<T>` interface (moved from service-core) | `packages/db/src/types.ts` | SPEC-059 (re-exports) |
| Updated `getClient(tx?: DrizzleClient)` method | `packages/db/src/base/base.model.ts` | SPEC-060 (all model subclasses call this) |
| Updated `withTransaction` callback type | `packages/db/src/client.ts` | SPEC-059, SPEC-064 |
| `BaseModelImpl` class (renamed from `BaseModel`) | `packages/db/src/base/base.model.ts` | SPEC-060 (subclasses extend this) |
| 13 base methods with `tx?: DrizzleClient` parameter | `packages/db/src/base/base.model.ts` | SPEC-060 (subclasses override these) |

### Completion Signal

When SPEC-058 is done, verify ALL of the following before signaling to other agents:

1. `pnpm typecheck` passes with zero errors
2. `pnpm test` passes (all existing tests)
3. `DrizzleClient` is exported from `@repo/db` package
4. `QueryContext` is exported from `@repo/db` package
5. `BaseModel<T>` interface is exported from `@repo/db` package
6. `BaseModel<T>` interface is re-exported from `@repo/service-core` (backward compat)
7. All 38 model subclasses compile with `BaseModelImpl`
8. PR is merged to `main`

**Only after ALL 8 checks pass can SPEC-059 and SPEC-060 agents begin work.**

### What SPEC-058 Does NOT Do (Boundaries)

- Does NOT add `tx` to model subclass custom methods (that's SPEC-060)
- Does NOT create `ServiceContext` runtime type (that's SPEC-059)
- Does NOT create `withServiceTransaction()` utility (that's SPEC-059)
- Does NOT touch any service-layer files except `types/index.ts` (interface removal + re-export)
- Does NOT touch any API route files
- Does NOT create integration test infrastructure (that's SPEC-061)

### Cross-Spec Merge Conflict Risk

| Spec | Risk | Details |
|------|------|---------|
| SPEC-053 | None | Already completed. SPEC-058 widens `findAllWithRelations` tx type from `NodePgDatabase<typeof schema>` to `DrizzleClient`. One-line change per location. |
| SPEC-052 | Low | Both touch `packages/service-core/src/types/index.ts`. SPEC-052 makes `AdminSearchExecuteParams` generic. SPEC-058 removes `BaseModel<T>` interface and adds re-export. Different parts of the file. |
| SPEC-055 | None | SPEC-055 touches model subclass method bodies (LIKE escaping). SPEC-058 only touches the base class and import lines in subclasses. No overlap. |
