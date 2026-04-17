# SPEC-063: Lifecycle State Standardization

## Progress: 18/63 tasks (28.6%)

**Last updated:** 2026-04-17T18:35:00Z
**Status:** in-progress (Phase 2 — admin UI migration complete; apps/admin typecheck clean for SPEC-063)

**Average Complexity:** 2.1/2.5 (ceiling)
**Critical Path (post-replan):** T-003 -> T-007 -> T-010 -> T-013 -> T-016a -> T-017 -> T-018a -> T-018c -> T-027 -> T-028 -> T-030 -> T-034 -> T-035 -> T-038 -> T-039 -> T-040 -> T-042 -> T-058 (18 steps)
**Parallel Tracks:** 3 identified (Phase 1 tests, Phase 2 migration, Phase 2 schemas after T-003)

---

## Phase 1 — AccommodationReview (verification, parallel with Phase 2)

- [ ] **T-001** (complexity: 2) — Write AccommodationReview schema + access verification tests
  - Verifies existing behavior, no code changes
  - Blocked by: none · Blocks: T-058

- [ ] **T-002** (complexity: 2) — Write AccommodationReview CRUD + admin-search verification tests
  - Verifies existing behavior
  - Blocked by: none · Blocks: T-058

## Phase 2 — OwnerPromotion (DB migration + full stack)

### Database

- [x] **T-003** (complexity: 2) — Update OwnerPromotion Drizzle DB schema: remove isActive, add lifecycleState
  - COMPLETED 2026-04-17 · lint: pass · typecheck: deferred (cascade)
  - Blocked by: none · Blocks: T-004, T-007, T-011

- [ ] **T-004** (complexity: 2.5) — Generate OwnerPromotion up migration with data migration
  - Blocked by: T-003 · Blocks: T-005, T-006

- [ ] **T-005** (complexity: 2) — Write OwnerPromotion down/rollback migration
  - Blocked by: T-004 · Blocks: T-006

- [ ] **T-006** (complexity: 2.5) — Write OwnerPromotion migration data integrity tests
  - Blocked by: T-005 · Blocks: none

### Zod Schemas

- [x] **T-007** (complexity: 2) — Update OwnerPromotion Zod base schema + fixtures
  - COMPLETED 2026-04-17 · lint: pass · typecheck: deferred (cascade)
  - BONUS: also renamed `isActive` → `lifecycleState` in legacy `OwnerPromotionSearchSchema` inside same file
  - Blocked by: T-003 · Blocks: T-008, T-009, T-010, T-011, T-019

- [x] **T-008** (complexity: 2) — Update OwnerPromotion access + CRUD schemas
  - COMPLETED 2026-04-17 · lint: pass · typecheck: pass for file (2 errors fixed); remaining errors are T-009/T-010/T-019 scope
  - Blocked by: T-007 · Blocks: T-013, T-019

- [x] **T-009** (complexity: 2) — Update OwnerPromotion query + admin-search schemas
  - COMPLETED 2026-04-17 · lint: pass · typecheck: resolves query.schema.ts L131/L178
  - Blocked by: T-007 · Blocks: T-013, T-020

- [x] **T-010** (complexity: 2.5) — Update OwnerPromotion HTTP schema + conversion function
  - COMPLETED 2026-04-17 · lint: pass · typecheck: resolves http.schema.ts L123/L169/L194
  - `packages/schemas` SOURCE now 100% typecheck-clean for OwnerPromotion; only test files remain (T-019/T-020)
  - Blocked by: T-007 · Blocks: T-013, T-020

### Model + Service

- [x] **T-011** (complexity: 2) — Update OwnerPromotion model findActive methods to use lifecycleState
  - COMPLETED 2026-04-17 · lint: pass · typecheck: `packages/db` fully clean
  - Blocked by: T-003, T-007 · Blocks: T-012, T-014, T-015, T-023

- [x] **T-012** (complexity: 2.5) — Update OwnerPromotion service: inject lifecycleState=ACTIVE default
  - COMPLETED 2026-04-17 · lint: pass · typecheck: service-core clean for SPEC-063 (unrelated SPEC-066 preexisting error in getById.test.ts)
  - AC-005-01: public endpoints only return ACTIVE records
  - Scope creep absorbed: also migrated `test/factories/ownerPromotionFactory.ts` (2 `isActive` refs); no other task covered it
  - Gap flagged: `_executeCount` NOT updated — to revisit with T-022
  - Blocked by: T-011 · Blocks: T-013, T-022, T-025

