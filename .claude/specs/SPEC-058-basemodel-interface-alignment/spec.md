# SPEC-058: Align BaseModel Interface with Implementation

> **Status**: draft
> **Priority**: P1
> **Complexity**: Medium
> **Origin**: SPEC-053 gaps (GAP-003, GAP-004, GAP-018, GAP-019, GAP-071, GAP-072)
> **Created**: 2026-04-01
> **ADR**: ADR-018 (Transaction Propagation via Context Object Pattern)
> **Dependencies**: None (foundation for SPEC-059, SPEC-060)

## Problem Statement

The `BaseModel<T>` interface in `packages/service-core/src/types/index.ts` has six gaps vs the concrete class in `packages/db/src/base/base.model.ts`:

1. **GAP-003**: 9 of 11 interface methods lack the `tx` parameter their implementations already accept
2. **GAP-004**: 3 methods exist in implementation but not in interface (`findWithRelations`, `updateById`, `raw`)
3. **GAP-018**: `withTransaction` types callback as `NodePgDatabase` when Drizzle passes `NodePgTransaction`
4. **GAP-019**: No `implements BaseModel<T>` clause on the concrete class
5. **GAP-071**: `getClient()` return type lies when receiving `NodePgTransaction`
6. **GAP-072**: `BaseModel<T>` has no generic constraint on `T`

## Proposed Solution

Seven coordinated changes following ADR-018 (Migration Plan Step 1):

### 1. Define `DrizzleClient` union type

```typescript
// packages/db/src/types.ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { schema } from './client';

export type DrizzleClient = NodePgDatabase<typeof schema> | PgTransaction<...>;
```

### 2. Define `QueryContext` interface

```typescript
export interface QueryContext {
  readonly tx?: DrizzleClient;
}
```

### 3. Add `ctx?: QueryContext` to all 9 missing interface methods

Methods to update: `findById`, `findOne`, `create`, `update`, `softDelete`, `restore`, `hardDelete`, `count`, `findAll`.

Dual-accept period: methods accept both positional `tx` and `ctx.tx` during migration.

### 4. Add 3 missing methods to interface

- `findWithRelations(where, relations, tx?): Promise<T | null>`
- `updateById(id, data, tx?): Promise<void>`
- `raw(query, tx?): Promise<unknown>`

### 5. Add `implements BaseModel<T>` clause

```typescript
export abstract class BaseModelImpl<T extends Record<string, unknown>>
  implements BaseModel<T> { ... }
```

### 6. Add generic constraint

```typescript
export interface BaseModel<T extends Record<string, unknown>> { ... }
```

### 7. Fix `getClient()` and `withTransaction` types

- `getClient(tx?: DrizzleClient): DrizzleClient`
- `withTransaction<T>(callback: (tx: DrizzleClient) => Promise<T>): Promise<T>`

## Acceptance Criteria

- [ ] `DrizzleClient` and `QueryContext` types exported from `@repo/db`
- [ ] All 12 `BaseModel<T>` interface methods have `tx` or `ctx` parameter
- [ ] Concrete class has `implements BaseModel<T>` clause
- [ ] `T extends Record<string, unknown>` constraint on both interface and class
- [ ] `getClient()` returns `DrizzleClient` (union type)
- [ ] `withTransaction` callback receives `DrizzleClient`
- [ ] All existing callers compile without changes (backward compatible)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (no regressions)

## Files to Modify

| File | Change |
|------|--------|
| `packages/db/src/types.ts` | NEW: Define `DrizzleClient`, `QueryContext` |
| `packages/db/src/index.ts` | Export new types |
| `packages/db/src/client.ts` | Fix `withTransaction` callback type |
| `packages/db/src/base/base.model.ts` | Fix `getClient` type, add `implements`, add constraint |
| `packages/service-core/src/types/index.ts` | Re-export from `@repo/db` or update interface |

## Estimated Effort

2-3 days

## Risks

- Interface changes ripple through all model subclasses. Must be backward-compatible (`ctx` optional everywhere).
- Dual-accept period (positional `tx` + `ctx.tx`) adds temporary complexity. Must be time-boxed.

## Out of Scope

- Migrating existing callers from positional `tx` to `ctx.tx` (handled by SPEC-060)
- Service-layer transaction support (SPEC-059)
- Integration tests (SPEC-061)
