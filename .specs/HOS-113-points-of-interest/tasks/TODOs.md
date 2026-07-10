# HOS-113: Points of Interest (POI) in destinations

## Progress: 0/52 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Decomposition:** Multi-pass (macro -> split -> score), all 52 tasks ≤ complexity 3
**Critical Path:** T-001 -> T-002 -> T-003 -> T-004 -> T-005 -> T-006 -> T-015 -> T-016 -> T-019 -> T-020 -> T-031 -> T-032 -> T-033 -> T-034 -> T-035 -> T-036 -> T-044 (17 steps, weighted length 39)
**Dependency levels:** 17 (Level 0 to Level 16)

This spec has 4 sequential implementation phases (per spec.md §12). Phase boundaries are
pause points — review before continuing to the next phase. Phase 5 (multi-marker map pins,
admin CRUD) is explicitly deferred/out of scope and has NO tasks here.

---

## Phase 1 — Data Layer (30 tasks, avg complexity 2.0)

Table + join table + migration, `PointOfInterestTypeEnum`, Zod 6-file set, service +
permissions, seed fixtures + relationship seed + manifest + i18n strings + dual-write
guard update. No admin CRUD (NG-5).

### DB schema + migration

- [ ] **T-001** (complexity: 2) - Add PointOfInterestTypeEnum to schemas package
  - `packages/schemas/src/enums/point-of-interest-type.{enum,schema}.ts` (OQ-3 closed enum)
  - Blocked by: none | Blocks: T-002, T-007
- [ ] **T-002** (complexity: 1) - Add PointOfInterestTypePgEnum to Drizzle enums
  - Blocked by: T-001 | Blocks: T-003
- [ ] **T-003** (complexity: 3) - Create points_of_interest Drizzle table schema
  - lat/long double precision, type enum, no `name` column (OQ-2)
  - Blocked by: T-002 | Blocks: T-004
- [ ] **T-004** (complexity: 2) - Create r_destination_point_of_interest join table schema
  - M2M (OQ-1), composite PK, cascade both sides
  - Blocked by: T-003 | Blocks: T-005
- [ ] **T-005** (complexity: 2) - Export POI Drizzle schemas from db package barrel
  - Blocked by: T-004 | Blocks: T-006
- [ ] **T-006** (complexity: 2) - Generate and commit migration 0050 for POI tables
  - `pnpm db:generate` -> `0050_*.sql`, drift guard (AC-1)
  - Blocked by: T-005 | Blocks: T-015, T-016

### Zod 6-file set

- [ ] **T-007** (complexity: 2) - Create point-of-interest.schema.ts base Zod schema
  - Blocked by: T-001 | Blocks: T-008, T-009, T-011, T-012
- [ ] **T-008** (complexity: 2) - Create point-of-interest.crud.schema.ts
  - Blocked by: T-007 | Blocks: T-010, T-013
- [ ] **T-009** (complexity: 3) - Create point-of-interest.query.schema.ts
  - Includes `DestinationIdsByPointOfInterestSlugsSchema` (AI/proximity resolution contract)
  - Blocked by: T-007 | Blocks: T-010, T-013
- [ ] **T-010** (complexity: 2) - Create point-of-interest.http.schema.ts
  - Blocked by: T-008, T-009 | Blocks: T-013
- [ ] **T-011** (complexity: 1) - Create point-of-interest.access.schema.ts
  - Blocked by: T-007 | Blocks: T-013
- [ ] **T-012** (complexity: 2) - Create point-of-interest.relations.schema.ts
  - Blocked by: T-007 | Blocks: T-013, T-047
- [ ] **T-013** (complexity: 1) - Create point-of-interest schemas barrel and wire package export
  - AC-2: `@repo/schemas` exposes the POI 6-file set
  - Blocked by: T-008, T-009, T-010, T-011, T-012 | Blocks: T-015, T-017, T-023

### Permissions

