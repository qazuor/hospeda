# SPEC-063: Lifecycle State Standardization

## Progress: 37/63 completed + 7 deferred — effective 37/56

**Last updated:** 2026-04-18T17:55:00Z
**Status:** in-progress. **Phase 4 DestinationReview FULLY CLOSED** (sans deferred T-036). Phase 2 OwnerPromotion complete end-to-end (sans deferred migration trio T-004/T-005/T-006). **Push-only migration policy decided 2026-04-18**: 6 migration-ceremony tasks deferred (T-004, T-005, T-006, T-040, T-041, T-042). See progress.md + state.json `_pushOnlyMigrationPolicy`. Effective Phase 3 scope drops from 19 to 13 tasks.

### Push-only migration policy (summary)

- Hospeda has no production DB. Workflow is `drizzle-kit push`, not `drizzle-kit migrate`.
- Numbered migration files, rollback SQL, and data-integrity migration tests have zero deliverable value in this model.
- Schema correctness is covered by unit/integration tests per entity; a T-031-style introspection test is the optional reinforcement when needed.
- Follow-up cleanup: T-029 output files (`src/migrations/0005_awesome_wild_child.sql` + `manual/0005_awesome_wild_child_down.sql`) scheduled for deletion to resolve naming collision and drop the dead artifact.

### Follow-up SPECs spawned

- **SPEC-087** (draft) — public endpoint response schema strip (systemic factory fix). Discovered during T-022. Until SPEC-087 lands, SPEC-063 phase 3/4 public routes (T-035 DestinationReview, T-051 Sponsorship) use per-handler strip as established by T-022.

### Next up (in priority order)

1. **Follow-up cleanup (not a formal task):** delete the two T-029 output SQL files + amend state.json/progress.md to record the cleanup done. Small, non-blocking. Could bundle with the next feature commit.
2. **T-039..T-057** — Phase 3 Sponsorship (13 non-migration tasks: T-039 schema, T-043..T-049 zod/model/service, T-050..T-054 API/frontend, T-055..T-057 tests). Starts with T-039 (DB schema + dual field rename/add) — highest impact, no blockers.
3. **T-001, T-002** (complexity 2 each) — Phase 1 AccommodationReview verification tests. Independent of Phase 3; can run in parallel.
4. **T-058** (complexity 2.5) — cleanup / cross-cutting verification. T-036 removed from blockedBy; `_deferredDependencies` note tracks the deferral for final-report mention.

**Average Complexity:** 2.1/2.5 (ceiling)
**Critical Path (post-T-038):** T-039 -> T-040 -> T-042 -> T-058 (4 steps remaining)
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

- [~] **T-004** (complexity: 2.5) — Generate OwnerPromotion up migration with data migration — **DEFERRED 2026-04-18 (push-only policy)**
  - Blocked by: T-003 · Blocks: T-005, T-006

- [~] **T-005** (complexity: 2) — Write OwnerPromotion down/rollback migration — **DEFERRED 2026-04-18 (push-only policy)**
  - Blocked by: T-004 · Blocks: T-006

- [~] **T-006** (complexity: 2.5) — Write OwnerPromotion migration data integrity tests — **DEFERRED 2026-04-18 (push-only policy)**
  - Blocked by: T-005 · Blocks: none
  - Schema correctness already covered by T-019 + T-020 + T-023 + T-021 + T-022.

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

- [x] **T-027** (complexity: 1.5) — i18n locale keys for OwnerPromotion lifecycle
  - COMPLETED 2026-04-17 · lint: pass · typecheck: pass · tests: admin-billing 1044/1044 pass
  - Session 1 (T-018 block): added `statusDraft`, `statusArchived`, `actions.changeLifecycle`, `form.lifecycleStateLabel` to 3 locales + regenerated types
  - Session 2 (this commit): **expanded sweep** (user-approved option 2) — removed 11 orphans inside `ownerPromotions`: `statusInactive`, `statusInactiveLabel`, `statusActiveLabel`, `actionActivate`, `actionDeactivate`, `actionEdit`, `actionDelete`, `actions.activate`, `actions.deactivate`, `filters.active`, `filters.inactive`. Grep confirmed zero consumers for all 11 in apps/admin.
  - Subtask "Add actionSet*" marked obsolete — T-018c resolved UX via native `<select>` without needing new keys
  - Blocked by: T-018c · Blocks: T-028