### API Routes + Integration

- [x] **T-013** (complexity: 2) — Update admin OwnerPromotion API routes
  - COMPLETED 2026-04-17 · verification-only task, 0 code changes
  - Routes live under `apps/api/src/routes/owner-promotion/admin/` (not `/admin/owner-promotion/` as description suggested); 0 `isActive` refs; consume already-updated Zod schemas (T-008/T-009/T-010)
  - Blocked by: T-008, T-009, T-010, T-012 · Blocks: T-016, T-021

- [x] **T-014** (complexity: 1.5) — Update usage-tracking service MAX_ACTIVE_PROMOTIONS query
  - COMPLETED 2026-04-17 · lint: pass · typecheck: no new SPEC-063 errors
  - Blocked by: T-011 · Blocks: T-024

- [x] **T-015** (complexity: 1.5) — Update limit-enforcement middleware promotion count query
  - COMPLETED 2026-04-17 · lint: pass · typecheck: no new SPEC-063 errors
  - Scope creep absorbed: also migrated `apps/api/test/schema-validation/owner-promotion-getById-schema.test.ts` mock
  - Gap flagged: 5 pre-existing audit-field missings in the schema-validation mock (pre-session bug, not SPEC-063 scope)
  - Blocked by: T-011 · Blocks: T-024

### Admin Frontend

> **REPLAN 2026-04-17T17:55**: T-016 and T-018 split into granular sub-tasks after admin UI scope analysis revealed that the original tasks referenced dead code files and did not cover the live route, types, or dialog components. T-017 retained but scope refined (toggle -> rename+payload). See `progress.md` for details.

- [x] **T-016a** (complexity: 1.5) — Migrate OwnerPromotion local types
  - COMPLETED 2026-04-17 · lint: pass · typecheck: pass for SPEC-063
  - Scope absorbed: also migrated `OwnerPromotionFilters.status` -> `lifecycleState`

- [x] **T-016b** (complexity: 2) — Migrate OwnerPromotion column definition in admin route
  - COMPLETED 2026-04-17 · 3-variant badge (ACTIVE→success, DRAFT→secondary, ARCHIVED→outline)

- [x] **T-016c** (complexity: 1.5) — Delete OwnerPromotion dead code (4 files + index.ts cleanup)
  - COMPLETED 2026-04-17 · 4 files deleted + empty dirs + re-export removed

- [x] **T-016d** (complexity: 1.5) — Migrate OwnerPromotion test fixtures
  - COMPLETED 2026-04-17 · 3 refs migrated (isActive:true→ACTIVE, isActive:false→ARCHIVED)

- [x] **T-017** (complexity: 2.5) — Rename togglePromotionActive -> updatePromotionLifecycle
  - COMPLETED 2026-04-17 · payload `{ isActive }` → `{ lifecycleState }`; hook renamed to `useUpdatePromotionLifecycleMutation`
  - Backend: verified via T-010 (HTTP schema accepts lifecycleState in PATCH)

- [x] **T-018a** (complexity: 2) — Migrate OwnerPromotion admin filter state + dropdown
  - COMPLETED 2026-04-17 · filter state typed as `LifecycleStatusEnum`; dropdown has 4 options (all, DRAFT, ACTIVE, ARCHIVED)

- [x] **T-018b** (complexity: 2) — Migrate OwnerPromotion dialog components
  - COMPLETED 2026-04-17 · DetailDialog badge (3-variant) + FormDialog initial value + added native select field

- [x] **T-018c** (complexity: 2.5) — Migrate OwnerPromotion action handler
  - COMPLETED 2026-04-17 · inline `<select>` (native, consistent with existing filter/discountType selects); aria-label added

### i18n (partial)

- [ ] **T-027** (complexity: 1.5) — i18n locale keys for OwnerPromotion lifecycle
  - **PARTIAL** (absorbed in T-018 block): added `statusDraft`, `statusArchived`, `actions.changeLifecycle`, `form.lifecycleStateLabel` to 3 locales + regenerated types
  - **Remaining scope:** remove legacy `actionActivate`/`actionDeactivate` keys, rename `statuses.inactive`→`statuses.draft`, remove now-unused `statusInactive`
  - Blocked by: T-018c · Blocks: T-028

### Tests

- [ ] **T-019** (complexity: 2) — Update OwnerPromotion schema + CRUD tests
  - Blocked by: T-007, T-008 · Blocks: none

