# SPEC-060: Model Subclass Transaction Propagation — Task List

**Status**: pending  
**Total tasks**: 35  
**Average complexity**: 2.4  
**Created**: 2026-04-09

---

## Summary

Fix 51 `getDb()` call sites in 18 model files so all model methods accept and propagate an optional `tx?: DrizzleClient` parameter. Also fix 16 LSP violations in `findWithRelations` overrides (narrowed `relations` type). Mechanical 6-step pattern applied per method across 5 implementation phases.

---

## Phase: setup

- [ ] **T-001** `[complexity:1]` Run pre-implementation audit grep commands
  - Count getDb() call sites (expect ~51)
  - Verify DrizzleClient is exported from @repo/db index
  - Verify BaseModel.getClient(tx) method exists
  - Confirm findAll tx is 4th positional parameter
  - Confirm count() uses { tx } options object pattern
  - Verify reference impls (rRolePermission, rUserPermission) exist

- [ ] **T-002** `[complexity:1]` Document tx threading patterns with code examples
  - Document 6-step mechanical pattern
  - Document findAll 4th-positional gotcha
  - Document count() options-object gotcha
  - Document findWithRelations fallback tx threading

---

## Phase: phase0 — Reference Implementations

> These are the pattern examples. Get them right before proceeding.

- [ ] **T-003** `[complexity:2]` Fix LSP violation in RRolePermissionModel
  - Replace NodePgDatabase with DrizzleClient import
  - Fix relations type to include Record<string, unknown>
  - Verify no getDb() calls remain in this file
  - Write/update unit tests for findWithRelations tx threading
  - **Blocked by**: T-001

- [ ] **T-004** `[complexity:2]` Fix LSP violation in RUserPermissionModel
  - Replace NodePgDatabase with DrizzleClient import
  - Fix relations type to include Record<string, unknown>
  - Verify no getDb() calls remain in this file
  - Write/update unit tests for findWithRelations tx threading
  - **Blocked by**: T-001

- [ ] **T-005** `[complexity:1]` Verify Phase 0 reference implementations compile correctly
  - Run pnpm typecheck --filter @repo/db
  - Grep zero NodePgDatabase in both files
  - Grep zero narrow relations type in both files
  - **Blocked by**: T-003, T-004
  - **Blocks**: T-006, T-007, T-008, T-009, T-010, T-011

---

## Phase: phase1 — Simple Models (findWithRelations only)

> All can run in parallel after T-005.

- [ ] **T-006** `[complexity:2]` Fix tx propagation in AmenityModel.findWithRelations
  - File: `packages/db/src/models/accommodation/amenity.model.ts`
  - Replace getDb() with this.getClient(tx)
  - Fix findWithRelations signature (relations type + tx param)
  - Thread tx to this.findOne(where, tx)
  - Swap imports
  - Write unit tests (backward compat + tx threading)
  - **Blocked by**: T-005

- [ ] **T-007** `[complexity:2]` Fix tx propagation in RDestinationAttractionModel.findWithRelations
  - File: `packages/db/src/models/destination/rDestinationAttraction.model.ts`
  - Replace getDb() with this.getClient(tx)
  - Fix findWithRelations signature
  - Thread tx to findOne fallback
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-005

- [ ] **T-008** `[complexity:2]` Fix tx propagation in EventModel.findWithRelations
  - File: `packages/db/src/models/event/event.model.ts`
  - Replace getDb() with this.getClient(tx)
  - Fix findWithRelations signature
  - Thread tx to findOne fallback
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-005

- [ ] **T-009** `[complexity:2]` Fix tx propagation in EventOrganizerModel (orphaned root-level file)
  - File: `packages/db/src/models/eventOrganizer.model.ts`
  - Locate exact file path (root-level orphan)
  - Replace getDb() with this.getClient(tx)
  - Fix findWithRelations signature
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-005

- [ ] **T-010** `[complexity:2]` Fix tx propagation in PostSponsorshipModel.findWithRelations
  - File: `packages/db/src/models/post/postSponsorship.model.ts`
  - Replace getDb() with this.getClient(tx)
  - Fix findWithRelations signature
  - Thread tx to findOne fallback
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-005