### Tests

- [x] **T-019** (complexity: 2) — Update OwnerPromotion schema + CRUD tests
  - COMPLETED 2026-04-17 · lint: pass · typecheck: pass (2 T-019 files clean; 5 remaining errors are T-020 scope) · tests: 73/73 pass
  - AC-002-01 coverage added at schema layer (accept DRAFT/ARCHIVED, default ACTIVE, reject invalid enum)
  - AC-002-02 enforced via `.strict()` on UpdateInputSchema
  - Blocked by: T-007, T-008 · Blocks: none

- [x] **T-020** (complexity: 2) — Update OwnerPromotion admin-search + group tests
  - COMPLETED 2026-04-17 · lint: pass · typecheck: **packages/schemas 100% clean for SPEC-063** · tests: 118/118 pass
  - Status enum coverage added at schema layer (all/DRAFT/ACTIVE/ARCHIVED + reject invalid)
  - Blocked by: T-009, T-010 · Blocks: none

- [x] **T-021** (complexity: 2) — Write OwnerPromotion admin list integration test (AC-001-01)
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass · tests: 5/5 pass
  - Strategy: module-level mock of `@repo/service-core` (same pattern as `accommodation/admin-search-filters.test.ts`)
  - 5 tests: DRAFT/ACTIVE/ARCHIVED accepted → 200, invalid status → 400 VALIDATION_ERROR, default → 'all'
  - Env gotcha: requires `apps/api/.env.test` (NOT `.env.local`), documented in state.json `_envGotcha`
  - Auth gotcha: mock actor needs ACCESS_PANEL_ADMIN + ACCESS_API_ADMIN on top of OWNER_PROMOTION_VIEW, documented in state.json `_authGotcha`
  - Scope bonus: +2 tests beyond original 4 subtasks (invalid rejection + default='all')
  - Blocked by: T-013 · Blocks: none

- [x] **T-022** (complexity: 2, effective ~2.5 with scope absorb) — Write OwnerPromotion public endpoint default ACTIVE test (AC-005-01)
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass · tests: 5/5 service unit + 5/5 integration
  - Strategy: service-level force-override (not just default) + service unit tests + integration pipeline mock + per-handler response strip
  - Scope absorbed: (1) security hardening `_executeSearch` force-override, (2) `_executeCount` force-override for pagination consistency, (3) service unit test file creation (new)
  - Systemic gap flagged: route factory does not runtime-parse responseSchema → per-handler strip in public/list.ts. Tracked in SPEC-087.
  - Blocked by: T-012 · Blocks: T-058

- [x] **T-023** (complexity: 2) — Update OwnerPromotion model tests for findActive methods
  - COMPLETED 2026-04-17 · lint: pass · typecheck: pass · tests: 19/19 pass
  - Path corrected: real file at `packages/db/test/models/ownerPromotion.model.test.ts` (no subdir)
  - Mock data shape migrated (isActive:true → lifecycleState:ACTIVE); SQL-exclusion verification delegated to T-022 integration
  - Blocked by: T-011 · Blocks: none

- [x] **T-024** (complexity: 2) — Write usage-tracking + limit-enforcement tests
  - COMPLETED 2026-04-17 · lint: pass · typecheck: clean · tests: 23/23 pass (2 fixed, were failing at session start)
  - Scope creep absorbed from T-015: fixed L329 + L398 isActive assertions broken since T-015 middleware migration
  - usage-tracking.service.test.ts subtask deferred to T-022 integration (user-approved option B — coverage by equivalence with limit-enforcement)
  - Blocked by: T-014, T-015 · Blocks: none

### Cron Job (US-007)

