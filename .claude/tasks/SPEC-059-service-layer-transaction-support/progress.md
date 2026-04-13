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

---

## Completed — Phase 2: Base class ctx threading (T-008 → T-012) ✅

| Task | Description | Commit |
|------|-------------|--------|
| T-008 | `runWithLoggingAndValidation` ctx param + error-rethrow inside tx | 9edbaacf |
| T-009 | 20 lifecycle hooks: `_tx?:DrizzleClient` → `_ctx:ServiceContext` | 9edbaacf |
| T-010 | `BaseCrudRead` 8 methods + `_executeAdminSearch` (applied in Phase 1) | 2076825a |
| T-011 | `BaseCrudWrite` 7 methods + `_getAndValidateEntity` ctx param | dc20cc0f |
| T-012 | `getAdminInfo`/`setAdminInfo` + `_executeSearch`/`_executeCount` abstract decls | 9edbaacf |

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

---

## Completed — Phase 4: ctx.tx propagation (T-024 → T-026) ✅

| Task | Description | Commit |
|------|-------------|--------|
| T-024 | DestinationService update() conditional ctx.tx propagation | a9ff7673 |
| T-025 | AccommodationReviewService stats recalculation pass ctx.tx | 6258ecce |
| T-026 | DestinationReviewService already passing ctx.tx | 4ecf23d6 |

---

## Completed — Testing (T-027 → T-032) ✅

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

## Post-audit fixes

| Fix | Description | Commit |
|-----|-------------|--------|
| Gap 1 | Write methods pass ctx to runWithLoggingAndValidation (6 methods) | dc20cc0f |
| Gap 2 | `_getAndValidateEntity` accepts `_ctx?: ServiceContext` | dc20cc0f |
| Gap 3 | HookState types exported from services barrel | dc20cc0f |
| Gap 4 | `hardDelete()` passes ctx?.tx to model | 307c448b |
