# SPEC-060 Gap Remediation — Implementation Plan

> **Source**: `.claude/specs/specs-gaps-060.md` (56 gaps, 5 already fixed, 51 triaged here)
> **Triage date**: 2026-04-10
> **Decision**: All 51 open gaps → HACER
> **Tasks**: See `.claude/tasks/SPEC-060-gaps/state.json`

---

## Triage Summary

All 51 gaps were verified against the current codebase by 3 parallel exploration agents.
**Zero false positives** — every gap is confirmed real.

| Category | Count | Gaps |
|---|---|---|
| Type consistency (NodePgDatabase → DrizzleClient) | 6 | GAP-003, 004, 016, 018, 030, 031 |
| Transaction infrastructure (withTransaction) | 3 | GAP-002, 014, 015 |
| API inconsistency (method signatures) | 3 | GAP-001, 020, 048 |
| Logic bug (CRITICAL) | 1 | GAP-050 |
| Dead code | 1 | GAP-047 |
| Service atomicity (billing) | 6 | GAP-005, 009, 010, 011, 012, 013 |
| Cron concurrency | 3 | GAP-009, 034, 035 |
| Service tx propagation | 3 | GAP-045, 046, 049 |
| BaseCrudService structural | 6 | GAP-039, 040, 041, 042, 043, 044 |
| SPEC-059 scope (API layer) | 3 | GAP-032, 037, 038 |
| Test debt | 12 | GAP-022, 023, 024, 025, 033, 036, 051, 052, 053, 054, 055, 056 |
| Process/tracking | 5 | GAP-008, 021, 026, 027, 028 |

---

## Individual Gap Decisions

