# SPEC-059 Progress — Service-Layer Transaction Support

**Status**: completed | **Progress**: 32/32 tasks (100%)
**Last updated**: 2026-04-13

---

## Completed — Phase 1: Setup (T-001 → T-007) ✅

| Task | Description | Commit |
|------|-------------|--------|
| T-001 | `ServiceContext` → `ServiceConfig` (constructor config type) | 2076825a |
| T-002 | `QueryContext` in `@repo/db` + new `ServiceContext<THookState>` | 2076825a |
| T-003 | 4 base class constructors updated to `ServiceConfig` | 2076825a |
| T-004 | Bulk rename across 21 concrete services + 388 test files | 2076825a |
| T-005 | `withServiceTransaction` utility in `utils/transaction.ts` | 2076825a |
| T-006 | Exports updated in `utils/index.ts` and `src/index.ts` | 2076825a |
| T-007 | `idle_in_transaction_session_timeout: 30000` in PG Pool | 2076825a |

**Key files changed:**
- `packages/db/src/types.ts` — `QueryContext` interface added
- `packages/db/src/index.ts` — `QueryContext` exported
- `packages/service-core/src/types/index.ts` — `ServiceConfig` + `ServiceContext<T>`
- `packages/service-core/src/utils/transaction.ts` — NEW: `withServiceTransaction`
- All 21 concrete services — constructors use `ServiceConfig`
- `apps/api/src/utils/database.ts` — Pool timeout configured

---

## Next — Phase 2: Base class ctx threading (T-008 → T-012)

**Start here: T-008** (most critical — error-swallowing fix)

### T-008 — `runWithLoggingAndValidation` + error-swallowing fix
**File**: `packages/service-core/src/base/base.service.ts`
1. Add `ctx?: ServiceContext` param to `runWithLoggingAndValidation`
2. Pass `resolvedCtx = ctx ?? { hookState: {} }` to `execute()`
3. Fix catch Branch 1 (ServiceError): add `if (ctx?.tx) { throw error; }` before `return { error }`
4. Fix catch Branch 3 (unknown): add `if (ctx?.tx) { throw serviceError; }` before `return { error }`
5. Branch 2 (DbError) — leave unchanged (already rethrows)

### T-009 — 20 lifecycle hooks in `base.crud.hooks.ts`
Add `_ctx: ServiceContext` as LAST param to all 20 no-op hooks. Use `_ctx` (underscore = unused).

### T-010 — `BaseCrudRead` 8 methods + `_executeAdminSearch`
**File**: `packages/service-core/src/base/base.crud.read.ts`
Pattern per method:
```typescript
async getById(actor: Actor, id: string, ctx?: ServiceContext): Promise<...> {
  const resolvedCtx: ServiceContext = { hookState: {}, ...ctx };
  return this.runWithLoggingAndValidation({ ..., ctx: resolvedCtx, execute: async (data, actor, execCtx) => {
    await this._beforeGetByField(..., execCtx);
    // ...
    await this._afterGetByField(..., execCtx);
  }});
}
```

### T-011 — `BaseCrudWrite` 7 methods + `_getAndValidateEntity`
**File**: `packages/service-core/src/base/base.crud.write.ts`
Same pattern. Also update `_getAndValidateEntity` in `base.service.ts` to accept `ctx?`.

### T-012 — `BaseCrudAdmin` + abstract `_executeSearch`/`_executeCount`
- `base.crud.admin.ts`: add ctx to `getAdminInfo`, `setAdminInfo`
- `base.crud.permissions.ts`: update ABSTRACT declarations (no `_` prefix — concrete impls use it)

---

## Completed — Phase 3: hookState migrations (T-013 → T-023) ✅

| Task | Description | Commit |
|------|-------------|--------|
| T-013 | 13 stateless services (done by T-012 cascade) | 9edbaacf |
| T-014 | UserService hooks (T-009 cascade) + ExchangeRateService 4 custom methods | 4ecf23d6 |
| T-015 | 6 stateful services (done by T-012 cascade) | 9edbaacf |
| T-016+T-017 | DestinationService hookState (4 mutable fields → ctx.hookState) | 4ecf23d6 |
| T-018 | AccommodationService hookState (2 mutable fields) | 4ecf23d6 |
| T-019+T-020 | PostService hookState (3 mutable fields + update override) | 4ecf23d6 |
| T-021 | EventService hookState (2 mutable fields) | 4ecf23d6 |
| T-022 | AccommodationReviewService hookState (2 mutable fields) | 4ecf23d6 |
| T-023 | DestinationReviewService hookState (2 mutable fields) | 4ecf23d6 |

**All mutable instance fields eliminated — zero shared state across requests.**

---

## Completed — Phase 4: ctx.tx propagation (T-024–T-026) ✅

| Task | Description | Commit |
|------|-------------|--------|
| T-024 | DestinationService update() conditional ctx.tx (already implemented, comment cleanup) | a9ff7673 |
| T-025 | AccommodationReviewService _afterSoftDelete/_afterHardDelete/_afterRestore pass ctx.tx | 6258ecce |
| T-026 | DestinationReviewService already passing ctx.tx (no changes needed) | 4ecf23d6 |

### Completed — Testing (T-027–T-032) ✅

| Task | Description | Commit |
|------|-------------|--------|
| T-027 | withServiceTransaction tests (commit, rollback, timeout, baseCtx) | ee7d187e |
| T-028 | runWithLoggingAndValidation rethrow (ServiceError, unknown, DbError) | ee7d187e |
| T-029 | AccommodationService hookState concurrency isolation | ee7d187e |
| T-030 | DestinationService hookState (instance fields eliminated) | ee7d187e |
| T-031 | backward compat — all methods work without ctx | ee7d187e |
| T-032 | hookState init edge cases (tx without hookState, preserve existing) | ee7d187e |

**38 tests across 6 files, all passing.**

---

## Gotchas discovered

- Multi-line constructors: `grep -n 'constructor.*ServiceContext'` does NOT find them. Search for `ctx: ServiceContext` on its own line.
- Pool is created in `apps/api/src/utils/database.ts`, not in `@repo/db` (db receives it via `initializeDb()`).
- `destination.service.ts` needs BOTH `ServiceConfig` (constructor) and `ServiceContext` (future method signatures) in imports.
- Biome auto-sorts imports — quotes style may change on commit (single → double), that's expected.