- [x] **T-025** (complexity: 2.5) — Create archive-expired-promotions cron job handler
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass (no new errors in apps/api) · tests: deferred to T-026
  - Handler file: `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` (205 lines)
  - Advisory lock: `pg_try_advisory_xact_lock(43010)` (transaction-level per advisory-locks.md rule; spec-deviation flagged in state.json `_specDeviation`)
  - Uses `withTransaction` + discriminated union (addon-expiry template)
  - `updatedById: null` safe: column is nullable (verified against `owner_promotions.dbschema.ts:33`)
  - Handler NOT yet registered in cron registry — T-026 scope
  - Blocked by: T-012 · Blocks: T-026

- [x] **T-026** (complexity: 2.5) — Register cron job + advisory lock docs + tests
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass · tests: 8/8 pass
  - Registered `archiveExpiredPromotionsJob` in `apps/api/src/cron/jobs/index.ts` barrel + `apps/api/src/cron/registry.ts` array (appended to end)
  - `packages/db/docs/advisory-locks.md` row 43010 Owner File updated to concrete handler path (row 43001 already concrete from SPEC-064)
  - Test file: `apps/api/test/cron/archive-expired-promotions.test.ts` (flat path, NOT `test/cron/jobs/`). 8 tests (6 core + 2 scope-bonus: job metadata + updatedAt freshness). Top-level error test also verifies Sentry.captureException tags.
  - Mocking: chainable vi.fn() stubs + withTransaction passthrough with tx stub acquired=true; tests override via `mockImplementationOnce` with `as never` cast for lock-not-acquired path. Pattern mirrors addon-expiry.test.ts.
  - Blocked by: T-025 · Blocks: none

### i18n

## Phase 4 — DestinationReview (new column)

### Database + Schemas

- [x] **T-028** (complexity: 2) — Update DestinationReview Drizzle DB schema: add lifecycleState column
  - COMPLETED 2026-04-18 · lint: pass · typecheck: deferred (cascade)
  - Added `lifecycleState` column + `destinationReviews_lifecycleState_idx` index
  - Blocked by: T-027 · Blocks: T-029, T-030, T-032

- [x] **T-029** (complexity: 2) — Generate DestinationReview up + down migrations
  - COMPLETED 2026-04-18 · up: `packages/db/src/migrations/0005_awesome_wild_child.sql` (auto-generated, diff-clean: 2 statements) · down: `packages/db/src/migrations/manual/0005_awesome_wild_child_down.sql` (idempotent)
  - Path correction: real migrations path is `packages/db/src/migrations/` (not `packages/db/migrations/` as task text said).
  - Orphan flagged: `0003_shiny_spitfire.sql` is untracked from prior session; not SPEC-063 scope.
  - **Outputs scheduled for deletion** per push-only policy (2026-04-18) — see state.json `_followUpObsolete` on T-029 + summary `_pushOnlyMigrationPolicy.followUpCleanups`. Task stays completed (work literally was done); files are dead artifacts.
  - Blocked by: T-028 · Blocks: T-031

- [x] **T-030** (complexity: 2) — Update DestinationReview Zod base schema + CRUD + fixtures
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass
  - Scope absorbed: http.schema.ts create conversion (LifecycleStatusEnum.ACTIVE default) to keep typecheck clean
  - CRUD no-op (flows via omit/partial). No dedicated fixtures file.
  - Blocked by: T-028 · Blocks: T-033, T-034

- [x] **T-031** (complexity: 1.5) — Write DestinationReview post-migration verification test
  - COMPLETED 2026-04-18 · biome pass · typecheck pass · tests 5/5 pass (75ms)
  - Option 1 schema introspection test at `packages/db/test/schemas/destination-review-lifecycle.schema.test.ts` (column UDT + NOT NULL + default ACTIVE + index + existing-rows invariant)
  - Path correction: `test/migrations/` does not exist; placed under `test/schemas/` (conventional)
  - Rollback subtask deferred (repo moves away from numbered migrations per CLAUDE.md — coupling to rollback SQL not worth it)
  - Blocked by: T-029 · Blocks: none

- [x] **T-032** (complexity: 1.5) — Update DestinationReview access schema (lifecycleState admin ONLY)
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass
  - Removed preemptive .extend override; base flows into Admin; Public/Protected exclude via .pick()
  - Blocked by: T-030 · Blocks: T-035, T-037

