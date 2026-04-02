# SPEC-053 Gaps Analysis: Transaction Support in findAllWithRelations

> **Spec**: SPEC-053-find-all-with-relations-tx
> **Created**: 2026-03-31
> **Last Updated**: 2026-03-31
> **Total Audit Passes**: 4
> **Spec Status at Audit**: `draft` (should be `completed` .. see GAP-053-001)

---

## Audit History

| Pass | Date | Auditors | Gaps Found | New | Updated |
|------|------|----------|------------|-----|---------|
| #1 | 2026-03-31 | Senior Architect + 3 expert sub-agents (DB/Model, Service-layer, Test/QA) | 12 | 12 | 0 |
| #2 | 2026-03-31 | Senior Architect + 4 expert sub-agents (DB/Model reviewer, Service-layer reviewer, QA engineer, TypeScript type-safety engineer) | 22 | 10 | 5 |
| #3 | 2026-03-31 | Senior Architect + 5 expert sub-agents (DB/Model code-reviewer, Service-layer code-reviewer, QA engineer, TypeScript/Node engineer, Cross-cutting tech-lead) | 49 | 27 | 7 |
| #4 | 2026-03-31 | Senior Architect + 5 expert sub-agents (DB/Model code-reviewer, Service-layer code-reviewer, QA engineer, TypeScript type-safety engineer, Cross-cutting tech-lead) | 79 | 30 | 12 |

---

## Executive Summary

SPEC-053 is **fully implemented** in code. All three propagation paths (`getClient`, `count`, `findAll` fallback), the interface update in service-core, and the 4 unit tests described in the spec are present and passing.

