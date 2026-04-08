# SPEC-049 Gaps Analysis: Admin List Filtering

> **Spec**: SPEC-049 - Admin List Filtering: adminList() Method for BaseCrudService
> **Status**: Approved, implementation ~85% complete (gaps remediation applied)
> **Last Audit**: Pass 10 (Remediation) - 2026-03-21

---

## Audit History

| Pass | Date | Auditor | Scope | Findings |
|------|------|---------|-------|----------|
| 1 | 2026-03-20 | 7 agents (DB, service-core, schemas/routes, error mapping, tests, frontend compat, sort format) | Full spec vs code exhaustive analysis | 10 gaps found (1 critical, 3 high, 3 medium, 3 low) |
| 2 | 2026-03-20 | 6 agents (DB layer, service-core, schemas+routes, frontend compat, test coverage, error handling+code quality) | Deep exhaustive re-audit with cross-referencing | 9 NEW gaps found (2 critical, 2 high, 3 medium, 2 low). Total: 19 gaps (3 critical, 5 high, 6 medium, 5 low) |
| 3 | 2026-03-20 | 6 agents (service-core deep, DB models, API routes, frontend sort/filter, schema-DB column audit, cross-layer) | Exhaustive cross-layer audit: schema fields vs DB columns, UserModel override, phantom fields, badge values, permission model, pagination double-extraction | 12 NEW gaps found (2 critical, 3 high, 4 medium, 3 low). Total: 31 gaps (5 critical, 8 high, 10 medium, 8 low) |
| 4 | 2026-03-20 | 6 agents (service-core deep, DB layer+models, schema-DB column verification, frontend compatibility, test coverage, route+API layer) | Exhaustive cross-layer Pass 4: Tailwind grid classes, empty response handling, type safety holes, post schema completeness, buildWhereClause logging, test infrastructure, count() consistency | 15 NEW gaps found (1 critical, 1 high, 7 medium, 6 low). Total: 46 gaps (6 critical, 9 high, 17 medium, 14 low) |
| 5 | 2026-03-20 | 6 agents (service-core deep, DB models deep, schemas+routes, frontend compat, test coverage+type safety, cross-layer integration) + 1 verification agent | Deep cross-layer Pass 5: UserModel.count() bug, findAllWithRelations tx gap, Tailwind space bug, numeric() type fragility, false positive resolution (4 services confirmed wired, CONFIGURATION_ERROR confirmed in enum). Resolved contradictions. | 4 NEW gaps found (1 high, 2 medium, 1 low) + 2 UPGRADES + 2 CORRECTIONS + 1 FALSE POSITIVE resolved. Total: 50 gaps (6 critical, 10 high, 19 medium, 15 low) |
| 6 | 2026-03-20 | 4 agents (Phase 0 prereqs, Phase 1-3 infra, Phase 4-6 services/routes, code quality/edge cases) | Full end-to-end re-verification: Phase 0-8 implementation status, all 16 service overrides code review, all 16 route code review, SQL injection analysis, type safety audit, count() migration completeness, error handling paths, schema consistency, test gap quantification | 2 NEW gaps found (1 medium, 1 low) + comprehensive status confirmation. All 50 prior gaps re-validated. Total: 52 gaps (6 critical, 10 high, 20 medium, 16 low) |
| 7 | 2026-03-20 | 5 agents (service-core deep audit, DB models audit, schemas+routes audit, frontend compat audit, test coverage audit) | Fresh independent audit by 5 expert agents: each agent read all relevant files from scratch without knowledge of prior gaps. Cross-validated all 52 prior findings. Found 2 NEW gaps, refined 3 existing gap details, confirmed all prior gaps still open. Quantified test coverage at ~20% with 167 schema tests vs 0 service/integration tests. | 2 NEW gaps found (1 medium, 1 low) + 3 refinements. Total: 54 gaps (6 critical, 10 high, 21 medium, 17 low) |
| 8 | 2026-03-20 | 5 expert agents (service-core code-reviewer, DB models code-reviewer, schemas+routes code-reviewer, frontend compat code-reviewer, test coverage code-reviewer) | Fresh independent Pass 8: Each agent read all relevant source files from scratch. Discovered adminList() validation order bug, pre-existing `limit` vs `pageSize` bugs in 2 services, EventService._beforeCreate data loss, review schema .int() on decimal column, import type inconsistency. Cross-validated all 54 prior gaps. | 7 NEW gaps found (1 high, 4 medium, 2 low) + 4 refinements to existing gaps. Total: 61 gaps (6 critical, 11 high, 25 medium, 19 low) |
| 9 | 2026-03-20 | 4 specialized agents (spec analyzer, code analyzer, gap verifier, frontend deep auditor) | Independent cross-validation Pass 9: 4 agents read ALL source files independently. Verified all 61 prior gaps remain open. Confirmed sort JSON.stringify mismatch end-to-end (regex rejects JSON array at Zod validation). Confirmed UserModel.findAll() `_additionalConditions` bug. Confirmed 6/16 services with overrides. Verified count() migration complete. Verified queryBooleanParam correctly used. Confirmed q->search mapping works. Found 2 NEW gaps, 3 refinements. | 2 NEW gaps found (1 medium, 1 low) + 3 refinements. Total: 63 gaps (6 critical, 11 high, 26 medium, 20 low) |
| 10 | 2026-03-21 | 10 specialized agents across 6 phases (A: UserModel+infra, B: schemas, C: services, D: frontend, E: code quality, F: tests) | **REMEDIATION PASS**: Full implementation of fixes for 63 gaps across 6 phases. 43 gaps RESOLVED, 5 NOT REAL BUGS, 8 DEFERRED to separate specs, 4 DOC-ONLY, 3 REMAINING (tests). Typecheck clean (except pre-existing service-core test error). All schema/db/admin tests pass. | 43 gaps RESOLVED. 8 DEFERRED. 5 FALSE POSITIVES. 4 DOC-ONLY. 3 remaining (GAP-002 adminList unit tests, GAP-003 integration tests, GAP-044 test infra). Implementation ~85% complete. |

---

## Summary

SPEC-049 implementation is approximately **85% complete** after Pass 10 remediation (up from 40-45%). All critical and high-severity code gaps have been resolved. Remaining work is limited to service-core unit tests (GAP-002), integration tests (GAP-003), and test infrastructure (GAP-044).

**Pass 10 REMEDIATION outcomes (2026-03-21):**
- **43 gaps RESOLVED** via code changes across 6 phases (A-F)
- **5 gaps confirmed NOT REAL BUGS** (GAP-014 already working, GAP-004 toString correct, GAP-012 subsumed by GAP-020, GAP-056/057 limit vs pageSize already correct)
- **8 gaps DEFERRED** to separate specs (GAP-025, 027, 036, 048, 046, 008, 050, 030)
- **4 gaps DOC-ONLY** (GAP-010, 029, 063, 043 - documented via JSDoc)
- **3 gaps REMAINING** (GAP-002 adminList unit tests, GAP-003 integration tests, GAP-044 test infrastructure)

**Gaps resolved by phase:**
- **Phase A** (infra): GAP-021, 047, 035, 034, 017, 055, 053, 019 (UserModel bugs, buildWhereClause logging, adminList validation, type safety)
- **Phase B** (schemas): GAP-020, 022, 033, 060, 015, 052, 061, 037, 038 (phantom fields removed, type mismatches fixed, DRY)
- **Phase C** (services): GAP-023, 059, 058, 042 (getSearchableColumns overrides, EventService data loss, DRY type, count consistency)
- **Phase D** (frontend): GAP-001, 054, 062, 040, 032, 049, 013, 024, 009, 026, 039 (sort format, Tailwind grid, entity filters, badges, filter names, empty response)
- **Phase E** (quality): GAP-041, 018, 031, 045, 011, 016, 043 (parseAdminSort validation, date range docs, unbounded query, Zod error context, service override JSDoc)
- **Phase F** (tests): GAP-005, 007, 051, 006 (review schema tests, OR search regression, buildWhereClause tests)

**Phase completion status (updated Pass 10):**
- **Phase 0**: 100% COMPLETE
- **Phase 1**: 100% COMPLETE (UserModel bugs FIXED, count() consistency FIXED, type safety FIXED)
- **Phase 2**: 100% COMPLETE (OR search fix + regression test added)
- **Phase 3**: 100% COMPLETE (adminList validation order FIXED, deletedAt guard added)
- **Phase 4**: 100% COMPLETE
- **Phase 5**: 100% COMPLETE (all 16 services wired, 6 with overrides, 10 documented with JSDoc, all 11 getSearchableColumns overrides added)
- **Phase 6**: 100% COMPLETE
- **Phase 7**: ~60% COMPLETE (schema tests added, DB layer tests added, service-core unit tests REMAINING)
- **Phase 8**: 0% COMPLETE (integration tests REMAINING)

**All critical and high findings RESOLVED in Pass 10:**
1. ~~10 services missing overrides~~ **RESOLVED**: 10 services documented with JSDoc (default works correctly after phantom field removal)
2. ~~eventLocation range filter BUG~~ **RESOLVED**: Phantom fields removed (GAP-020)
3. ~~Frontend EntityQueryParams no entity-specific filters~~ **RESOLVED**: `filters` field added (GAP-013)
4. ~~defaultFilters not applied~~ **RESOLVED in Pass 5**: Was already working
5. ~~includeDeleted not using queryBooleanParam~~ **RESOLVED**: Replaced with queryBooleanParam (GAP-015)
6. ~~Test coverage ~20%~~ **IMPROVED to ~50%**: Schema + DB tests added. Service-core unit tests + integration tests REMAINING
7. ~~9 phantom schema fields~~ **RESOLVED**: All removed or corrected (GAP-020)
8. ~~UserModel drops additionalConditions~~ **RESOLVED**: findAll, count, findAllWithCounts all fixed (GAP-021, 047, 035)
9. ~~Tag color hex vs enum~~ **RESOLVED**: Uses TagColorEnumSchema now (GAP-022)
10. ~~Sponsorship badge case~~ **RESOLVED**: Lowercase values (GAP-024)
11. ~~getSearchableColumns never overridden~~ **RESOLVED**: 11 services with custom overrides (GAP-023)
12. ~~Tailwind dynamic grid classes~~ **RESOLVED**: Static gridColsMap (GAP-032, 049)
13. ~~destinationReview inherits status~~ **RESOLVED**: status always resolves to 'all' (GAP-033)
14. ~~Test infrastructure absent~~ **PARTIALLY RESOLVED**: Schema + DB test infra done. Service-core test infra REMAINING

**Remaining open items (3 gaps):**
1. **GAP-002**: adminList() service-core unit tests (0%)
2. **GAP-003**: Integration tests for 16 admin routes (0%)
3. **GAP-044**: Service-core test infrastructure/helpers

**Deferred to separate specs (8 gaps):**
- GAP-025 (lifecycleState modeling), GAP-027 (_canAdminList hook), GAP-036 (entityFilters generics)
- GAP-048 (findAllWithRelations tx), GAP-046 (defaultFilters UI), GAP-008 (LIKE wildcard escaping)
- GAP-050 (numeric() returns strings), GAP-030 (response schema consistency)

---

## CRITICAL GAPS

---

## GAP-049-001: Sort Format Mismatch (Frontend vs Backend) [CRITICAL]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2
**Severity**: CRITICAL
**Priority**: P0
**Complexity**: Low (2)

### Description

The admin frontend sends sort as a JSON-stringified array (`sort=[{"id":"name","desc":false}]`) but the backend `AdminSearchBaseSchema` validates sort as a regex string (`/^[a-zA-Z_]+:(asc|desc)$/`). This means **ALL admin sorting fails silently** or returns a VALIDATION_ERROR.

### Evidence

- **Backend** (`packages/schemas/src/common/admin-search.schema.ts` lines 61-68): `sort: z.string().regex(/^[a-zA-Z_]+:(asc|desc)$/)`
- **Frontend** (`apps/admin/src/components/entity-list/api/createEntityApi.ts` line 59): `params.set('sort', JSON.stringify(sort))` where sort is `SortConfig[]`
- **parseAdminSort** (`packages/schemas/src/common/admin-search.schema.ts` lines 117-120): Splits on `:` expecting `"field:dir"` format

### Impact

ALL 16 admin list routes silently fail on sorting. Sort param falls back to default `'createdAt:desc'` or returns 400 error.

### Proposed Solutions

**Option A (recommended): Fix frontend to send `field:dir` format**
- Modify `createEntityApi.ts` to transform `SortConfig[]` -> `"field:dir"` string before sending
- Pros: No backend changes, aligns with spec
- Cons: Frontend change needed
- Complexity: 1

**Option B: Accept both formats in backend**
- Use `z.preprocess()` to detect JSON array vs string format and normalize
- Pros: Backward compatible
- Cons: More complex validation, deviates from spec
- Complexity: 3

### Recommendation

**Fix directly in SPEC-049 with Option A.** This is a missing step in the current implementation.

---

## GAP-049-011: 10 Services Missing _executeAdminSearch() Override [CRITICAL]

**Found in**: Audit Pass 2
**Severity**: CRITICAL
**Priority**: P0
**Complexity**: Medium (5)

### Description

The spec requires all 16 services to have `_executeAdminSearch()` overrides. Only 6 services implement them. The remaining 10 rely on the default base implementation, which treats entity-specific filters as direct `where` clause matches. This works "by accident" for simple column filters but **FAILS for range filters** (see GAP-049-012).

### Missing Overrides

| # | Service | Entity-Specific Filters | Works With Default? |
|---|---------|------------------------|-------------------|
| 1 | amenity | `category`, `isBuiltin` | Yes (direct columns) |
| 2 | attraction | `destinationId`, `category`, `isFeatured` | Yes (direct columns) |
| 3 | destination | `parentDestinationId`, `destinationType`, `level`, `isFeatured` | Yes (direct columns) |
| 4 | **eventLocation** | `city`, `minCapacity`, `maxCapacity`, `isVerified` | **NO - minCapacity/maxCapacity are range filters** |
| 5 | eventOrganizer | `isVerified` | Yes (direct column) |
| 6 | feature | `category`, `isBuiltin` | Yes (direct columns) |
| 7 | ownerPromotion | `accommodationId`, `ownerId`, `discountType`, `isActive` | Yes (direct columns) |
| 8 | post | `category`, `authorId`, `isFeatured`, `isNews`, `relatedDestinationId` | Yes (direct columns) |
| 9 | postSponsor | `type` | Yes (direct column) |
| 10 | tag | `color` | Partial (regex not enforced) |

### Services WITH Override (correct)

| Service | Handles | Status |
|---------|---------|--------|
| accommodation | JSONB price extraction (`->>'price'`) | MATCHES_SPEC |
| accommodationReview | `minRating`/`maxRating` via `gte()/lte()` on `averageRating` | MATCHES_SPEC |
| destinationReview | `minRating`/`maxRating` via `gte()/lte()` on `averageRating` | MATCHES_SPEC |
| event | JSONB date extraction (`->>'start'`, `->>'end'`) with `::timestamptz` | MATCHES_SPEC |
| sponsorship | Maps `sponsorshipStatus` -> `status` DB column | MATCHES_SPEC |
| user | `ilike(email, '%${email}%')` for partial match | MATCHES_SPEC |

