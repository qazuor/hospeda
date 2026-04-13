# SPEC-059 Progress — Service-Layer Transaction Support

**Status**: in-progress | **Progress**: 7/32 tasks (22%)
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

## Remaining phases

### Phase 3: hookState migrations (T-013 → T-023) — depends on T-012
- T-013: 13 stateless services — add `ctx` to `_executeSearch`/`_executeCount`
- T-014: UserService + ExchangeRateService
- T-015: 6 stateful services — signatures only
- T-016–T-023: Replace mutable instance fields with `ctx.hookState` in 6 services

### Phase 4: ctx.tx propagation (T-024–T-026) — NEEDS SPEC-060
- T-024: DestinationService.update() — replace withTransaction with ctx.tx
- T-025: AccommodationReviewService stats — pass ctx.tx to model
- T-026: DestinationReviewService stats — pass ctx.tx to model

### Testing (T-027–T-032) — can start after respective tasks
- T-027: withServiceTransaction tests (unblocked now — T-005/T-006 done)
- T-028: runWithLoggingAndValidation tx error-rethrow (after T-008)
- T-029–T-032: hookState + backward compat tests

---

## Gotchas discovered

- Multi-line constructors: `grep -n 'constructor.*ServiceContext'` does NOT find them. Search for `ctx: ServiceContext` on its own line.
- Pool is created in `apps/api/src/utils/database.ts`, not in `@repo/db` (db receives it via `initializeDb()`).
- `destination.service.ts` needs BOTH `ServiceConfig` (constructor) and `ServiceContext` (future method signatures) in imports.
- Biome auto-sorts imports — quotes style may change on commit (single → double), that's expected.
