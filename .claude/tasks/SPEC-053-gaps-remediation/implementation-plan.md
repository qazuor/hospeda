# SPEC-053 Gaps Remediation — Implementation Plan

**Date**: 2026-04-01
**Total gaps**: 79 (3 false positives, 76 actionable)
**Architecture decision**: Context Object pattern for tx propagation (GAP-060)

---

## Phase 1: URGENT Fixes (Security, Runtime, Correctness)

**Dependencies**: None
**Estimated effort**: ~4 hours

| Gap | Description | File(s) | Complexity |
|-----|-------------|---------|------------|
| GAP-026 | `updateVisibility` phantom `{ id: '' }` — authorization bypass | `packages/service-core/src/base/base.crud.write.ts` (~371-376) | Trivial (15 min) |
| GAP-061 | `require()` in ESM — runtime failure | `packages/db/src/models/tag/rEntityTag.model.ts` (~127) | Trivial (5 min) |
| GAP-076 | `desc()` vs `max()` — incorrect exchange rates | `packages/db/src/models/exchange-rate/exchange-rate.model.ts` (~82-116) | Trivial (10 min) |
| GAP-054 | `PostService.like/unlike` non-atomic increment | `packages/service-core/src/services/post/post.service.ts` (~788-822), `packages/db/src/models/post/post.model.ts` | Low (1 hr) |
| GAP-059 | `_beforeUpdate` hierarchy corruption — N+1 without tx | `packages/service-core/src/services/destination/destination.service.ts` (~594), `packages/db/src/models/destination/destination.model.ts` (~535-594) | High (2 hr) |

**Gotchas**:

- GAP-059: Replace N+1 loop with batch SQL: `UPDATE ... SET path = REPLACE(path, oldPrefix, newPrefix) WHERE path LIKE oldPrefix || '%'`. Test with multi-level hierarchies.
- GAP-054: `decrementLikes` should use `GREATEST(likes - 1, 0)` to prevent negatives.

---

## Phase 2: Quick Code Fixes (Trivial/Low, One Pass)

**Dependencies**: None (can run parallel with Phase 1)
**Estimated effort**: ~4 hours

| Gap | Description | File(s) | Complexity |
|-----|-------------|---------|------------|
| GAP-001 | Update spec status to `completed` | `.claude/specs/SPEC-053-find-all-with-relations-tx/spec.md` | Trivial |
| GAP-002 | Delete `SupportsRelations<T>` dead interface | `packages/schemas/src/common/relations.schema.ts` (25-31) | Trivial |
| GAP-009 | Fix billing tx type to `typeof schema` | 2 billing service files | Low |
| GAP-015 | Replace `findAll + items.length` with `count()` | `destination.service.ts` (~773-777) | Low |
| GAP-020/030 | Wrap `logQuery`/`logError` in try-catch | `base.model.ts` (~618-627) | Trivial |
| GAP-033 | `buildWhereClause` accept `Table`, remove 12 casts | `drizzle-helpers.ts`, `base.model.ts` | Low |
| GAP-039 | Deduplicate `PaginatedListOutput<T>` to `@repo/schemas` | `relations.schema.ts`, `service-core/types/index.ts` | Low |
| GAP-040 | `Omit<PaginatedListOptions, 'relations'>` | `base.model.ts` | Low |
| GAP-041 | Fix `withTransaction` JSDoc example | `packages/db/src/client.ts` (~100-106) | Trivial |
| GAP-042 | Fix `create()` error handling pattern | `base.model.ts` | Trivial |
| GAP-046 | Remove redundant `?? {}` | `base.model.ts` | Trivial |
| GAP-047 | Move `transformRelationsForDrizzle` to module scope | `base.model.ts` | Trivial |
| GAP-048/049 | Fix CLAUDE.md tx example + UserModel.count() or vs ?? | `packages/db/CLAUDE.md`, `user.model.ts` | Trivial |
| GAP-079 | Add non-null assertion for allConditions[0] | `base.model.ts` | Trivial |
| GAP-069 | Re-validate expiration inside tx (defense-in-depth) | `promo-code.redemption.ts` (~301) | Low |

**Gotchas**:

- GAP-033: Run `pnpm typecheck` after removing casts.
- GAP-039: Verify `service-core` has `@repo/schemas` as dependency.

