# SPEC-059: Service-Layer Transaction Support & Concurrency Safety

> **Status**: draft
> **Priority**: P1
> **Complexity**: High
> **Origin**: SPEC-053 gaps (GAP-010, GAP-013/025, GAP-014, GAP-029, GAP-034, GAP-055, GAP-057, GAP-058, GAP-063, GAP-064, GAP-065)
> **Created**: 2026-04-01
> **ADR**: ADR-018 (Transaction Propagation via Context Object Pattern)
> **Depends on**: SPEC-058

## Problem Statement

`BaseCrudService` has zero transaction support. No service method accepts or propagates a transaction context. This causes:

1. **Non-atomic multi-writes**: Lifecycle hooks (`_afterCreate`, `_afterUpdate`, `_afterSoftDelete`) perform cross-entity writes that can partially fail, leaving inconsistent state
2. **Singleton mutable state**: 6 services store mutable state in instance fields between `_before`/`_after` hooks. Under concurrent requests, the event loop interleaves and one request overwrites another's state
3. **Error swallowing**: `runWithLoggingAndValidation` catches `ServiceError` and returns `{ error }` instead of rethrowing, preventing transaction rollback
4. **TOCTOU races**: `softDelete`/`hardDelete` do check-then-act without atomicity

## Affected Services (Singleton Mutable State)

| Service | Mutable Fields | Risk |
|---------|---------------|------|
| AccommodationService | `_lastDeletedEntity`, `_lastRestoredAccommodation` | Wrong entity revalidated |
| AccommodationReviewService | `_lastDeletedAccommodationId`, `_lastRestoredAccommodationId` | Wrong stats |
| DestinationReviewService | `_lastDeletedDestinationId`, `_lastRestoredDestinationIdForReview` | Wrong stats |
| DestinationService | `_lastDeletedDestinationSlug`, `_lastRestoredDestinationSlug`, `_updateId` | Wrong revalidation |
| EventService | `_lastRestoredEvent`, `_lastDeletedEvent` | Wrong revalidation |
| PostService | `_lastRestoredPost`, `_lastDeletedPost`, `_updateId` | Wrong revalidation |

## Proposed Solution

### 1. Define `ServiceContext` extending `QueryContext`

```typescript
interface ServiceContext extends QueryContext {
  // Hook state (replaces singleton mutable fields)
  hookState?: Record<string, unknown>;
  // Future: requestId, actor, correlationId
}
```

### 2. Pass `ServiceContext` through CRUD methods and lifecycle hooks

All `BaseCrudService` methods (`create`, `update`, `softDelete`, `hardDelete`, `restore`, `list`, `_executeAdminSearch`) receive `ctx?: ServiceContext`.

All lifecycle hooks (`_beforeCreate`, `_afterCreate`, `_beforeUpdate`, `_afterUpdate`, `_beforeSoftDelete`, `_afterSoftDelete`, etc.) receive `ctx: ServiceContext`.

### 3. Replace singleton mutable state

Before:

```typescript
private _lastDeletedEntity: TEntity | undefined;
_beforeSoftDelete(entity) { this._lastDeletedEntity = entity; }
_afterSoftDelete() { revalidate(this._lastDeletedEntity); this._lastDeletedEntity = undefined; }
```

After:

```typescript
_beforeSoftDelete(entity, ctx) { ctx.hookState.deletedEntity = entity; }
_afterSoftDelete(entity, ctx) { revalidate(ctx.hookState.deletedEntity); }
```

### 4. Fix `runWithLoggingAndValidation`

When `ctx.tx` is active, rethrow `ServiceError` instead of returning `{ error }`:

```typescript
if (error instanceof ServiceError) {
  if (ctx?.tx) throw error; // Let transaction rollback
  return { error };
}
```

### 5. Wrap cross-entity writes in transactions

Lifecycle hooks that perform cross-entity writes (stats recalculation, accommodation count updates, sponsorship linking) use `withTransaction` and pass `tx` through `ctx`.

## Acceptance Criteria

- [ ] `ServiceContext` type defined and exported
- [ ] All BaseCrudService methods accept `ctx?: ServiceContext`
- [ ] All lifecycle hooks receive `ctx: ServiceContext`
- [ ] 6 services: mutable instance fields replaced with `ctx.hookState`
- [ ] `runWithLoggingAndValidation` rethrows when `ctx.tx` is active
- [ ] `_executeAdminSearch` and `list()` propagate `ctx.tx`
- [ ] Cross-entity writes in hooks wrapped in transactions
- [ ] Existing callers compile without changes (ctx optional)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes

## Estimated Effort

5-7 days

## Risks

- HIGH: Touches every service's lifecycle hooks. Requires careful migration.
- Must be backward-compatible (ctx optional). Existing route handlers that don't pass ctx continue working.
- The `hookState` bag is untyped. Consider a per-service typed context interface.

## Out of Scope

- Model-layer tx propagation (SPEC-060)
- BaseModel interface changes (SPEC-058)
- Integration tests (SPEC-061)
- Billing services (SPEC-064)