- [x] **T-033** (complexity: 2) — Update DestinationReview query + HTTP schemas
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass
  - Added lifecycleState filter to Filters + Search + HTTP search schemas; conversion passthrough
  - Create default ACTIVE was absorbed into T-030 boundary
  - Security: JSDoc warns that service must force ACTIVE for public endpoints (T-035)
  - Blocked by: T-030 · Blocks: T-035

- [x] **T-034** (complexity: 2) — Remove DestinationReview admin-search workaround
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass
  - Removed z.unknown().transform override; AdminSearchBaseSchema.status now maps to lifecycleState
  - No service-side workaround present; runtime verification deferred to T-035/T-038
  - Blocked by: T-030 · Blocks: T-035, T-038

### Integration

- [x] **T-035** (complexity: 2) — Update admin DestinationReview API routes
  - COMPLETED 2026-04-18 · verification task, 0 code changes
  - Routes live at `apps/api/src/routes/destination/reviews/` (not `admin/destination-review/` as spec suggested)
  - Grep for isActive/lifecycleState across all tiers: 0 matches. Routes inherit updated schemas from T-032.
  - Blocked by: T-032, T-033, T-034 · Blocks: T-036, T-038

- [~] **T-036** (complexity: 2) — Add DestinationReview admin frontend lifecycle filter — **DEFERRED 2026-04-18**
  - Reason: no DestinationReview admin UI exists to filter. AC-001-04 covered at API layer via T-032/T-033/T-034 (schema) + T-035 (routes) + T-038 (integration tests). See progress.md and state.json `T-036._scopeDeviation`.
  - Future SPEC for destination-reviews admin CRUD UI will inherit working backend; filter dropdown follows T-018a OwnerPromotion pattern (trivial).
  - Blocked by: T-035 · Blocks: (was T-058 — removed from blockedBy; `_deferredDependencies` entry tracks deferral)

### Tests

- [x] **T-037** (complexity: 2) — Write DestinationReview schema + access boundary tests
  - COMPLETED 2026-04-18 · lint: pass · typecheck: pass · tests: 21/21
  - 8 new tests added to existing destinationReview.schema.test.ts (no new access.schema.test.ts file needed)
  - Coverage: lifecycleState enum values + default ACTIVE + invalid rejection + public/protected strip + admin preserve + isPublished/isVerified regression guard
  - Blocked by: T-032 · Blocks: none

- [ ] **T-038** (complexity: 2) — Write DestinationReview admin-search + integration tests (AC-001-04)
  - Blocked by: T-034, T-035 · Blocks: T-039, T-058

## Phase 3 — Sponsorship (rename + add)

### Database

- [ ] **T-039** (complexity: 2.5) — Update Sponsorship Drizzle DB schema: add lifecycleState + rename status
  - Blocked by: T-038 · Blocks: T-040, T-043, T-047

- [~] **T-040** (complexity: 2.5) — Generate Sponsorship up migration (add-copy-drop pattern) — **DEFERRED 2026-04-18 (push-only policy)**
  - Blocked by: T-039 · Blocks: T-041, T-042
  - Schema rename + new column will land via `drizzle-kit push` directly when T-039 commits.

- [~] **T-041** (complexity: 2.5) — Write Sponsorship down/rollback migration — **DEFERRED 2026-04-18 (push-only policy)**
  - Blocked by: T-040 · Blocks: T-042

- [~] **T-042** (complexity: 2.5) — Write Sponsorship migration data integrity tests — **DEFERRED 2026-04-18 (push-only policy)**
  - Blocked by: T-040, T-041 · Blocks: none
  - Schema correctness will be covered by T-055 + T-056 + T-057 when Phase 3 lands.

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
  - Final report must mention T-036 deferral (admin UI does not exist).
  - Blocked by: T-001, T-002, T-022, T-027, T-038, T-054, T-056, T-057 · Blocks: none
  - _Deferred dep:_ T-036 (see state.json `T-058._deferredDependencies`)

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
