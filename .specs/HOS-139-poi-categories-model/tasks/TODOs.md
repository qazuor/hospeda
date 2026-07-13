# HOS-139: POI categories model (M2M catalog, replaces single `type` enum)

## Progress: 0/28 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-005 → T-011 → T-012 → T-013 → T-022 → T-028 (6 steps)
**Parallel Tracks:** DB (T-001..T-004), Schemas/mapping (T-005..T-010), Seed (T-017..T-021)

---

### Core Phase — DB

- [ ] **T-001** (complexity: 3) — Add `poi_categories` dbschema
  - Table: slug unique, nameI18n jsonb, translationMeta, icon, displayWeight, BaseModel
  - Blocked by: none · Blocks: T-002, T-003, T-004
- [ ] **T-002** (complexity: 3) — Add `r_poi_category` join + partial unique primary index
  - Composite PK, both FK cascade, 2 indexes + partial unique WHERE is_primary
  - Blocked by: T-001 · Blocks: T-003, T-004, T-012, T-016
- [ ] **T-003** (complexity: 2) — Generate structural migration (0053, re-check)
  - Blocked by: T-001, T-002 · Blocks: T-025

### Core Phase — Schemas + mapping + permissions

- [ ] **T-005** (complexity: 3) — Create `poi-category` Zod 6-file set
  - Blocked by: none · Blocks: T-006, T-009, T-011, T-017
- [ ] **T-006** (complexity: 2) — Category-assignment relation input schemas
  - Blocked by: T-005 · Blocks: T-009, T-012
- [ ] **T-007** (complexity: 2) — Additive categoryId/categorySlug filter on POI search schema
  - Blocked by: none · Blocks: T-016
- [ ] **T-008** (complexity: 2) — `CATEGORY_SLUG_TO_POI_TYPE` reverse map + forward map + helper
  - Lossy 40→9, unknown → OTHER; unit test
  - Blocked by: none · Blocks: T-012, T-019, T-020, T-023
- [ ] **T-009** (complexity: 2) — Register zodError i18n keys + regenerate inventory
  - Blocked by: T-005, T-006 · Blocks: none
- [ ] **T-010** (complexity: 2) — Add `POI_CATEGORY_*` PermissionEnum values
  - Blocked by: none · Blocks: T-011

### Core Phase — Service

- [ ] **T-011** (complexity: 3) — Scaffold `PointOfInterestCategoryService` (catalog CRUD)
  - Blocked by: T-005, T-010 · Blocks: T-012, T-015
- [ ] **T-012** (complexity: 3) — `assignCategoryToPointOfInterest` (+ type sync in tx)
  - Blocked by: T-011, T-008, T-002, T-006 · Blocks: T-013, T-014, T-022, T-023
- [ ] **T-013** (complexity: 3) — `unassignCategoryFromPointOfInterest` (+ auto-promote + type)
  - Blocked by: T-012 · Blocks: T-022, T-023
- [ ] **T-014** (complexity: 2) — `setPrimaryCategory` (+ type re-derive)
  - Blocked by: T-012 · Blocks: T-022, T-023
- [ ] **T-015** (complexity: 2) — Category read-side methods
  - Blocked by: T-011 · Blocks: none
- [ ] **T-016** (complexity: 3) — Wire category filter in `buildSearchWhere` (type filter untouched)
  - Blocked by: T-007, T-002 · Blocks: T-024

### Core Phase — Seed (dual-write)

- [ ] **T-017** (complexity: 3) — Author 40 category fixtures (multilang es/en/pt)
  - Blocked by: T-005 · Blocks: T-018, T-019, T-020, T-021
- [ ] **T-018** (complexity: 2) — `poiCategories.seed.ts` + manifest entry
  - Blocked by: T-017 · Blocks: T-021
- [ ] **T-019** (complexity: 3) — 12-POI `r_poi_category` backfill seed step (§7.4 mapping + type)
  - Blocked by: T-018, T-008 · Blocks: T-026
- [ ] **T-020** (complexity: 3) — Data-migration `0012-hos-139-poi-categories` (idempotent)
  - Blocked by: T-017, T-008 · Blocks: T-026
- [ ] **T-021** (complexity: 1) — Add `poiCategory` glob to `check-seed-dual-write.sh`
  - Blocked by: T-017 · Blocks: none

### Testing Phase

- [ ] **T-004** (complexity: 3) — dbschema structural tests (both tables)
  - Blocked by: T-001, T-002 · Blocks: none
- [ ] **T-022** (complexity: 3) — Service tests: primary demote (AC-5) + auto-promote (AC-6)
  - Blocked by: T-012, T-013, T-014 · Blocks: none
- [ ] **T-023** (complexity: 2) — type-sync tests (AC-8 a/b)
  - Blocked by: T-012, T-013, T-014, T-008 · Blocks: T-027
- [ ] **T-024** (complexity: 2) — Category filter service test (AC-7)
  - Blocked by: T-016 · Blocks: none
- [ ] **T-025** (complexity: 2) — Partial unique index rejection test (AC-1)
  - Blocked by: T-003 · Blocks: none
- [ ] **T-026** (complexity: 3) — Seed backfill test (AC-4, fresh + migrate)
  - Blocked by: T-019, T-020 · Blocks: none
- [ ] **T-027** (complexity: 2) — Consumer regression test (AC-8c)
  - Blocked by: T-023 · Blocks: none

### Docs / Quality Phase

- [ ] **T-028** (complexity: 2) — Quality gate + migration prefix re-check
  - Blocked by: T-004, T-009, T-021, T-022, T-023, T-024, T-025, T-026, T-027 · Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001, T-005, T-007, T-008, T-010
- Level 1: T-002, T-006, T-009, T-011, T-017
- Level 2: T-003, T-012, T-016, T-018
- Level 3: T-004, T-013, T-014, T-015, T-019, T-020, T-021, T-024, T-025
- Level 4: T-022, T-023, T-026
- Level 5: T-027
- Level 6: T-028

## Suggested Start

Begin with **T-001** (poi_categories dbschema) and **T-005** (poi-category Zod set) in
parallel — both are no-dependency roots that unblock the DB and service/seed tracks.
T-008 (the `type` reverse-mapping constant) is also a zero-dependency quick win that
several later tasks depend on.