| Gap | Description | Decision | Notes |
|---|---|---|---|
| GAP-001 | `findTopRated` tx inside params object | HACER | Mover tx a param posicional + actualizar callers |
| GAP-002 | `withTransaction` swallows all errors | HACER | Fix inline post GAP-015. Re-throw TransactionRollbackError y DbError sin wrappear |
| GAP-003 | `getDb()` returns NodePgDatabase | HACER | Incluye GAP-018, 030, 031. Cambiar 4 tipos en client.ts |
| GAP-004 | `createBillingAdapter()` wrong type | HACER | Cambiar a DrizzleClient. Auto-resuelve GAP-029 |
| GAP-005 | addon-lifecycle-cancellation non-atomic | HACER | Wrappear DB update en withTransaction. QZPay+DB full atomicity → billing reconciliation futura |
| GAP-008 | SPEC-055 status still draft | HACER | Actualizar a completed. Solo proceso |
| GAP-009 | webhook-retry false idempotency | HACER | Agregar pg_try_advisory_lock + corregir docstring |
| GAP-010 | activateAddon non-atomic | HACER | DB en tx + needsEntitlementSync flag para reconciliation |
| GAP-011 | addon-expiration non-atomic | HACER | Crear logica que procese entitlementRemovalPending flag |
| GAP-012 | trial.service 2 active subscriptions | HACER | Multi-subscription detection + auto-cancel |
| GAP-013 | notification-retry TOCTOU | HACER | Atomic SQL increment para retryCount |
| GAP-014 | withTransaction no nested tx | HACER | Agregar existingTx param. Desbloquea SPEC-059 Phase 4 |
| GAP-015 | TransactionRollbackError missing | HACER | Crear clase en error.ts + export. Desbloquea GAP-002 |
| GAP-016 | getBasePlanLimit uses getDb() | HACER | Cambiar a recibir db como param |
| GAP-018 | setDb wrong type | HACER | Incluido en GAP-003 cluster |
| GAP-020 | findPopularTags unusable tx param | HACER | Mover limit a options object |
| GAP-021 | SPEC-060 tasks all pending | HACER | Actualizar 35 tasks a completed |
| GAP-022 | withTransaction zero tests | HACER | Tests para callback, rollback, error handling, nested tx |
| GAP-023 | BaseModelImpl zero tx tests | HACER | describe('tx propagation') con spy en getClient para 13 métodos |
| GAP-024 | 9 models zero tx tests | HACER | Al menos 1 test por método custom |
| GAP-025 | partial tx test coverage (4 models) | HACER | Completar coverage parcial |
| GAP-026 | BaseModel name ambiguity | HACER | Eliminar alias 'as BaseModel'. Usar BaseModelImpl |
| GAP-027 | BaseModel interface not exported | HACER | Agregar a export en index.ts |
| GAP-028 | throwDbError lacks cause | HACER | Agregar cause param. 1 línea |
| GAP-029 | initBillingInstance type mismatch | HACER | Auto-resuelve con GAP-004 |
| GAP-030 | runtimeClient typed as NodePgDatabase | HACER | Parte del cluster GAP-003 |
| GAP-031 | initializeDb returns NodePgDatabase | HACER | Parte del cluster GAP-003 |
| GAP-032 | 11 service files use getDb() directly | HACER | Migrar a tx propagation. Parte de GAP-039 |
| GAP-033 | 13+ model test files unaudited | HACER | Auditar + agregar tx tests a los con custom methods |
| GAP-034 | notification-schedule no advisory lock | HACER | pg_try_advisory_lock. Mismo patrón que GAP-009 |
| GAP-035 | dunning.job no advisory lock | HACER | pg_try_advisory_lock |
| GAP-036 | 31 test files getDb() mock anti-pattern | HACER | Agregar describe('tx propagation') con spy en getClient |
| GAP-037 | Zero withTransaction in API layer | HACER | Parte del trabajo de GAP-039/032 |
| GAP-038 | 18 route handlers use getDb() | HACER | Migrar 18 route handlers |
| GAP-039 | BaseCrudService zero tx infrastructure | HACER | Implementar tx en BaseCrudService + GAP-040-044. Sin SPEC formal separada |
| GAP-040 | DestinationService.update split tx | HACER | Wrappear parent update + descendant cascade en misma tx |
| GAP-041 | AccommodationReviewService hooks | HACER | Hooks participan en tx del parent create/update |
| GAP-042 | DestinationReviewService hooks | HACER | Mismo patrón que GAP-041 |
| GAP-043 | PostSponsorshipService silent swallow | HACER | Hooks con tx + eliminar silent error swallowing |
| GAP-044 | AccommodationService._afterCreate | HACER | Hook participa en tx del parent create |
| GAP-045 | cancelAddonPurchaseRecord no tx | HACER | Agregar tx param + actualizar callers |
| GAP-046 | promo-code.crud.ts no tx params | HACER | Agregar tx param a 6 funciones CRUD |
| GAP-047 | QueryContext dead code | HACER | Eliminar de types.ts + index.ts + actualizar ADR-018 |
| GAP-048 | findWithRelations ignores unknown keys | HACER | logger.warn para keys desconocidas en 15+ overrides |
| GAP-049 | inline count() bypasses Number() | HACER | Agregar Number() en 6 ubicaciones |
| GAP-050 | findAllByAttractionId LOGIC BUG | HACER | Fix inmediato. WHERE incorrecto → JOIN via r_destination_attractions |
| GAP-051 | UserModel zero test file | HACER | Crear user.model.test.ts (findAll, count, findAllWithCounts) |
| GAP-052 | AccommodationModel search zero tests | HACER | Tests para search() y searchWithRelations() |
| GAP-053 | tx test file covers only 1 model | HACER | Agregar DestinationModel al tx test file |
| GAP-054 | No partial-failure tx test | HACER | Test: findMany OK + count() falla → error propagado |
| GAP-055 | 5 billing models zero test files | HACER | Smoke tests para los 5 billing models |
| GAP-056 | Zero service-core billing tests | HACER | Crear packages/service-core/test/billing/ |

---

## Pre-existing Fixes (Before Triage)

These 5 gaps were already resolved during or before the 5-pass audit. Included here for completeness and task tracking.

| Gap | Description | Status | Resolution |
|---|---|---|---|
| GAP-006 | `addon-plan-change.service.ts` non-atomic loop | ✅ FIXED | Advisory lock + dedup guard added |
| GAP-007 | `migrate-addon-purchases.ts` INSERT + grant idempotency bug | ✅ FIXED | Epoch normalization for idempotency (DB atomicity left to GAP-005 pattern) |
| GAP-011 | `addon-expiration.service.ts` missing reconciliation cron | ✅ PARTIAL | Reconciliation cron exists in addon-expiry.job.ts:1064; root non-atomicity remains (tracked as GAP-011 remaining in Phase 5) |
| GAP-017 | Pagination loop bug: `firstPage.hasMore` instead of `page.hasMore` | ✅ FIXED | Proper `hasMore`/`total` tracking with PAGE_SIZE = 100 |
| GAP-019 | `BaseModelImpl.getClient()` lacks JSDoc | ✅ FIXED | JSDoc added at base.model.ts:74-76 |

---

## Implementation Phases

### Dependency Graph

```
Phase 1 (Foundation) ──┬── Phase 2 (Tx Infra) ──── Phase 3 (BaseCrudService) ──── Phase 4 (Service Migration)
                       │                                                                      │
                       └── Phase 6 (Cron Locks) [independent]                                │
                                                                                              ▼
                       Phase 5 (Billing Atomicity) [needs Phase 2] ──────────────── Phase 7 (Tests)
```