Across four audit passes with 17 independent expert analyses, we uncovered **79 gaps** (49 from audits #1-3 + 30 new in audit #4).

**Audit #4 key findings** (30 new gaps, 12 existing gaps deepened):

- **CRITICAL/Architecture**: `db.query.*` relational API may NOT propagate `tx` inside Drizzle transactions .. potentially INVALIDATES the core SPEC-053 implementation (GAP-053-050)
- **CRITICAL/Architecture**: The `tx` parameter added by SPEC-053 is **unusable from production** .. no route/service path can pass it (GAP-053-063)
- **CRITICAL/Architecture**: The "tx as last positional parameter" pattern is unsustainable at scale (GAP-053-060)
- **CRITICAL/Runtime**: `require()` in ESM module .. guaranteed runtime failure on `findPopularTags` (GAP-053-061)
- **CRITICAL/Data**: `updateDescendantPaths` does N+1 UPDATE without transaction .. hierarchy corruption on partial failure (GAP-053-062)
- **CRITICAL/Financial**: Billing promo-code redemption has confirmed TOCTOU between validation and transaction (GAP-053-069)
- **CRITICAL/Data**: `PostService.like/unlike` non-atomic read-modify-write loses increments under concurrency (GAP-053-064)
- **HIGH/Type-safety**: `count()` returns `SQL<number>` but pg driver delivers string at runtime .. `Number()` coercion hides the mismatch (GAP-053-070)
- **HIGH/Type-safety**: `getClient()` return type lies when receiving `NodePgTransaction` .. hides savepoint vs top-level distinction (GAP-053-071)
- **HIGH/Correctness**: `ExchangeRateModel.findLatestRates` uses `desc()` instead of `max()` in subquery .. incorrect exchange rates (GAP-053-076)
- **HIGH/Test**: `afterEach(vi.restoreAllMocks)` missing in test files .. spy leak guaranteed on test failure (GAP-053-073)

**Audit #3 key findings** (preserved from prior audit):

- **CRITICAL/Security**: `updateVisibility` passes phantom `{ id: '' }` entity to permission hooks .. authorization bypass risk (GAP-053-026)
- **CRITICAL/Confirmed**: Services ARE module-level singletons .. confirms GAP-053-013 as guaranteed data corruption, not theoretical (GAP-053-025)
- **CRITICAL**: 5 model subclass `findWithRelations` overrides DROP the `tx` parameter and use bare `getDb()` (GAP-053-023)
- **CRITICAL**: 20+ custom model methods across AccommodationModel and DestinationModel use bare `getDb()` bypassing transactions entirely (GAP-053-024)
- **HIGH/New**: Review uniqueness check is a classic TOCTOU race with no DB constraint (GAP-053-027)
- **HIGH/New**: `_afterHardDelete` in both review services omits stats recalculation (GAP-053-028)
- **HIGH/New**: `runWithLoggingAndValidation` catches ServiceError and returns `{ error }` instead of rethrowing .. prevents transaction rollback (GAP-053-029)
- **HIGH/Type-safety**: 12 occurrences of `this.table as unknown` due to `buildWhereClause` accepting `unknown` (GAP-053-033)
- **HIGH/Type-safety**: `items as T[]` unsafe casts silence type errors in query returns (GAP-053-031)

---

## Implementation Status

| Acceptance Criteria | Status | Evidence |
|---------------------|--------|----------|
| `findAllWithRelations()` accepts optional `tx` | DONE | `base.model.ts:486-492` |
| `this.getClient(tx)` used for main query | DONE | `base.model.ts:493` |
| `this.count()` receives `tx` via `options.tx` | DONE | `base.model.ts:613` |
| `this.findAll()` receives `tx` in fallback path | DONE | `base.model.ts:526-527` |
| `BaseModel<T>` interface updated with `tx` | DONE | `service-core/types/index.ts:191-197` |
| Existing callers work without changes | DONE | 6 callers verified (audit #2), none pass `tx` |
| Unit tests cover all 3 propagation paths + regression | DONE (quality issues) | `find-all-with-relations-tx.test.ts` (4 tests pass) |
| `pnpm typecheck` passes | VERIFIED | Passes across all packages |
| `pnpm lint` passes | VERIFIED | Passes |
| `pnpm test` passes | PARTIAL | tx tests pass, but global coverage threshold fails |

---

## Gaps Found

---

### GAP-053-001: Spec Status is Stale (draft, should be completed)

- **Found in Audit**: #1
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Process/Documentation
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: The spec status is `draft` but all code, interface updates, and tests are implemented and passing. Should be `completed`.

**Recommendation**: Fix directly .. update spec.md status.

---

### GAP-053-002: `SupportsRelations<T>` Interface is Dead Code with Wrong Signature

- **Found in Audit**: #1 | **Deepened in**: #2, #3
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Type Safety / Dead Code
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: `packages/schemas/src/common/relations.schema.ts:25-31` defines `SupportsRelations<T>` with parameter order `(where, options, relations)` but implementation is `(relations, where, options, ...)`. Exhaustive grep confirms zero imports, zero usages.

**Recommendation**: Fix directly .. delete the dead interface.

---

### GAP-053-003: 9 of 11 `BaseModel<T>` Interface Methods Missing `tx` Parameter

- **Found in Audit**: #1 | **Deepened in**: #2, #3
- **Severity**: High
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Type Safety / Interface Contract
- **Decision**: 📋 NUEVA SPEC (SPEC-058 "Align BaseModel Interface")
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-004, GAP-018, GAP-019, GAP-071, GAP-072

**Description**: Only `findAllWithRelations` (SPEC-053) and `getTable` have correct signatures. The remaining 9 methods (`findById`, `findOne`, `create`, `update`, `softDelete`, `restore`, `hardDelete`, `count`, `findAll`) have `tx` in implementation but NOT in the interface.

**Audit #3 addition**: TypeScript expert confirmed this directly blocks service-layer transaction support. Any code typed as `BaseModel<T>` cannot pass `tx` to 9 of 11 methods.

**Recommendation**: **Needs formal SPEC** (e.g., SPEC-058 "Align BaseModel Interface").

---

### GAP-053-004: 3 Implementation Methods Missing from `BaseModel<T>` Interface

- **Found in Audit**: #1 | **Confirmed in**: #2, #3
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Interface Completeness
- **Decision**: ✅ HACER (bundleado en SPEC-058 con GAP-003)
- **Decision Date**: 2026-03-31

**Description**: `findWithRelations`, `updateById`, and `raw` exist in implementation but not in interface.

**Recommendation**: Bundle with GAP-053-003 SPEC.

---

### GAP-053-005: Tests Prove Routing Only, Not Behavior

- **Found in Audit**: #1 | **Deepened in**: #2, #3
- **Severity**: High
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Test Quality
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-016, GAP-017, GAP-073, GAP-074

**Description**: The 4 tests only verify mock routing. QA expert (audit #3) confirmed ALL tests could pass even if `tx` were completely ignored after `getClient`.

**Audit #3 additions**:

1. `mockTx = {}` is empty object .. no methods, no `query` property. Tests work only because `getClient` is spied to return a different mock
2. Regression test (test 1) doesn't assert `getDb` was called or `getClient` received `undefined`
3. Tests 2-4 don't check `result.items` or `result.total`
4. No `afterEach(() => vi.restoreAllMocks())` .. if a test throws, spies leak

**Recommendation**: Fix directly .. critical test quality improvement.

---

### GAP-053-006: No Error Path Testing Within Transaction Context

- **Found in Audit**: #1 | **Deepened in**: #2
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Test Coverage
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-075

**Description**: No test verifies error behavior when queries fail inside a transaction. Existing error tests assert `.toThrow(Error)` but never `.toThrow(DbError)`.

**Recommendation**: Fix directly.

---

### GAP-053-007: No Tests for Parameter Combinations with `tx`

- **Found in Audit**: #1 | **Deepened in**: #2, #3
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Low
- **Category**: Test Coverage
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-021, GAP-045

**Description**: No tests combine `tx` with `additionalConditions`, non-empty `where`, pagination, sorting, or nested relations.

**Audit #3 addition**: QA expert confirmed nested relations branch (`transformRelationsForDrizzle` lines 583-584) has 0% coverage across the entire test suite.

**Recommendation**: Fix directly.

---

### GAP-053-008: Global Test Coverage Threshold Failure

- **Found in Audit**: #1 | **Deepened in**: #3
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: High
- **Category**: Test Infrastructure
- **Decision**: ✅ HACER (ya trackeado en SPEC-040, no duplicar)
- **Decision Date**: 2026-03-31

**Description**: `@repo/db` functions coverage at 42.23% vs required 70%. Pre-existing, not caused by SPEC-053.

**Audit #3 addition**: QA expert noted project standard in CLAUDE.md requires 90% but `vitest.config.ts` thresholds are set at 70%/60%. Even the relaxed thresholds are failing.

**Recommendation**: Pre-existing. Tracked under SPEC-040.

---

### GAP-053-009: Inconsistent `tx` Type in Billing Services

- **Found in Audit**: #1 | **Deepened in**: #2, #3
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Low
- **Category**: Type Safety
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: Two files use `NodePgDatabase<Record<string, unknown>>` instead of `NodePgDatabase<typeof schema>`.

**Recommendation**: Fix directly.

---

### GAP-053-010: Zero Service-Layer Transaction Support (Systemic Gap)

- **Found in Audit**: #1 | **Significantly deepened in**: #2, #3
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: High
- **Category**: Architecture / Data Integrity
- **Decision**: 📋 NUEVA SPEC (SPEC-059 "Service-Layer Transaction Support & Concurrency Safety")
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-014, GAP-029, GAP-034, GAP-055, GAP-057, GAP-058, GAP-064, GAP-065
- **Dependencies**: SPEC-058 (interface alignment), SPEC-063 (tx architecture ADR)

**Description**: No service method in `BaseCrudService` accepts or propagates `tx`.

**Audit #3 additions** (service-layer expert):

| # | Pattern | Location | Severity |
|---|---------|----------|----------|
| 1 | `PostService.like()/unlike()` read-modify-write | `post.service.ts:788-822` | CRITICAL |
| 2 | `DestinationService._beforeUpdate()` multi-write without tx | `destination.service.ts:519-616` | CRITICAL |
| 3 | `AccommodationReviewService._afterCreate/Update` multi-write | `accommodationReview.service.ts:249-282` | HIGH |
| 4 | `DestinationReviewService._afterCreate/Update` multi-write | `destinationReview.service.ts:194-215` | HIGH |
| 5 | `FeatureService.addFeatureToAccommodation()` TOCTOU | `feature.service.ts:272-289` | HIGH |
| 6 | `AmenityService.addAmenityToAccommodation()` TOCTOU | `amenity.service.ts:362-382` | HIGH |
| 7 | `TagService.addTagToEntity()` TOCTOU | `tag.service.ts:322-338` | HIGH |
| 8 | `DestinationService.updateAccommodationsCount()` count-then-write | `destination.service.ts:773-777` | MODERATE |
| NEW | `update()` base method: fetch then update without tx | `base.crud.write.ts:120-188` | HIGH |
| NEW | `softDelete`/`hardDelete`: check-then-delete not atomic | `base.crud.write.ts:211-264` | HIGH |
| NEW | Stats recalculation ABA problem in both review services | Both review services | HIGH |

**Recommendation**: **Needs formal SPEC** (P1).

---

### GAP-053-011: `findAllWithRelations` Parallel findMany/count Snapshot Gap

- **Found in Audit**: #1
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Medium
- **Category**: Data Consistency
- **Decision**: ✅ HACER (documentar como comportamiento conocido)
- **Decision Date**: 2026-03-31

**Description**: `Promise.all` with `findMany` and `count` can see different committed data under `READ COMMITTED`.

**Recommendation**: Document as known behavior.

---

### GAP-053-012: No Integration Tests for Transaction Behavior

- **Found in Audit**: #1 | **Confirmed in**: #2, #3
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: High
- **Category**: Test Infrastructure
- **Decision**: 📋 NUEVA SPEC (SPEC-061 "DB Integration Testing + tx.query.* Verification")
- **Decision Date**: 2026-03-31

**Description**: All 38 test files in `packages/db/test/` are unit tests with mocked DB. Zero integration tests exist.

**Recommendation**: **Needs formal SPEC** for DB integration testing infrastructure.

---

### GAP-053-013: Instance-Level Mutable State Broken Under Concurrency

- **Found in Audit**: #2 | **CONFIRMED AND UPGRADED in**: #3
- **Severity**: ~~Critical~~ Medium (adjusted: async interleaving, not thread-safety)
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Concurrency / Data Integrity
- **Decision**: 📋 BUNDLEAR EN SPEC-059 (Service-Layer Transaction Support)
- **Decision Date**: 2026-03-31
- **Decision Notes**: Context object per-call que incluya tanto `tx` como estado de hooks. Se hace junto con SPEC-059 para no modificar firmas de hooks dos veces.
- **Bundled gaps**: GAP-025

**Description**: Multiple services store state in private instance fields between `_beforeXxx` and `_afterXxx` hooks.

**Audit #3 CRITICAL confirmation**: Service-layer expert confirmed services ARE module-level singletons (instantiated at module scope in route files, shared across all concurrent requests). This is NOT theoretical .. it is **guaranteed data corruption** under concurrent load.

Full inventory of affected services (6 services, 12+ fields):

| Service | Fields | Risk |
|---------|--------|------|
| `AccommodationService` | `_lastDeletedEntity`, `_lastRestoredAccommodation` | Wrong entity revalidated |
| `AccommodationReviewService` | `_lastDeletedAccommodationId`, `_lastRestoredAccommodationId` | Wrong accommodation stats corrupted |
| `DestinationReviewService` | `_lastDeletedDestinationId`, `_lastRestoredDestinationIdForReview` | Wrong destination stats |
| `DestinationService` | `_lastDeletedDestinationSlug`, `_lastRestoredDestinationSlug`, `_updateId` | Wrong slug revalidated, wrong entity updated |
| `EventService` | `_lastRestoredEvent`, `_lastDeletedEvent` | Wrong event revalidated |
| `PostService` | `_lastRestoredPost`, `_lastDeletedPost`, `_updateId` | Wrong entity, wrong revalidation |

**Evidence of singleton instantiation** (from route files):

```typescript
// apps/api/src/routes/destination/admin/update.ts:18 — MODULE SCOPE
const destinationService = new DestinationService({ logger: apiLogger });
// This single instance handles ALL concurrent requests
```

**Recommendation**: **Needs formal SPEC** (P1). Two approaches: (1) per-call context object passed through hooks, or (2) per-request service instantiation.

---

### GAP-053-014: `DestinationService._beforeUpdate` Performs DB Writes (Lifecycle Contract Violation)

- **Found in Audit**: #2 | **Confirmed in**: #3
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Medium
- **Category**: Architecture / Lifecycle
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-03-31

**Description**: `_beforeUpdate` calls `updateDescendantPaths` which is a bulk DB write. If the subsequent `model.update()` fails, descendants are corrupted with no rollback.

**Recommendation**: Bundle with GAP-053-010 service-layer transaction SPEC.

---

### GAP-053-015: `updateAccommodationsCount` Fetches All Records Just to Count

- **Found in Audit**: #2 | **Deepened in**: #3
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Low
- **Category**: Performance
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: Fetches full accommodation records then uses `items.length`.

**Audit #3**: Service expert confirmed this is also a read-count-write race under concurrent load (two requests read same count, both write the same incremented value).

**Recommendation**: Fix directly .. use `count()` or atomic SQL subquery.

---

### GAP-053-016: Tests Don't Verify `getDb` is NOT Called When `tx` is Provided

- **Found in Audit**: #2 | **Confirmed in**: #3
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Test Quality
- **Decision**: ✅ HACER (bundleado con GAP-005)
- **Decision Date**: 2026-03-31

**Description**: The most critical assertion (`expect(getDb).not.toHaveBeenCalled()`) is missing from all tx tests.

**Recommendation**: Fix directly .. one line per test.

---

### GAP-053-017: Test Imports `schema` from Wrong Source

- **Found in Audit**: #2 | **UPGRADED in**: #3
- **Severity**: High (upgraded from Medium)
- **Priority**: P2 (upgraded from P3)
- **Complexity**: Low
- **Category**: Type Safety / Test Quality
- **Decision**: ✅ HACER (bundleado con GAP-005)
- **Decision Date**: 2026-03-31

**Description**: Test imports `schema` from `../../src/schemas` but `src/schemas/index.ts` does NOT export a `schema` const. The real `schema` (combined `hospedaSchema + qzpaySchema`) is in `client.ts`. TypeScript type expert confirmed `typeof schema` in the test references a different type than production code.

**Recommendation**: Fix directly .. change import to `../../src/client`.

---

### GAP-053-018: `withTransaction` Types `tx` as `NodePgDatabase` Instead of `NodePgTransaction`

- **Found in Audit**: #2 | **UPGRADED in**: #3
- **Severity**: High (upgraded from Low)
- **Priority**: P3 (upgraded from P4)
- **Complexity**: Medium
- **Category**: Type Precision
- **Decision**: ✅ HACER (bundleado en SPEC-058 con GAP-003)
- **Decision Date**: 2026-03-31

**Description**: Drizzle's `db.transaction()` callback receives `NodePgTransaction`, not `NodePgDatabase`. By typing as `NodePgDatabase`, the `rollback()` method is hidden and nested transaction behavior differs.

**Audit #3 additions**: TypeScript expert confirmed:

1. `getClient()` return type is also a lie when `tx` is provided .. it declares `NodePgDatabase` but returns `NodePgTransaction`
2. `NodePgTransaction` has different `entityKind` at runtime
3. Nested `db.transaction()` inside a tx creates savepoints (different from top-level transactions) but TypeScript thinks it's starting a new transaction

**Recommendation**: Define a `DrizzleClient` union type or use `NodePgTransaction` properly. Bundle with GAP-053-003 interface alignment.

---

### GAP-053-019: No `implements BaseModel<T>` Clause

- **Found in Audit**: #2
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Type Safety / Architecture
- **Decision**: ✅ HACER (bundleado en SPEC-058 con GAP-003)
- **Decision Date**: 2026-03-31

**Description**: Class doesn't declare `implements BaseModel<T>`, so contract conformity is only structural.

**Recommendation**: Bundle with GAP-053-003.

---

### GAP-053-020: `logError` AND `logQuery` in `findAllWithRelations` Lack Defensive Try-Catch

- **Found in Audit**: #2 | **EXPANDED in**: #3
- **Severity**: Medium (upgraded from Low)
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-030
- **Priority**: P3 (upgraded from P4)
- **Complexity**: Trivial
- **Category**: Error Handling / Consistency

**Description**: Both `logError` (catch block) AND `logQuery` (success path) in `findAllWithRelations` are NOT wrapped in try-catch. Every other method in BaseModel wraps both.

**Audit #3 addition**: DB expert confirmed the SUCCESS path `logQuery` (lines 618-627) is the more dangerous omission .. a successful DB query that triggers a logger error would throw instead of returning the result.

**Recommendation**: Fix directly .. wrap both in try-catch.

---

### GAP-053-021: `sortBy`/`sortOrder` Path Has 0% Coverage

- **Found in Audit**: #2 | **Confirmed in**: #3
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Test Coverage
- **Decision**: ✅ HACER (bundleado con GAP-007)
- **Decision Date**: 2026-03-31

**Description**: Lines 595-599 of `base.model.ts` (sorting logic in `findAllWithRelations`) have 0% test coverage.

**Recommendation**: Fix directly.

---

### GAP-053-022: `db.query` Cast to `Record<string, unknown>` Loses Type Safety

- **Found in Audit**: #2 | **Deepened in**: #3
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Medium
- **Category**: Type Safety
- **Decision**: ✅ HACER (documentar como limitación conocida)
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-031

**Description**: `db.query as Record<string, unknown>` then re-cast to `QueryableTable` is a double-cast that eliminates Drizzle type inference.

**Audit #3 addition**: TypeScript expert identified `items as T[]` casts at lines 124, 616 as the same pattern .. all query results are unsafely cast to `T[]` without type guards.

**Recommendation**: Document as known limitation. Long-term: make BaseModel generic over table type.

---

### GAP-053-023: Model Subclass `findWithRelations` Overrides Drop `tx` Parameter

- **Found in Audit**: #3 (NEW)
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: Medium
- **Category**: Transaction Isolation / Concurrency
- **Decision**: 📋 NUEVA SPEC (SPEC-060 "Model Subclass Transaction Propagation")
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-024, GAP-032, GAP-067, GAP-068

**Description**: The base class `findWithRelations` accepts `tx?`, but ALL 5 subclass overrides drop it AND use `getDb()` directly instead of `this.getClient(tx)`:

| Model | File |
|-------|------|
| `AccommodationModel` | `accommodation.model.ts:32-60` |
| `DestinationModel` | `destination.model.ts:39-79` |
| `EventModel` | `event.model.ts:22-60` |
| `SponsorshipModel` | `sponsorship.model.ts:146-186` |
| `PostSponsorshipModel` | `postSponsorship.model.ts:22-53` |

Any caller inside a transaction that calls `findWithRelations` on a subclass will silently escape the transaction and read from the main connection, violating ACID guarantees.

**Proposed Solution**: Each override must accept `tx?` and use `this.getClient(tx)`.

**Recommendation**: Fix directly if straightforward, or bundle with GAP-053-003 interface alignment SPEC.

---

### GAP-053-024: 20+ Custom Model Methods Use Bare `getDb()` Bypassing Transactions

- **Found in Audit**: #3 (NEW)
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: High
- **Category**: Transaction Isolation
- **Decision**: ✅ HACER (bundleado en SPEC-060 con GAP-023)
- **Decision Date**: 2026-03-31

**Description**: Multiple model subclasses have custom query methods that call `getDb()` directly with no `tx` parameter:

**AccommodationModel** (4 methods):

- `countByFilters()`, `search()`, `searchWithRelations()`, `findTopRated()`

**DestinationModel** (9 methods):

- `findAllByAttractionId()`, `searchWithAttractions()`, `search()`, `findChildren()`, `findDescendants()`, `findAncestors()`, `findByPath()`, `updateDescendantPaths()`, `countByFilters()`

**SponsorshipModel**:

- `findActiveByTarget()` (also loads all records for counting instead of using COUNT)

**AccommodationModel**:

- `updateStats()` (write method that cannot participate in transactions)

The most dangerous is `DestinationModel.updateDescendantPaths()` which performs multi-row writes in a loop .. inherently non-atomic without tx support.

**Proposed Solution**: Add `tx?: NodePgDatabase<typeof schema>` to all methods and replace `getDb()` with `this.getClient(tx)`.

**Recommendation**: **Needs formal SPEC** or bundle with GAP-053-003/010. High effort (20+ method signatures).

---

### GAP-053-025: Services Confirmed as Module-Level Singletons

- **Found in Audit**: #3 (NEW .. answers Open Question #1 from Audit #2)
- **Severity**: ~~Critical~~ Medium (adjusted with GAP-013)
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Concurrency / Architecture
- **Decision**: ✅ HACER (bundleado con GAP-013 en SPEC-059)
- **Decision Date**: 2026-03-31

**Description**: Service-layer expert confirmed that EVERY route file in `apps/api/src/routes/` instantiates services at **module scope**, creating singletons shared across all concurrent requests:

```typescript
// apps/api/src/routes/destination/admin/update.ts:18 — MODULE SCOPE
const destinationService = new DestinationService({ logger: apiLogger });
```

This pattern is repeated across 50+ route files for AccommodationService, EventService, PostService, UserService, SponsorshipService, FeatureService, and more.

**Impact**: This confirms GAP-053-013 is **guaranteed data corruption**, not theoretical. Two concurrent `PUT /admin/destinations/:id` requests will overwrite each other's `_updateId`.

**Proposed Solution**: Move service instantiation inside request handlers (per-request), or adopt a factory pattern.

**Recommendation**: **Needs formal SPEC** (P1). Bundle with GAP-053-013 and GAP-053-010.

---

### GAP-053-026: `updateVisibility` Passes Phantom `{ id: '' }` Entity to Permission Hooks

- **Found in Audit**: #3 (NEW)
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: Low
- **Category**: Security / Authorization Bypass
- **Decision**: ✅ HACER (URGENTE, fix de seguridad)
- **Decision Date**: 2026-03-31

**Description**: `base.crud.write.ts:371-376` fetches the real entity for existence validation but passes a synthetic `{ id: '' } as TEntity` to both `_canUpdateVisibility` and `_beforeUpdateVisibility`:

```typescript
await this._canUpdateVisibility(
    validActor,
    { id: '' } as TEntity,  // PHANTOM entity, not the real one
    validData.visibility
);
```

Any service overriding `_canUpdateVisibility` to check ownership (e.g., `entity.ownerId === actor.id`) will always receive `{ id: '' }` and make its access decision on wrong data.

**Proposed Solution**: Pass the real `entity` (already fetched) to both hooks.

**Recommendation**: Fix directly .. URGENT security fix, trivial change.

---

### GAP-053-027: Review Uniqueness Check is TOCTOU Race (No DB Constraint)

- **Found in Audit**: #3 (NEW)
- **Severity**: ~~Critical~~ Low (FALSO POSITIVO - DB constraint EXISTS)
- **Priority**: P4
- **Complexity**: Low
- **Category**: Data Integrity
- **Decision**: ✅ HACER (mejorar error handling del constraint violation, no es urgente)
- **Decision Date**: 2026-03-31
- **Verification**: FALSE POSITIVE confirmed. `uniqueIndex('accommodation_reviews_user_accommodation_uniq').on(table.userId, table.accommodationId)` exists in schema. DB constraint closes the TOCTOU gap. App check is redundant but harmless.

**Description**: `AccommodationReviewService._beforeCreate` enforces one-review-per-user with a non-atomic check-then-act:

```typescript
const existing = await this.model.findOne({   // READ
    userId: data.userId, accommodationId: data.accommodationId, deletedAt: null
});
if (existing) throw new ServiceError(ALREADY_EXISTS);
return data;  // Falls through to INSERT .. another request can slip through
```

Two concurrent requests from the same user both pass the check before either commits. No `UNIQUE(user_id, accommodation_id) WHERE deleted_at IS NULL` database constraint exists.

Same pattern in `DestinationReviewService`.

**Proposed Solution**: Add partial unique index: `UNIQUE (user_id, accommodation_id) WHERE deleted_at IS NULL`. Application check stays as fast early-exit.

**Recommendation**: Fix directly .. database migration + constraint.

---

### GAP-053-028: `_afterHardDelete` Omits Stats Recalculation in Review Services

- **Found in Audit**: #3 (NEW)
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Data Integrity
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: `_afterSoftDelete` correctly recalculates stats, but `_afterHardDelete` does NOT call `recalculateAndUpdateDestinationStats` or `recalculateAndUpdateAccommodationStats` in either review service. After hard-deleting a review, the parent entity's `reviewsCount` and `averageRating` are permanently stale.

**Proposed Solution**: Add `recalculateStats` call to `_afterHardDelete` in both services.

**Recommendation**: Fix directly.

---

### GAP-053-029: `runWithLoggingAndValidation` Swallows Errors Preventing Transaction Rollback

- **Found in Audit**: #3 (NEW)
- **Severity**: ~~High~~ Medium (adjusted: no service currently wrapped in external tx)
- **Priority**: P3
- **Complexity**: Medium
- **Category**: Architecture / Data Integrity
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-03-31

**Description**: `base.service.ts:103-121` catches `ServiceError` and returns `{ error }` instead of rethrowing. If a service method runs inside a `withTransaction` wrapper and throws `ServiceError`, the transaction is NOT rolled back because the error never propagates. The transaction commits with partial writes.

```typescript
} catch (error) {
    if (error instanceof ServiceError) {
        return { error };  // Swallowed .. tx will NOT rollback
    }
}
```

**Proposed Solution**: When a `tx` context is active, rethrow the error instead of returning it. Or redesign so transaction-aware callers use a variant that propagates exceptions.

**Recommendation**: Bundle with GAP-053-010 service-layer transaction SPEC.

---

### GAP-053-030: `logQuery` Success Path in `findAllWithRelations` NOT Wrapped in Try-Catch

- **Found in Audit**: #3 (NEW .. extends GAP-053-020)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Error Handling / Consistency
- **Decision**: ✅ HACER (bundleado con GAP-020)
- **Decision Date**: 2026-03-31

**Description**: Every other BaseModel method wraps `logQuery` in a silent try-catch:

```typescript
try { logQuery(...); } catch {}
return result;
```

But `findAllWithRelations` calls `logQuery` bare on the success path (lines 618-627). If `logQuery` throws (e.g., circular reference serialization), a successful DB query causes an application error.

**Recommendation**: Fix directly .. bundle with GAP-053-020.

---

### GAP-053-031: `items as T[]` Unsafe Casts Across BaseModel

- **Found in Audit**: #3 (NEW)
- **Severity**: High
- **Priority**: P3
- **Complexity**: Medium
- **Category**: Type Safety
- **Decision**: ✅ HACER (bundleado con GAP-022, documentar como limitación conocida)
- **Decision Date**: 2026-03-31

**Description**: In `findAll` (line 124), `findAllWithRelations` (line 616), `findById` (line 152), `findOne` (line 180), and `create` (line 202), query results are unsafely cast with `as T` or `as T[]`. No type guard verifies the cast is correct. If `tableName` is wrong or the schema changes, TypeScript won't catch the mismatch.

**Proposed Solution**: Long-term: make BaseModel generic over table type for correct inference. Short-term: add `!= null` checks before casts.

**Recommendation**: Document as known limitation. Address in BaseModel generics refactor.

---

### GAP-053-032: `findWithRelations` Overrides Narrow `relations` Type (LSP Violation)

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Type Safety / LSP
- **Decision**: ✅ HACER (bundleado en SPEC-060 con GAP-023)
- **Decision Date**: 2026-03-31

**Description**: Base class has `relations: Record<string, boolean | Record<string, unknown>>` but all 5 subclass overrides use `relations: Record<string, boolean>`. This narrows what the method accepts, breaking Liskov Substitution Principle.

**Proposed Solution**: All overrides must match the base class parameter type.

**Recommendation**: Fix directly .. bundle with GAP-053-023.

---

### GAP-053-033: `this.table as unknown` .. 12 Unnecessary Casts Due to `buildWhereClause` Accepting `unknown`

- **Found in Audit**: #3 (NEW)
- **Severity**: High
- **Priority**: P3
- **Complexity**: Low
- **Category**: Type Safety
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: `buildWhereClause` and `buildOrderByClause` in `drizzle-helpers.ts` declare `table: unknown`. This forces 12 occurrences of `this.table as unknown` across `base.model.ts`. The `this.table` property is typed as `Table` from `drizzle-orm`, which is perfectly valid. The cast to `unknown` eliminates ALL type safety.

**Proposed Solution**: Change helper signatures to accept `Table` from `drizzle-orm`. Remove all 12 casts.

**Recommendation**: Fix directly .. trivial signature change.

---

### GAP-053-034: `softDelete`/`hardDelete` Check-Then-Delete Not Atomic

- **Found in Audit**: #3 (NEW)
- **Severity**: High
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Concurrency / Data Integrity
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-03-31

**Description**: Both methods read entity (check `deletedAt`), then delete. Two concurrent soft-deletes of the same entity both pass the check, both call `model.softDelete`, and both `_afterSoftDelete` hooks run .. potentially running `updateAccommodationsCount` twice.

**Proposed Solution**: Use optimistic locking (`WHERE deleted_at IS NULL` in the statement) or wrap in transaction.

**Recommendation**: Bundle with GAP-053-010 service-layer transaction SPEC.

---

### GAP-053-035: `count()` with `tx` Has Zero Test Coverage in Isolation

- **Found in Audit**: #3 (NEW)
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Test Coverage
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-036

**Description**: SPEC-053 depends on `count()` honoring its `options.tx`, but no test in the entire codebase calls `count()` with `tx` and verifies `getDb` is not called. Test 3 in the tx test file mocks `count` entirely, bypassing the real implementation.

**Proposed Solution**: Add dedicated `count()` with tx test to `base.model.test.ts`.

**Recommendation**: Fix directly.

---

### GAP-053-036: `findAll()` with `tx` Has Zero Test Coverage

- **Found in Audit**: #3 (NEW)
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Test Coverage
- **Decision**: ✅ HACER (bundleado con GAP-035)
- **Decision Date**: 2026-03-31

**Description**: `findAll()` accepts `tx` as 4th parameter and SPEC-053's no-relations fallback delegates to it. Despite 12 tests for `findAll` in `base.model.test.ts`, not one passes a transaction.

**Proposed Solution**: Add `findAll` with tx test to `base.model.test.ts`.

**Recommendation**: Fix directly.

---

### GAP-053-037: No ADR Documenting Transaction Propagation Convention

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Documentation
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: 13+ BaseModel methods follow the `tx?: NodePgDatabase<typeof schema>` convention. None of the 17 ADRs document this pattern. Future developers don't know: (1) `tx` can be passed, (2) how to thread it through services, (3) why `NodePgTransaction` is typed as `NodePgDatabase`.

**Proposed Solution**: Create `ADR-018-transaction-propagation-pattern.md`.

**Recommendation**: Fix directly.

---

### GAP-053-038: No Transaction Context in Log Entries (Observability)

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Observability
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-070

**Description**: `logQuery` and `logError` include no indicator of whether a query ran inside a transaction. If a transaction rolls back, logs show successful executions with no rollback marker. Debugging production incidents with transaction failures is nearly impossible.

**Proposed Solution**: Add `inTransaction: !!tx` to log context in `findAllWithRelations` (and eventually all methods).

**Recommendation**: Fix directly.

---

### GAP-053-039: `PaginatedListOutput<T>` Duplicated in Two Packages

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Single Source of Truth Violation
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: `PaginatedListOutput<T>` = `{ items: T[]; total: number }` is defined identically in:

- `packages/service-core/src/types/index.ts:159-162`
- `packages/schemas/src/common/relations.schema.ts:36-39`

If one changes, divergence is silent.

**Proposed Solution**: Define only in `@repo/schemas`, re-export from `service-core`.

**Recommendation**: Fix directly.

---

### GAP-053-040: `PaginatedListOptions.relations` Field Silently Ignored in `findAllWithRelations`

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P4
- **Complexity**: Low
- **Category**: Type Mismatch / Misleading API
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: `PaginatedListOptions` includes `relations?: ListRelationsConfig`, but `findAllWithRelations` receives `relations` as a separate first parameter. Passing `{ relations: ... }` inside `options` is silently ignored.

**Proposed Solution**: Use `Omit<PaginatedListOptions, 'relations'>` for the `options` parameter in `findAllWithRelations`.

**Recommendation**: Fix directly.

---

### GAP-053-041: `withTransaction` JSDoc Example Has Wrong Argument Order

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Documentation
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: `client.ts:100-106` example shows `userModel.create(tx, userData)` but actual signature is `create(data, tx?)` .. arguments reversed.

**Proposed Solution**: Fix the JSDoc example.

**Recommendation**: Fix directly.

---

### GAP-053-042: `create()` Error Handler Uses `error as Error` (Inconsistent)

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Error Handling / Consistency
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: `create()` is the ONLY BaseModel method that uses `error as Error` directly in the catch block instead of the defensive `error instanceof Error ? error : new Error(String(error))` pattern used by all other methods.

**Proposed Solution**: Apply the same defensive pattern.

**Recommendation**: Fix directly.

---

### GAP-053-043: Test File Naming Convention Mismatch

- **Found in Audit**: #3 (NEW)
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Test Infrastructure
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-044

**Description**: `find-all-with-relations-tx.test.ts` uses method-level naming. All other test files use `entity-name.model.test.ts` or `entity-name.feature.test.ts`. These 4 tests should be merged into `base.model.test.ts`.

**Recommendation**: Fix directly .. merge tests into existing file.

---

### GAP-053-044: Commented-Out Pagination Test is a Deferred Bug

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Medium
- **Category**: Test Quality
- **Decision**: ✅ HACER (bundleado con GAP-043)
- **Decision Date**: 2026-03-31

**Description**: `base.model.test.ts:386-424` contains a large commented-out pagination test with a TODO UUID. Pagination logic in `findAllWithRelations` follows the same pattern and is also not tested.

**Recommendation**: Fix directly .. investigate and fix the commented test.

---

### GAP-053-045: `MAX_PAGE_SIZE` Cap Never Tested in `findAllWithRelations`

- **Found in Audit**: #3 (NEW)
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Test Coverage
- **Decision**: ✅ HACER (bundleado con GAP-007)
- **Decision Date**: 2026-03-31

**Description**: `base.model.ts:497-498` caps `pageSize` at 100. No test verifies passing `pageSize: 9999` results in `limit: 100`. This defensive security boundary could be removed without test failure.

**Recommendation**: Fix directly.

---

### GAP-053-046: `safeWhere = where ?? {}` Redundant with Default Parameter

- **Found in Audit**: #3 (NEW)
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Code Quality
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: `where` already has default value `= {}` in the parameter list. The `?? {}` is dead code.

**Recommendation**: Fix directly .. remove `?? {}`.

---

### GAP-053-047: `transformRelationsForDrizzle` Redefined on Every Call

- **Found in Audit**: #3 (NEW)
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Performance / Code Quality
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31

**Description**: Pure function with no closure dependencies declared inside `findAllWithRelations` body. Re-allocated on every call. Should be at module scope.

**Recommendation**: Fix directly.

---

### GAP-053-048: CLAUDE.md Transaction Example Uses Direct Table Access Anti-Pattern

- **Found in Audit**: #3 (NEW)
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Documentation
- **Decision**: ✅ HACER
- **Decision Date**: 2026-03-31
- **Bundled gaps**: GAP-049

**Description**: `packages/db/CLAUDE.md` shows `trx.insert(accommodationTable)` directly instead of `accommodationModel.create(data, tx)`. Contradicts the project convention of always using models.

**Recommendation**: Fix directly .. update example.

---

### GAP-053-049: `UserModel.count()` Uses `||` Instead of `?? 0`

- **Found in Audit**: #3 (NEW)
- **Severity**: Low
- **Priority**: P4
- **Complexity**: Trivial
- **Category**: Correctness
- **Decision**: ✅ HACER (bundleado con GAP-048)
- **Decision Date**: 2026-03-31

**Description**: `user.model.ts:146` uses `result[0]?.count || 0`. If `count` is `0` (valid) and typed as number, `||` treats it as falsy. Base class uses `?? 0` consistently.

**Recommendation**: Fix directly.

---

### GAP-053-050: `db.query.*` Relational API May Not Propagate Transaction Context in Drizzle

- **Found in Audit**: #4
- **Severity**: ~~Critical~~ N/A (FALSE POSITIVE)
- **Priority**: N/A
- **Complexity**: N/A
- **Category**: Architecture / Transaction Correctness
- **Decision**: ✅ HACER (agregar integration test en SPEC-061 para máxima certeza, pero el gap en sí es falso positivo)
- **Decision Date**: 2026-04-01
- **Verification**: FALSE POSITIVE confirmed. `this.getClient(tx)` returns the tx object, `.query.tableName.findMany()` operates on that client inside the transaction. Drizzle docs confirm `tx.query.*` is supported. Recent tests (commit `4027ace9`) verify this works.

**Description**: The core `findAllWithRelations` method uses `db.query[tableName].findMany(queryConfig)` (Drizzle relational query builder) at line 551 of `base.model.ts`. When `tx` is passed, `getClient(tx)` returns the transaction object and then `tx.query[tableName].findMany(...)` is called. However, Drizzle's relational query API (`db.query.*`) on a transaction object may route queries through the pool connection rather than the transaction connection, depending on the Drizzle version. This would mean the entire SPEC-053 premise (that passing `tx` makes relational queries participate in the transaction) may be incorrect for the main query path.

**Note**: The `count()` call and `findAll()` fallback both use `db.select().from()` which IS correctly transaction-aware. Only the relational query path (`db.query.*.findMany`) is in question.

**Evidence**: Drizzle's official docs show `tx.query.users.findMany()` inside transactions, suggesting it IS supported. However, no integration test in this codebase verifies this behavior. The spec itself notes "Drizzle's official documentation explicitly shows `tx.query.users.findMany({ with: { accounts: true } })` inside transactions" but this was never verified with an actual test.

**Proposed Solution**: Write an integration test that: (1) starts a transaction, (2) inserts a row, (3) calls `findAllWithRelations` with the tx, (4) verifies the inserted row is visible, (5) rolls back, (6) verifies the row is gone.

**Recommendation**: **Needs investigation** (integration test) before any further tx work. If `tx.query.*` does NOT work, `findAllWithRelations` needs to be rewritten with explicit joins.

---

### GAP-053-051: Base `findWithRelations` Ignores the `relations` Parameter Entirely

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Correctness / Dead Code
- **Decision**: ✅ HACER (documentar como stub + JSDoc warning)
- **Decision Date**: 2026-04-01

**Description**: The base class `findWithRelations` (lines 418-454) accepts a `relations` parameter but the only query it issues is `db.select().from(this.table).where(whereClause).limit(1)` .. no joining, no `with`, no `db.query.*` call. The `relations` parameter is completely ignored. Every call to `findWithRelations` on the base class silently drops all requested relations. Only subclass overrides (which have their own query logic) actually load relations.

**Proposed Solution**: Either implement actual relation loading (mirroring `findAllWithRelations`), or throw `NotImplementedError` to force subclass override, or document clearly that the base implementation is a stub.

**Recommendation**: Fix directly or document as known stub.

---

### GAP-053-052: `transformRelationsForDrizzle` Only Handles One Level of Nesting

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Correctness / Depth Limitation
- **Decision**: ✅ HACER (Opción A: hacer recursiva)
- **Decision Date**: 2026-04-01

**Description**: The `transformRelationsForDrizzle` function (lines 572-588) handles: `{ author: true }` and `{ sponsorship: { sponsor: true } }`. But NOT deeper nesting like `{ sponsorship: { sponsor: { user: true } } }` (two-level). If a caller passes deeper nesting, the transformation produces invalid Drizzle syntax because the function is not recursive. There are no runtime guards or type constraints preventing deeper nesting.

**Proposed Solution**: (1) Make the function recursive, or (2) enforce max depth 1 at the type level, or (3) document the limitation and validate at runtime.

**Recommendation**: Fix directly.

---

### GAP-053-053: `count` and `findMany` May Produce Mismatched Results for Complex `additionalConditions`

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Data Consistency
- **Decision**: ✅ HACER (documentar + comment en código)
- **Decision Date**: 2026-04-01

**Description**: `findMany` uses `db.query.*` (relational API) which operates on the schema-aware model. `count` uses `db.select({ count: count() }).from(this.table)` (plain query). If `additionalConditions` reference columns from related tables (not the base table), `count` fails because it has no joins, while `findMany` via the relational API might handle them implicitly. This produces `total` that doesn't match `items.length` for certain queries.

**Proposed Solution**: Document that `additionalConditions` must only reference base table columns. Add runtime validation or type constraint.

**Recommendation**: Fix directly (documentation + comment in code).

---

### GAP-053-054: `PostService.like/unlike` Non-Atomic Read-Modify-Write on `likes` Counter

- **Decision**: ✅ HACER
- **Decision Date**: 2026-04-01
- **Severity adjusted**: ~~Critical~~ Medium (likes counter, not financial data)

- **Found in Audit**: #4
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: Low
- **Category**: Concurrency / Data Integrity

**Description**: `post.service.ts:792-793` and `817-818` do a classic TOCTOU race:

```typescript
const post = await this.model.findOne({ id: validated.postId });
await this.model.update({ id: validated.postId }, { likes: (post.likes ?? 0) + 1 });
```

Two concurrent requests read the same `likes` value and both write the same incremented value, silently losing one increment.

**Proposed Solution**: Use atomic SQL increment: `UPDATE posts SET likes = likes + 1 WHERE id = $1` via Drizzle's `sql` expression. Add `incrementLikes(id)` and `decrementLikes(id)` to PostModel.

**Recommendation**: Fix directly.

---

### GAP-053-055: `PostSponsorshipService._afterCreate` Cross-Entity Write Without Transaction

- **Found in Audit**: #4
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: Medium
- **Category**: Data Integrity / Atomicity
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-04-01

**Description**: `postSponsorship.service.ts:92-128`: After the PostSponsorship row commits, `_afterCreate` calls `postModel.update()` to set `posts.sponsorshipId`. If this second write fails, the error is caught and swallowed (line 126), leaving PostSponsorship row committed but Post.sponsorshipId = null. Same pattern in `_beforeSoftDelete` and `_beforeHardDelete` (writes Post before delete, not atomic).

**Proposed Solution**: Wrap the insert and the Post update in a single transaction.

**Recommendation**: Bundle with GAP-053-010 service-layer transaction SPEC.

---

### GAP-053-056: `hardDelete` Silently Returns `{ count: 0 }` for Already-Soft-Deleted Entities

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Behavioral Bug
- **Decision**: ✅ HACER
- **Decision Date**: 2026-04-01

**Description**: `base.crud.write.ts:255-256`: If entity has `deletedAt` set, `hardDelete` returns `{ count: 0 }` immediately. This makes it impossible to permanently clean up soft-deleted records through the service layer. The intended workflow (soft-delete then hard-delete) is broken.

**Proposed Solution**: Remove the early return guard, or add `{ force: boolean }` parameter.

**Recommendation**: Fix directly.

---

### GAP-053-057: `_executeAdminSearch` Does Not Propagate `tx` to `findAllWithRelations`

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Feature Gap / Architecture
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-04-01

**Description**: `base.crud.read.ts:441-452` and `list()` at line 212 call `findAllWithRelations` without forwarding `tx`. SPEC-053 added `tx` to the model but no service method can pass it. This makes the SPEC-053 `tx` parameter invisible from the service layer.

**Proposed Solution**: Extend `AdminSearchExecuteParams` and `list()` options with an optional `tx` parameter.

**Recommendation**: Bundle with GAP-053-010 service-layer transaction SPEC.

---

### GAP-053-058: `AccommodationReviewService._afterCreate/_afterUpdate` Multi-Write Without Transaction (deepens GAP-053-028)

- **Found in Audit**: #4
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: Medium
- **Category**: Data Integrity / Atomicity
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-04-01

**Description**: `accommodationReview.service.ts:249-265`: `_afterCreate` calls `computeAndStoreReviewAverage(entity)` then `recalculateAndUpdateAccommodationStats()`. Three separate DB writes after the review insert has committed. If `computeAndStoreReviewAverage` succeeds but stats recalculation fails, the review's `averageRating` is set but Accommodation stats are stale. Same in `_afterUpdate` (line 267). Also: `_afterHardDelete` (line 347) omits stats recalculation entirely while `_afterSoftDelete` (line 315) does it correctly.

**Proposed Solution**: Wrap review insert + stat updates in a single transaction.

**Recommendation**: Bundle with GAP-053-010.

---

### GAP-053-059: `DestinationService._beforeUpdate` Writes Descendants Then Parent Update Can Fail (deepens GAP-053-014)

- **Found in Audit**: #4
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: High
- **Category**: Data Integrity / Atomicity
- **Decision**: ✅ HACER (fix urgente directo)
- **Decision Date**: 2026-04-01

**Description**: `destination.service.ts:594`: `_beforeUpdate` calls `this.model.updateDescendantPaths(id, current.path, newPath)` which commits writes immediately. If the subsequent `model.update()` for the parent destination fails, descendant paths point to the new parent path while the parent still has the old path. Hierarchy permanently corrupted with no rollback. Additionally, `updateDescendantPaths` itself does N+1 individual UPDATE queries in a loop without a transaction (line 535-594 of destination.model.ts).

**Proposed Solution**: Wrap entire update operation in a transaction. Replace N+1 with batch UPDATE using SQL expression.

**Recommendation**: Fix directly (urgent). Also needs tx support in the model method.

---

### GAP-053-060: "tx as Last Positional Parameter" Pattern is Unsustainable at Scale

- **Found in Audit**: #4
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: High
- **Category**: Architecture / Scalability
- **Decision**: ✅ HACER (patrón elegido: Context Object como último param)
- **Decision Date**: 2026-04-01
- **Decision Notes**: Se eligió Opción 1 (Context Object) sobre Repository DI (Opción 2, costo de migración prohibitivo en 50+ route files) y AsyncLocalStorage (Opción 3, magia implícita es footgun). Context Object resuelve tx propagation + singleton mutable state (GAP-013) con 1 patrón. Migración incremental, extensible (requestId, actor, correlationId futuro), explícito en firmas. Documentar en ADR-018 y aplicar en SPEC-058/059/060.

**Description**: The pattern already shows inconsistencies: `findAllWithRelations` has 5 positional params (must pass 4 `undefined` to reach `tx`), `count` uses an options object `{ additionalConditions?, tx? }`, other methods use positional. When service-layer tx is needed, every intermediate method needs the parameter, creating chains of 5-7 positions. The pattern is incompatible with a complete transaction architecture.

Alternative patterns: (1) Context object as last param (extensible), (2) Repository with tx in constructor (DI-friendly), (3) AsyncLocalStorage for implicit context (transparent but complex).

**Proposed Solution**: Document in ADR-018 that the current pattern is provisional. Define the target pattern before expanding tx to the service layer.

**Recommendation**: **Needs formal SPEC** (blocks all service-layer tx work).

---

### GAP-053-061: `REntityTagModel.findPopularTags` Uses `require()` in ESM .. Runtime Failure Guaranteed

- **Found in Audit**: #4
- **Severity**: ~~Critical~~ High (adjusted: may work if bundler tolerates CJS)
- **Priority**: P1
- **Complexity**: Low
- **Category**: Runtime Error / Module System
- **Decision**: ✅ HACER (URGENTE, fix trivial)
- **Decision Date**: 2026-04-01

**Description**: `packages/db/src/models/tag/rEntityTag.model.ts:127`:

```typescript
const { rEntityTag, tags } = require('../../schemas/tag');
```

This `require()` in an ESM module is a guaranteed runtime failure. The same schemas are already available via the import at line 5. This is dead code duplication that will crash when `findPopularTags` is called in production.

**Proposed Solution**: Replace `require()` with the existing ESM import.

**Recommendation**: Fix directly (urgent).

---

### GAP-053-062: Duplicate Model Singletons Exported (`accommodationModel`, `amenityModel`)

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Architecture / Confusion
- **Decision**: ✅ HACER (verificar que no haya código único en stubs antes de eliminar)
- **Decision Date**: 2026-04-01

**Description**: `packages/db/src/models/accommodation.model.ts:64` exports `const accommodationModel = new AccommodationModel()` which is a DIFFERENT class from `packages/db/src/models/accommodation/accommodation.model.ts`. The subdirectory version has `search`, `searchWithRelations`, `findTopRated` etc. while the root version is a simplified stub with only `findWithRelations`. Same pattern for `amenityModel`. Any code importing from the wrong path gets a model missing critical methods.

**Proposed Solution**: Delete the root-level stub files. Only the subdirectory versions should exist. MUST verify stub code is not unique before deleting — merge any missing logic into subdirectory version.

**Recommendation**: Fix directly or bundle with a model consolidation SPEC.

---

### GAP-053-063: `tx` Parameter of SPEC-053 is Unusable from Production Code

- **Found in Audit**: #4
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: High
- **Category**: Architecture / Feature Completeness
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-04-01

**Description**: Tracing the full request flow: Route handler → Service singleton → `list()`/`_executeAdminSearch()` → `findAllWithRelations()`. The `tx` parameter is never passed at any level. No mechanism exists for a route to start a transaction and propagate it through the service layer. The SPEC-053 `tx` parameter only exists for direct model usage and tests. This is explicitly "Out of Scope" per the spec, but means the feature has zero production callers.

**Proposed Solution**: This is acknowledged in the spec as intentional infrastructure. Needs SPEC for service-layer tx propagation to make it usable.

**Recommendation**: **Needs formal SPEC** (P1). Bundle with GAP-053-010.

---

### GAP-053-064: `AccommodationService._afterCreate` Cross-Entity Write Without Transaction

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Medium
- **Category**: Data Integrity / Atomicity
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-04-01

**Description**: `accommodation.service.ts:326-346`: `_afterCreate` calls `this.destinationService.updateAccommodationsCount(entity.destinationId)`. Cross-entity write after the Accommodation insert committed. If count update fails, accommodation exists but destination's `accommodationsCount` is wrong. Same in `_afterSoftDelete`, `_afterHardDelete`, `_afterRestore`.

**Proposed Solution**: Wrap in transaction or use DB trigger.

**Recommendation**: Bundle with GAP-053-010.

---

### GAP-053-065: `DestinationReviewService._afterCreate/_afterUpdate` Same Atomicity Gap as AccommodationReviewService

- **Found in Audit**: #4
- **Severity**: Critical
- **Priority**: P1
- **Complexity**: Medium
- **Category**: Data Integrity / Atomicity
- **Decision**: ✅ HACER (bundleado en SPEC-059 con GAP-010)
- **Decision Date**: 2026-04-01

**Description**: `destinationReview.service.ts:194-215` and `217-239`: Same pattern as GAP-053-058. `_afterCreate` calls `model.update()` to persist `averageRating`, then `recalculateAndUpdateDestinationStats()`. `_afterHardDelete` (line 304) omits stats recalculation while `_afterSoftDelete` (line 272) does it.

**Proposed Solution**: Same as GAP-053-058.

**Recommendation**: Bundle with GAP-053-010.

---

### GAP-053-066: Billing Services Use Completely Different Pattern (No BaseModel, Direct `getDb()`)

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: High
- **Category**: Architecture / Consistency
- **Decision**: 📋 NUEVA SPEC (SPEC-064 "Billing Transaction Safety")
- **Decision Date**: 2026-04-01

**Description**: Billing services in `packages/service-core/src/services/billing/` have a completely different pattern: `BillingSettingsService` uses `getDb()` directly without extending `BaseCrudService` (lines 117, 169, 214). `promo-code.crud.ts` has 6 occurrences of `getDb()` as standalone functions. `addon-expiration.queries.ts` and `addon-user-addons.ts` are standalone functions with `getDb()` direct. No tx propagation mechanism exists.

**Proposed Solution**: Billing services need their own migration plan to the model + tx pattern.

**Recommendation**: **Needs formal SPEC** for billing transaction safety.

---

### GAP-053-067: `REntityTagModel` 3 Methods with Bare `getDb()` (Not tx-Aware)

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Transaction Isolation
- **Decision**: ✅ HACER (bundleado en SPEC-060 con GAP-023/024)
- **Decision Date**: 2026-04-01

**Description**: `findAllWithTags` (line 61), `findAllWithEntities` (line 88), `findPopularTags` (line 125) all use `getDb()` directly. These are 100% of the specialized logic in `REntityTagModel`.

**Proposed Solution**: Add `tx?` and use `this.getClient(tx)`.

**Recommendation**: Bundle with GAP-053-024 SPEC.

---

### GAP-053-068: 30+ Additional Model Methods with Bare `getDb()` Across All Models

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: High
- **Category**: Transaction Isolation
- **Decision**: ✅ HACER (bundleado en SPEC-060 con GAP-023/024)
- **Decision Date**: 2026-04-01

**Description**: Beyond the 20+ already identified in GAP-053-024, additional methods confirmed in audit #4:

- `SponsorshipModel.findBySlug`, `SponsorshipLevelModel.findBySlug`, `OwnerPromotionModel.findBySlug`
- `ExchangeRateModel`: `findLatestRate`, `findLatestRates`, `findRateHistory`, `findManualOverrides`, `findAllWithDateRange` (5 methods)
- `DestinationModel`: `findChildren`, `findDescendants`, `findAncestors`, `findByPath` (confirmed)
- `RevalidationLogModel`: `deleteOlderThan`, `findWithFilters`, `findLastCronEntry` (3 methods)
- `RAccommodationAmenityModel.countAccommodationsByAmenityIds`
- Total: 50+ methods across all model subclasses use bare `getDb()`.

**Proposed Solution**: Systematic sweep adding `tx?` and replacing `getDb()` with `this.getClient(tx)`.

**Recommendation**: Bundle with GAP-053-024 SPEC.

---

### GAP-053-069: Billing `promo-code.redemption.ts` TOCTOU Between Validation and Transaction

- **Found in Audit**: #4
- **Severity**: ~~Critical~~ Low (FALSE POSITIVE — lock-then-verify pattern is correct)
- **Priority**: P4
- **Complexity**: Low
- **Category**: Data Integrity / Financial Impact
- **Decision**: ✅ HACER (minor improvement: also re-validate expiration date inside the SELECT FOR UPDATE transaction for defense-in-depth)
- **Decision Date**: 2026-04-01
- **Verification**: FALSE POSITIVE confirmed. `tryRedeemAtomically` does cheap validations outside lock (expiry, inactive — immutable conditions), then re-validates `maxUses` inside transaction with `SELECT FOR UPDATE`. Pattern is correct. Minor improvement: also re-check expiration inside tx for defense-in-depth.

**Description**: `promo-code.redemption.ts:144` does validation read with `getDb()` (no lock), then `line 301` starts a separate transaction with `SELECT FOR UPDATE`. The gap between validation and lock is a TOCTOU window. A promo code can pass validation (not expired, under maxUses) but by the time the `SELECT FOR UPDATE` runs, another process has already used it. The `SELECT FOR UPDATE` on line 302 re-checks `maxUses` but does NOT re-validate expiration date.

**Proposed Solution**: Move ALL validation logic inside the transaction alongside the `SELECT FOR UPDATE`.

**Recommendation**: Fix directly (financial impact). Bundle with GAP-053-066 billing SPEC.

---

### GAP-053-070: `count()` Returns `SQL<number>` But PostgreSQL Driver Delivers String at Runtime

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P3
- **Complexity**: Low
- **Category**: Type Safety / Runtime Mismatch
- **Decision**: ✅ HACER (bundleado con GAP-038)
- **Decision Date**: 2026-04-01

**Description**: `base.model.ts:271-278`: Drizzle's `count()` is typed as `SQL<number>` but PostgreSQL's `COUNT()` always returns `bigint` which the `pg` Node.js driver delivers as a string. The `Number()` coercion on line 278 masks this: `Number("42") === 42` works, but TypeScript believes the coercion is unnecessary. If `Number()` were ever removed during a refactor, the runtime behavior would break silently.

**Proposed Solution**: Add a comment documenting the Drizzle/pg type mismatch. Keep the explicit `Number()` coercion.

**Recommendation**: Fix directly (documentation).

---

### GAP-053-071: `getClient()` Return Type Lies When Receiving `NodePgTransaction` (deepens GAP-053-018)

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P3
- **Complexity**: Medium
- **Category**: Type Safety / Transaction Semantics
- **Decision**: ✅ HACER (bundleado en SPEC-058 con GAP-003/018)
- **Decision Date**: 2026-04-01

**Description**: `base.model.ts:48-50`:

```typescript
protected getClient(tx?: NodePgDatabase<typeof schema>): NodePgDatabase<typeof schema>
```

When `tx` is a `NodePgTransaction` (from `db.transaction()` callback), `getClient` returns it typed as `NodePgDatabase`. Consequences: (1) `NodePgTransaction.transaction()` creates savepoints (not new top-level transactions) but TypeScript thinks it creates a new transaction. (2) `entityKind` discriminant differs at runtime (`'NodePgTransaction'` vs `'NodePgDatabase'`). (3) TypeScript cannot distinguish savepoints from transactions.

**Proposed Solution**: Define `DrizzleClient = NodePgDatabase<typeof schema> | NodePgTransaction<...>` union type. Use it in `getClient` return type.

**Recommendation**: Bundle with GAP-053-018 and GAP-053-003.

---

### GAP-053-072: `BaseModel<T>` Has No Generic Constraint on `T`

- **Found in Audit**: #4
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Type Safety
- **Decision**: ✅ HACER (bundleado en SPEC-058 con GAP-003)
- **Decision Date**: 2026-04-01

**Description**: `class BaseModel<T>` has no constraint. `BaseModel<string>`, `BaseModel<number>`, `BaseModel<undefined>` are all valid. `create(data: Partial<T>)` with `T = string` accepts `"hello"`. The constraint should be at least `T extends Record<string, unknown>`.

**Proposed Solution**: `export abstract class BaseModel<T extends Record<string, unknown>>`

**Recommendation**: Bundle with GAP-053-003 interface alignment SPEC.

---

### GAP-053-073: `afterEach(vi.restoreAllMocks)` Missing in Test Files .. Spy Leak on Failure

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Trivial
- **Category**: Test Quality / Infrastructure
- **Decision**: ✅ HACER (bundleado con GAP-005)
- **Decision Date**: 2026-04-01

**Description**: `find-all-with-relations-tx.test.ts` uses `vi.clearAllMocks()` in `beforeEach` but no `afterEach(() => vi.restoreAllMocks())`. Tests 2-4 use manual `.mockRestore()` at the end, but if the test fails BEFORE reaching `.mockRestore()`, spies leak to subsequent tests. Same issue in `base.model.test.ts` `findAllWithRelations` describe block. `clearAllMocks` resets call history but does NOT restore original implementations.

**Proposed Solution**: Add `afterEach(() => vi.restoreAllMocks())` and remove manual `.mockRestore()` calls.

**Recommendation**: Fix directly.

---

### GAP-053-074: `mockTx = {}` Makes Test Assertions Trivially True (deepens GAP-053-005)

- **Found in Audit**: #4
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Test Quality
- **Decision**: ✅ HACER (bundleado con GAP-005)
- **Decision Date**: 2026-04-01

**Description**: Tests verify `getClientSpy.toHaveBeenCalledWith(mockTx)` where `mockTx = {}`. But `getClient` spy returns a completely different mock object (not `mockTx`). The test proves `getClient` received the empty object reference, NOT that the returned DB client was actually used for queries. If the implementation called `getClient(tx)` then discarded the result and used `getDb()`, the test would still pass.

**Proposed Solution**: The `getClient` spy should return a distinguishable mock, and the test should verify that mock's `findMany` was called and `getDb` was NOT called.

**Recommendation**: Fix directly (bundle with GAP-053-005).

---

### GAP-053-075: Error Tests for `findAllWithRelations` Expect Generic `Error` Not `DbError`

- **Found in Audit**: #4
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Test Correctness
- **Decision**: ✅ HACER (bundleado con GAP-006)
- **Decision Date**: 2026-04-01

**Description**: `base.model.test.ts` lines 571-621: Three error tests use `.toThrow(Error)` which is overly broad (`DbError extends Error` so it always passes). Other tests in the same file correctly use `.toThrow(DbError)` (e.g., line 153). The weak assertion means the error wrapping behavior could regress without detection.

**Proposed Solution**: Change `.toThrow(Error)` to `.toThrow(DbError)`.

**Recommendation**: Fix directly.

---

### GAP-053-076: `ExchangeRateModel.findLatestRates` Uses `desc()` Instead of `max()` in Subquery

- **Found in Audit**: #4
- **Severity**: Critical (correctness bug)
- **Priority**: P1
- **Complexity**: Low
- **Category**: Correctness / Data Integrity
- **Decision**: ✅ HACER (URGENTE, bug de correctness)
- **Decision Date**: 2026-04-01

**Description**: `exchange-rate.model.ts:82-116`: The subquery uses `desc(exchangeRates.fetchedAt)` as a column expression in a `GROUP BY` query. `desc()` is an ORDER BY directive, NOT an aggregate function. The value of `maxFetchedAt` will be an arbitrary row's `fetchedAt` from the group, not the maximum. The subsequent JOIN on `eq(exchangeRates.fetchedAt, subquery.maxFetchedAt)` may return incorrect rates or no rates.

**Proposed Solution**: Replace `desc(exchangeRates.fetchedAt)` with `max(exchangeRates.fetchedAt)`.

**Recommendation**: Fix directly (correctness bug affecting displayed exchange rates).

---

### GAP-053-077: `notification-retention.service.ts` SELECT + DELETE Without Atomicity

- **Found in Audit**: #4
- **Severity**: High
- **Priority**: P2
- **Complexity**: Low
- **Category**: Data Integrity / Concurrency
- **Decision**: ✅ HACER
- **Decision Date**: 2026-04-01

**Description**: Lines 69 and 102 in `notification-retention.service.ts`: SELECT with `getDb()` then separate DELETE with `getDb()`. Two concurrent cleanup processes can both SELECT the same records, both DELETE them, with the second getting 0 rows affected silently. Metrics of cleaned records are incorrect.

**Proposed Solution**: Use `DELETE ... WHERE ... RETURNING` for atomic operation.

**Recommendation**: Fix directly.

---

### GAP-053-078: `revalidation-stats.service.ts` Bypasses Model Layer .. Direct `getDb()` in service-core

- **Found in Audit**: #4
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Low
- **Category**: Architecture / Layer Violation
- **Decision**: ✅ HACER
- **Decision Date**: 2026-04-01

**Description**: `revalidation-stats.service.ts:29` uses `getDb()` directly without going through `RevalidationLogModel`. Violates the project's established separation of concerns where services use models, not raw DB connections.

**Proposed Solution**: Use `RevalidationLogModel` which already exists.

**Recommendation**: Fix directly.

---

### GAP-053-079: `allConditions[0]` with `noUncheckedIndexedAccess` is `SQL | undefined` .. Non-Null Assertion Missing

- **Found in Audit**: #4
- **Severity**: Medium
- **Priority**: P3
- **Complexity**: Trivial
- **Category**: Type Safety
- **Decision**: ✅ HACER
- **Decision Date**: 2026-04-01

**Description**: In `base.model.ts` lines 99-104, 542-547, and 265-268: When `allConditions.length === 1`, `allConditions[0]` is typed as `SQL | undefined` with `noUncheckedIndexedAccess` enabled. The `undefined` is impossible at runtime (length guarantees existence) but TypeScript cannot infer this. The code compiles because `SQL | undefined` is assignable to `.where()`, but the type is looser than intended.

**Proposed Solution**: Add `!` non-null assertion: `allConditions[0]!`. Safe because `length === 1` guarantees the element exists.

**Recommendation**: Fix directly.

---

## Gap Summary Table

> **Note**: Gaps 001-049 from Audits #1-3, Gaps 050-079 from Audit #4

| Gap ID | Title | Severity | Priority | Complexity | Audit(s) | Recommendation |
|--------|-------|----------|----------|------------|:---:|----------------|
| 001 | Spec status stale | Low | P4 | Trivial | #1 | Fix directly |
| 002 | `SupportsRelations<T>` dead code | Med | P3 | Low | #1-3 | Fix directly (delete) |
| 003 | 9/11 interface methods missing `tx` | High | P2 | Med | #1-3 | **New SPEC** |
| 004 | 3 methods missing from interface | Med | P3 | Low | #1-3 | Bundle with 003 |
| 005 | Tests prove routing only | High | P2 | Med | #1-4 | Fix directly |
| 006 | No error path testing in tx | Med | P3 | Low | #1-2 | Fix directly |
| 007 | No param combination tests | Low | P4 | Low | #1-3 | Fix directly |
| 008 | Global coverage threshold failure | Med | P3 | High | #1-3 | Pre-existing (SPEC-040) |
| 009 | Inconsistent tx type in billing | Low | P4 | Low | #1-3 | Fix directly |
| 010 | Zero service-layer tx support | **Crit** | **P1** | High | #1-4 | **New SPEC** (P1) |
| 011 | Parallel findMany/count snapshot | Low | P4 | Med | #1 | Document only |
| 012 | No DB integration tests | Med | P3 | High | #1-3 | **New SPEC** |
| 013 | Instance mutable state + singletons | **Crit** | **P1** | Med | #2-4 | **New SPEC** (P1) |
| 014 | `_beforeUpdate` does DB writes | Med | P3 | Med | #2-4 | Bundle with 010 |
| 015 | Count fetches all records + race | Low | P4 | Low | #2-3 | Fix directly |
| 016 | Tests missing `getDb` NOT called | High | P2 | Low | #2-4 | Fix directly |
| 017 | Test imports wrong schema source | High | P2 | Low | #2-4 | Fix directly |
| 018 | withTransaction + getClient type lie | High | P3 | Med | #2-4 | Bundle with 003 |
| 019 | No `implements` clause | Med | P3 | Low | #2 | Bundle with 003 |
| 020 | logError + logQuery lack try-catch | Med | P3 | Trivial | #2-3 | Fix directly |
| 021 | sortBy/sortOrder 0% coverage | Med | P3 | Low | #2-3 | Fix directly |
| 022 | db.query cast + items as T[] | Low | P4 | Med | #2-3 | Document only |
| 023 | Subclass findWithRelations drops tx | **Crit** | **P1** | Med | #3-4 | Fix directly or SPEC |
| 024 | 20+ model methods use bare getDb() | **Crit** | **P1** | High | #3-4 | **New SPEC** |
| 025 | Services ARE module-level singletons | **Crit** | **P1** | Med | #3-4 | **New SPEC** (P1) |
| 026 | updateVisibility phantom entity | **Crit** | **P1** | Low | #3-4 | **Fix directly (URGENT)** |
| 027 | Review uniqueness TOCTOU race | **Crit** | **P1** | Med | #3 | Fix directly (migration) |
| 028 | _afterHardDelete missing stats recalc | High | P2 | Low | #3-4 | Fix directly |
| 029 | runWithLoggingAndValidation swallows errors | High | P2 | Med | #3-4 | Bundle with 010 |
| 030 | logQuery success path unguarded | Med | P3 | Trivial | #3 | Fix directly |
| 031 | items as T[] unsafe casts | High | P3 | Med | #3 | Document/long-term |
| 032 | findWithRelations LSP violation | Med | P3 | Low | #3 | Bundle with 023 |
| 033 | 12x `this.table as unknown` casts | High | P3 | Low | #3 | Fix directly |
| 034 | softDelete/hardDelete not atomic | High | P2 | Med | #3 | Bundle with 010 |
| 035 | count() with tx zero coverage | High | P2 | Low | #3 | Fix directly |
| 036 | findAll() with tx zero coverage | High | P2 | Low | #3 | Fix directly |
| 037 | No ADR for tx convention | Med | P3 | Low | #3 | Fix directly (ADR) |
| 038 | No tx context in logs | Med | P3 | Low | #3 | Fix directly |
| 039 | PaginatedListOutput duplicated | Med | P3 | Low | #3 | Fix directly |
| 040 | PaginatedListOptions.relations ignored | Med | P4 | Low | #3 | Fix directly |
| 041 | withTransaction JSDoc wrong order | Med | P3 | Trivial | #3 | Fix directly |
| 042 | create() error as Error inconsistent | Med | P3 | Trivial | #3 | Fix directly |
| 043 | Test file naming convention | Low | P4 | Trivial | #3 | Fix directly |
| 044 | Commented-out pagination test | Med | P3 | Med | #3 | Fix directly |
| 045 | MAX_PAGE_SIZE cap untested | Med | P3 | Low | #3 | Fix directly |
| 046 | safeWhere ?? {} redundant | Low | P4 | Trivial | #3 | Fix directly |
| 047 | transformRelationsForDrizzle inline | Low | P4 | Trivial | #3 | Fix directly |
| 048 | CLAUDE.md tx example anti-pattern | Low | P4 | Trivial | #3 | Fix directly |
| 049 | UserModel.count uses or instead of nullish coalescing | Low | P4 | Trivial | #3 | Fix directly |
| **050** | **`db.query.*` may not propagate tx in Drizzle** | **Crit** | **P1** | High | #4 | **Needs investigation** |
| **051** | Base `findWithRelations` ignores relations param | High | P2 | Low | #4 | Fix/document |
| **052** | `transformRelationsForDrizzle` only 1-level deep | High | P2 | Med | #4 | Fix directly |
| **053** | count/findMany mismatch for complex conditions | High | P2 | Med | #4 | Fix (document) |
| **054** | `PostService.like/unlike` non-atomic increment | **Crit** | **P1** | Low | #4 | Fix directly |
| **055** | PostSponsorshipService cross-entity write no tx | **Crit** | **P1** | Med | #4 | Bundle with 010 |
| **056** | hardDelete silently ignores soft-deleted entities | High | P2 | Low | #4 | Fix directly |
| **057** | `_executeAdminSearch` doesn't propagate tx | High | P2 | Low | #4 | Bundle with 010 |
| **058** | AccommodationReview multi-write no atomicity | **Crit** | **P1** | Med | #4 | Bundle with 010 |
| **059** | DestinationService._beforeUpdate hierarchy corruption | **Crit** | **P1** | High | #4 | Fix directly (urgent) |
| **060** | tx-last-param pattern unsustainable | **Crit** | **P1** | High | #4 | **New SPEC** (blocks svc tx) |
| **061** | `require()` in ESM .. runtime failure | **Crit** | **P1** | Low | #4 | **Fix directly (urgent)** |
| **062** | Duplicate model singletons (accommodation, amenity) | High | P2 | Med | #4 | Fix directly or SPEC |
| **063** | tx param unusable from production code | **Crit** | **P1** | High | #4 | **New SPEC** (P1) |
| **064** | AccommodationService cross-entity write no tx | High | P2 | Med | #4 | Bundle with 010 |
| **065** | DestinationReview multi-write no atomicity | **Crit** | **P1** | Med | #4 | Bundle with 010 |
| **066** | Billing services completely different pattern | High | P2 | High | #4 | **New SPEC** |
| **067** | REntityTagModel 3 methods bare getDb | High | P2 | Low | #4 | Bundle with 024 |
| **068** | 30+ additional model methods bare getDb | High | P2 | High | #4 | Bundle with 024 |
| **069** | Billing promo-code TOCTOU (financial impact) | **Crit** | **P1** | Med | #4 | Fix directly (urgent) |
| **070** | count SQL-number vs string at runtime | High | P3 | Low | #4 | Fix directly (doc) |
| **071** | getClient return type lies (NodePgTransaction) | High | P3 | Med | #4 | Bundle with 018/003 |
| **072** | BaseModel no constraint on T | Med | P3 | Low | #4 | Bundle with 003 |
| **073** | afterEach(vi.restoreAllMocks) missing .. spy leak | High | P2 | Trivial | #4 | Fix directly |
| **074** | mockTx = {} makes assertions trivially true | Med | P3 | Low | #4 | Bundle with 005 |
| **075** | Error tests expect Error not DbError | Med | P3 | Trivial | #4 | Fix directly |
| **076** | ExchangeRateModel desc() vs max() bug | High | P2 | Low | #4 | **Fix directly (urgent)** |
| **077** | notification-retention SELECT+DELETE not atomic | High | P2 | Low | #4 | Fix directly |
| **078** | revalidation-stats bypasses model layer | Med | P3 | Low | #4 | Fix directly |
| **079** | allConditions[0] needs non-null assertion | Med | P3 | Trivial | #4 | Fix directly |

---

## Severity Distribution (Updated Audit #4)

| Severity | Count | Gap IDs |
|----------|-------|---------|
| Critical | 17 | 010, 013, 023, 024, 025, 026, 027, **050, 054, 055, 058, 059, 060, 061, 063, 065, 069** |
| High | 27 | 003, 005, 016, 017, 018, 028, 029, 031, 033, 034, 035, 036, **051, 052, 053, 056, 057, 062, 064, 066, 067, 068, 070, 071, 073, 076, 077** |
| Medium | 22 | 002, 004, 006, 008, 012, 014, 019, 020, 021, 030, 032, 037-045, **072, 074, 075, 078, 079** |
| Low | 13 | 001, 007, 009, 011, 015, 022, 040, 043, 046-049 |

---

## Recommended Actions (Updated Audit #4)

### URGENT Fixes (security + runtime + data corruption) .. 5 items

| # | Gap | Action | Effort |
|---|-----|--------|--------|
| 1 | 026 | Pass real entity to `_canUpdateVisibility`/`_beforeUpdateVisibility` | 15 min |
| 2 | 061 | Replace `require()` with existing ESM import in `rEntityTag.model.ts` | 5 min |
| 3 | 076 | Replace `desc()` with `max()` in `ExchangeRateModel.findLatestRates` | 10 min |
| 4 | 054 | Replace read-modify-write in `PostService.like/unlike` with atomic SQL increment | 1 hr |
| 5 | 069 | Move billing promo-code validation inside transaction with `SELECT FOR UPDATE` | 2 hrs |

### High-Priority Fixes (no new spec needed) .. 28 items

| # | Gap(s) | Action | Effort |
|---|--------|--------|--------|
| 1 | 001 | Update spec status to `completed` | 1 min |
| 2 | 002 | Delete `SupportsRelations<T>` dead code | 5 min |
| 3 | 005, 016, 017, 073, 074 | Rewrite tx tests: `afterEach`, `getDb` NOT called, richer mocks, fix schema import | 3 hrs |
| 4 | 006, 075 | Add error path tests in tx context, fix `DbError` assertions | 1 hr |
| 5 | 007, 021, 045, 052 | Add param combination tests (sortBy, additionalConditions, nested relations, MAX_PAGE_SIZE, depth) | 2 hrs |
| 6 | 009 | Fix billing service tx type | 15 min |
| 7 | 015 | Replace `findAll + items.length` with `count()` | 15 min |
| 8 | 020, 030 | Wrap logQuery (success) and logError (catch) in try-catch | 10 min |
| 9 | 027 | Add partial unique index migration for reviews | 1 hr |
| 10 | 028 | Add stats recalc to `_afterHardDelete` in both review services | 30 min |
| 11 | 033 | Change `buildWhereClause`/`buildOrderByClause` to accept `Table`, remove 12 casts | 30 min |
| 12 | 035, 036 | Add count() and findAll() with tx tests | 1 hr |
| 13 | 037 | Create ADR-018 for tx propagation convention | 30 min |
| 14 | 038, 070 | Add `inTransaction: !!tx` to log context + document count() type mismatch | 20 min |
| 15 | 039 | Deduplicate PaginatedListOutput to single source | 15 min |
| 16 | 040 | Use `Omit<PaginatedListOptions, 'relations'>` in findAllWithRelations | 10 min |
| 17 | 041 | Fix withTransaction JSDoc example | 5 min |
| 18 | 042 | Fix create() error handling pattern | 5 min |
| 19 | 043, 044 | Merge tx tests into base.model.test.ts, fix commented pagination test | 1 hr |
| 20 | 046 | Remove redundant `?? {}` | 1 min |
| 21 | 047 | Move transformRelationsForDrizzle to module scope | 5 min |
| 22 | 048, 049, 078 | Fix CLAUDE.md example, fix UserModel or-vs-nullish, fix revalidation-stats | 30 min |
| 23 | 051 | Document base `findWithRelations` as stub or implement | 30 min |
| 24 | 053 | Document `additionalConditions` must be base-table only | 15 min |
| 25 | 056 | Fix `hardDelete` to allow hard-deleting soft-deleted entities | 30 min |
| 26 | 059 | Wrap `updateDescendantPaths` + parent update in transaction | 2 hrs |
| 27 | 062 | Delete duplicate root-level model stubs | 1 hr |
| 28 | 077 | Use `DELETE ... RETURNING` in notification-retention | 30 min |

### Needs New Formal SPEC .. 7 specs

| # | Gap(s) | Suggested SPEC | Priority | Complexity |
|---|--------|---------------|----------|------------|
| 1 | 003, 004, 018, 019, 032, 071, 072 | SPEC-058: Align BaseModel Interface | P2 | Medium |
| 2 | 010, 013, 014, 025, 029, 034, 055, 057, 058, 063, 064, 065 | SPEC-059: Service-Layer Transaction Support | **P1** | High |
| 3 | 023, 024, 067, 068 | SPEC-060: Model Subclass Transaction Propagation | **P1** | High |
| 4 | 012, 050 | SPEC-061: DB Integration Testing | P2 | High |
| 5 | 066, 069 | SPEC-062: Billing Transaction Safety | **P1** | High |
| 6 | 060 | SPEC-063: Transaction Architecture ADR | **P1** | Medium |
| 7 | 052 | SPEC-064: Relation Query Depth Handling | P3 | Medium |

### Pre-existing / Document Only .. 3 items

| # | Gap(s) | Action |
|---|--------|--------|
| 1 | 008 | Global coverage failure .. tracked under SPEC-040 |
| 2 | 011 | Parallel query snapshot .. document as known behavior |
| 3 | 022, 031 | db.query cast + items as T[] .. document as known limitation, address in future generics refactor |

---

## Top 10 Most Dangerous Gaps for Production (Audit #4)

| # | Gap | Risk | Impact |
|---|-----|------|--------|
| 1 | **050** | `findAllWithRelations` with tx may not work via `db.query.*` | Potentially invalidates ENTIRE SPEC-053 for relational queries |
| 2 | **069** | Billing promo-code TOCTOU | Promo codes usable beyond maxUses under concurrency .. **financial loss** |
| 3 | **059** | `updateDescendantPaths` N+1 without tx | Hierarchy corruption on partial failure .. breaks ALL geographic search |
| 4 | **013/025** | Singleton services with mutable state | **Guaranteed data corruption** under concurrent load for 6 services |
| 5 | **026** | `updateVisibility` phantom entity | Authorization bypass if any service checks entity ownership |
| 6 | **061** | `require()` in ESM | **Runtime crash** when `findPopularTags` is called |
| 7 | **076** | `desc()` instead of `max()` | Incorrect exchange rates displayed to users |
| 8 | **054** | `PostService.like/unlike` non-atomic | Like counts silently drift under concurrent usage |
| 9 | **027** | Review uniqueness TOCTOU | Users can create duplicate reviews |
| 10 | **029** | `runWithLoggingAndValidation` swallows errors | Transactions commit with partial writes .. **silent data corruption** |

---

## Open Questions

1. **~~Are services singletons or per-request?~~** **ANSWERED in Audit #3**: Yes, they are module-level singletons. GAP-053-013 is confirmed as guaranteed data corruption.

2. **Do junction tables have unique constraints?** Do `r_accommodation_features`, `r_accommodation_amenities`, and `r_entity_tags` have `UNIQUE(accommodation_id, feature_id)` etc.? Determines if TOCTOU races result in duplicates or constraint violations.

3. **Review tables unique constraint?** Do `accommodation_reviews` and `destination_reviews` have `UNIQUE(user_id, accommodation_id/destination_id) WHERE deleted_at IS NULL`? If not, GAP-053-027 is confirmed as a production duplicate-review bug.

4. **Does `tx.query.*` propagate the transaction in Drizzle?** (NEW from Audit #4 - GAP-053-050) This is the MOST CRITICAL open question. If `tx.query.tableName.findMany()` does NOT use the transaction connection, then `findAllWithRelations` with tx only works for the `count()` and `findAll()` fallback paths, not the main relational query path. Needs integration test to verify.

5. **Priority ordering for SPEC work?** Updated:
   1. GAP-053-026, 061, 076 (urgent fixes .. 30 min total, fix NOW)
   2. GAP-053-050 investigation (verify `tx.query.*` works .. blocks all other tx work)
   3. SPEC-063 for tx architecture ADR (blocks service-layer tx)
   4. SPEC-059 for service-layer tx + concurrency (highest production impact)
   5. SPEC-060 for model-layer tx sweep (foundation for service tx)
   6. SPEC-062 for billing tx safety (financial impact)
   7. SPEC-058 for interface alignment (enables type safety for all above)

---

## Audit Metadata

### Pass #1

- Files analyzed: 15+ source, 38 test
- Methods compared: 14 BaseModel methods
- Callers traced: 6 direct callers

### Pass #2

- Expert agents: 4
- Files analyzed: 25+ source, 38+ test, 12+ services
- Methods compared: 11 interface + 3 missing
- Coverage run: base.model.ts 77.4% lines / 60.36% branches

### Pass #3

- Expert agents: 5 (DB/Model code-reviewer, Service-layer code-reviewer, QA engineer, TypeScript/Node engineer, Cross-cutting tech-lead)
- Files analyzed: 40+ source files, 38+ test files, 50+ route files, all model subclasses, all service lifecycle hooks
- New findings: 27 (7 Critical, 8 High, 8 Medium, 4 Low)
- Key confirmations: services ARE singletons (question #1 answered), 5 subclass overrides drop tx, 20+ custom methods bypass tx
- Type audit: all `NodePgDatabase` usages, `withTransaction` callback type, 12 `as unknown` casts, `items as T[]` casts
- Cross-cutting: build/bundling, export maps, ADR coverage, observability gaps, security (SQL injection ruled out)

### Pass #4

- Expert agents: 5 (DB/Model code-reviewer, Service-layer code-reviewer, QA engineer, TypeScript type-safety engineer, Cross-cutting tech-lead)
- Files analyzed: 60+ source files, 38+ test files, 50+ route files, ALL model subclasses, ALL service files, billing services, exchange-rate model, notification services, revalidation services
- New findings: 30 (10 Critical, 12 High, 6 Medium, 2 Low)
- Existing gaps confirmed still open: ALL 49 prior gaps remain unresolved
- Key new findings: `db.query.*` tx propagation questionable (GAP-053-050), `require()` in ESM (061), `desc()` as `max()` bug (076), PostService.like non-atomic (054), billing TOCTOU (069), tx param unusable from production (063), tx-last-param unsustainable (060)
- Type-safety audit: `count()` SQL<number> vs string, `getClient()` return type lie, BaseModel<T> unconstrained, 5-step type erasure chain
- Architecture audit: confirmed tx param has ZERO production callers, billing services use completely different pattern, 50+ model methods with bare `getDb()`