---

## Phase 3: Test Quality Improvements

**Dependencies**: Phase 2 complete (GAP-047, GAP-042 affect tests)
**Estimated effort**: ~8 hours

| Gap Group | Description | File(s) | Complexity |
|-----------|-------------|---------|------------|
| GAP-005/016/017/073/074 | Rewrite tx tests: `afterEach(vi.restoreAllMocks)`, `getDb` NOT called assertion, fix schema import, rich mocks, verify results | `find-all-with-relations-tx.test.ts` | Medium (3 hrs) |
| GAP-006/075 | Error path tests in tx context + `.toThrow(DbError)` | `find-all-with-relations-tx.test.ts`, `base.model.test.ts` (~571-621) | Low (1 hr) |
| GAP-007/021/045 | Param combination tests: tx + sorting, additionalConditions, MAX_PAGE_SIZE, nested relations | `base.model.test.ts` | Low (2 hrs) |
| GAP-035/036 | `count()` and `findAll()` with tx tests | `base.model.test.ts` | Low (1 hr) |
| GAP-043/044 | Merge tx tests into `base.model.test.ts`, fix commented pagination test | `base.model.test.ts`, delete `find-all-with-relations-tx.test.ts` | Medium (1 hr) |

**Gotchas**:

- GAP-017: After fixing schema import to `../../src/client`, verify mock structure satisfies types.
- GAP-044: Commented-out pagination test has a TODO UUID — investigate before uncommenting.

---

## Phase 4: Medium Fixes

**Dependencies**: Phase 1 and 2 complete. GAP-062 before Phase 6 SPECs.
**Estimated effort**: ~6 hours

| Gap | Description | File(s) | Complexity |
|-----|-------------|---------|------------|
| GAP-028 | Add stats recalc to `_afterHardDelete` in both review services | `accommodationReview.service.ts` (~347), `destinationReview.service.ts` (~304) | Low (30 min) |
| GAP-052 | Make `transformRelationsForDrizzle` recursive | `base.model.ts` (module scope after GAP-047) | Medium (1 hr) |
| GAP-056 | Fix `hardDelete` for soft-deleted entities | `base.crud.write.ts` (~255-256) | Low (30 min) |
| GAP-062 | Eliminate duplicate model stubs (accommodation, amenity) | `packages/db/src/models/accommodation.model.ts` (root), `packages/db/src/models/index.ts` | Medium (2 hrs) |
| GAP-077 | `DELETE ... RETURNING` in notification retention | `notification-retention.service.ts` (~69, ~102) | Low (30 min) |
| GAP-078 | Use `RevalidationLogModel` instead of `getDb()` | `revalidation-stats.service.ts` (~29) | Low (30 min) |

**Gotchas**:

- GAP-062: Before deleting stubs, verify no unique logic exists. Check all imports across codebase.
- GAP-056: Consider `{ force: true }` option instead of removing guard entirely.
- GAP-052: Add max-depth guard (e.g., 5 levels) to prevent infinite recursion.

---

## Phase 5: Documentation

**Dependencies**: Phase 1 (informs tx docs), Phase 2 (changes affect docs)
**Estimated effort**: ~3 hours

| Gap | Description | File(s) | Complexity |
|-----|-------------|---------|------------|
| GAP-037 | ADR-018: Transaction propagation convention + Context Object decision | `docs/decisions/ADR-018-transaction-propagation-pattern.md` (new) | Low (30 min) |
| GAP-038/070 | `inTransaction: !!tx` in logs + document count() type mismatch | `base.model.ts` (log calls, comment ~278) | Low (20 min) |
| GAP-011 | Document parallel findMany/count snapshot gap | `base.model.ts` (JSDoc), ADR-018 | Low (10 min) |
| GAP-022/031 | Document `db.query` cast + `items as T[]` known limitations | `base.model.ts` (comments at cast sites) | Low (15 min) |
| GAP-051 | Document base `findWithRelations` as stub | `base.model.ts` (JSDoc ~418-454) | Low (10 min) |
| GAP-053 | Document count/findMany mismatch for complex additionalConditions | `base.model.ts` (comment ~613, JSDoc) | Low (10 min) |
| GAP-027 | Improve error handling for constraint violation | `accommodationReview.service.ts`, `destinationReview.service.ts` | Low (20 min) |