---

### Phase 1: Foundation
**Gaps**: 10 | **Complexity**: Low | **Files**: ~10

| Task ID | Gap(s) | File(s) | Description |
|---|---|---|---|
| P1-T01 | GAP-050 | `packages/db/src/models/destination/destination.model.ts` | Fix findAllByAttractionId WHERE + regression test |
| P1-T02 | GAP-015 | `packages/db/src/utils/error.ts` | Create TransactionRollbackError class + export |
| P1-T03 | GAP-003/018/030/031 | `packages/db/src/client.ts` | Unify 4 types to DrizzleClient |
| P1-T04 | GAP-004/029 | `packages/db/src/billing/drizzle-adapter.ts` | Fix createBillingAdapter param type |
| P1-T05 | GAP-028 | `packages/db/src/utils/error.ts` | Add cause param to throwDbError |
| P1-T06 | GAP-047 | `packages/db/src/types.ts` + `index.ts` + ADR-018 | Remove QueryContext dead code |
| P1-T07 | GAP-026 | `packages/db/src/base/base.model.ts` | Remove BaseModel class alias |
| P1-T08 | GAP-027 | `packages/db/src/index.ts` | Export BaseModel interface |
| P1-T09 | GAP-008 | `.claude/specs/SPEC-055-*/spec.md` | Update SPEC-055 status to completed |
| P1-T10 | GAP-021 | `.claude/tasks/SPEC-060-*/state.json` | Update SPEC-060 tasks to completed |

**Verify**: `pnpm --filter @repo/db typecheck && pnpm --filter @repo/db test && pnpm --filter @repo/service-core typecheck && pnpm --filter api typecheck`

---

### Phase 2: Transaction Infrastructure
**Gaps**: 7 | **Complexity**: Medium | **Files**: ~20 | **Depends on**: Phase 1

| Task ID | Gap(s) | File(s) | Description |
|---|---|---|---|
| P2-T01 | GAP-002 | `packages/db/src/client.ts` | Fix withTransaction error handling |
| P2-T02 | GAP-014 | `packages/db/src/client.ts` | Add existingTx param to withTransaction |
| P2-T03 | GAP-001 | `packages/db/src/models/accommodation/accommodation.model.ts` | Move tx from params to positional in findTopRated |
| P2-T04 | GAP-020 | `packages/db/src/models/tag/rEntityTag.model.ts` | Refactor findPopularTags params |
| P2-T05 | GAP-016 | `packages/db/src/billing/migrate-addon-purchases.ts` | Add db param to getBasePlanLimit |
| P2-T06 | GAP-049 | 4 model files | Add Number() coercion to 6 inline counts |
| P2-T07 | GAP-048 | 15+ model files | Add logger.warn for unknown findWithRelations keys |

**Verify**: `pnpm --filter @repo/db typecheck && pnpm --filter @repo/db test && pnpm lint`

---

### Phase 3: BaseCrudService Transaction Infrastructure
**Gaps**: 6 | **Complexity**: HIGH | **Files**: ~14 | **Depends on**: Phase 2 (GAP-014)

| Task ID | Gap(s) | File(s) | Description |
|---|---|---|---|
| P3-T01 | GAP-039 | 8 files in `packages/service-core/src/base/` | Add tx to ALL BaseCrudService write methods + lifecycle hooks |
| P3-T02 | GAP-040 | `packages/service-core/src/services/destination/destination.service.ts` | Wrap update + descendant cascade in single tx |
| P3-T03 | GAP-041 | `packages/service-core/src/services/accommodationReview/` | AccommodationReviewService hooks in tx |
| P3-T04 | GAP-042 | `packages/service-core/src/services/destinationReview/` | DestinationReviewService hooks in tx |
| P3-T05 | GAP-043 | `packages/service-core/src/services/postSponsorship/` | PostSponsorshipService hooks in tx + remove silent swallow |
| P3-T06 | GAP-044 | `packages/service-core/src/services/accommodation/` | AccommodationService._afterCreate in tx |

**Verify**: `pnpm --filter @repo/service-core typecheck && pnpm --filter @repo/service-core test`

---

### Phase 4: Service Layer Migration
**Gaps**: 4 | **Complexity**: Medium-High | **Files**: ~29 | **Depends on**: Phase 3

