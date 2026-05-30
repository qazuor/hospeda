# SPEC-172 — Accommodation amenities & features — chips with junction tables
## Task Breakdown

**Total tasks**: 30 | **Avg complexity**: 2.3 | **PRs**: 4 | PR1: 9 | PR2: 8 | PR3: 5 | PR4: 8

---

## Critical Path

`T-001 → T-002 → T-007 → T-008 → T-009 → T-010 → T-011 → T-012 → T-013 → T-017 → T-018 → T-019 → T-021 → T-022 → T-023 → T-029 → T-030`

---

## PR1 — Write path (backend)
*9 tasks | Blocks: AC-1.1 through AC-1.8*

| ID | Title | Complexity | Status | BlockedBy |
|----|-------|-----------|--------|-----------|
| T-001 | Add amenityIds and featureIds to accommodation CRUD schemas | 2 | pending | — |
| T-002 | Implement transactional amenity junction sync in AccommodationService | 4 | pending | T-001 |
| T-003 | Implement transactional feature junction sync in AccommodationService | 3 | pending | T-001 |
| T-004 | Delete standalone addFeatureToAccommodation and removeFeatureFromAccommodation route files | 2 | pending | T-003 |
| T-005 | Update accommodation API routes to pass amenityIds/featureIds to service | 2 | pending | T-002, T-003 |
| T-006 | Add admin accommodation API route for create/update with junction fields | 1 | pending | T-005 |
| T-007 | Write service-level unit tests for junction sync (PR1 quality gate) | 4 | pending | T-002, T-003 |
| T-008 | PR1 quality gate — typecheck, lint, test run | 1 | pending | T-004, T-005, T-006, T-007 |
| T-009 | Open PR1 to staging | 1 | pending | T-008 |

### PR1 Parallel tracks
- **Track A** (schemas → service amenity sync): T-001 → T-002
- **Track B** (service feature sync): T-001 → T-003 → T-004
- **Track C** (tests): T-002 + T-003 → T-007
- **Merge**: T-004 + T-005 + T-006 + T-007 → T-008 → T-009

---

## PR2 — Schema cleanup + i18n catalog
*8 tasks | Blocks: AC-2.1 through AC-2.9*
*Depends on PR1 merged to staging*

| ID | Title | Complexity | Status | BlockedBy |
|----|-------|-----------|--------|-----------|
| T-010 | Remove phantom fields from AccommodationWithFeaturesSchema | 2 | pending | T-009 |
| T-011 | Migrate amenity catalog DB schema: name/description → nameI18n/descriptionI18n JSONB | 3 | pending | T-010 |
| T-012 | Migrate feature catalog DB schema: name/description → nameI18n/descriptionI18n JSONB | 2 | pending | T-011 |
| T-013 | Update amenity and feature Zod schemas for i18n shape | 3 | pending | T-011, T-012 |
| T-014 | Update seed data for amenity and feature i18n fields | 2 | pending | T-013 |
| T-015 | Update public catalog list endpoints to return i18n fields | 2 | pending | T-012, T-013 |
| T-016 | Verify existing accommodation read paths return updated i18n relation objects | 3 | pending | T-013, T-015 |
| T-017 | PR2 quality gate — typecheck, lint, test run, migration review | 2 | pending | T-010, T-014, T-015, T-016 |

### PR2 Parallel tracks
- **Track A** (DB migration amenity): T-010 → T-011
- **Track B** (DB migration feature): T-011 → T-012
- **Track C** (Zod + seed): T-013 → T-014
- **Track D** (API): T-015 → T-016
- **Merge**: T-014 + T-016 → T-017 → (open PR2 — no separate task needed)

---

## PR3 — Admin chips UI + quality-signal rewrite
*5 tasks | Blocks: AC-3.1 through AC-3.8*
*Depends on PR2 merged to staging (catalog endpoints must return nameI18n shape)*

| ID | Title | Complexity | Status | BlockedBy |
|----|-------|-----------|--------|-----------|
| T-018 | Create MultiSelectChipsField admin component | 4 | pending | T-017 |
| T-019 | Wire MultiSelectChipsField into accommodation edit form | 3 | pending | T-018 |
| T-020 | Rewrite quality-score 'services' signal to use amenities.length | 2 | pending | T-018 |
| T-021 | PR3 quality gate — typecheck, lint, test run | 1 | pending | T-019, T-020 |
| T-022 | Open PR3 to staging | 1 | pending | T-021 |