- [ ] **T-011** `[complexity:1]` Verify Phase 1 typecheck passes
  - Run typecheck --filter @repo/db
  - Run grep zero getDb() on phase 1 files
  - Run phase 1 model tests
  - **Blocked by**: T-006, T-007, T-008, T-009, T-010

---

## Phase: phase2 — Few-Methods Models

> T-012 through T-017 can run in parallel after T-011.

- [ ] **T-012** `[complexity:3]` Fix tx propagation in PostModel custom methods
  - File: `packages/db/src/models/post/post.model.ts`
  - Fix incrementLikes: add tx param + replace getDb()
  - Fix decrementLikes: add tx param + replace getDb()
  - Fix findWithRelations: relations type + tx + thread to findOne
  - Swap imports
  - Write unit tests for all 3 methods
  - **Blocked by**: T-011

- [ ] **T-013** `[complexity:3]` Fix tx propagation in SponsorshipLevelModel
  - File: `packages/db/src/models/sponsorship/sponsorshipLevel.model.ts`
  - Fix findBySlug: add tx + replace getDb()
  - Fix findActiveByTargetType delegate: `this.findAll(where, undefined, undefined, tx)` (4th positional!)
  - Fix findWithRelations: type + tx + findOne threading
  - Swap imports
  - Write unit tests including delegate tx pattern
  - **Blocked by**: T-011

- [ ] **T-014** `[complexity:3]` Fix tx propagation in SponsorshipPackageModel
  - File: `packages/db/src/models/sponsorship/sponsorshipPackage.model.ts`
  - Fix findBySlug: add tx + replace getDb()
  - Fix findActive delegate: `this.findAll(where, undefined, undefined, tx)` (4th positional!)
  - Fix findWithRelations: type + tx + findOne threading
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-011

- [ ] **T-015** `[complexity:3]` Fix tx propagation in OwnerPromotionModel
  - File: `packages/db/src/models/owner-promotion/ownerPromotion.model.ts`
  - Fix findBySlug, findActiveByAccommodationId, findActiveByOwnerId: add tx + replace getDb()
  - Fix findByOwnerId delegate: `this.findAll(where, undefined, undefined, tx)` (4th positional!)
  - Fix findWithRelations: type + tx
  - Swap imports
  - Write unit tests for all methods
  - **Blocked by**: T-011

- [ ] **T-016** `[complexity:3]` Fix tx propagation in SponsorshipModel custom methods
  - File: `packages/db/src/models/sponsorship/sponsorship.model.ts`
  - Fix findBySlug and findActiveByTarget: add tx + replace getDb()
  - Fix findBySponsorUserId and findByStatus delegates
  - Fix findWithRelations
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-011

- [ ] **T-017** `[complexity:2]` Fix tx propagation in RevalidationConfigModel
  - File: `packages/db/src/models/revalidation/revalidation-config.model.ts`
  - Fix findByEntityType: add tx + replace getDb()
  - Fix findAllEnabled: add tx + replace getDb()
  - Check if findWithRelations exists — fix if present
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-011

- [ ] **T-020** `[complexity:1]` Verify Phase 2 typecheck passes
  - Run typecheck --filter @repo/db
  - Grep zero getDb() on all phase 2 files
  - Run phase 2 model tests
  - **Blocked by**: T-012, T-013, T-014, T-015, T-016, T-017

---

## Phase: phase3 — Moderate Complexity Models

> T-018, T-019, T-021, T-022, T-023 can run in parallel after T-011/T-020.

- [ ] **T-018** `[complexity:3]` Fix tx propagation in RevalidationLogModel
  - File: `packages/db/src/models/revalidation/revalidation-log.model.ts`
  - Fix deleteOlderThan: add tx + replace getDb() (critical for tx atomicity)
  - Fix findWithFilters: add tx + replace getDb()
  - Fix findLastCronEntry: add tx + replace getDb()
  - Fix findWithRelations if present
  - Swap imports
  - Write unit tests including tx atomicity test for deleteOlderThan
  - **Blocked by**: T-011