- [ ] **T-014** (complexity: 2) - Add PointOfInterest permission enum values
  - `POINT_OF_INTEREST_*` used consistently at service AND route layer (deliberate deviation
    from attraction's split-brain gate — see task description)
  - Blocked by: none | Blocks: T-018

### DB models

- [ ] **T-015** (complexity: 2) - Create PointOfInterestModel
  - Blocked by: T-006 | Blocks: T-016, T-019
- [ ] **T-016** (complexity: 2) - Create RDestinationPointOfInterestModel
  - Blocked by: T-006, T-015 | Blocks: T-019, T-045

### Service layer

- [ ] **T-017** (complexity: 1) - Create point-of-interest.normalizers.ts
  - Blocked by: T-013 | Blocks: T-019
- [ ] **T-018** (complexity: 2) - Create point-of-interest.permissions.ts
  - Blocked by: T-014 | Blocks: T-019
- [ ] **T-019** (complexity: 3) - Create PointOfInterestService core CRUD
  - Blocked by: T-015, T-016, T-017, T-018 | Blocks: T-020, T-024
- [ ] **T-020** (complexity: 3) - Add relation and slug-resolution methods to PointOfInterestService
  - `getDestinationIdsByPointOfInterestSlugs` — the Phase 2/3 entry point
  - Blocked by: T-019 | Blocks: T-021, T-026, T-031, T-039

### API routes (public read only, NG-5)

- [ ] **T-021** (complexity: 3) - Create public POI API routes
  - `apps/api/src/routes/point-of-interest/public/{getById,getBySlug,list,index}.ts`
  - Blocked by: T-020 | Blocks: T-022
- [ ] **T-022** (complexity: 2) - Register POI routes in API app + route registration tests
  - Blocked by: T-021 | Blocks: T-035

### Seed layer

- [ ] **T-023** (complexity: 2) - Create seed data JSON fixtures for POIs
  - 10-12 real CDU/Litoral landmarks covering all 9 `type` values
  - Blocked by: T-013 | Blocks: T-024, T-027, T-029
- [ ] **T-024** (complexity: 2) - Create pointsOfInterest.seed.ts required-seed factory
  - Blocked by: T-019, T-023 | Blocks: T-025, T-030
- [ ] **T-025** (complexity: 1) - Register pointsOfInterest in manifest-required.json and orchestrator
  - Blocked by: T-024 | Blocks: T-026
- [ ] **T-026** (complexity: 3) - Add destination-POI relationship seed step
  - M2M coverage: at least one POI mapped to 2 destinations
  - Blocked by: T-020, T-025 | Blocks: T-028
- [ ] **T-027** (complexity: 1) - Update seed dual-write guard for pointOfInterest path (R-5)
  - Blocked by: T-023 | Blocks: T-028
- [ ] **T-028** (complexity: 3) - Write seed integration test for POI required group (AC-3)
  - Blocked by: T-026, T-027 | Blocks: T-036

### i18n

- [ ] **T-029** (complexity: 2) - Add POI i18n display strings (es/en/pt)
  - `destinations.poiNames.<slug>` + `destinations.poiTypeLabels.<TYPE>`
  - Blocked by: T-023 | Blocks: T-030, T-050
- [ ] **T-030** (complexity: 2) - Write i18n coverage test for POI slugs (R-6, AC-7)
  - Blocked by: T-029, T-024 | Blocks: T-038

---

## Phase 2 — Proximity Search / API (7 tasks, avg complexity 2.1)

POI resolution + accommodation search "near POI" (`poiId`/`poiSlug`), consuming `geo.ts`
(NG-2 — zero new distance SQL); decide default radius (OQ-5).

- [ ] **T-031** (complexity: 2) - Add poiId/poiSlug params to accommodation search schemas
  - Blocked by: T-020 | Blocks: T-032
- [ ] **T-032** (complexity: 3) - Implement resolvePoiToCoordinates helper
  - OQ-5 PLACEHOLDER: default radius 5km — needs owner confirmation before merge
  - Blocked by: T-031 | Blocks: T-033
- [ ] **T-033** (complexity: 3) - Wire resolved POI coordinates into accommodation search query
  - Reuses EXISTING `buildWithinRadiusClause`/`buildDistanceOrderByExpr` path (NG-2)
  - Blocked by: T-032 | Blocks: T-034, T-042
- [ ] **T-034** (complexity: 1) - Add poiId/latitude precedence validation
  - Blocked by: T-033 | Blocks: T-035
- [ ] **T-035** (complexity: 2) - Wire poiId/poiSlug through accommodation public search route
  - Blocked by: T-034, T-022 | Blocks: T-036
- [ ] **T-036** (complexity: 3) - Write near-POI accommodation search integration test (AC-4)
  - Blocked by: T-035, T-028 | Blocks: T-037, T-044
- [ ] **T-037** (complexity: 1) - Document OQ-5 default radius resolution in spec.md
  - Blocked by: T-036 | Blocks: none

---

## Phase 3 — AI Search (7 tasks, avg complexity 2.3)

`poi-allowlist.ts` + `poi-resolver.ts` + `buildAllowlistLines` wiring + `poiSlugs` intent
slot (OQ-7).

- [ ] **T-038** (complexity: 3) - Create poi-allowlist.ts with matchPoiTerms
  - OQ-7: curated statically from seed; cross-checked against seed JSON (R-4, HOS-111 T-009 lesson)
  - Blocked by: T-030 | Blocks: T-039, T-040, T-041
- [ ] **T-039** (complexity: 3) - Create poi-resolver.ts
  - Blocked by: T-038, T-020 | Blocks: T-042
- [ ] **T-040** (complexity: 1) - Add poiSlugs slot to SearchIntentEntitiesSchema
  - Blocked by: T-038 | Blocks: T-041, T-043
- [ ] **T-041** (complexity: 2) - Wire POI allowlist into search-chat.prompt.ts
  - Blocked by: T-038, T-040 | Blocks: T-042
- [ ] **T-042** (complexity: 3) - Wire poi-resolver into search-chat handler
  - Blocked by: T-039, T-041, T-033 | Blocks: T-044
- [ ] **T-043** (complexity: 1) - Add poiSlugs to ai-search-chat.schema.ts response typing
  - Blocked by: T-040 | Blocks: T-044
- [ ] **T-044** (complexity: 3) - Write AI chat POI resolution integration test (AC-6)
  - Blocked by: T-042, T-036, T-043 | Blocks: none

---

## Phase 4 — Destination Detail (Web) (8 tasks, avg complexity 2.1)

`_withPointsOfInterest()` hydration + `DestinationPOISection.astro`.

- [ ] **T-045** (complexity: 2) - Add DestinationModel.getPointsOfInterestMap
  - Blocked by: T-016 | Blocks: T-046
- [ ] **T-046** (complexity: 3) - Add DestinationService._withPointsOfInterest hydration
  - Blocked by: T-045 | Blocks: T-047
- [ ] **T-047** (complexity: 2) - Add pointsOfInterest field to Destination Zod schema
  - Blocked by: T-012, T-046 | Blocks: T-048
- [ ] **T-048** (complexity: 3) - Create DestinationPOISection.astro component
  - Build fresh (do NOT resurrect dead DestinationAttractionsGrid.astro)
  - Blocked by: T-047 | Blocks: T-049
- [ ] **T-049** (complexity: 2) - Wire DestinationPOISection into destination detail page
  - Blocked by: T-048 | Blocks: T-051
- [ ] **T-050** (complexity: 1) - Create POI type-label i18n resolution helper
  - Blocked by: T-029 | Blocks: T-051
- [ ] **T-051** (complexity: 3) - Write destination detail POI rendering integration test (AC-5, AC-7)
  - Blocked by: T-049, T-050 | Blocks: T-052
- [ ] **T-052** (complexity: 1) - Document POI entity in CLAUDE.md Common Gotchas
  - Blocked by: T-051 | Blocks: none

---

## Dependency Graph (levels)

```
Level  0: T-001, T-014
Level  1: T-002, T-007, T-018
Level  2: T-003, T-008, T-009, T-011, T-012
Level  3: T-004, T-010
Level  4: T-005, T-013
Level  5: T-006, T-017, T-023
Level  6: T-015, T-027, T-029
Level  7: T-016, T-050
Level  8: T-019, T-045
Level  9: T-020, T-024, T-046
Level 10: T-021, T-025, T-030, T-031, T-047
Level 11: T-022, T-026, T-032, T-038, T-048
Level 12: T-028, T-033, T-039, T-040, T-049
Level 13: T-034, T-041, T-043, T-051
Level 14: T-035, T-042, T-052
Level 15: T-036
Level 16: T-037, T-044
```

**Critical path:** T-001 -> T-002 -> T-003 -> T-004 -> T-005 -> T-006 -> T-015 -> T-016 ->
T-019 -> T-020 -> T-031 -> T-032 -> T-033 -> T-034 -> T-035 -> T-036 -> T-044
(17 steps, weighted length 39 by complexity)

**Parallel tracks** (representative, not exhaustive): the Zod 6-file set (T-008/T-009/T-011/
T-012) can be split across contributors once T-007 lands; T-014/T-018 (permissions) run
independent of the DB-schema/migration chain (T-002..T-006) until T-019 needs both; within
Phase 1, seed (T-023..T-028) and i18n (T-029..T-030) can proceed in parallel once T-013 and
T-020/T-024 are ready.

## Suggested Start

Begin with **T-001** (complexity: 2) - Add PointOfInterestTypeEnum to schemas package.
No dependencies, unblocks T-002 (DB pgEnum) and T-007 (Zod base schema) — the two
foundational chains (DB schema and Zod schema) both start from this enum.