### PR3 Parallel tracks
- **Track A** (component + form wire-up): T-018 → T-019
- **Track B** (quality signal): T-018 → T-020
- **Merge**: T-019 + T-020 → T-021 → T-022

---

## PR4 — Web read paths
*8 tasks | Blocks: AC-4.1 through AC-4.4*
*Depends on PR2 merged (schema/JSONB columns live); PR3 not a hard technical dep for PR4*

| ID | Title | Complexity | Status | BlockedBy |
|----|-------|-----------|--------|-----------|
| T-023 | Audit and update web components reading amenity data from junction arrays | 3 | pending | T-022 |
| T-024 | Update search_index materialized view and triggers for JSONB amenity text | 3 | pending | T-022 |
| T-025 | Update vitest fixtures to insert junction rows for amenity/feature test data | 2 | pending | T-023 |
| T-026 | Update AccommodationWithFeaturesSchema read paths in web layer | 2 | pending | T-023 |
| T-027 | Update accommodation list page web component for junction amenity display | 3 | pending | T-023 |
| T-028 | Update accommodation detail page web component for junction amenity display | 2 | pending | T-023 |
| T-029 | PR4 quality gate — full typecheck, lint, test run across all packages | 2 | pending | T-024, T-025, T-026, T-027, T-028 |
| T-030 | Open PR4 to staging and close out SPEC-172 | 1 | pending | T-029 |

### PR4 Parallel tracks
- **Track A** (web components): T-023 → T-025 + T-026 + T-027 + T-028 (all parallel after T-023)
- **Track B** (DB trigger): T-024 (can run in parallel with T-023 once T-022 is done)
- **Merge**: all → T-029 → T-030

---

## Phase Summary

| Phase | Tasks |
|-------|-------|
| setup | T-001, T-010 |
| core | T-002, T-003, T-011, T-012, T-013, T-014, T-018, T-019, T-023, T-024, T-025, T-026 |
| integration | T-004, T-005, T-006, T-015, T-016, T-020, T-021, T-022, T-027, T-028 |
| testing | T-007, T-008, T-009, T-017, T-021, T-029 |
| cleanup | T-030 |

---

## Key File References

### PR1 files
- `packages/schemas/src/entities/accommodation/accommodation.crud.schema.ts` (T-001)
- `packages/service-core/src/services/accommodation/accommodation.service.ts` (T-002, T-003)
- `apps/api/src/routes/feature/protected/addFeatureToAccommodation.ts` (DELETE — T-004)
- `apps/api/src/routes/feature/protected/removeFeatureFromAccommodation.ts` (DELETE — T-004)
- `packages/db/src/schemas/accommodation/r_accommodation_amenity.dbschema.ts` (read in T-002)
- `packages/db/src/schemas/accommodation/r_accommodation_feature.dbschema.ts` (read in T-003)

### PR2 files
- `packages/schemas/src/entities/accommodation/accommodation.relations.schema.ts` lines 130-140 (T-010)
- `packages/db/src/schemas/accommodation/amenity.dbschema.ts` (T-011)
- `packages/db/src/schemas/accommodation/feature.dbschema.ts` (T-012)
- `packages/schemas/src/entities/amenity/amenity.schema.ts` lines 34-47 (T-013)
- `packages/schemas/src/entities/feature/feature.schema.ts` (T-013)
- `apps/api/src/routes/amenity/public/list.ts` (T-015)
- `apps/api/src/routes/feature/public/list.ts` (T-015)

### PR3 files
- `apps/admin/src/features/accommodations/components/MultiSelectChipsField.tsx` (NEW — T-018)
- `apps/admin/src/features/accommodations/config/score-signals.ts` lines 198-225 (T-020)

### PR4 files
- `apps/web/src/components/accommodation/` (T-023, T-027, T-028)
- `packages/db/scripts/apply-postgres-extras.sh` (T-024)
- `apps/api/src/routes/accommodation/public/quick-amenity-resolver.ts` (DO NOT TOUCH — Q-5)

---

## Risk Reminders

- **R-1 (junction sync)**: Absent `amenityIds` on update = no-op. `[]` = remove all. Document in JSDoc.
- **R-2 (migration data loss)**: Migration SQL must copy existing `name` string into all 3 locales before dropping column.
- **R-3 (search_index drift)**: T-024 updates trigger to JSONB path. PR4 ships after PR2 — old `name` column is already gone.
- **R-4 (PR3 fetch failure)**: T-018 must handle fetch error without crash (loading skeleton + error state).