- [ ] **T-019** `[complexity:3]` Fix tx propagation in RAccommodationAmenityModel
  - File: `packages/db/src/models/accommodation/rAccommodationAmenity.model.ts`
  - Fix countAccommodationsByAmenityIds: add tx + replace getDb()
  - Fix findWithRelations: type + tx
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-011

- [ ] **T-021** `[complexity:3]` Fix tx propagation in RAccommodationFeatureModel
  - File: `packages/db/src/models/accommodation/rAccommodationFeature.model.ts`
  - Fix countAccommodationsByFeatureIds: add tx + replace getDb()
  - Fix findWithRelations: type + tx
  - Swap imports
  - Write unit tests
  - **Blocked by**: T-020

- [ ] **T-022** `[complexity:3]` Fix tx propagation in REntityTagModel
  - File: `packages/db/src/models/tag/rEntityTag.model.ts`
  - Fix findAllWithTags: add tx + replace getDb()
  - Fix findAllWithEntities: add tx + replace getDb()
  - Fix findPopularTags: add tx + replace getDb()
  - Fix findWithRelations: type + tx
  - Swap imports
  - Write unit tests for all methods
  - **Blocked by**: T-020

- [ ] **T-023** `[complexity:4]` Fix tx propagation in ExchangeRateModel (subquery pattern)
  - File: `packages/db/src/models/exchange-rate/exchange-rate.model.ts`
  - Fix findLatestRate and findLatestRates: add tx + replace getDb()
  - Fix findRateHistory and findManualOverrides: add tx + replace getDb()
  - **CRITICAL**: Fix findAllWithDateRange subquery: single `this.getClient(tx)` call for both outer and inner query
  - Swap imports
  - Write unit tests including subquery tx test
  - **Blocked by**: T-020

- [ ] **T-024** `[complexity:1]` Verify Phase 3 typecheck passes
  - Run typecheck --filter @repo/db
  - Grep zero getDb() on all phase 3 files
  - Run phase 3 model tests
  - **Blocked by**: T-018, T-019, T-021, T-022, T-023

---

## Phase: phase4 — Complex Models

> These are the hardest. Do AccommodationModel first (T-025/T-026), then DestinationModel (T-028/T-029).

- [ ] **T-025** `[complexity:4]` Fix tx in AccommodationModel.countByFilters and search methods
  - File: `packages/db/src/models/accommodation/accommodation.model.ts`
  - Fix countByFilters: add tx + replace getDb()
  - Fix search: add tx + replace getDb()
  - Fix searchWithRelations: add tx + thread to internal search call
  - Write unit tests for these 3 methods
  - **Blocked by**: T-024

- [ ] **T-026** `[complexity:4]` Fix tx in AccommodationModel.findTopRated, updateStats, findWithRelations
  - File: `packages/db/src/models/accommodation/accommodation.model.ts` (continued)
  - Fix findTopRated: add tx + replace getDb()
  - Fix updateStats delegate: thread tx to BaseModel call
  - Fix findWithRelations: LSP type fix + tx + findOne threading
  - Swap imports
  - Write unit tests for remaining methods
  - **Blocked by**: T-025

- [ ] **T-027** `[complexity:1]` Verify AccommodationModel typecheck and tests pass
  - Grep zero getDb() in accommodation.model.ts
  - Run typecheck
  - Run accommodation model tests
  - **Blocked by**: T-026

- [ ] **T-028** `[complexity:4]` Fix tx in DestinationModel traversal methods
  - File: `packages/db/src/models/destination/destination.model.ts`
  - Fix findChildren: add tx + replace getDb()
  - **CRITICAL**: Fix findDescendants recursive: thread tx through ALL recursive calls
  - **CRITICAL**: Fix findAncestors recursive: thread tx through ALL recursive calls
  - Fix findByPath: add tx + replace getDb()
  - Write unit tests including recursive tx threading tests
  - **Blocked by**: T-024, T-027

- [ ] **T-029** `[complexity:4]` Fix tx in DestinationModel search and aggregate methods
  - File: `packages/db/src/models/destination/destination.model.ts` (continued)
  - Fix findAllByAttractionId, getAttractionsMap, search, countByFilters
  - Fix searchWithAttractions: thread tx to internal N+1 calls
  - Fix isDescendant delegate: thread tx to findAncestors call
  - Fix findWithRelations: LSP type fix + tx + findOne threading
  - Swap imports
  - Write unit tests for all remaining methods
  - **Blocked by**: T-028