**Note**: ADR-018 MUST be written BEFORE Phase 6 SPECs.

---

## Phase 6: New Formal SPECs

### Dependency Graph

```
ADR-018 (Phase 5, GAP-037)
    |
    v
SPEC-058 (BaseModel Interface Alignment)
    |
    +---> SPEC-059 (Service-Layer Transaction Support)
    |
    +---> SPEC-060 (Model Subclass Transaction Propagation)
    |
    v
SPEC-061 (DB Integration Tests) -- validates SPEC-058/059/060
    |
    v
SPEC-064 (Billing Transaction Safety) -- depends on SPEC-059 patterns
```

### SPEC-058: Align BaseModel Interface

**Gaps**: GAP-003, GAP-004, GAP-018, GAP-019, GAP-071, GAP-072
**Scope**: Add tx to 9 interface methods, add 3 missing methods, `implements` clause, `T extends Record<string, unknown>`, `DrizzleClient` union type, fix `getClient`/`withTransaction` return types, adopt Context Object pattern
**Key files**: `service-core/types/index.ts`, `base.model.ts`, `client.ts`
**Effort**: 2-3 days | **Risk**: Medium

### SPEC-059: Service-Layer Transaction Support & Concurrency Safety

**Gaps**: GAP-010, GAP-013/025, GAP-014, GAP-029, GAP-034, GAP-055, GAP-057, GAP-058, GAP-063, GAP-064, GAP-065
**Scope**: `ServiceContext` type, tx through BaseCrudService + lifecycle hooks, replace singleton mutable state with context-scoped, fix `runWithLoggingAndValidation`, fix cross-entity writes
**Key files**: `base.service.ts`, `base.crud.write.ts`, `base.crud.read.ts`, 6 services with mutable fields
**Effort**: 5-7 days | **Risk**: High | **Depends on**: SPEC-058

### SPEC-060: Model Subclass Transaction Propagation

**Gaps**: GAP-023, GAP-024, GAP-032, GAP-067, GAP-068
**Scope**: Add ctx to 5 `findWithRelations` overrides, fix LSP violation, sweep 50+ custom methods replacing `getDb()` with `this.getClient(ctx?.tx)`
**Key files**: All model files in `packages/db/src/models/` (30+ files)
**Effort**: 3-5 days | **Risk**: Medium | **Depends on**: SPEC-058

### SPEC-061: DB Integration Testing

**Gaps**: GAP-012, GAP-050
**Scope**: Integration test infra (Docker PostgreSQL), verify `tx.query.*`, test rollback, test concurrent isolation
**Key files**: New `packages/db/test/integration/`, Docker config
**Effort**: 3-4 days | **Risk**: Medium | **Parallel with**: SPEC-058/059/060

### SPEC-064: Billing Transaction Safety

**Gaps**: GAP-066
**Scope**: Migrate billing services from direct `getDb()` to model/tx pattern
**Key files**: All `packages/service-core/src/services/billing/` files
**Effort**: 5-7 days | **Risk**: High (financial) | **Depends on**: SPEC-059, SPEC-061

---

## Execution Timeline

| Week | Work |
|------|------|
| 1 | Phase 1 (URGENT) + Phase 2 (Quick fixes) in parallel |
| 1-2 | Phase 3 (Test quality) starts after Phase 2 |
| 2 | Phase 4 (Medium fixes) overlaps with Phase 3 |
| 2 | Phase 5 (Documentation) in parallel |
| 3 | Write SPEC-058, SPEC-061 |
| 3-4 | Implement SPEC-058 |
| 4 | Write SPEC-059, SPEC-060 |
| 4-5 | Implement SPEC-060 (after SPEC-058 done) |
| 5-6 | Implement SPEC-059 + SPEC-061 in parallel |
| 7 | Write and implement SPEC-064 |

---

## False Positives (No Implementation Needed)

| Gap | Reason |
|-----|--------|
| GAP-027 | DB unique constraint already exists (only improving error handling in Phase 5) |
| GAP-050 | `tx.query.*` works correctly (integration test in SPEC-061 for confidence) |
| GAP-069 | Pattern correct — minor defense-in-depth in Phase 2 |
| GAP-008 | Pre-existing coverage, tracked in SPEC-040 |