| Task ID | Gap(s) | File(s) | Description |
|---|---|---|---|
| P4-T01 | GAP-032 | 11 files in `apps/api/src/services/` | Migrate 11 services to accept tx |
| P4-T02 | GAP-037/038 | 18 locations in `apps/api/src/routes/` | Wrap multi-step route handlers in withTransaction |
| P4-T03 | GAP-045 | `packages/service-core/src/services/billing/addon/addon-user-addons.ts` | Add tx to cancelAddonPurchaseRecord |
| P4-T04 | GAP-046 | `packages/service-core/src/services/billing/promo-code/promo-code.crud.ts` | Add tx to 6 CRUD functions |

**Verify**: `pnpm --filter api typecheck && pnpm --filter api test`

---

### Phase 5: Billing Atomicity
**Gaps**: 5 | **Complexity**: High | **Files**: ~5 | **Depends on**: Phase 2

| Task ID | Gap(s) | File(s) | Description |
|---|---|---|---|
| P5-T01 | GAP-005 | `apps/api/src/services/addon-lifecycle-cancellation.service.ts` | Wrap DB update in withTransaction per-purchase |
| P5-T02 | GAP-010 | `apps/api/src/services/addon.admin.ts` | DB in tx + needsEntitlementSync flag |
| P5-T03 | GAP-011 | `apps/api/src/services/addon-expiration.service.ts` | Reconciliation logic for entitlementRemovalPending |
| P5-T04 | GAP-012 | `apps/api/src/services/trial.service.ts` | Multi-subscription detection + auto-cancel |
| P5-T05 | GAP-013 | `apps/api/src/services/notification-retry.service.ts` | Atomic SQL increment for retryCount |

**Verify**: `pnpm --filter api test` + manual review of billing flows

---

### Phase 6: Cron Concurrency
**Gaps**: 3 | **Complexity**: Low | **Files**: 3 | **Depends on**: Phase 1 (independent of 2-5)

| Task ID | Gap(s) | File(s) | Description |
|---|---|---|---|
| P6-T01 | GAP-009 | `apps/api/src/cron/jobs/webhook-retry.job.ts` | Add pg_try_advisory_lock + fix false idempotency docstring |
| P6-T02 | GAP-034 | `apps/api/src/cron/jobs/notification-schedule.job.ts` | Add pg_try_advisory_lock |
| P6-T03 | GAP-035 | `apps/api/src/cron/jobs/dunning.job.ts` | Add pg_try_advisory_lock |

**Verify**: `pnpm --filter api test` + grep all cron jobs have advisory locks

---

### Phase 7: Test Debt
**Gaps**: 12 | **Complexity**: Medium | **Files**: ~35 | **Depends on**: all functional phases

| Task ID | Gap(s) | File(s) | Description |
|---|---|---|---|
| P7-T01 | GAP-022 | New: `packages/db/test/client.withTransaction.test.ts` | withTransaction tests |
| P7-T02 | GAP-023 | `packages/db/test/models/base.model.test.ts` | BaseModelImpl tx propagation tests (13 methods) |
| P7-T03 | GAP-024 | 9 test files in `packages/db/test/models/` | 9 models tx tests for custom methods |
| P7-T04 | GAP-025 | 4 test files | Complete partial tx coverage |
| P7-T05 | GAP-033 | 13 test files | Audit + tx tests for models with custom methods |
| P7-T06 | GAP-036 | 31 test files | Add describe('tx propagation') with getClient spy |
| P7-T07 | GAP-051 | New: `packages/db/test/models/user.model.test.ts` | UserModel test file |
| P7-T08 | GAP-052 | `packages/db/test/models/accommodation.model.test.ts` | search() + searchWithRelations() tests |
| P7-T09 | GAP-053 | `packages/db/test/models/find-all-with-relations-tx.test.ts` | Add DestinationModel coverage |
| P7-T10 | GAP-054 | Same as P7-T09 | Partial-failure test scenario |
| P7-T11 | GAP-055 | 5 new test files | Billing models smoke tests |
| P7-T12 | GAP-056 | New: `packages/service-core/test/billing/` | service-core billing service tests |

**Verify**: `pnpm --filter @repo/db test:coverage && pnpm --filter @repo/service-core test:coverage`

---

## Risk Assessment

| Risk | Phase | Mitigation |
|---|---|---|
| GAP-039 (BaseCrudService) — toca todos los services | 3 | tx es param opcional; código existente compila sin cambios |
| GAP-003 cluster (type unification) | 1 | DrizzleClient es el tipo más amplio; asignación segura |
| GAP-050 (logic bug) — cambia resultados de query en prod | 1 | TDD: escribir test PRIMERO, luego fix |
| GAP-037/038 (18 route migrations) — alto volumen | 4 | Template 1 route, batch el resto. 1 commit por route |
| Phase 7 (31+ test files) — scope masivo | 7 | Paralelizable con múltiples agentes |