- [ ] **T-030** `[complexity:1]` Verify DestinationModel typecheck and tests pass
  - Grep zero getDb() in destination.model.ts
  - Run typecheck
  - Run destination model tests
  - **Blocked by**: T-029

---

## Phase: verification — Final Checks

- [ ] **T-031** `[complexity:2]` Run final verification grep commands
  - Grep 1: zero getDb() in model subclasses (excluding base.model.ts)
  - Grep 2: zero narrow relations types (LSP violations)
  - Grep 3: zero getDb imports in non-base files
  - Grep 4: zero findAll(where, tx) 2nd-positional mistakes
  - **Blocked by**: T-030

- [ ] **T-032** `[complexity:2]` Run full typecheck on @repo/db package
  - Run pnpm typecheck --filter @repo/db
  - Fix any LSP type errors if found
  - Fix any findAll arity errors if found
  - Fix any count() options errors if found
  - **Blocked by**: T-031

- [ ] **T-033** `[complexity:2]` Run full test suite for @repo/db models
  - Run pnpm test --filter @repo/db
  - Fix any failing tests
  - Run pnpm typecheck --filter @repo/service-core
  - Run pnpm typecheck --filter apps/api
  - **Blocked by**: T-032

- [ ] **T-034** `[complexity:1]` Run biome lint on modified model files
  - Run pnpm lint --filter @repo/db
  - Fix any useDefaultParameterLast violations (tx must be last)
  - Fix any noUnusedVariables violations
  - Fix any import ordering issues
  - **Blocked by**: T-033

- [ ] **T-035** `[complexity:1]` Update SPEC-060 status to completed
  - Confirm all 4 spec greps return zero results
  - Confirm pnpm typecheck exits 0
  - Confirm pnpm test exits 0
  - Confirm pnpm lint exits 0
  - Update state.json summary and task statuses
  - Update index.json SPEC-060 entry to completed
  - **Blocked by**: T-034

---

## Critical Gotchas Reference

| Gotcha | Correct pattern |
|--------|----------------|
| `findAll` tx position | 4th positional: `this.findAll(where, undefined, undefined, tx)` |
| `count` tx position | Options object: `this.count(where, { tx })` |
| `findWithRelations` fallback | MUST pass tx: `this.findOne(where, tx)` |
| Subquery pattern | Assign `const db = this.getClient(tx)` ONCE, use same reference for both outer and inner queries |
| Recursive methods | Thread tx to EVERY recursive call (findDescendants, findAncestors in DestinationModel) |
| N+1 patterns | Thread tx to EVERY inner loop call |
| LSP fix required | `Record<string, boolean>` → `Record<string, boolean \| Record<string, unknown>>` |
| Import swap | Remove `getDb` import, add `import type { DrizzleClient } from '@repo/db'` |

---

## Parallel Execution Tracks

```
Phase 0:   T-003 ─┐
           T-004 ─┴─ T-005

Phase 1:   T-006 ─┐
           T-007  │
           T-008  ├─ T-011
           T-009  │
           T-010 ─┘

Phase 2:   T-012 ─┐
           T-013  │
           T-014  │
           T-015  ├─ T-020
           T-016  │
           T-017 ─┘

Phase 3:   T-018 ─┐
           T-019  │
           T-021  ├─ T-024
           T-022  │
           T-023 ─┘

Phase 4a:  T-025 → T-026 → T-027 ─┐
Phase 4b:  T-028 → T-029 → T-030 ─┴─ T-031

Verify:    T-031 → T-032 → T-033 → T-034 → T-035
```

## Critical Path

T-001 → T-003/T-004 → T-005 → T-006..T-010 → T-011 → T-012..T-017 → T-020 → T-018..T-023 → T-024 → T-025 → T-026 → T-027 → T-028 → T-029 → T-030 → T-031 → T-032 → T-033 → T-034 → T-035

**Longest sequential chain**: setup → phase0 → phase1 → phase2 → phase3 → phase4 (Destination) → verification