- [ ] **T-020** (complexity: 2) — Update OwnerPromotion admin-search + group tests
  - Blocked by: T-009, T-010 · Blocks: none

- [ ] **T-021** (complexity: 2) — Write OwnerPromotion admin list integration test (AC-001-01)
  - Blocked by: T-013 · Blocks: none

- [ ] **T-022** (complexity: 2) — Write OwnerPromotion public endpoint default ACTIVE test (AC-005-01)
  - Blocked by: T-012 · Blocks: T-058

- [ ] **T-023** (complexity: 2) — Update OwnerPromotion model tests for findActive methods
  - Blocked by: T-011 · Blocks: none

- [ ] **T-024** (complexity: 2) — Write usage-tracking + limit-enforcement tests
  - Blocked by: T-014, T-015 · Blocks: none

### Cron Job (US-007)

- [ ] **T-025** (complexity: 2.5) — Create archive-expired-promotions cron job handler
  - Advisory lock 43010, hourly schedule, batch 100
  - Blocked by: T-012 · Blocks: T-026

- [ ] **T-026** (complexity: 2.5) — Register cron job + advisory lock docs + tests
  - Blocked by: T-025 · Blocks: none

### i18n

## Phase 4 — DestinationReview (new column)

### Database + Schemas

- [ ] **T-028** (complexity: 2) — Update DestinationReview Drizzle DB schema: add lifecycleState column
  - Blocked by: T-027 · Blocks: T-029, T-030, T-032

- [ ] **T-029** (complexity: 2) — Generate DestinationReview up + down migrations
  - Blocked by: T-028 · Blocks: T-031

- [ ] **T-030** (complexity: 2) — Update DestinationReview Zod base schema + CRUD + fixtures
  - Blocked by: T-028 · Blocks: T-033, T-034

- [ ] **T-031** (complexity: 1.5) — Write DestinationReview post-migration verification test
  - Blocked by: T-029 · Blocks: none

- [ ] **T-032** (complexity: 1.5) — Update DestinationReview access schema (lifecycleState admin ONLY)
  - Blocked by: T-030 · Blocks: T-035, T-037

- [ ] **T-033** (complexity: 2) — Update DestinationReview query + HTTP schemas
  - Blocked by: T-030 · Blocks: T-035

- [ ] **T-034** (complexity: 2) — Remove DestinationReview admin-search workaround
  - Blocked by: T-030 · Blocks: T-035, T-038

### Integration

- [ ] **T-035** (complexity: 2) — Update admin DestinationReview API routes
  - Blocked by: T-032, T-033, T-034 · Blocks: T-036, T-038

- [ ] **T-036** (complexity: 2) — Add DestinationReview admin frontend lifecycle filter
  - Blocked by: T-035 · Blocks: T-058

### Tests

- [ ] **T-037** (complexity: 2) — Write DestinationReview schema + access boundary tests
  - Blocked by: T-032 · Blocks: none

- [ ] **T-038** (complexity: 2) — Write DestinationReview admin-search + integration tests (AC-001-04)
  - Blocked by: T-034, T-035 · Blocks: T-039, T-058

## Phase 3 — Sponsorship (rename + add)

### Database

- [ ] **T-039** (complexity: 2.5) — Update Sponsorship Drizzle DB schema: add lifecycleState + rename status
  - Blocked by: T-038 · Blocks: T-040, T-043, T-047

- [ ] **T-040** (complexity: 2.5) — Generate Sponsorship up migration (add-copy-drop pattern)
  - Blocked by: T-039 · Blocks: T-041, T-042

- [ ] **T-041** (complexity: 2.5) — Write Sponsorship down/rollback migration
  - Blocked by: T-040 · Blocks: T-042

- [ ] **T-042** (complexity: 2.5) — Write Sponsorship migration data integrity tests
  - Blocked by: T-040, T-041 · Blocks: none

### Zod Schemas

- [ ] **T-043** (complexity: 2) — Update Sponsorship Zod base schema + fixtures
  - status -> sponsorshipStatus, add BaseLifecycleFields
  - Blocked by: T-039 · Blocks: T-044, T-045, T-046, T-047, T-048, T-054, T-055

- [ ] **T-044** (complexity: 2) — Update Sponsorship access + CRUD schemas
  - Blocked by: T-043 · Blocks: T-050, T-051, T-055