### Impact

- 9 services work "by accident" with the default implementation but violate the spec's explicit pattern requirement
- 1 service (eventLocation) has a **runtime BUG** (see GAP-049-012)
- Maintenance risk: future changes to base `_executeAdminSearch()` could break services that depend on the current default behavior
- Inconsistent codebase: some services have explicit overrides, others don't

### Proposed Solutions

**Option A (recommended): Add overrides for all 10 services**
- For 9 "simple" services: override that calls `super._executeAdminSearch()` with a comment explaining why no custom logic needed
- For eventLocation: full override with `gte()/lte()` for capacity range
- Complexity: 4 (mostly boilerplate, eventLocation needs SQL logic)

**Option B: Only add override for eventLocation + document pattern**
- Fix the bug, document that services with only direct-column filters can rely on default
- Pros: Less code
- Cons: Deviates from spec, inconsistent pattern
- Complexity: 2

### Recommendation

**Fix directly in SPEC-049 with Option A.** The spec explicitly requires all 16 overrides. The consistency benefit outweighs the boilerplate cost. At minimum, eventLocation MUST be fixed (it's a bug).

---

## GAP-049-012: eventLocation minCapacity/maxCapacity Range Filter BUG [CRITICAL]

**Found in**: Audit Pass 2
**Severity**: CRITICAL
**Priority**: P0
**Complexity**: Low (2)

### Description

`EventLocationService` has `minCapacity` and `maxCapacity` in its `AdminSearchSchema` but NO `_executeAdminSearch()` override. The default base implementation treats these as direct `where` clause matches (equality check), not range comparisons. This means:

- `?minCapacity=100` would try to find locations WHERE capacity = 100, not WHERE capacity >= 100
- `?maxCapacity=500` would try to find locations WHERE capacity = 500, not WHERE capacity <= 500

### Evidence

- **Schema** (`packages/schemas/src/entities/eventLocation/eventLocation.admin-search.schema.ts`): Defines `minCapacity`, `maxCapacity` as `z.coerce.number().positive().optional()`
- **Service** (`packages/service-core/src/services/eventLocation/eventLocation.service.ts` line 52): `adminSearchSchema` is set but NO `_executeAdminSearch()` override exists
- **Base impl** (`packages/service-core/src/base/base.crud.read.ts` line 432): Merges entity filters into `where` as direct column matches

### Impact

Admin filtering of event locations by capacity **silently produces wrong results**. A filter for "locations with capacity >= 100" would return only locations with EXACTLY 100 capacity (or none, if `minCapacity` isn't a real DB column name).

### Proposed Solution

Add `_executeAdminSearch()` override to `EventLocationService`:

```ts
protected override async _executeAdminSearch(params: AdminSearchParams): Promise<Result<PaginatedListOutput<EventLocation>>> {
    const { entityFilters, ...rest } = params;
    const { minCapacity, maxCapacity, ...directFilters } = entityFilters;
    const extraConditions: SQL[] = [];

    if (minCapacity !== undefined) {
        extraConditions.push(gte(eventLocationTable.capacity, minCapacity));
    }
    if (maxCapacity !== undefined) {
        extraConditions.push(lte(eventLocationTable.capacity, maxCapacity));
    }

    return super._executeAdminSearch({
        ...rest,
        entityFilters: directFilters,
        extraConditions: [...(rest.extraConditions || []), ...extraConditions],
    });
}
```

### Recommendation

**Fix directly in SPEC-049.** This is a runtime bug, not a design issue.

---

## HIGH GAPS

---

## GAP-049-002: Missing Unit Tests for adminList() and _executeAdminSearch() [HIGH]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2 (test coverage agent found 0 tests)
**Severity**: HIGH
**Priority**: P1
**Complexity**: High (7)

### Description

Zero test coverage exists for the core `adminList()` method and `_executeAdminSearch()` overrides. The spec requires 10+ unit test files that don't exist.

### Missing Test Files

| # | Required Test File | Status |
|---|-------------------|--------|
| 1 | `packages/service-core/test/base/crud/adminList.test.ts` | MISSING |
| 2 | `packages/service-core/test/services/accommodation/adminList.test.ts` | MISSING |
| 3 | `packages/service-core/test/services/event/adminList.test.ts` | MISSING |
| 4 | `packages/service-core/test/services/accommodationReview/adminList.test.ts` | MISSING |
| 5 | `packages/service-core/test/services/destinationReview/adminList.test.ts` | MISSING |
| 6 | `packages/service-core/test/services/user/adminList.test.ts` | MISSING |
| 7 | `packages/service-core/test/services/sponsorship/adminList.test.ts` | MISSING |

### Required Coverage (per spec)

- Sort parsing from compound string
- Invalid sort field returns VALIDATION_ERROR
- Status filter mapping (status=ACTIVE -> lifecycleState=ACTIVE, status=all -> no filter)
- includeDeleted=false adds deletedAt=null, includeDeleted=true skips it
- createdAfter/Before mapped to _gte/_lte
- Search uses OR condition
- Permission check calls _canList
- Missing adminSearchSchema throws CONFIGURATION_ERROR
- Entity filters passed through to _executeAdminSearch
- Per-service JSONB extraction (price, dates, ratings)
- Per-service column renames (sponsorshipStatus)
- Per-service partial match (email ilike)

### Impact

Without tests, there's no regression safety net. Any future change to BaseCrudRead could break all 16 admin list routes undetected. The sort format mismatch (GAP-049-001) would have been caught by tests.

### Recommendation

Fix directly in SPEC-049 Phase 7. Tests are mandatory per project standards ("No tests = not done").

---

## GAP-049-003: Missing Integration Tests for Admin List Routes [HIGH]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2
**Severity**: HIGH
**Priority**: P1
**Complexity**: High (8)

### Description

Zero integration tests exist for any of the 16 admin list routes. The spec requires 8 integration test files.

### Missing Test Files

| # | Required Test File | Status |
|---|-------------------|--------|
| 1 | `apps/api/test/routes/admin/accommodation-list.test.ts` | MISSING |
| 2 | `apps/api/test/routes/admin/event-list.test.ts` | MISSING |
| 3 | `apps/api/test/routes/admin/user-list.test.ts` | MISSING |
| 4 | `apps/api/test/routes/admin/amenity-list.test.ts` | MISSING |
| 5 | `apps/api/test/routes/admin/accommodation-review-list.test.ts` | MISSING |
| 6 | `apps/api/test/routes/admin/destination-review-list.test.ts` | MISSING |
| 7 | `apps/api/test/routes/admin/destination-list.test.ts` | MISSING |
| 8 | `apps/api/test/routes/admin/sponsorship-list.test.ts` | MISSING |

### Impact

No end-to-end validation that filters, sort, search, and pagination work correctly through the full HTTP -> route -> service -> DB pipeline.

### Recommendation

Fix directly in SPEC-049. At minimum, implement accommodation and sponsorship integration tests first (they exercise the most complex code paths).

---

## GAP-049-013: Frontend EntityQueryParams Doesn't Support Entity-Specific Filters [HIGH]

**Found in**: Audit Pass 2
**Severity**: HIGH
**Priority**: P1
**Complexity**: Medium (5)

### Description

The frontend's generic entity list system was built BEFORE SPEC-049's entity-specific admin search schemas. The `EntityQueryParams` type only supports 4 generic parameters (`page`, `pageSize`, `q`, `sort`) and has NO mechanism to accept entity-specific filters like `sponsorshipStatus`, `destinationType`, `includeDeleted`, `minRating`, etc.

### Evidence

- **EntityQueryParams** (`apps/admin/src/components/entity-list/types.ts` lines 150-155):
  ```ts
  export type EntityQueryParams = {
      readonly page: number;
      readonly pageSize: number;
      readonly q?: string;
      readonly sort?: readonly SortConfig[];
  };
  ```
  No fields for entity-specific filters.

- **createEntityApi** (`apps/admin/src/components/entity-list/api/createEntityApi.ts` lines 44-60): Only maps these 4 params to query string.

- **EntityListPage** (`apps/admin/src/components/entity-list/EntityListPage.tsx` lines 198-203): Only passes these 4 params to `useEntityQuery`.

### Impact

**ALL entity-specific admin filters are impossible to use from the frontend UI.** The backend correctly processes them, but the frontend never sends them. This makes the entire entity-specific filtering feature unusable from the admin panel.

### Proposed Solutions

**Option A (recommended): Extend EntityQueryParams with generic filters Record**
```ts
export type EntityQueryParams = {
    readonly page: number;
    readonly pageSize: number;
    readonly q?: string;
    readonly sort?: readonly SortConfig[];
    readonly filters?: Record<string, string | number | boolean | undefined>;
};
```
- Update `createEntityApi` to serialize all filter entries as query params
- Update `EntityListPage` to pass entity-specific filters from config/UI
- Complexity: 3

**Option B: Per-entity custom API functions**
- Each entity defines its own API function with typed params
- Pros: Type-safe per entity
- Cons: Lots of boilerplate, breaks generic pattern
- Complexity: 7

### Recommendation

**Fix directly in SPEC-049 with Option A.** This is essential for the feature to be usable. Without this, the backend implementation is correct but unreachable from the UI.

---

## GAP-049-014: Frontend defaultFilters Defined But Never Applied [HIGH]

**Found in**: Audit Pass 2
**Severity**: HIGH
**Priority**: P1
**Complexity**: Low (2)

### Description

Several entity config files define `defaultFilters` that are NEVER applied to API requests. The `EntityListPage` component ignores the `defaultFilters` property entirely.

### Evidence

- **destinations.config.ts** line 19: `defaultFilters: { destinationType: 'CITY' }` .. never applied
- **createEntityApi.ts** has a `defaultFilters` parameter in its function signature but the main `getEntities` function only sends `page`, `pageSize`, `q`, `sort`

### Impact

Entity list pages that define default filters (like destinations defaulting to type=CITY) silently show unfiltered results. The configuration exists but has no effect.

### Proposed Solution

Wire `defaultFilters` from entity config through `EntityListPage` -> `useEntityQuery` -> `createEntityApi.getEntities`. Merge default filters with any user-selected filters, with user selections taking precedence.

### Recommendation

**Fix directly in SPEC-049.** This is a frontend wiring issue, directly related to the entity-specific filter support added by this spec.

---

## MEDIUM GAPS

---

## GAP-049-004: Rating Comparison Uses .toString() Instead of Direct Number [MEDIUM]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

Both `AccommodationReviewService` and `DestinationReviewService` convert rating numbers to strings before passing to `gte()`/`lte()`. The spec says to pass the number directly.

### Technical Context

Drizzle's `numeric()` type maps to `string` in TypeScript. So `.toString()` is actually correct for type compatibility. However, it could cause edge cases with locale-specific number formatting.

### Recommendation

Fix directly in SPEC-049 with a JSDoc comment explaining the `.toString()` rationale. Low effort.

---

## GAP-049-005: Missing Schema-Level Unit Tests [MEDIUM]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Medium (3)

### Description

Missing schema tests:

| # | Required Test | Status |
|---|--------------|--------|
| 1 | `packages/schemas/test/enums/service-error-code.test.ts` - CONFIGURATION_ERROR exists | MISSING |
| 2 | `packages/schemas/test/entities/tag/admin-search.test.ts` - nameContains removed | MISSING |
| 3 | `packages/schemas/test/entities/accommodation-review/admin-search.test.ts` - boolean coercion | MISSING |

**Note (Pass 2)**: Schema tests for AdminSearchBaseSchema DO exist and are comprehensive (30+ tests). Per-entity admin search schema tests also exist in grouped files (group-a, group-b, group-c). The missing items above are specific edge cases not covered by the grouped tests.

### Recommendation

Fix directly in SPEC-049.

---

## GAP-049-006: Missing DB Layer Tests for additionalConditions [MEDIUM]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Medium (3)

### Description

No unit tests for `findAll()`, `count()`, or `findAllWithRelations()` with `additionalConditions` parameter. Also, `base.model.test.ts` uses mocked tables instead of real Drizzle tables (tests are superficial).

### Recommendation

Fix directly in SPEC-049. Add tests to `packages/db/test/models/base.model.test.ts`.

---

## GAP-049-015: includeDeleted Doesn't Use queryBooleanParam() [MEDIUM]

**Found in**: Audit Pass 2
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

The spec requires `includeDeleted` in `AdminSearchBaseSchema` to use `queryBooleanParam()`. The actual implementation uses a custom `z.preprocess()`:

```ts
// Actual (admin-search.schema.ts lines 83-86)
includeDeleted: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(false)

// Spec requires
includeDeleted: queryBooleanParam()
```

### Differences

| Input | queryBooleanParam() | Current impl |
|-------|-------------------|--------------|
| `"true"` | `true` | `true` |
| `"false"` | `false` | `false` |
| `"1"` | `true` | **`false`** |
| `""` | `undefined` | **`false`** |
| `null` | `undefined` | **`false`** |
| `undefined` | `undefined` | **`false`** |

### Impact

Functional difference for `"1"` input (which `queryBooleanParam` accepts as true but current impl doesn't). The `.default(false)` vs `.optional()` difference means the service always receives a boolean value rather than potentially `undefined`.

### Proposed Solutions

**Option A (recommended): Replace with queryBooleanParam().default(false)**
- `includeDeleted: queryBooleanParam().pipe(z.boolean().default(false))`
- Aligns with spec, keeps `.default(false)` behavior
- Complexity: 1

**Option B: Keep current implementation, update spec**
- Current impl is simpler and sufficient
- Document deviation
- Complexity: 0

### Recommendation

**Fix directly in SPEC-049 with Option A** for consistency, or **Option B** if the spec is updated to document the deviation. Low impact either way.

---

## GAP-049-016: Entity Schema Field Name Deviations from Spec [MEDIUM]

**Found in**: Audit Pass 2
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

Three entity admin search schemas use different field names than what the spec defines:

| Entity | Spec Field | Actual Field | File |
|--------|-----------|-------------|------|
| amenity | `categoryId` | `category` | `packages/schemas/src/entities/amenity/amenity.admin-search.schema.ts` |
| feature | `categoryId` | `category` | `packages/schemas/src/entities/feature/feature.admin-search.schema.ts` |
| attraction | `type` | `category` | `packages/schemas/src/entities/attraction/attraction.admin-search.schema.ts` |

### Impact

Low functional impact .. the actual field names match the database column names (which use `category`, not `categoryId`). The spec had incorrect field names. This is a **spec inaccuracy**, not an implementation bug.

### Proposed Solutions

**Option A (recommended): Update the spec to match the implementation**
- The implementation correctly uses DB column names
- Complexity: 0

**Option B: Rename to match spec**
- Would require renaming DB columns, which is incorrect
- NOT recommended

### Recommendation

**Update spec to reflect actual column names.** No code change needed.

---

## GAP-049-017: deletedAt Column Existence Not Checked at Runtime [MEDIUM]

**Found in**: Audit Pass 2
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (2)

### Description

When `includeDeleted=false`, the code sets `where.deletedAt = null`. If a table doesn't have a `deletedAt` column, this will result in a database query error (not a validation error). The `billing_subscription_addons` table is documented as having no `deletedAt` column.

### Evidence

```ts
// base.crud.read.ts lines 367-369
if (!includeDeleted) {
    where.deletedAt = null;
}
```

### Impact

Currently LOW because `adminList()` is only used on the 16 entities that all have soft delete. But if `adminList()` is extended to other entities in the future, this would cause runtime errors.

### Proposed Solutions

**Option A (recommended): Add runtime column check**
```ts
if (!includeDeleted && Object.prototype.hasOwnProperty.call(tableRecord, 'deletedAt')) {
    where.deletedAt = null;
}
```
- Complexity: 1

**Option B: Document as known limitation**
- Add comment noting all current entities have deletedAt
- Complexity: 0

### Recommendation

**Fix directly in SPEC-049 with Option A.** Defensive programming that prevents future runtime errors. Very low effort.

---

## LOW GAPS

---

## GAP-049-007: list() Search OR Fix Regression Test Missing [LOW]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (1)

### Description

The spec requires a regression test in `packages/service-core/test/base/crud/list.test.ts` verifying that the search OR fix works. The test file exists with 6 tests but has no explicit test case for OR search behavior.

### Recommendation

Fix directly in SPEC-049. Add 1-2 test cases to existing list.test.ts file.

---

## GAP-049-008: LIKE Wildcard Characters Not Escaped in Search [LOW]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (2)

### Description

The `buildSearchCondition()` function uses `ilike(column, '%${trimmedTerm}%')` without escaping `%` and `_` characters. Spec explicitly documents this as a known limitation.

### Recommendation

**Defer to a separate spec** (or micro-fix). Not blocking for SPEC-049 completion.

---

## GAP-049-009: Sponsorship Admin Filter Name Mismatch with Frontend [LOW]

**Found in**: Audit Pass 1 | **Confirmed in**: Pass 2
**Severity**: LOW (but blocking for sponsorship filtering)
**Priority**: P3
**Complexity**: Low (1)

### Description

Frontend's SponsorshipsTab sends `status` but backend expects `sponsorshipStatus`. Sponsorship status filtering is silently broken.

### Recommendation

**Fix directly in SPEC-049** by updating frontend to send `sponsorshipStatus`. Subsumes into GAP-049-013 (frontend entity-specific filter support).

---

## GAP-049-010: UserService _executeAdminSearch Bypasses Default Pattern [LOW]

**Found in**: Audit Pass 1
**Severity**: LOW
**Priority**: P4
**Complexity**: N/A (informational)

### Description

UserService's `_executeAdminSearch()` calls `this.model.findAll()` directly instead of `super._executeAdminSearch()`. Spec documents this as intentional.

### Recommendation

No fix needed. **Informational only.**

---

## GAP-049-020: 9 Phantom Schema Fields Reference Non-Existent DB Columns [CRITICAL]

**Found in**: Audit Pass 3
**Severity**: CRITICAL
**Priority**: P0
**Complexity**: Medium (4)

### Description

Multiple entity AdminSearchSchemas define filter fields that reference DB columns that DO NOT EXIST. These filters will either silently fail (ignored by `buildWhereClause`) or cause runtime DB errors.

### Evidence

| # | Entity | Schema Field | Expected Column | Actual DB State |
|---|--------|-------------|-----------------|-----------------|
| 1 | **Amenity** | `category` | `category` | Column is `type` (AmenitiesTypePgEnum) |
| 2 | **Attraction** | `destinationId` | `destination_id` | Does not exist (relation via join table `r_destination_attraction`) |
| 3 | **Attraction** | `category` | `category` | Does not exist (table has no category/type column) |
| 4 | **Feature** | `category` | `category` | Does not exist (table has no category/type column) |
| 5 | **AccommodationReview** | `isVerified` | `is_verified` | Does not exist |
| 6 | **DestinationReview** | `isVerified` | `is_verified` | Does not exist |
| 7 | **EventOrganizer** | `isVerified` | `is_verified` | Does not exist |
| 8 | **EventLocation** | `minCapacity`/`maxCapacity` | `capacity` | Does not exist |
| 9 | **EventLocation** | `isVerified` | `is_verified` | Does not exist |

### Impact

- **Amenity**: Filtering by `category` silently fails .. should be `type` using `AmenitiesTypeEnumSchema`
- **Attraction**: Filtering by `destinationId` silently fails .. would require a JOIN through `r_destination_attraction`, cannot be a simple column filter
- **Attraction/Feature**: `category` silently fails .. these entities have no categorization column
- **Reviews/EventOrganizer/EventLocation**: `isVerified` silently fails .. verification columns were never added to these tables
- **EventLocation**: `minCapacity`/`maxCapacity` silently fails .. `capacity` column was never added (also see GAP-049-012)

### Proposed Solutions

**Option A (recommended): Remove phantom fields, fix mismatched names**
- **Amenity**: Rename `category` to `type` using `AmenitiesTypeEnumSchema`
- **Attraction**: Remove `destinationId` (needs JOIN, not simple filter) and `category` (doesn't exist)
- **Feature**: Remove `category` (doesn't exist)
- **Reviews/EventOrganizer/EventLocation**: Remove `isVerified` (column doesn't exist)
- **EventLocation**: Remove `minCapacity`/`maxCapacity` (column doesn't exist .. subsumes GAP-049-012)
- Complexity: 2

**Option B: Add missing columns via migration**
- Add `is_verified` to reviews, event_organizers, event_locations
- Add `capacity` to event_locations
- Add `category` or `type` to attractions and features
- Pros: Schema fields become real filters
- Cons: Significant DB migration, needs product decision
- Complexity: 7

### Recommendation

**Fix directly in SPEC-049 with Option A.** Remove phantom fields now. If the product team later wants these filter capabilities, they should be a SEPARATE spec that includes the DB migration.

---

## GAP-049-021: UserModel.findAll() Drops additionalConditions [CRITICAL]

**Found in**: Audit Pass 3
**Severity**: CRITICAL
**Priority**: P0
**Complexity**: Medium (3)

### Description

`UserModel` overrides `findAll()` and explicitly IGNORES the `additionalConditions` parameter (prefixed with `_`). This means that when `adminList()` builds additional SQL conditions (text search from `buildSearchCondition`, status filters), they are silently discarded for the user entity.

### Evidence

- **UserModel.findAll()** (`packages/db/src/models/user/user.model.ts` line 32): `_additionalConditions?: SQL[]` .. underscore prefix = intentionally unused
- **UserModel.count()** (`packages/db/src/models/user/user.model.ts` lines 84-123): When `where.q` exists, ignores `options?.additionalConditions`
- **UserService._executeAdminSearch()** (`packages/service-core/src/services/user/user.service.ts` line 396): Properly builds conditions and passes to `this.model.findAll()` .. but model discards them

### Impact

**Admin user list filters partially broken:**
- `search` param text search: Admin search builds `buildSearchCondition()` and passes as `additionalConditions` .. **SILENTLY IGNORED** by UserModel
- `status` (lifecycle) filter: Passed via `where.lifecycleState` which IS in the where object, so this WORKS
- `includeDeleted`: Passed via `where.deletedAt` which IS in the where object, so this WORKS
- `email` filter: Handled by UserService override BEFORE calling findAll, so this WORKS
- `role` filter: Passed via `where.role` which IS in the where object, so this WORKS
- `createdAfter`/`createdBefore`: Passed via `where.createdAt_gte/_lte` which buildWhereClause handles, so this WORKS

**Net impact: Text search on users is broken when using adminList().**

### Proposed Solutions

**Option A (recommended): Fix UserModel.findAll() to use additionalConditions**
```ts
async findAll(
    where: Record<string, unknown>,
    options?: PaginatedListOptions,
    additionalConditions?: SQL[],
    tx?: unknown
): Promise<PaginatedListOutput<User>> {
    // ... existing logic ...
    const combined = additionalConditions?.length
        ? and(finalWhere, ...additionalConditions)
        : finalWhere;
    // use combined instead of finalWhere
}
```
- Also fix `count()` to forward `options?.additionalConditions`
- Complexity: 3

**Option B: Remove UserModel.findAll() override entirely**
- Let BaseModel handle everything, move custom `q` search logic to UserService
- Pros: Cleaner architecture
- Cons: More refactoring, breaks existing public user search
- Complexity: 5

### Recommendation

**Fix directly in SPEC-049 with Option A.** The override exists for a valid reason (custom `q` search on displayName/firstName/lastName), but it must properly combine with additionalConditions.

---

## GAP-049-022: Tag Color Schema Type Mismatch (hex regex vs enum) [HIGH]

**Found in**: Audit Pass 3
**Severity**: HIGH
**Priority**: P1
**Complexity**: Low (1)

### Description

`TagAdminSearchSchema` defines `color` as a hex string regex (`/^#[0-9A-Fa-f]{6}$/`) but the DB column `tags.color` uses `TagColorPgEnum` (a PostgreSQL enum with values like `'RED'`, `'BLUE'`, etc.). Filtering by hex color will NEVER match any row.

### Evidence

- **Schema** (`packages/schemas/src/entities/tag/tag.admin-search.schema.ts`): `color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()`
- **DB** (`packages/db/src/schema/tag.schema.ts`): `color` column uses `TagColorPgEnum`

### Impact

Tag color filtering is completely broken. Any color filter value will either fail validation (enum value doesn't match hex regex) or silently return empty results.

### Proposed Solution

Replace hex regex with `TagColorEnumSchema`:
```ts
color: TagColorEnumSchema.optional()
```

### Recommendation

**Fix directly in SPEC-049.** One-line change.

---

## GAP-049-023: getSearchableColumns() Never Overridden by Any Service [HIGH]

**Found in**: Audit Pass 3
**Severity**: HIGH
**Priority**: P1
**Complexity**: Medium (3)

### Description

The base `getSearchableColumns()` returns `['name']` and NO concrete service overrides it. This means text search via the `search` parameter defaults to searching the `name` column for ALL 16 entities, including those where `name` is not the primary identifier.

### Affected Entities

| Entity | Has `name` column? | Better search columns | Impact |
|--------|-------------------|----------------------|--------|
| User | NO | `displayName`, `firstName`, `lastName`, `email` | **Search fails silently** (no `name` column) |
| AccommodationReview | NO | `title`, `content` | **Search fails silently** |
| DestinationReview | NO | `title`, `content` | **Search fails silently** |
| Sponsorship | NO | `notes` (if exists) | **Search fails silently** |
| PostSponsor | Has `name` | N/A | Works correctly |
| OwnerPromotion | Has `name` | N/A | Works correctly |
| All others | Has `name` | `description`, `slug` | Works but limited |

### Impact

Text search is completely broken for entities without a `name` column (users, reviews, sponsorships). For entities WITH `name`, search works but is limited to just the name field when description/slug/content would also be valuable.

### Proposed Solutions

**Option A (recommended): Override getSearchableColumns() for each service**
```ts
// UserService
protected override getSearchableColumns(): string[] {
    return ['displayName', 'firstName', 'lastName', 'email'];
}
// AccommodationReviewService
protected override getSearchableColumns(): string[] {
    return ['title', 'content'];
}
// etc.
```
- Complexity: 2 (15 min per service, mostly boilerplate)

**Option B: Build searchable columns into AdminSearchSchema metadata**
- Each schema declares its searchable columns alongside its filter fields
- Pros: Co-located with schema, easier to maintain
- Cons: Requires schema architecture change
- Complexity: 5

### Recommendation

**Fix directly in SPEC-049 with Option A.** Each service should declare what columns are searchable. Critical for user, review, and sponsorship entities.

---

## GAP-049-024: Sponsorship Badge Case Mismatch [HIGH]

**Found in**: Audit Pass 3
**Severity**: HIGH
**Priority**: P1
**Complexity**: Low (1)

### Description

The sponsorship tab badge configuration uses UPPERCASE values (`'PENDING'`, `'ACTIVE'`, `'EXPIRED'`, `'CANCELLED'`) but `SponsorshipStatusEnum` stores lowercase values (`'pending'`, `'active'`, `'expired'`, `'cancelled'`). Badges will never match data values.

### Evidence

- **Frontend badges** (`apps/admin/src/features/sponsorships/components/SponsorshipsTab.tsx` lines 89-107): `{ value: 'PENDING', ... }`
- **Enum values** (`packages/schemas/src/enums/sponsorship-status.enum.ts`): `PENDING = 'pending'`

### Impact

Sponsorship status badges in the admin panel show raw values or fallback styling instead of colored badges.

### Proposed Solution

Change badge values to lowercase:
```ts
badgeOptions: [
    { value: 'pending', ... },
    { value: 'active', ... },
    { value: 'expired', ... },
    { value: 'cancelled', ... }
]
```

### Recommendation

**Fix directly in SPEC-049.** One-line change per badge option.

---

## GAP-049-025: Entities Without lifecycleState Inherit Base Status Filter [MEDIUM]

**Found in**: Audit Pass 3
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Medium (3)

### Description

`AdminSearchBaseSchema` defines a `status` filter that maps to `lifecycleState` column. Several entities inherit this filter but DON'T have a `lifecycleState` column:

| Entity | Has lifecycleState? | Effect of status filter |
|--------|-------------------|----------------------|
| **Sponsorship** | NO (has own `status` column) | **Silently ignored** by buildWhereClause (no matching column) |
| **OwnerPromotion** | NO | **Silently ignored** |
| **DestinationReview** | NO | **Silently ignored** |
| **AccommodationReview** | YES | Works correctly |

### Impact

Admin users may apply the DRAFT/ACTIVE/ARCHIVED status filter on these entities and see no change in results, leading to confusion. No data corruption or errors.

### Proposed Solutions

**Option A (recommended): Add statusField config to AdminSearchBaseSchema extension**
- Each entity schema declares which column (if any) maps to the base `status` filter
- Services with no lifecycle column would exclude `status` from their schema
- Complexity: 4

**Option B: Override in service to ignore status when no column exists**
- Add early return/skip in `adminList()` when status is set but table has no `lifecycleState`
- Complexity: 2

**Option C: Document as known limitation**
- The filter simply has no effect on these entities
- Complexity: 0

### Recommendation

**Defer to a separate spec.** The current behavior (silently ignored) is not harmful and doesn't produce errors. A proper solution requires architectural decisions about how different entities model their "status".

---

## GAP-049-026: Owner Promotions Frontend Sends `status` Instead of `isActive` [MEDIUM]

**Found in**: Audit Pass 3
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

The owner promotions page sends `status` as a filter key, but the backend `OwnerPromotionAdminSearchSchema` defines `isActive` (boolean) as the active/inactive filter. The `status` key maps to the base schema's lifecycle status (DRAFT/ACTIVE/ARCHIVED) which the owner_promotions table doesn't have.

### Evidence

- **Frontend** (`apps/admin/src/routes/_authed/billing/owner-promotions.tsx` line 35-38): `filters: { status?: string; discountType?: string }`
- **Backend** (`packages/schemas/src/entities/owner-promotion/owner-promotion.admin-search.schema.ts`): `isActive: queryBooleanParam()`

### Impact

Owner promotion status filtering is silently broken. The lifecycle `status` filter has no effect (no `lifecycleState` column), and `isActive` is never sent.

### Proposed Solution

Change frontend to send `isActive=true`/`isActive=false` instead of `status`.

### Recommendation

**Fix directly in SPEC-049.** Related to GAP-049-013 (frontend entity-specific filter support).

---

## GAP-049-027: adminList() Uses _canList() Instead of Dedicated Admin Permission [MEDIUM]

**Found in**: Audit Pass 3
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Medium (3)

### Description

`adminList()` calls `this._canList(actor)` for permission checking, sharing the same permission check as the public `list()` method. Some services have very permissive `_canList` (e.g., PostService allows any actor). The admin route is protected at the API layer by `adminAuthMiddleware`, but the service layer doesn't distinguish between admin and non-admin list access.

### Evidence

- **adminList()** (`packages/service-core/src/base/base.crud.read.ts` line 334): `await this._canList(validatedActor)`
- **PostService._canList()**: Allows any actor (no admin check)
- **Admin routes**: All use `adminAuthMiddleware(requiredPermissions)` at the route level

### Impact

Currently LOW because the route layer correctly enforces admin permissions. However, if `adminList()` is called from a non-admin context (e.g., future internal service-to-service call), the permission check would not enforce admin access.

### Proposed Solutions

**Option A: Add _canAdminList() hook**
- New hook that defaults to `_canList()` but can be overridden for stricter checks
- Complexity: 3

**Option B: Document as defense-in-depth pattern**
- Route layer = primary auth, service layer = secondary
- Complexity: 0

### Recommendation

**Defer to a separate spec.** The route-level protection is sufficient for now. Adding a separate hook is a design improvement, not a bug fix.

---

## GAP-049-028: Pagination Double-Extraction in Admin Routes [MEDIUM]

**Found in**: Audit Pass 3
**Severity**: MEDIUM
**Priority**: P3
**Complexity**: Low (1)

### Description

All 16 admin list routes extract pagination twice:
1. `createListRoute` auto-merges `PaginationQuerySchema` and validates via Hono's `ctx.req.valid('query')`
2. The handler calls `extractPaginationParams(query || {})` to re-extract page/pageSize
3. The handler passes full `query` to `adminList()` which re-validates page/pageSize via `AdminSearchBaseSchema`
4. The handler then manually builds `getPaginationResponse(total, { page, pageSize })` instead of using `adminList()`'s returned pagination

### Evidence

All 16 route files follow this identical pattern:
```ts
const { page, pageSize } = extractPaginationParams(query || {});
const result = await service.adminList(actor, query || {});
return {
    items: result.data?.items || [],
    pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize }),
};
```

`adminList()` already returns `result.data.pagination` but it's ignored.

### Impact

No functional bug .. the values are consistent. But it's triple-validated, triple-extracted, creating maintenance risk if any of the three pagination implementations diverges.

### Proposed Solution

Simplify route handlers to use the pagination returned by `adminList()`:
```ts
const result = await service.adminList(actor, query || {});
return {
    items: result.data?.items || [],
    pagination: result.data?.pagination,
};
```

### Recommendation

**Defer to a cleanup pass.** Not blocking, not a bug, just unnecessary complexity.

---

## GAP-049-029: Exchange Rate History Route Inconsistency [LOW]

**Found in**: Audit Pass 3
**Severity**: LOW
**Priority**: P3
**Complexity**: N/A (informational)

### Description

The exchange rate history route (`/admin/exchange-rates/history`) uses `createAdminListRoute` but calls `service.search()` instead of `adminList()`. It uses its own `ExchangeRateHistoryHttpSchema` without `AdminSearchBaseSchema` fields (no sort, status, includeDeleted, search).

### Impact

Inconsistent with the 16 standard admin list routes but functionally correct. The exchange rate service doesn't have `adminSearchSchema` configured, which is intentional since exchange rates aren't standard CRUD entities.

### Recommendation

**No action needed.** Informational. If exchange rates later need admin list features, they should be added to the `adminList()` system at that time.

---

## GAP-049-030: Response Schema Inconsistency Across Admin Routes [LOW]

**Found in**: Audit Pass 3
**Severity**: LOW
**Priority**: P4
**Complexity**: N/A (informational)

### Description

Some admin list routes use `*AdminSchema` as responseSchema while others use base `*Schema`:

| Route | ResponseSchema | Has AdminSchema? |
|-------|---------------|-----------------|
| Accommodation | `AccommodationAdminSchema` | YES |
| Destination | `DestinationAdminSchema` | YES |
| Event | `EventAdminSchema` | YES |
| Post | `PostAdminSchema` | YES |
| User | `UserAdminSchema` | YES |
| **Tag** | `TagSchema` | **Uses base** |
| **Sponsorship** | `SponsorshipSchema` | **Uses base** |
| **PostSponsor** | `PostSponsorSchema` | **Uses base** |
| **OwnerPromotion** | `OwnerPromotionSchema` | **Uses base** |
| **AccommodationReview** | `AccommodationReviewSchema` | **Uses base** |
| **DestinationReview** | `DestinationReviewSchema` | **Uses base** |
| Others | Various base schemas | N/A |

### Impact

No functional impact. The `*AdminSchema` variants typically include additional fields (like audit metadata) that the base schema omits. Routes using base schemas may serialize slightly differently, but the admin frontend likely doesn't depend on these extra fields.

### Recommendation

**No action needed.** Informational. If specific admin-only fields are needed on these entities, create the `*AdminSchema` variant at that time.

---

## GAP-049-031: UserModel Unbounded Query Risk [LOW]

**Found in**: Audit Pass 3
**Severity**: LOW
**Priority**: P4
**Complexity**: Low (1)

### Description

`UserModel.findAll()` override can run unbounded queries (no LIMIT) when `page` or `pageSize` is not provided. `BaseModel.findAll()` always caps at MAX_PAGE_SIZE=100, but UserModel's override bypasses this safety.

### Evidence

- **UserModel.findAll()** (`packages/db/src/models/user/user.model.ts` line 77): When `isPaginated` is false, runs `db.select().from(this.table).where(...)` with no LIMIT

### Impact

Currently LOW because `adminList()` always provides pagination params. But a future caller that omits pagination could trigger a full table scan.

### Proposed Solution

Add `MAX_PAGE_SIZE` cap to UserModel's non-paginated path.

### Recommendation

**Defer.** Not triggered by current code paths.

---

## GAP-049-018: Inverted Date Range Not Validated [LOW]

**Found in**: Audit Pass 2
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (1)

### Description

When `createdAfter` is after `createdBefore`, the query silently returns empty results instead of returning a validation error.

### Evidence

```ts
// base.crud.read.ts lines 371-377
if (createdAfter) { where.createdAt_gte = createdAfter; }
if (createdBefore) { where.createdAt_lte = createdBefore; }
// No validation that createdAfter < createdBefore
```

### Impact

Low. Admin users who invert date ranges get empty results, which is technically correct behavior. No data corruption or security risk.

### Proposed Solutions

**Option A: Add Zod refinement**
```ts
.refine(
    (data) => !data.createdAfter || !data.createdBefore || data.createdAfter <= data.createdBefore,
    { message: 'createdAfter must be before createdBefore' }
)
```
- Complexity: 1

**Option B: Leave as-is, document behavior**
- Empty results for inverted ranges is valid behavior
- Complexity: 0

### Recommendation

**Defer to a future micro-fix or leave as-is.** Not blocking for SPEC-049.

---

## GAP-049-019: getTable() Uses `as any` Instead of BaseModel Interface [LOW]

**Found in**: Audit Pass 2
**Severity**: LOW
**Priority**: P4
**Complexity**: Low (2)

### Description

The `adminList()` method accesses `getTable()` via `(this.model as any).getTable()` with a biome-ignore comment. The method exists on all models but isn't declared in the `BaseModel` interface.

### Evidence

```ts
// base.crud.read.ts line 351
// biome-ignore lint/suspicious/noExplicitAny: getTable() not in BaseModel interface
const table = (this.model as any).getTable();
```

### Impact

Type safety gap. If someone removes `getTable()` from a model, TypeScript won't catch it and it will fail at runtime.

### Proposed Solution

Add `getTable()` to the `BaseModel<T>` abstract class signature (or the interface it implements). This eliminates the `as any` cast.

### Recommendation

**Fix directly in SPEC-049.** Low effort, improves type safety.

---

## PASS 4 NEW GAPS

---

## GAP-049-032: Tailwind Dynamic Grid Classes Broken in Production [CRITICAL]

**Found in**: Audit Pass 4 (Frontend agent)
**Severity**: CRITICAL
**Priority**: P0
**Complexity**: Low (2)

### Description

`EntityListPage.tsx` generates Tailwind grid classes dynamically using template literals. Tailwind CSS purges unused classes at build time and cannot detect dynamically constructed class names. This means grid layouts are **completely broken in production builds**.

### Evidence

- **File**: `apps/admin/src/components/entity-list/EntityListPage.tsx` (line ~384)
```tsx
className={`grid grid-cols-${viewConfig.gridConfig?.columns.mobile || 1} gap-4 md:grid-cols-${viewConfig.gridConfig?.columns.tablet || 2} lg:grid-cols-${viewConfig.gridConfig?.columns.desktop || 3}`}
```
- Tailwind cannot detect `grid-cols-1`, `grid-cols-2`, `grid-cols-3`, `md:grid-cols-2`, `lg:grid-cols-3` when constructed at runtime
- In production, all grid items render in a single column

### Impact

ALL entity list pages using grid view render incorrectly in production. Items stack vertically instead of displaying in the configured grid layout.

### Proposed Solutions

**Option A (recommended): Use a static class map**
```tsx
const gridColsMap: Record<number, string> = {
    1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
};
const mdGridColsMap: Record<number, string> = {
    1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4',
};
// ... then use gridColsMap[columns.mobile] etc.
```
- Complexity: 1

**Option B: Safelist classes in Tailwind config**
- Add all grid-cols variants to `safelist` in tailwind.config
- Complexity: 1, but less maintainable

### Recommendation

**Fix directly in SPEC-049 with Option A.** This is a production-breaking bug.

---

## GAP-049-033: destinationReview Inherits status Filter but Has No lifecycleState Column [HIGH]

**Found in**: Audit Pass 4 (Schema-DB verification agent)
**Severity**: HIGH
**Priority**: P1
**Complexity**: Low (2)

### Description

`DestinationReviewAdminSearchSchema` inherits `status` from `AdminSearchBaseSchema`, which maps to a `lifecycleState` column. However, `destination_reviews` table does **NOT** have a `lifecycle_state` column (unlike `accommodation_reviews` which does). This is more specific than GAP-049-025 (which documents the general pattern) .. this entity has a concrete runtime failure risk.

### Evidence

- **Schema**: Inherits `AdminSearchBaseSchema.status` (maps to `lifecycleState`)
- **DB table**: `destination_reviews` has `deleted_at` but no `lifecycle_state` column
- **Contrast**: `accommodation_reviews` DOES have `lifecycle_state` column

### Impact

Filtering destination reviews by status (DRAFT/ACTIVE/ARCHIVED) will silently produce no results or be ignored by `buildWhereClause()` because the column doesn't exist.

### Proposed Solutions

**Option A (recommended): Remove status from DestinationReviewAdminSearchSchema**
- Override the base schema to exclude the `status` field: `.omit({ status: true })`
- Complexity: 1

**Option B: Add lifecycleState column to destination_reviews**
- DB migration
- Complexity: 4

### Recommendation

**Fix directly in SPEC-049 with Option A.** The column doesn't exist, so the filter should not be exposed.

---

## GAP-049-034: buildWhereClause Silently Drops Unknown Keys Without Logging [MEDIUM]

**Found in**: Audit Pass 4 (DB layer agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (2)

### Description

`buildWhereClause()` in `packages/db/src/utils/drizzle-helpers.ts` silently filters out unknown column names without any warning or logging. If a caller passes a filter key that doesn't match a real column, it's silently ignored. This is the ROOT CAUSE of many phantom field bugs (GAP-049-020) going undetected.

### Evidence

- **File**: `packages/db/src/utils/drizzle-helpers.ts` (lines 48-86)
- Lines 51-55: `_like` suffix .. returns `undefined` if column not found (no log)
- Lines 61-65: `_gte` suffix .. returns `undefined` if column not found (no log)
- Lines 71-75: `_lte` suffix .. returns `undefined` if column not found (no log)
- Lines 78-85: Direct eq .. returns `undefined` if column not found (no log)

### Impact

- Phantom schema fields silently produce no filtering, making bugs invisible
- Developers have no way to detect misspelled or non-existent column names at runtime
- Test: `drizzle-helpers.test.ts:53-56` confirms this is intentional ("ignores keys not in table") but doesn't validate logging

### Proposed Solutions

**Option A (recommended): Add logger.warn() for ignored keys**
```ts
if (!Object.prototype.hasOwnProperty.call(tableRecord, columnName)) {
    logger.warn(`buildWhereClause: unknown column "${columnName}" in table, filter ignored`);
    return undefined;
}
```
- Complexity: 1

**Option B: Throw error for unknown keys in development mode**
- Complexity: 3

### Recommendation

**Fix directly in SPEC-049 with Option A.** Logging unknown keys would have caught GAP-049-020 during development. Low effort, high diagnostic value.

---

## GAP-049-035: UserModel.findAllWithCounts() Missing additionalConditions Parameter [MEDIUM]

**Found in**: Audit Pass 4 (DB layer agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (2)

### Description

`UserModel.findAllWithCounts()` does NOT accept `additionalConditions` in its signature, unlike `BaseModel.findAllWithRelations()` which does. If admin list ever needs to use this method with search conditions, they'll be silently dropped.

### Evidence

- **File**: `packages/db/src/models/user/user.model.ts` (lines 128-132)
```typescript
async findAllWithCounts(
    where: Record<string, unknown>,
    options?: { page?: number; pageSize?: number },
    tx?: NodePgDatabase<typeof schema>
): Promise<{ items: UserWithCounts[]; total: number }>
```
Missing `additionalConditions?: SQL[]` parameter

- **Contrast**: `BaseModel.findAllWithRelations()` (base.model.ts:483-487) includes `additionalConditions`

### Impact

Currently LOW because `UserService._executeAdminSearch()` calls `this.model.findAll()` not `findAllWithCounts()`. But inconsistency creates future trap.

### Recommendation

**Fix directly in SPEC-049.** Add the parameter for consistency. Low effort.

---

## GAP-049-036: entityFilters Type Safety Weakened by Broad Type Assertion in adminList() [MEDIUM]

**Found in**: Audit Pass 4 (Service-core agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Medium (3)

### Description

In `adminList()`, the destructuring of parsed params uses a broad type assertion that makes `entityFilters` a `Record<string, unknown>`. This means `_executeAdminSearch()` overrides receive untyped entity filters, and TypeScript won't catch if a schema defines a field that the service doesn't handle.

### Evidence

- **File**: `packages/service-core/src/base/base.crud.read.ts` (lines 321, 335-345)
```ts
const validParams = parseResult.data as Record<string, unknown>;
// ... later destructure with:
const { search, sort, status, includeDeleted, createdAfter, createdBefore, page, pageSize, ...entityFilters } = validParams as { ... [key: string]: unknown };
```

### Impact

- No compile-time check that service overrides handle all schema-defined fields
- Adding a new field to an entity's AdminSearchSchema won't produce a TypeScript error if the service doesn't handle it
- Makes it easy to introduce phantom filters silently

### Proposed Solutions

**Option A (recommended): Use Zod infer type for entityFilters**
- Extract entity-specific type from `this.adminSearchSchema` inferred type, minus base fields
- Complexity: 3

**Option B: Document as known limitation**
- Runtime validation via schema is sufficient; TypeScript won't help here due to generic base class
- Complexity: 0

### Recommendation

**Defer to a separate spec.** The generic base class pattern inherently limits type inference. Schema validation provides runtime safety. A type-safe solution would require significant architecture changes (generics on BaseCrudService).

---

## GAP-049-037: Post Admin Search Missing relatedAccommodationId Filter [MEDIUM]

**Found in**: Audit Pass 4 (Schema-DB verification agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

The `posts` table has both `related_accommodation_id` and `related_destination_id` columns, but `PostAdminSearchSchema` only includes `relatedDestinationId`. The `relatedAccommodationId` filter is missing.

### Evidence

- **Schema**: `packages/schemas/src/entities/post/post.admin-search.schema.ts` .. has `relatedDestinationId`, missing `relatedAccommodationId`
- **DB**: `posts` table has both `related_accommodation_id` and `related_destination_id` columns

### Impact

Admins cannot filter posts by related accommodation. They can only filter by related destination.

### Proposed Solution

Add `relatedAccommodationId: z.string().uuid().optional()` to `PostAdminSearchSchema`.

### Recommendation

**Fix directly in SPEC-049.** One-line addition.

---

## GAP-049-038: Post Has Ambiguous isFeatured vs isFeaturedInWebsite Fields [MEDIUM]

**Found in**: Audit Pass 4 (Schema-DB verification agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (2)

### Description

The `posts` DB table has TWO separate boolean columns: `is_featured` (generic) and `is_featured_in_website` (website-specific). The `PostAdminSearchSchema` only includes `isFeatured`, which maps to `is_featured`. There's no way to filter by `is_featured_in_website`.

### Evidence

- **Schema**: `PostAdminSearchSchema` has `isFeatured: queryBooleanParam()`
- **DB**: `posts` table has `is_featured` AND `is_featured_in_website`

### Impact

- Admin filtering by "featured" only considers the generic flag
- Posts that are featured on the website but not generically won't appear in "featured" filter
- Potentially confusing for admins who see posts marked as "featured on website" but filtered out

### Proposed Solutions

**Option A (recommended): Add isFeaturedInWebsite to PostAdminSearchSchema**
```ts
isFeaturedInWebsite: queryBooleanParam(),
```
- Complexity: 1

**Option B: Document that isFeatured covers only the generic flag**
- Complexity: 0

### Recommendation

**Fix directly in SPEC-049 with Option A.** Low effort, completes the filter set.

---

## GAP-049-039: Empty API Response Body Causes Runtime Crash in Admin Frontend [MEDIUM]

**Found in**: Audit Pass 4 (Frontend agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (2)

### Description

If the API responds with `200 OK` but an empty body (or non-JSON body), the admin API client returns `{ data: undefined as T }`. Consumers expecting `EntityQueryResponse` will crash accessing `data.data.items`.

### Evidence

- **File**: `apps/admin/src/lib/api/client.ts` (line ~104)
```tsx
const text = await res.text();
let parsed: unknown = undefined;
try {
    parsed = text ? JSON.parse(text) : undefined; // empty body → undefined
} catch {
    parsed = undefined;
}
return { data: parsed as T, status }; // data = undefined, cast as T
```

### Impact

Runtime `TypeError: Cannot read properties of undefined (reading 'items')` if API returns empty body. Could happen during network issues, timeouts, or server errors that return no body.

### Proposed Solution

Add null check before type assertion:
```tsx
if (!parsed) {
    throw new ApiError('Empty response body', status);
}
```

### Recommendation

**Fix directly in SPEC-049.** Defensive error handling. Low effort.

---

## GAP-049-040: Unsafe JSON Sort Parsing in EntityListPage [MEDIUM]

**Found in**: Audit Pass 4 (Frontend agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (2)

### Description

`EntityListPage` parses sort configuration from URL params using `JSON.parse()` with `as DataTableSort` type assertion. No runtime validation that each element has `{id: string, desc: boolean}` structure. Malformed sort params (e.g., `[1, 2, 3]` or `[{id: "x"}]` missing `desc`) are silently accepted.

### Evidence

- **File**: `apps/admin/src/components/entity-list/EntityListPage.tsx` (lines ~187-195)
```tsx
const parsedSort: DataTableSort = useMemo(() => {
    if (!search.sort) return [];
    try {
        const s = JSON.parse(search.sort) as DataTableSort;
        return Array.isArray(s) ? s : [];
    } catch {
        return [];
    }
}, [search.sort]);
```

### Impact

- Malformed sort params silently produce incorrect behavior
- URL manipulation could inject unexpected sort configs
- No user-facing error for invalid sort state

### Proposed Solution

Add Zod validation for parsed sort:
```tsx
const SortConfigSchema = z.array(z.object({ id: z.string(), desc: z.boolean() }));
const parsed = SortConfigSchema.safeParse(JSON.parse(search.sort));
return parsed.success ? parsed.data : [];
```

### Recommendation

**Fix directly in SPEC-049.** Aligns with project's Zod-validation-everywhere pattern.

---

## GAP-049-041: parseAdminSort Uses Type Assertion Without Runtime Validation [LOW]

**Found in**: Audit Pass 4 (Service-core agent)
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (1)

### Description

`parseAdminSort()` uses `as [string, 'asc' | 'desc']` after splitting on `:`. The type assertion doesn't validate the second element is actually `'asc'` or `'desc'`.

### Evidence

- **File**: `packages/schemas/src/common/admin-search.schema.ts` (lines 117-120)
- The regex validation at lines 62-68 prevents invalid values from reaching `parseAdminSort()`, so this is defense-in-depth only

### Impact

Very low. Schema validation catches invalid sort strings before they reach this function.

### Recommendation

**Defer.** Not a runtime risk due to upstream validation.

---

## GAP-049-042: BaseModel.count() Inconsistent undefined Handling vs findAll() [LOW]

**Found in**: Audit Pass 4 (DB layer agent)
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (1)

### Description

`BaseModel.count()` passes potentially `undefined` baseWhereClause to `and()`, while `findAll()` explicitly checks for `undefined` before combining conditions. The patterns are inconsistent.

### Evidence

- **count()** (base.model.ts:264-267): `and(baseWhereClause, ...additionalConditions)` where baseWhereClause may be undefined
- **findAll()** (base.model.ts:95-104): Explicitly builds `allConditions[]` array, filtering out undefined

### Impact

Currently works because Drizzle's `and()` filters falsy values internally. But if Drizzle changes this behavior, count queries would break.

### Recommendation

**Defer.** Cosmetic inconsistency, no runtime impact. Fix opportunistically when touching this file.

---

## GAP-049-043: includeDeleted + status=all Interaction Undocumented [LOW]

**Found in**: Audit Pass 4 (Service-core agent)
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (0)

### Description

When `includeDeleted=true` and `status='all'`, the query returns ALL items including soft-deleted ones with any lifecycle state. This is the most permissive combination but its semantics aren't documented anywhere.

### Evidence

- **File**: `packages/service-core/src/base/base.crud.read.ts` (lines 363-369)
- `status !== 'all'` sets `where.lifecycleState`
- `!includeDeleted` sets `where.deletedAt = null`
- Both `true` + `all` = no filters applied

### Impact

Admin users might not realize they're seeing deleted items. No data corruption risk.

### Recommendation

**Document in spec.** No code change needed.

---

## GAP-049-044: Test Infrastructure Completely Absent [LOW]

**Found in**: Audit Pass 4 (Test coverage agent)
**Severity**: LOW (but blocks P1 test gaps)
**Priority**: P3 (but must be done before GAP-049-002/003)
**Complexity**: Medium (4)

### Description

No test helper infrastructure exists for admin list testing:
- No `createAccommodationWithOwner()` factory
- No `createEventWithOrganizer()` factory
- No `createReviewWithRating()` factory
- No `createAdminActor()` mock with full permissions
- No seeding utilities for 16 entity types
- No cleanup helpers for test isolation

### Impact

Writing the ~34 missing test files (GAP-049-002, GAP-049-003) without infrastructure will result in massive code duplication across test files.

### Recommendation

**Fix directly in SPEC-049 as prerequisite to Phase 7.** Create `apps/api/test/helpers/admin-test-factory.ts` before writing individual test files.

---

## GAP-049-045: Zod Validation Error Messages Don't Include Response Data [LOW]

**Found in**: Audit Pass 4 (Frontend agent)
**Severity**: LOW
**Priority**: P4
**Complexity**: Low (1)

### Description

When API response Zod validation fails in `createEntityApi`, the error message includes Zod issues but not the actual response data that failed validation. Makes debugging difficult.

### Evidence

- **File**: `apps/admin/src/components/entity-list/api/createEntityApi.ts` (lines ~76-83)
```tsx
throw new Error(
    `API response validation failed for ${endpoint}: ${parseResult.error.issues.map(...)}`
);
// Missing: actual response data for debugging
```

### Recommendation

**Defer.** Nice debugging improvement but not a functional issue.

---

## GAP-049-046: defaultFilters Applied Silently With No UI Indicator [LOW]

**Found in**: Audit Pass 4 (Frontend agent) .. extends GAP-049-014
**Severity**: LOW
**Priority**: P3
**Complexity**: Medium (3)

### Description

Extension of GAP-049-014. Even if defaultFilters are wired to API requests (fixing GAP-014), there's no UI indicator showing that a default filter is active. Users see filtered results without knowing why.

### Evidence

- **Config**: `destinations.config.ts` line 19: `defaultFilters: { destinationType: 'CITY' }`
- **UI**: No filter chip, badge, or indicator showing "Filtered by: Type = City"

### Impact

Admin users confused about why they see fewer results than expected. They may not realize a default filter is applied.

### Proposed Solution

Add a filter indicator bar above the entity list showing active filters (both default and user-selected) with ability to clear them.

### Recommendation

**Defer to a separate spec.** This is a UX enhancement, not a bug fix. Related to the broader filter UI system needed for GAP-049-013.

---

## GAP-049-047: UserModel.count() Drops additionalConditions When 'q' Parameter Present [HIGH]

**Found in**: Audit Pass 5 (DB models agent) .. extends GAP-049-021
**Severity**: HIGH
**Priority**: P1
**Complexity**: Low (2)

### Description

Distinct from GAP-049-021 (which covers findAll()). When UserModel.count() receives a query with the `q` parameter, it takes a custom code path that destructures `options` but only extracts `tx`, silently discarding `additionalConditions`. This means pagination counts are wrong when both a search term AND SQL filter conditions are present.

### Evidence

- **File**: `packages/db/src/models/user/user.model.ts` lines 84-123
- **Code**: `const { tx } = options ?? {};` .. extracts only tx, DISCARDS additionalConditions
- **Without 'q'**: Falls through to `super.count(where, options)` which correctly passes additionalConditions
- **With 'q'**: Custom search path builds `finalWhereClause` WITHOUT merging additionalConditions

### Impact

When adminList() sends both a `search` term AND entity-specific SQL conditions (e.g., role filter + text search), the count query returns WRONG total. Items list shows correct filtered results but pagination says "showing 5 of 100" when it should say "showing 5 of 5". This breaks pagination UI.

### Proposed Solution

**Fix directly in SPEC-049.** Extract and merge additionalConditions in the custom code path:
```ts
const { tx, additionalConditions } = options ?? {};
// ... build finalWhereClause ...
if (additionalConditions?.length) {
    finalWhereClause = and(finalWhereClause, ...additionalConditions);
}
```

### Recommendation

**Fix directly in SPEC-049.** Same pattern as GAP-049-021 fix. Complexity: 2.

---

## GAP-049-048: findAllWithRelations() Missing tx Parameter [MEDIUM]

**Found in**: Audit Pass 5 (DB models agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Medium (3)

### Description

`BaseModel.findAllWithRelations()` does NOT accept a transaction (`tx`) parameter, unlike `findAll()` which does. When `_executeAdminSearch()` calls `findAllWithRelations()` inside a transaction context, it always hits the global database connection, breaking transaction atomicity.

### Evidence

- **File**: `packages/db/src/base/base.model.ts` lines 483-487
- **findAllWithRelations signature**: `(relations, where, options, additionalConditions?)` .. NO tx parameter
- **findAll signature**: `(where, options?, additionalConditions?, tx?)` .. HAS tx parameter
- **findAllWithRelations implementation**: `const db = this.getClient();` .. always uses global db

### Impact

If adminList() is called within a transaction (e.g., during a bulk operation or test), findAllWithRelations() reads stale data from outside the transaction. In tests, this means writes within a transaction-wrapped test are invisible to the query, causing flaky test failures.

Not immediately production-breaking since adminList() is currently called outside transactions, but will be a problem for integration tests.

### Proposed Solution

**Option A (recommended): Add tx parameter to findAllWithRelations()**
- Add optional `tx` parameter to method signature
- Pass to `this.getClient(tx)` instead of `this.getClient()`
- Pros: Consistent with findAll(), enables transactional tests
- Cons: Breaking change to method signature (but parameter is optional)
- Complexity: 3

**Option B: Accept tx in options object**
- Merge tx into the existing `options` parameter
- Pros: Non-breaking API change
- Cons: Different pattern from findAll()

### Recommendation

**Defer to separate spec.** This is a BaseModel architectural improvement that affects more than SPEC-049. Should be addressed in a DB layer cleanup spec. For SPEC-049 testing, use per-test database seeding instead of transactional rollback.

---

## GAP-049-049: Malformed Tailwind Class - Missing Space Before lg: Breakpoint [MEDIUM]

**Found in**: Audit Pass 5 (Frontend agent) .. sub-issue of GAP-049-032
**Severity**: MEDIUM
**Priority**: P1 (fix together with GAP-049-032)
**Complexity**: Low (1)

### Description

In addition to the dynamic class purging issue (GAP-049-032), the template literal in EntityListPage.tsx has a missing space character between the `md:` and `lg:` breakpoint classes, producing an invalid class like `md:grid-cols-2lg:grid-cols-3`.

### Evidence

- **File**: `apps/admin/src/components/entity-list/EntityListPage.tsx` line 384
- **Code**: `` `...md:grid-cols-${viewConfig.gridConfig?.columns.tablet || 2}lg:grid-cols-${viewConfig.gridConfig?.columns.desktop || 3}` ``
- **Missing**: Space between `}` and `lg:`
- **Result**: Produces `md:grid-cols-2lg:grid-cols-3` (invalid class) instead of `md:grid-cols-2 lg:grid-cols-3`

### Impact

Even if GAP-049-032 is fixed (dynamic classes replaced with safe alternatives), this concatenation bug means the `lg:` breakpoint would STILL be ignored. Desktop users see tablet layout instead of desktop layout.

### Proposed Solution

**Fix together with GAP-049-032.** When replacing dynamic grid classes with a safe approach (e.g., CSS variables, static class map, or style attribute), this space issue goes away automatically.

### Recommendation

**Fix directly in SPEC-049** as part of GAP-049-032 resolution.

---

## GAP-049-050: averageRating numeric() Column Returns Strings in JavaScript [LOW]

**Found in**: Audit Pass 5 (DB models agent + verification agent)
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (1)

### Description

PostgreSQL `numeric(3,2)` columns return **string values** in JavaScript via Drizzle (e.g., `"3.50"` not `3.50`). The `averageRating` column on both review tables uses `numeric()`. While Drizzle's `gte(numericColumn, "3.5")` works because PostgreSQL performs implicit type casting, this is fragile and any JavaScript code comparing `averageRating` as a number (e.g., `if (review.averageRating > 3.5)`) will produce incorrect results due to string comparison.

### Evidence

- **accommodation_reviews.dbschema.ts**: `averageRating: numeric('average_rating', { precision: 3, scale: 2 })`
- **destination_reviews.dbschema.ts**: `averageRating: numeric('average_rating', { precision: 3, scale: 2 })`
- **Service code** (accommodation_review.service.ts line 181): `gte(accommodationReviews.averageRating, minRating.toString())`
- **Note**: `.toString()` is actually CORRECT here since the column type is string-backed numeric. GAP-049-004 incorrectly flagged this.

### Impact

Low for SPEC-049 specifically (the SQL comparison works). Higher risk for any future code that treats averageRating as a JavaScript number.

### Proposed Solution

**Option A: Document the behavior**
- Add JSDoc to schema fields explaining numeric() returns string
- Pros: No code change, prevents confusion
- Cons: Doesn't prevent future bugs

**Option B: Add a numeric parse helper**
- Create a helper that parses numeric strings for display/comparison
- Pros: Type-safe in application code
- Cons: Overkill if only used in DB queries

### Recommendation

**Defer to separate spec.** This is a DB convention issue, not specific to SPEC-049. For now, the toString() pattern in review services is actually correct.

---

## GAP-049-051: list() Search OR Fix Has No Dedicated Unit Test Validating OR Behavior [MEDIUM]

**Found in**: Audit Pass 6
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (2)

### Description

The `list()` method was fixed to use `buildSearchCondition()` for OR-based search (Phase 2), but there is NO unit test in `packages/service-core/test/base/crud/list.test.ts` that specifically validates the OR behavior. Existing list tests are generic and do not verify that search across multiple columns uses OR (not AND).

This is distinct from GAP-049-007 (regression test for the fix) and GAP-049-002 (adminList tests). This gap specifically covers the `list()` method's search behavior at the service layer.

### Evidence

- `packages/service-core/test/base/crud/list.test.ts` exists but has no test case asserting OR search behavior
- The fix is in `base.crud.read.ts` lines 191-197, calling `buildSearchCondition()`
- `buildSearchCondition()` itself HAS unit tests in `packages/db/test/utils/drizzle-helpers.test.ts` (11 tests)
- But no test validates the INTEGRATION of buildSearchCondition into list()

### Impact

If someone refactors `list()` and accidentally reverts to the old for-loop AND pattern, no test would catch it. The `buildSearchCondition` tests only cover the utility function in isolation.

### Proposed Solution

Add 2-3 test cases to `list.test.ts`:
1. Search term matching name column returns result (OR works for name)
2. Search term matching description column returns result (OR works for description)
3. Search term not matching any column returns empty result

### Recommendation

**Fix directly in SPEC-049 Phase 7.** Low effort, high value regression safety.

---

## GAP-049-052: AdminSearchBaseSchema includeDeleted Uses z.preprocess But Not queryBooleanParam [LOW]

**Found in**: Audit Pass 6
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (1)

### Description

`AdminSearchBaseSchema` in `packages/schemas/src/common/admin-search.schema.ts` defines `includeDeleted` using a custom `z.preprocess()` inline, rather than the shared `queryBooleanParam()` helper created in Phase 0 specifically for this purpose. Both implementations handle the `"false"` string bug correctly, so there's no functional difference.. but it violates the DRY principle and the spec's explicit instruction (Phase 0, step 5).

This was previously reported as GAP-049-015 but that gap described a different issue (includeDeleted "doesn't use queryBooleanParam"). Pass 6 confirms the root cause: the inline `z.preprocess` is functionally equivalent but not using the shared helper.

### Evidence

- `admin-search.schema.ts` line 83-86: Uses inline `z.preprocess()` for includeDeleted
- `packages/schemas/src/common/query-helpers.ts`: `queryBooleanParam()` exists and is exported
- All 12 entity-specific boolean fields use `queryBooleanParam()` (confirmed in Pass 6)
- Only `includeDeleted` in the BASE schema uses the inline version

### Impact

Minor consistency issue. No functional bug. If `queryBooleanParam()` is updated in the future (e.g., to handle "yes"/"no"), `includeDeleted` would not get the update.

### Proposed Solution

Replace inline `z.preprocess()` with `queryBooleanParam()` in AdminSearchBaseSchema.

### Recommendation

**Fix directly in SPEC-049.** Trivial 1-line change. Aligns with spec and DRY principle.

---

## Pass 6 Confirmations

### All 6 Service Overrides Code-Reviewed and Verified Correct

| Service | Override | Verified |
|---------|----------|----------|
| AccommodationService | JSONB `(price->>'price')::numeric` with gte/lte | Correct. Drizzle parameterizes values. |
| EventService | JSONB `(date->>'start')::timestamptz` and `(date->>'end')::timestamptz` | Correct. All 4 date filters properly handled. |
| UserService | `ilike(userTable.email, '%${email}%')` | Correct. Intentionally bypasses relations. |
| AccommodationReviewService | `gte/lte(accommodationReviews.averageRating, minRating.toString())` | Correct. toString() needed for numeric() column. |
| DestinationReviewService | `gte/lte(destinationReviews.averageRating, minRating.toString())` | Correct. Same pattern as accommodation reviews. |
| SponsorshipService | `sponsorshipStatus -> status` column rename | Correct. Avoids lifecycleState collision. |

### count() Migration Fully Complete

All callers of `count()` in the codebase use the new `count(where, { additionalConditions?, tx? })` options object signature. No legacy `count(where, tx)` calls found.

### SQL Security Assessment: SECURE

- Sort field validated against table columns before use (prevents SQL injection via sort)
- Search terms parameterized via Drizzle's `ilike()` (prevents SQL injection via search)
- JSONB SQL conditions use Drizzle `sql` template literals with parameter placeholders (prevents injection via price/date filters)
- minPrice/maxPrice validated as numbers by Zod schema before reaching SQL

### Phase 0 Prerequisites: 100% COMPLETE

Every item confirmed implemented and tested:
- CONFIGURATION_ERROR enum + HTTP 500 mapping
- queryBooleanParam helper + 11 tests
- All 12 boolean fields in admin search schemas
- Tag nameContains removed
- averageRating column on both review tables
- Migration with backfill SQL
- Service hooks (_afterCreate, _afterUpdate, _afterDelete) on both review services

---

## Pass 5 Corrections and Upgrades

### CORRECTION: GAP-049-014 (defaultFilters Not Applied)

**Previous assessment (Pass 2)**: "Frontend defaultFilters defined but never applied to API requests"
**Pass 5 correction**: defaultFilters ARE applied at `createEntityApi.ts` lines 62-67. The code iterates over defaultFilters and sets them as URLSearchParams. The real issue is that they're applied SILENTLY with no UI indicator (already captured in GAP-049-046).

**Action**: GAP-049-014 severity downgraded from HIGH to **RESOLVED** (the code works). GAP-049-046 remains as the UX issue.

### UPGRADE: GAP-049-004 (Rating toString())

**Previous assessment (Pass 1)**: MEDIUM - "Document toString() usage"
**Pass 5 reassessment**: The toString() is actually CORRECT because `numeric()` columns return strings in JS. Drizzle's gte/lte on numeric columns expects string values. The GAP was based on incorrect assumption that the column returns numbers.

**Action**: GAP-049-004 DOWNGRADED from MEDIUM to **LOW/INFORMATIONAL**. The code is correct; only needs a JSDoc comment explaining WHY toString() is used.

### FALSE POSITIVE RESOLVED: 4 Services Missing adminSearchSchema

**Reported by**: Test coverage agent (Pass 5)
**Resolution**: Verification agent confirmed all 4 services (amenity, attraction, feature, tag) DO have `adminSearchSchema` wired as class properties. The test agent's grep pattern likely missed the `protected readonly` declaration syntax.

### CONTRADICTION RESOLVED: Sort Format

**Agent A (frontend)**: "sort handling verified OK"
**Agent B (schemas)**: "backend expects field:dir regex"
**Resolution**: The frontend agent incorrectly stated sort was OK. Verification confirmed the backend schema uses regex `/^[a-zA-Z_]+:(asc|desc)$/` while the frontend sends `JSON.stringify(sort)`. GAP-049-001 remains OPEN and CRITICAL.

---

## Overall Implementation Status

### By Phase (Revised Pass 6)

| Phase | Description | Status | Completion |
|-------|-------------|--------|------------|
| Phase 0 | Prerequisites (enum, boolean fix, averageRating) | DONE | 100% (verified Pass 6: all 14 items complete) |
| Phase 1 | Infrastructure (buildWhereClause, BaseModel) | **PARTIAL** | **75%** (UserModel.findAll + count drops additionalConditions, findAllWithRelations no tx, count() inconsistency, no logging for unknown keys) |
| Phase 2 | Fix search OR bug in list() | DONE | 95% (missing regression test + NEW GAP-051: no OR-specific unit test) |
| Phase 3 | Core adminList() infrastructure | **PARTIAL** | **85%** (getSearchableColumns never overridden, entityFilters type safety) |
| Phase 4 | Sponsorship schema migration | DONE | 100% |
| Phase 5 | Services (wire adminSearchSchema + overrides) | **PARTIAL** | **45%** (6/16 overrides, +phantom fields, +tag color bug, +post missing fields). All 16 services have adminSearchSchema wired. All 6 overrides code-reviewed and verified correct (Pass 6). |
| Phase 6 | Routes (switch to adminList()) | DONE | 100% (all 16 routes use adminList + .omit pattern) |
| Phase 7 | Testing | NOT STARTED | 0% (test infrastructure also absent) |
| Phase 8 | Verification | NOT STARTED | 0% |

### By Category (Revised Pass 6)

| Category | Done | Total | % |
|----------|------|-------|---|
| Schemas & enums | 8/14 | 14 | 57% (9 phantom fields, 1 type mismatch, post missing 2 fields, destinationReview status) |
| DB layer (model + helpers) | 5/11 | 11 | 45% (UserModel findAll+count bugs, findAllWithCounts, findAllWithRelations tx, count() inconsistency, no logging) |
| Service core (adminList base) | 1/3 | 3 | 33% (getSearchableColumns, entityFilters type safety) |
| Service overrides (_executeAdminSearch) | 6/16 | 16 | 38% (all 6 existing overrides verified correct in Pass 6) |
| Routes (switch to adminList) | 16/16 | 16 | 100% |
| Frontend compatibility fixes | 0/10 | 10 | 0% (sort, badges, entity filters, Tailwind grid+space, empty response, sort parsing). Note: defaultFilters RESOLVED (was falsely reported as not applied) |
| Unit tests | 3/18 | 18 | 17% (added: list() OR-specific test gap) |
| Integration tests | 0/8 | 8 | 0% |
| Test infrastructure | 0/1 | 1 | 0% |
| Code quality fixes | 0/9 | 9 | 0% (added: includeDeleted queryBooleanParam consistency) |
| **TOTAL** | **39/124** | **124** | **31%** |

### Test Coverage by Layer

| Layer | Component | Tests | Status |
|-------|-----------|-------|--------|
| Schema | AdminSearchBaseSchema | 30+ | GOOD |
| Schema | Entity-specific schemas | 60+ | GOOD (but test phantom fields too!) |
| Schema | queryBooleanParam | 15+ | GOOD |
| Schema | ServiceErrorCode enum | 0 | MISSING |
| DB | drizzle-helpers (buildSearchCondition, _gte/_lte) | 45+ | GOOD (missing buildSearchCondition comprehensive) |
| DB | BaseModel (additionalConditions) | 0 | MISSING |
| DB | UserModel.findAll() with additionalConditions | 0 | **CRITICAL** |
| Service | adminList() base method | 0 | **CRITICAL** |
| Service | getSearchableColumns() per entity | 0 | **CRITICAL** |
| Service | list() OR regression | 0 | MISSING |
| Service | Per-entity adminList() (6 overrides) | 0 | **CRITICAL** |
| Service | Review helpers (averageRating) | 30+ | GOOD |
| Integration | Admin list routes (16) | 0 | **CRITICAL** |
| Infrastructure | Test factories, mock auth | 0 | **BLOCKING** (must exist before GAP-002/003) |

### Test Files Required (34 total)

| Category | Files | Status |
|----------|-------|--------|
| Service unit (base) | 1 (`adminList.test.ts`) | MISSING |
| Service unit (overrides) | 6 (accommodation, event, reviews x2, user, sponsorship) | MISSING |
| Service unit (simple) | 10 (amenity, destination, feature, tag, post, attraction, eventLocation, eventOrganizer, ownerPromotion, postSponsor) | MISSING |
| Integration routes | 16 (all admin list routes) | MISSING |
| Regression | 1 (list() search OR fix) | MISSING |
| Infrastructure | 1 (`admin-test-factory.ts`) | **MUST BE FIRST** |

---

## Priority Ranking for Remaining Work (Revised Pass 5)

### Must Fix Before Release (P0/P1) .. 15 items

1. **GAP-049-032** [CRITICAL] - Fix Tailwind dynamic grid classes in EntityListPage (production-breaking)
2. **GAP-049-049** [MEDIUM] - Fix missing space before lg: breakpoint (fix together with 032)
3. **GAP-049-020** [CRITICAL] - Remove 9 phantom schema fields referencing non-existent DB columns
4. **GAP-049-021** [CRITICAL] - Fix UserModel.findAll() to use additionalConditions
5. **GAP-049-047** [HIGH] - Fix UserModel.count() dropping additionalConditions when 'q' present (fix together with 021)
6. **GAP-049-001** [CRITICAL] - Fix sort format mismatch (frontend -> backend)
7. **GAP-049-012** [CRITICAL] - Fix eventLocation minCapacity/maxCapacity BUG (subsumed by GAP-049-020)
8. **GAP-049-011** [CRITICAL] - Add _executeAdminSearch() overrides for remaining 10 services
9. **GAP-049-033** [HIGH] - Remove/fix destinationReview status filter (no lifecycleState column)
10. **GAP-049-022** [HIGH] - Fix Tag color schema type (hex regex -> TagColorEnumSchema)
11. **GAP-049-023** [HIGH] - Override getSearchableColumns() for all 16 services
12. **GAP-049-024** [HIGH] - Fix sponsorship badge case mismatch (UPPERCASE -> lowercase)
13. **GAP-049-013** [HIGH] - Extend frontend EntityQueryParams for entity-specific filters
14. **GAP-049-002** [HIGH] - Write adminList() unit tests (needs GAP-049-044 first)
15. **GAP-049-003** [HIGH] - Write integration tests (needs GAP-049-044 first)

### Should Fix (P2) .. 16 items

16. **GAP-049-034** [MEDIUM] - Add logging for unknown keys in buildWhereClause
17. **GAP-049-035** [MEDIUM] - Add additionalConditions to UserModel.findAllWithCounts()
18. **GAP-049-037** [MEDIUM] - Add relatedAccommodationId to PostAdminSearchSchema
19. **GAP-049-038** [MEDIUM] - Add isFeaturedInWebsite to PostAdminSearchSchema
20. **GAP-049-039** [MEDIUM] - Handle empty API response body in admin frontend
21. **GAP-049-040** [MEDIUM] - Validate sort JSON structure in EntityListPage with Zod
22. **GAP-049-048** [MEDIUM] - Add tx parameter to findAllWithRelations() (defer to DB cleanup spec)
23. **GAP-049-025** [MEDIUM] - Handle entities without lifecycleState (defer to separate spec)
24. **GAP-049-026** [MEDIUM] - Fix owner-promotions frontend status -> isActive
25. **GAP-049-027** [MEDIUM] - Consider _canAdminList() hook (confirmed intentional in Pass 5, defer to separate spec)
26. **GAP-049-028** [MEDIUM] - Simplify pagination double-extraction
27. **GAP-049-015** [MEDIUM] - Fix includeDeleted to use queryBooleanParam()
28. **GAP-049-016** [MEDIUM] - Update spec for field name deviations (no code change)
29. **GAP-049-017** [MEDIUM] - Add deletedAt column existence check
30. **GAP-049-005** [MEDIUM] - Write missing schema unit tests
31. **GAP-049-006** [MEDIUM] - Write DB layer additionalConditions tests

### Nice to Have (P3/P4) .. 21 items

32. **GAP-049-036** [MEDIUM->DEFER] - entityFilters type safety (requires architecture change, defer to separate spec)
33. **GAP-049-044** [LOW but BLOCKING] - Create test infrastructure (admin-test-factory.ts) .. MUST precede GAP-002/003
34. **GAP-049-051** [MEDIUM] - Add list() search OR-specific unit tests in list.test.ts (Pass 6)
35. **GAP-049-041** [LOW] - parseAdminSort type assertion without runtime validation
36. **GAP-049-042** [LOW] - BaseModel.count() inconsistent undefined handling
37. **GAP-049-043** [LOW] - Document includeDeleted + status=all interaction
38. **GAP-049-045** [LOW] - Include response data in Zod validation error messages
39. **GAP-049-046** [LOW] - Add UI indicator for active default filters
40. **GAP-049-050** [LOW] - Document averageRating numeric() returns strings (toString() is actually correct)
41. **GAP-049-052** [LOW] - Replace includeDeleted inline z.preprocess with queryBooleanParam() (Pass 6)
42. **GAP-049-029** [LOW] - Exchange rate route inconsistency (informational)
43. **GAP-049-030** [LOW] - Response schema inconsistency (informational)
44. **GAP-049-031** [LOW] - UserModel unbounded query risk
45. **GAP-049-009** [LOW] - Fix sponsorship filter name (subsumed by GAP-049-013)
46. **GAP-049-007** [LOW] - Add list() search OR regression test
47. **GAP-049-018** [LOW] - Validate inverted date ranges (defer or leave as-is)
48. **GAP-049-019** [LOW] - Add getTable() to BaseModel interface
49. **GAP-049-008** [LOW] - LIKE wildcard escaping (defer to separate spec)
50. **GAP-049-010** [LOW] - UserService pattern deviation (informational, no action)
51. **GAP-049-004** [LOW/INFORMATIONAL] - toString() in rating comparisons is actually correct for numeric() columns (downgraded in Pass 5)
52. **GAP-049-014** [RESOLVED] - defaultFilters ARE applied (Pass 5 corrected: code works at createEntityApi.ts:62-67, UX issue tracked in GAP-046)
53. **GAP-049-053** [MEDIUM] - BaseModel type interface in service-core/types has `tx?: unknown` instead of proper Drizzle type (Pass 7)
54. **GAP-049-054** [LOW] - Sort format mismatch exists in 3 locations, not just createEntityApi.ts (Pass 7 refinement of GAP-001)

---

## PASS 7 NEW GAPS

---

## GAP-049-053: BaseModel Type Interface Has `tx?: unknown` Instead of Proper Drizzle Type [MEDIUM]

**Found in**: Audit Pass 7 (DB models audit agent)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

The `BaseModel` type interface in `packages/service-core/src/types/index.ts` declares the `count()` method signature with `tx?: unknown` instead of the proper Drizzle transaction type (`NodePgDatabase<typeof schema>`). This creates a type safety gap between the interface that services program against and the actual BaseModel implementation.

### Evidence

- **Interface** (`packages/service-core/src/types/index.ts` ~line 140): `count(where: Record<string, unknown>, options?: { additionalConditions?: SQL[]; tx?: unknown }): Promise<number>`
- **Implementation** (`packages/db/src/base/base.model.ts` line 254): `count(where: Record<string, unknown>, options?: { additionalConditions?: SQL[]; tx?: NodePgDatabase<typeof schema> }): Promise<number>`
- The `tx` parameter in the interface is typed as `unknown` but the implementation expects the proper Drizzle transaction type

### Impact

- TypeScript won't warn if an incorrect value is passed as `tx` through the interface
- Services using the interface type lose autocomplete and type checking for the transaction parameter
- No RUNTIME impact since the actual implementation receives the value correctly

### Proposed Solutions

**Option A (recommended): Update interface to use proper type**
```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
// ... in interface:
tx?: NodePgDatabase<typeof schema>
```
- Complexity: 1

**Option B: Use a generic transaction type**
```ts
tx?: Parameters<typeof db.transaction>[0] // Or a branded type
```
- Complexity: 2

### Recommendation

**Fix directly in SPEC-049.** One import + one type change. Improves type safety at no cost.

---

## GAP-049-054: Sort Format Mismatch Exists in 3 Frontend Locations [LOW]

**Found in**: Audit Pass 7 (schemas+routes audit agent) .. refinement of GAP-049-001
**Severity**: LOW (subsumes into GAP-049-001 fix)
**Priority**: P3 (fix all 3 together with GAP-049-001)
**Complexity**: Low (1)

### Description

GAP-049-001 documented the sort format mismatch between frontend (JSON array) and backend ("field:dir" string). Pass 7's independent audit discovered that the `JSON.stringify(sort)` pattern exists in THREE separate locations, not just one. All three must be fixed together.

### Evidence

| # | File | Line | Code |
|---|------|------|------|
| 1 | `apps/admin/src/components/entity-list/api/createEntityApi.ts` | 59 | `params.set('sort', JSON.stringify(sort))` |
| 2 | `apps/admin/src/features/destinations/api/getDestinations.ts` | varies | Custom API function with same JSON.stringify pattern |
| 3 | `apps/admin/src/lib/factories/createEntityHooks.ts` | varies | Hook factory using same JSON.stringify pattern |

### Impact

If only `createEntityApi.ts` is fixed (as GAP-049-001 recommends), the other two locations will continue sending the wrong format. Custom entity APIs and hook factories will break sorting.

### Proposed Solution

When fixing GAP-049-001, grep for ALL instances of `JSON.stringify(sort)` in `apps/admin/` and fix them all:
```bash
rg 'JSON.stringify\(sort' apps/admin/src/
```

### Recommendation

**Fix together with GAP-049-001.** Not a separate task, just a reminder to fix ALL instances, not just the primary one.

---

## Pass 7 Refinements to Existing Gaps

### REFINEMENT: GAP-049-001 (Sort Format Mismatch) - Additional Locations

Pass 7 confirmed the sort mismatch affects 3 files (see GAP-049-054). Additionally, the `EntityListPage.tsx` has TWO more locations with the same issue:
- **Line 190**: `JSON.parse(search.sort) as DataTableSort` .. reads sort from URL using wrong format
- **Line 307**: `handleSortChange` writes JSON to URL search params

**Total locations to fix**: 5 files/locations, not 1.

### REFINEMENT: GAP-049-011 (10 Services Missing Overrides) - Reclassification

Pass 7 independently confirmed:
- **9 of the 10 services** work correctly with the default implementation because their entity-specific filters map directly to DB column names. No override is NEEDED for correctness.
- **1 service (eventLocation)** has minCapacity/maxCapacity which REQUIRES an override (already covered by GAP-049-012, which is subsumed by GAP-049-020 since those columns don't exist yet).

**Updated recommendation**: For the 9 working services, consider **Option B** (only add explicit overrides where logic differs) instead of adding 9 passthrough overrides. The boilerplate cost outweighs the consistency benefit. **eventLocation** is the only one that truly needs a fix, and it's blocked by the missing `capacity` column (tracked in GAP-049-020).

### REFINEMENT: GAP-049-002/003 (Missing Tests) - Precise Test Count

Pass 7 quantified existing test coverage precisely:

| Test Layer | Files Found | Test Cases | Coverage |
|------------|------------|------------|----------|
| Schema (queryBooleanParam) | 1 | 17 | 100% |
| Schema (AdminSearchBase) | 1 | 23 | 95% |
| Schema (entity-specific) | 5 files (group-a/b/c, user, sponsorship) | 63 | 95% |
| DB (drizzle-helpers) | 1 | ~15 | 40% |
| DB (base.model) | 1 | ~10 | 20% |
| Service (adminList) | 0 | 0 | **0%** |
| Service (overrides) | 0 | 0 | **0%** |
| Integration (routes) | 0 | 0 | **0%** |
| **TOTAL** | **9 existing** | **~128** | **~20%** |

**34 test files required** to reach 90% target. Estimated effort: 44-58 hours.

---

## GAP-049-055: adminList() Inner safeParse Reads Raw params Not Validated Copy [HIGH]

**Found in**: Audit Pass 8
**Severity**: HIGH
**Priority**: P1
**Complexity**: Low (1)

### Description

In `adminList()` (`packages/service-core/src/base/base.crud.read.ts` ~line 312), the inner `this.adminSearchSchema.safeParse(params)` operates on the raw outer `params` object, not on the `_passthrough` variable that comes from `runWithLoggingAndValidation`'s outer schema validation.

The outer `runWithLoggingAndValidation` call uses `schema: z.record(z.string(), z.unknown())` and passes `_passthrough` to the `execute` callback. But the inner `safeParse` reads from the captured closure `params` instead of `_passthrough`.

### Evidence

```ts
// base.crud.read.ts ~line 304-312
return this.runWithLoggingAndValidation({
    schema: z.record(z.unknown()),
    execute: async (_passthrough, validatedActor) => {
        // ...
        const parseResult = this.adminSearchSchema.safeParse(params);  // <-- reads raw `params`, not `_passthrough`
    }
});
```

### Impact

Currently harmless because the outer schema is a transparent passthrough (`z.record(z.unknown())`). But this establishes a pattern that will BREAK if the outer schema ever becomes substantive (e.g., if `runWithLoggingAndValidation` adds normalization, stripping, or transformation to the outer layer).

### Proposed Solutions

**Option A (recommended): Use _passthrough instead of params**
```ts
const parseResult = this.adminSearchSchema.safeParse(_passthrough);
```
- Complexity: 1, zero risk

**Option B: Document the pattern as intentional**
- Add comment explaining the outer schema is transparent
- Complexity: 0

### Recommendation

**Fix directly in SPEC-049 with Option A.** One-line change, eliminates architectural fragility.

---

## GAP-049-056: SponsorshipService._executeSearch Uses `limit` Instead of `pageSize` [MEDIUM]

**Found in**: Audit Pass 8 (pre-existing bug, not SPEC-049 specific)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

`SponsorshipService._executeSearch()` (`packages/service-core/src/services/sponsorship/sponsorship.service.ts` ~line 183-185) destructures `limit` from params instead of `pageSize`:

```ts
const { page = 1, limit = 20, ...filterParams } = params;
return this.model.findAll(filterParams, { page, pageSize: limit });
```

The project-wide convention documented in CLAUDE.md is `pageSize` (not `limit`). `AdminSearchBaseSchema` and `PaginationQuerySchema` both use `pageSize`. If the schema sends `pageSize`, the destructuring `limit = 20` will NEVER receive the caller's value and will ALWAYS default to 20, silently ignoring pagination.

### Impact

Sponsorship public search pagination is silently broken .. always returns 20 items regardless of `pageSize` param. This doesn't directly affect `adminList()` (which uses `_executeAdminSearch`, not `_executeSearch`) but represents a pre-existing bug in the public search path.

### Proposed Solutions

**Option A (recommended): Change `limit` to `pageSize`**
```ts
const { page = 1, pageSize = 20, ...filterParams } = params;
return this.model.findAll(filterParams, { page, pageSize });
```
- Complexity: 1

### Recommendation

**Fix as micro-fix alongside SPEC-049** or in a separate cleanup commit. Pre-existing bug, low effort to fix.

---

## GAP-049-057: OwnerPromotionService._executeSearch Uses `limit` Instead of `pageSize` [MEDIUM]

**Found in**: Audit Pass 8 (pre-existing bug, not SPEC-049 specific)
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

Same bug as GAP-049-056 but in `OwnerPromotionService._executeSearch()` (`packages/service-core/src/services/owner-promotion/owner-promotion.service.ts` ~line 106):

```ts
const { page = 1, limit = 20, ...filterParams } = params;
return this.model.findAll(filterParams, { page, pageSize: limit });
```

### Impact

Owner promotion public search pagination silently broken .. always returns 20 items.

### Proposed Solution

Same as GAP-049-056: rename `limit` to `pageSize`.

### Recommendation

**Fix as micro-fix alongside SPEC-049.** Same pattern as GAP-049-056.

---

## GAP-049-058: _executeAdminSearch Parameter Type Not Extracted as Shared Type [LOW]

**Found in**: Audit Pass 8
**Severity**: LOW
**Priority**: P4
**Complexity**: Low (2)

### Description

The `_executeAdminSearch()` parameter type signature is copy-pasted identically into 7 places: the base class `BaseCrudRead` and all 6 service overrides (AccommodationService, EventService, AccommodationReviewService, DestinationReviewService, UserService, SponsorshipService).

```ts
params: {
    readonly where: Record<string, unknown>;
    readonly entityFilters: Record<string, unknown>;
    readonly pagination: { readonly page: number; readonly pageSize: number };
    readonly sort: { readonly sortBy: string; readonly sortOrder: 'asc' | 'desc' };
    readonly search?: SQL;
    readonly extraConditions?: SQL[];
    readonly actor: Actor;
}
```

This violates the project's DRY principle and "Single Source of Truth" policy.

### Proposed Solution

Extract as a named type in the base class:

```ts
export type AdminSearchParams<TEntity> = {
    readonly where: Record<string, unknown>;
    readonly entityFilters: Record<string, unknown>;
    readonly pagination: { readonly page: number; readonly pageSize: number };
    readonly sort: { readonly sortBy: string; readonly sortOrder: 'asc' | 'desc' };
    readonly search?: SQL;
    readonly extraConditions?: SQL[];
    readonly actor: Actor;
};
```

### Recommendation

**Defer to cleanup pass** or fix alongside SPEC-049 Phase 7 tests. Not blocking.

---

## GAP-049-059: EventService._beforeCreate Drops Normalized Fields [HIGH]

**Found in**: Audit Pass 8 (pre-existing bug, not SPEC-049 specific)
**Severity**: HIGH
**Priority**: P1
**Complexity**: Medium (3)

### Description

`EventService._beforeCreate()` (`packages/service-core/src/services/event/event.service.ts` ~lines 162-182) returns only `{ slug }` when generating a slug, discarding ALL other fields from the `normalized` object:

```ts
protected override async _beforeCreate(data, _actor) {
    const normalized = this.normalizeCreateInput(data);
    if (!normalized.slug) {
        const slug = generateSlug(normalized.name);
        return { slug };  // <-- DROPS all other normalized fields!
    }
    return {};
}
```

The `_beforeCreate` hook should return a `Partial<TEntity>` merged into the create payload. By returning only `{ slug }`, any other computed/transformed fields from `normalizeCreateInput()` are lost.

### Impact

**Data loss on event creation.** If `normalizeCreateInput` transforms or computes additional fields beyond the slug, those transformations are discarded. The severity depends on what `normalizeCreateInput` does - if it only validates and passes through, the impact is low. But this is architecturally wrong and will cause bugs if normalization is extended.

### Proposed Solution

```ts
return { ...normalized, slug };
// or, if normalizeCreateInput only needs to produce slug:
return { slug };  // with a comment explaining this is intentional
```

### Recommendation

**Fix as pre-existing bug** alongside SPEC-049 or as a separate fix. Needs investigation of what `normalizeCreateInput` actually does for events.

---

## GAP-049-060: Review Schema minRating/maxRating Use .int() on Decimal Column [MEDIUM]

**Found in**: Audit Pass 8
**Severity**: MEDIUM
**Priority**: P2
**Complexity**: Low (1)

### Description

Both `AccommodationReviewAdminSearchSchema` and `DestinationReviewAdminSearchSchema` define `minRating` and `maxRating` with `z.coerce.number().int().min(1).max(5)`. The `.int()` constraint means only whole numbers (1, 2, 3, 4, 5) pass validation. But the `averageRating` column is `numeric(3,2)` which stores decimal values like 4.75, 3.50, etc.

### Evidence

```ts
// accommodationReview.admin-search.schema.ts ~lines 73-88
minRating: z.coerce.number().int().min(1).max(5).optional()
maxRating: z.coerce.number().int().min(1).max(5).optional()
```

### Impact

An admin trying to filter reviews with `?minRating=4.5` gets a VALIDATION_ERROR. They can only filter by integer boundaries (1, 2, 3, 4, 5). For a 5-star system with decimal averages, this significantly reduces filtering precision. An admin looking for "above average" reviews (e.g., >= 3.5) cannot express this filter.

### Proposed Solution

Remove `.int()` and keep decimal support:

```ts
minRating: z.coerce.number().min(1).max(5).optional()
maxRating: z.coerce.number().min(1).max(5).optional()
```

### Recommendation

**Fix directly in SPEC-049.** One-line change per schema. Low risk.

---

## GAP-049-061: import type { z } in 2 Schema Files Inconsistent with Value Import Pattern [LOW]

**Found in**: Audit Pass 8
**Severity**: LOW
**Priority**: P4
**Complexity**: Low (1)

### Description

Two entity admin-search schema files use `import type { z } from 'zod'` instead of `import { z } from 'zod'`:
- `packages/schemas/src/entities/postSponsor/postSponsor.admin-search.schema.ts` line 1
- `packages/schemas/src/entities/eventOrganizer/eventOrganizer.admin-search.schema.ts` line 1

All 14 other entity admin-search schemas use value imports (`import { z } from 'zod'`). The `import type` works because `z` is only used for `z.infer<...>` type inference in these files. But if someone adds runtime `z` usage (e.g., a new Zod schema), the `import type` will silently fail at compile time.

### Proposed Solution

Change to `import { z } from 'zod'` for consistency.

### Recommendation

**Fix as micro-fix.** Not blocking.

---

## Pass 8 Refinements to Existing Gaps

### REFINEMENT: GAP-049-043 (includeDeleted + status Interaction) - Specific Scenario

Pass 8 service-core agent identified a specific problematic combination: when `includeDeleted=true` AND `status=ACTIVE`, the where clause contains `{ lifecycleState: 'ACTIVE' }` WITHOUT a `deletedAt` filter. This means soft-deleted records that happened to have `lifecycleState='ACTIVE'` at the time of deletion WILL be returned. This is almost certainly unintentional. Upgrading from LOW to **MEDIUM** priority.

### REFINEMENT: GAP-049-005 (Missing Schema Tests) - Review Schemas at 0%

Pass 8 test coverage agent confirmed that `AccommodationReviewAdminSearchSchema` and `DestinationReviewAdminSearchSchema` have **zero test coverage** in any of the group test files (group-a/b/c). These are the ONLY two entity admin-search schemas without any tests. All other 14 are covered.

### REFINEMENT: GAP-049-054 (Sort Format in 3 Files) - Param Construction Duplication

Pass 8 frontend agent identified that `createEntityHooks.ts` duplicates the ENTIRE API parameter construction logic from `createEntityApi.ts`, not just the sort format. Both independently build `URLSearchParams` with identical logic for page, pageSize, search, and sort. Any fix must be applied in BOTH places. A shared `buildAdminQueryParams()` utility should be extracted.

### REFINEMENT: GAP-049-042 (count() Inconsistent undefined Handling) - Pattern Detail

Pass 8 DB agent confirmed the specific pattern: `count()` passes `baseWhereClause` (which can be `undefined`) directly into `and(baseWhereClause, ...additionalConditions)`, relying on Drizzle's silent undefined dropping. Both `findAll()` and `findAllWithRelations()` use an explicit accumulator array pattern that avoids passing undefined to `and()`. The inconsistency is confirmed as a readability/fragility issue.

---

## Overall Implementation Status (Revised Pass 10 - Post Remediation)

### By Phase

| Phase | Description | Status | Completion |
|-------|-------------|--------|------------|
| Phase 0 | Prerequisites (enum, boolean fix, averageRating) | DONE | 100% |
| Phase 1 | Infrastructure (buildWhereClause, BaseModel) | DONE | 100% |
| Phase 2 | Fix search OR bug in list() | DONE | 100% |
| Phase 3 | Core adminList() infrastructure | DONE | 100% |
| Phase 4 | Sponsorship schema migration | DONE | 100% |
| Phase 5 | Services (wire adminSearchSchema + overrides) | DONE | 100% |
| Phase 6 | Routes (switch to adminList()) | DONE | 100% |
| Phase 7 | Testing | **PARTIAL** | **60%** (schema + DB tests done, service-core unit tests remaining) |
| Phase 8 | Verification | NOT STARTED | 0% |

### By Category (Revised Pass 10)

| Category | Done | Total | % |
|----------|------|-------|---|
| Schemas & enums | 14/14 | 14 | 100% |
| DB layer (model + helpers) | 12/12 | 12 | 100% |
| Service core (adminList base) | 3/3 | 3 | 100% |
| Service overrides (_executeAdminSearch) | 16/16 | 16 | 100% |
| Routes (switch to adminList) | 16/16 | 16 | 100% |
| Frontend compatibility fixes | 12/12 | 12 | 100% |
| Unit tests | 11/18 | 18 | 61% |
| Integration tests | 0/8 | 8 | 0% |
| Test infrastructure | 0/1 | 1 | 0% |
| Code quality fixes | 13/13 | 13 | 100% |
| Pre-existing bugs discovered | 3/3 | 3 | 100% |
| **TOTAL** | **100/116** | **116** | **86%** |

### Gap Distribution (Pass 10 Final)

| Severity | Open | Resolved | Deferred | Not Real | Doc-Only |
|----------|------|----------|----------|----------|----------|
| **CRITICAL** (6) | 0 | 6 | 0 | 0 | 0 |
| **HIGH** (11) | 2 | 7 | 0 | 1 | 1 |
| **MEDIUM** (26) | 0 | 18 | 5 | 2 | 1 |
| **LOW** (20) | 1 | 12 | 3 | 2 | 2 |
| **TOTAL** (63) | **3** | **43** | **8** | **5** | **4** |

### Remaining Open Gaps

| GAP ID | Severity | Description | Action Needed |
|--------|----------|-------------|---------------|
| GAP-002 | HIGH | Missing adminList() service-core unit tests | Write tests for adminList + _executeAdminSearch |
| GAP-003 | HIGH | Missing integration tests for 16 admin routes | Write route integration tests |
| GAP-044 | LOW | Test infrastructure (factories, helpers) | Create test helpers for service-core |

---

## GAP-049-062: Sort Validation Rejects at Zod Level With 400 Error [MEDIUM]

**Found in**: Audit Pass 9
**Severity**: MEDIUM (upgrade from informational - impacts UX)
**Priority**: P2
**Complexity**: Low (1)

### Description

The sort format mismatch (GAP-001) does NOT produce a "silent fallback" to default sort. The end-to-end flow verification in Pass 9 confirmed that:

1. Frontend sends `sort=JSON.stringify([{id:"name",desc:false}])` as URL param
2. Hono route factory validates query params against the entity's AdminSearchSchema
3. Zod regex `/^[a-zA-Z_]+:(asc|desc)$/` REJECTS the JSON string
4. Route returns **HTTP 400 VALIDATION_ERROR** to the frontend

This means admin list pages that attempt ANY sorting will get a 400 error response, not silently fall back to `createdAt:desc`. The admin UI must handle this error or sorting is completely broken for end users.

### Evidence

- Backend regex: `packages/schemas/src/common/admin-search.schema.ts:62-68`
- Frontend serialization: `apps/admin/src/components/entity-list/api/createEntityApi.ts:58-60`
- Route validation: `apps/api/src/utils/route-factory.ts:336-341` (Hono `valid('query')`)

### Impact

All 16 admin list pages will fail with 400 error when user clicks any column header to sort. This is worse than silent fallback because it breaks the entire page load if sort is part of the default query.

### Proposed Solution

Same fix as GAP-001: transform frontend sort from `SortConfig[]` to `"field:direction"` string before URL serialization. Priority should be aligned with GAP-001.

### Recommendation

**Fix together with GAP-001.** This is a detail/refinement of GAP-001 that clarifies the actual failure mode.

---

## GAP-049-063: AdminSearchBaseSchema Status Enum Values Don't Match Spec [LOW]

**Found in**: Audit Pass 9
**Severity**: LOW
**Priority**: P3
**Complexity**: Low (1)

### Description

The `AdminSearchBaseSchema` defines `status` with enum values `['all', 'active', 'inactive', 'deleted']` (lowercase), but the SPEC-049 document describes status values as `DRAFT`, `ACTIVE`, `ARCHIVED` (uppercase, different values). This creates a semantic mismatch:

- Schema has `inactive` but spec says `DRAFT`
- Schema has `deleted` but spec says `ARCHIVED`
- Schema values are lowercase, spec values are uppercase

### Evidence

- Schema: `packages/schemas/src/common/admin-search.schema.ts` - `z.enum(['all', 'active', 'inactive', 'deleted'])`
- Spec: SPEC-049 describes `status: DRAFT | ACTIVE | ARCHIVED | all`

### Impact

Low. The schema IS the source of truth for the actual implementation. The spec may be outdated or the implementation diverged intentionally. The current enum values work with the `lifecycleState` column values in the DB (which should be verified).

### Proposed Solution

1. **Option A**: Update the spec to match the schema (document the actual values)
2. **Option B**: Update the schema to match the spec (requires verifying all `lifecycleState` enum values in DB)
3. **Option C**: Leave as-is with a note that spec and implementation diverged intentionally

### Recommendation

**Option A** (update spec). The code is working, the spec should reflect reality. Address during spec cleanup.

---

## Pass 9 Refinements to Existing Gaps

### REFINEMENT: GAP-049-001 (Sort Format Mismatch) - Failure Mode Clarified

Pass 9 end-to-end verification confirmed the EXACT failure mode: Zod validation in the route factory (not adminList()) catches the invalid format and returns HTTP 400. The sort parameter NEVER reaches `parseAdminSort()` or `adminList()`. This is actually worse than previously assumed because: (a) the error prevents page load entirely if sort is in the default query, and (b) the user sees a network error, not a graceful fallback. See also GAP-049-062.

### REFINEMENT: GAP-049-021 (UserModel.findAll() Drops additionalConditions) - Biome Convention Confirmed

Pass 9 verification confirmed the parameter is named `_additionalConditions` (with underscore prefix). In Biome lint, the underscore prefix explicitly means "this parameter is intentionally unused." This confirms it was DELIBERATELY dropped, not accidentally. The original developer may not have known about the adminList() use case. This makes the fix more nuanced: simply removing the underscore and using the parameter may cause Biome lint warnings elsewhere if the parameter was previously necessary for signature compatibility.

### REFINEMENT: GAP-049-011 (10 Services Missing Overrides) - Override Count Verified

Pass 9 independently verified exactly **6** services have `_executeAdminSearch()` overrides: AccommodationService, AccommodationReviewService, DestinationReviewService, EventService, SponsorshipService, UserService. The remaining **10** services in scope (Amenity, Attraction, Destination, EventLocation, EventOrganizer, Feature, OwnerPromotion, Post, PostSponsor, Tag) use the default base implementation. Additional services outside the 16-route scope (exchange-rate, permission, sponsorshipLevel, sponsorshipPackage, userBookmark, postSponsorship) also lack overrides but are NOT in scope for SPEC-049.
