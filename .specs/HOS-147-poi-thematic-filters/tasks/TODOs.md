# HOS-147: Thematic POI Filters by Category

## Progress: 0/14 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Critical Path:** T-004 → T-005 → T-006 → T-011 → T-009 → T-013 → T-014 (7 steps)
**Parallel Tracks:** 2 (API catalog+payload track; web-shared helpers track) join at T-011

---

### Core Phase — API

- [ ] **T-001** (complexity: 1) — Add PublicPoiCategorySchema Zod schema
  - Public category shape { id, slug, nameI18n, icon, displayWeight } + barrel export.
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 2) — Add public read method to PoiCategoryService
  - ACTIVE, non-deleted, sorted displayWeight then slug (AC-1).
  - Blocked by: T-001
  - Blocks: T-003

- [ ] **T-003** (complexity: 2) — Add public route GET /api/v1/public/poi-categories
  - createPublicListRoute + wire into routes/index + integration test (AC-1).
  - Blocked by: T-002
  - Blocks: T-011

- [ ] **T-004** (complexity: 1) — Add categories[] to DestinationPointOfInterestSummarySchema
  - Full category set per POI, additive alongside primaryCategory (D-4).
  - Blocked by: none
  - Blocks: T-005

- [ ] **T-005** (complexity: 3) — Aggregate all POI categories in getPointsOfInterestMap
  - json_agg over r_poi_category; guard HOS-135/HOS-182; test on Colón (AC-2, R-1).
  - Blocked by: T-004
  - Blocks: T-006

- [ ] **T-006** (complexity: 2) — Thread categories[] through DestinationService.getPointsOfInterest
  - Propagate to summary mapper + service test (AC-2).
  - Blocked by: T-005
  - Blocks: T-011

### Core Phase — Web shared

- [ ] **T-007** (complexity: 2) — Register POI-category facet in facet-config.ts
  - paramKey 'categories', operator OR, enum undefined (destinationAttraction precedent).
  - Blocked by: none
  - Blocks: T-009

- [ ] **T-008** (complexity: 1) — Shared OR category-filter predicate util
  - matchesAnyCategory; OR/multi/empty unit tests (AC-3, AC-4, AC-6).
  - Blocked by: none
  - Blocks: T-009, T-010, T-012

### Integration Phase

- [ ] **T-009** (complexity: 3) — Build DestinationPOIFilter chip island
  - Present-only chips (D-5), aria-current, URL read/pushState, Clear(N) (AC-5, AC-7).
  - Blocked by: T-007, T-008, T-011
  - Blocks: T-013

- [ ] **T-010** (complexity: 3) — Wire card visibility + empty state in DestinationPOISection.astro
  - data-poi-categories on SSR cards + empty state (AC-6, AC-8).
  - Blocked by: T-008
  - Blocks: T-013

- [ ] **T-011** (complexity: 2) — Fetch category catalog SSR + thread props in destination page
  - endpoints.ts wrapper + present-only list + pass to section/map/island (D-5).
  - Blocked by: T-003, T-006
  - Blocks: T-009, T-012

- [ ] **T-012** (complexity: 3) — Filter map markers on category change
  - Shared predicate on PRIMARY+NEARBY; read URL on mount + CustomEvent (R-2, R-3).
  - Blocked by: T-008, T-011
  - Blocks: T-013

### Testing Phase

- [ ] **T-013** (complexity: 3) — Web integration + a11y tests for the filter
  - cards+map sync, URL/deep-link, aria-current, SEO full-set guard (AC-3..AC-8).
  - Blocked by: T-009, T-010, T-012
  - Blocks: T-014

### Docs Phase

- [ ] **T-014** (complexity: 1) — Document the client-side POI category filter
  - apps/web docs + CLAUDE gotcha (client-side, categories[] payload, catalog endpoint).
  - Blocked by: T-013
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-004, T-007, T-008
Level 1: T-002, T-005, T-010
Level 2: T-003, T-006
Level 3: T-011
Level 4: T-009, T-012
Level 5: T-013
Level 6: T-014

## Suggested Start

Begin with **T-004** (complexity: 1) or **T-001** (complexity: 1) — both are dependency-free roots of the API track. **T-008** (complexity: 1) is the dependency-free root of the web track and unblocks 3 tasks. The API payload track (T-004→T-005→T-006) is the critical path — start it early.