- [ ] **T-045** (complexity: 2) — Update Sponsorship query + admin-search schemas
  - Blocked by: T-043 · Blocks: T-050, T-051

- [ ] **T-046** (complexity: 2.5) — Update Sponsorship HTTP schema + conversion functions
  - Blocked by: T-043 · Blocks: T-050, T-051

### Model + Service

- [ ] **T-047** (complexity: 2) — Update Sponsorship model: rename findByStatus + update findActiveByTarget
  - findActiveByTarget uses BOTH sponsorshipStatus='active' AND lifecycleState='ACTIVE'
  - Blocked by: T-039, T-043 · Blocks: T-048, T-057

- [ ] **T-048** (complexity: 2) — Update Sponsorship service: remove _executeAdminSearch override
  - Blocked by: T-047 · Blocks: T-050, T-051, T-056

- [ ] **T-049** (complexity: 2) — Update Sponsorship service _executeSearch with lifecycleState=ACTIVE default
  - Blocked by: T-048 · Blocks: T-051

### API Routes + Frontend

- [ ] **T-050** (complexity: 2) — Update admin Sponsorship API routes
  - Blocked by: T-044, T-045, T-046, T-048 · Blocks: T-052, T-053, T-055, T-056

- [ ] **T-051** (complexity: 2) — Update public/protected Sponsorship API routes
  - Blocked by: T-044, T-045, T-046, T-049 · Blocks: none

- [ ] **T-052** (complexity: 2) — Update admin Sponsorship frontend routes + types
  - Blocked by: T-050 · Blocks: T-053, T-055

- [ ] **T-053** (complexity: 2) — Update Sponsorship useSponsorshipQueries hook
  - Blocked by: T-050, T-052 · Blocks: T-055, T-057

- [ ] **T-054** (complexity: 2.5) — Update SponsorshipsTab + add lifecycle filter to Sponsorship list
  - Blocked by: T-052, T-053 · Blocks: T-058

### Tests

- [ ] **T-055** (complexity: 2.5) — Write Sponsorship schema + access tests (AC-003-03)
  - Blocked by: T-043, T-044 · Blocks: none

- [ ] **T-056** (complexity: 2.5) — Write Sponsorship integration test: filter independence (AC-001-02, AC-003-02)
  - Blocked by: T-050 · Blocks: T-058

- [ ] **T-057** (complexity: 2) — Write Sponsorship model + hook tests
  - Blocked by: T-047, T-053 · Blocks: none

## Cleanup / Cross-cutting

- [ ] **T-058** (complexity: 2.5) — Cross-cutting public endpoint + regression tests + final verification
  - All 4 entities: only ACTIVE in public, lifecycleState absent. Regressions: PostSponsor, Tag.
  - Blocked by: T-001, T-002, T-022, T-027, T-036, T-038, T-054, T-056, T-057 · Blocks: none

---

## Dependency Graph (simplified levels)

- **Level 0** (parallel starts): T-001, T-002, T-003
- **Level 1**: T-004, T-007 (after T-003)
- **Level 2**: T-005, T-008, T-009, T-010, T-011, T-019
- **Level 3**: T-006, T-012, T-013, T-014, T-015, T-020, T-023
- **Level 4**: T-016, T-017, T-021, T-022, T-024, T-025
- **Level 5**: T-018, T-026
- **Level 6**: T-027
- **Level 7**: T-028 (starts Phase 4)
- **Level 8**: T-029, T-030
- **Level 9**: T-031, T-032, T-033, T-034
- **Level 10**: T-035, T-037
- **Level 11**: T-036, T-038
- **Level 12**: T-039 (starts Phase 3)
- **Level 13**: T-040, T-043, T-047
- **Level 14**: T-041, T-044, T-045, T-046, T-048
- **Level 15**: T-042, T-049, T-050, T-055
- **Level 16**: T-051, T-052, T-056
- **Level 17**: T-053
- **Level 18**: T-054, T-057
- **Level 19**: T-058

## Suggested Start

Three independent tasks can start in parallel:

1. **T-001** (complexity: 2) — AccommodationReview schema + access verification tests (Phase 1)
2. **T-002** (complexity: 2) — AccommodationReview CRUD + admin-search verification tests (Phase 1)
3. **T-003** (complexity: 2) — OwnerPromotion DB schema update (unblocks Phase 2 entirely)

Recommended first: **T-003** — it has zero dependencies and unblocks 3 tasks immediately (T-004, T-007, T-011), forming the backbone of Phase 2.
