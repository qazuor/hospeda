# SPEC-006: Destination Hierarchy System

## Progress: 0/43 tasks (0%)

**Average Complexity:** 3.0/4 (max)
**Critical Path:** T-001 -> T-002 -> T-003 -> T-004 -> T-005 -> T-013 -> T-015 -> T-019 -> T-026 (9 steps)
**Parallel Tracks:** 4 identified (schemas, model, service, seeds)

---

### Setup Phase (5 tasks)

- [ ] **T-001** (complexity: 2) - Create DestinationType Zod enum and DESTINATION_TYPE_LEVELS constant
  - New enum with 7 values, level mapping constant, unit tests
  - Blocked by: none
  - Blocks: T-002, T-005, T-006, T-007, T-008, T-017

- [ ] **T-002** (complexity: 1) - Create DestinationTypePgEnum in database schema
  - PostgreSQL enum matching Zod enum
  - Blocked by: T-001
  - Blocks: T-003

- [ ] **T-003** (complexity: 3) - Add hierarchy columns to destinations table
  - parentDestinationId, destinationType, level, path, pathIds
  - Blocked by: T-002
  - Blocks: T-004

- [ ] **T-004** (complexity: 3) - Add hierarchy indexes and self-referencing relations
  - 5 indexes + parent/children Drizzle relations
  - Blocked by: T-003
  - Blocks: T-005

- [ ] **T-005** (complexity: 3) - Generate and validate database migration
  - Generate, review, apply, verify migration
  - Blocked by: T-004
  - Blocks: T-013, T-014, T-015, T-027

---

### Core Phase - Schemas (7 tasks)

- [ ] **T-006** (complexity: 2) - Update DestinationSchema with hierarchy fields
  - Add 5 hierarchy fields to main entity schema
  - Blocked by: T-001
  - Blocks: T-007, T-008, T-009, T-010, T-011

- [ ] **T-007** (complexity: 3) - Update destination CRUD schemas for hierarchy
  - CreateInput omits computed fields, UpdateInput allows reparenting
  - Blocked by: T-006
  - Blocks: T-011, T-012

- [ ] **T-008** (complexity: 2) - Update destination search/query schemas with hierarchy filters
  - Add parentDestinationId, destinationType, level, ancestorId filters
  - Blocked by: T-006
  - Blocks: T-009, T-011

- [ ] **T-009** (complexity: 3) - Update destination HTTP schemas with hierarchy coercion
  - HTTP coercion + conversion functions for hierarchy params
  - Blocked by: T-008
  - Blocks: T-011

- [ ] **T-010** (complexity: 3) - Create hierarchy-specific Zod schemas
  - 6 new schemas: GetChildren, GetDescendants, GetAncestors, GetByPath, Breadcrumb, GetBreadcrumb
  - Blocked by: T-006
  - Blocks: T-011, T-022

- [ ] **T-011** (complexity: 2) - Update destination access schemas and barrel exports
  - Update Public/Protected/Admin schemas + barrel exports
  - Blocked by: T-007, T-008, T-009, T-010
  - Blocks: T-012, T-018, T-019, T-020, T-021, T-023

- [ ] **T-012** (complexity: 4) - Write unit tests for new and updated Zod schemas
  - Comprehensive tests for all schema changes
  - Blocked by: T-011
  - Blocks: none

---

### Core Phase - Model (4 tasks)

- [ ] **T-013** (complexity: 4) - Add findDescendants method to DestinationModel
  - Materialized path query with maxDepth and type filters
  - Blocked by: T-005
  - Blocks: T-015, T-016

- [ ] **T-014** (complexity: 3) - Add findAncestors method to DestinationModel
  - pathIds split + single query for all ancestors
  - Blocked by: T-005
  - Blocks: T-015, T-016

- [ ] **T-015** (complexity: 3) - Add isDescendant and updateDescendantPaths methods
  - Cycle detection + cascading path updates
  - Blocked by: T-013, T-014
  - Blocks: T-016, T-019

- [ ] **T-016** (complexity: 4) - Write unit tests for hierarchy model methods
  - Tests for findDescendants, findAncestors, isDescendant, updateDescendantPaths
  - Blocked by: T-015
  - Blocks: none

---

### Core Phase - Service (10 tasks)

- [ ] **T-017** (complexity: 2) - Create destination hierarchy helper functions
  - validateDestinationTypeLevel, getExpectedParentType, computeHierarchyPath, computeHierarchyPathIds
  - Blocked by: T-001
  - Blocks: T-018, T-019

- [ ] **T-018** (complexity: 4) - Update _beforeCreate hook for hierarchy auto-computation
  - Auto-compute path, pathIds, level from parent; validate type/level
  - Blocked by: T-011, T-017
  - Blocks: T-019, T-026

- [ ] **T-019** (complexity: 4) - Update _beforeUpdate hook for reparenting logic
  - Cycle detection, path recalculation, descendant cascade
  - Blocked by: T-015, T-017, T-018
  - Blocks: T-026

- [ ] **T-020** (complexity: 3) - Add getChildren method to DestinationService
  - Fetch immediate children with permission checks
  - Blocked by: T-011
  - Blocks: T-025, T-030

- [ ] **T-021** (complexity: 3) - Add getDescendants method to DestinationService
  - Fetch all descendants using materialized path
  - Blocked by: T-011, T-013
  - Blocks: T-025

- [ ] **T-022** (complexity: 3) - Add getAncestors and getBreadcrumb methods
  - Ancestors ordered root-to-parent + breadcrumb assembly
  - Blocked by: T-010, T-011, T-014
  - Blocks: T-025, T-033

- [ ] **T-023** (complexity: 2) - Add getByPath method to DestinationService
  - Resolve destination by materialized path
  - Blocked by: T-011
  - Blocks: T-025, T-034

- [ ] **T-024** (complexity: 4) - Update destination search/list to support hierarchy filters
  - parentDestinationId, destinationType, level, ancestorId filters in search
  - Blocked by: T-011, T-013
  - Blocks: T-025, T-035

- [ ] **T-025** (complexity: 4) - Write unit tests for service hierarchy methods
  - Tests for getChildren, getDescendants, getAncestors, getBreadcrumb, getByPath, search
  - Blocked by: T-020, T-021, T-022, T-023, T-024
  - Blocks: none

- [ ] **T-026** (complexity: 4) - Write unit tests for _beforeCreate/_beforeUpdate hooks
  - Auto-computation, validation, cycle detection, cascading tests
  - Blocked by: T-018, T-019
  - Blocks: none

---

### Integration Phase - Seeds (3 tasks)

- [ ] **T-027** (complexity: 3) - Create hierarchy node seed files
  - 4 JSON files: Argentina, Litoral, Entre Rios, Depto Uruguay
  - Blocked by: T-005
  - Blocks: T-028, T-029

- [ ] **T-028** (complexity: 3) - Update existing 11 city seed files with hierarchy fields
  - Add destinationType, level, path, pathIds, parentDestinationId to all cities
  - Blocked by: T-027
  - Blocks: T-029

- [ ] **T-029** (complexity: 4) - Update seed script and manifest for hierarchy order
  - Manifest ordering, normalizer updates, idMapper for parentDestinationId
  - Blocked by: T-027, T-028
  - Blocks: T-037

---

### Integration Phase - API (8 tasks)

- [ ] **T-030** (complexity: 2) - Create GET /destinations/:id/children route
  - Blocked by: T-020
  - Blocks: T-036, T-037

- [ ] **T-031** (complexity: 3) - Create GET /destinations/:id/descendants route
  - With maxDepth and destinationType query params
  - Blocked by: T-021
  - Blocks: T-036, T-037

- [ ] **T-032** (complexity: 2) - Create GET /destinations/:id/ancestors route
  - Blocked by: T-022
  - Blocks: T-036, T-037

- [ ] **T-033** (complexity: 2) - Create GET /destinations/:id/breadcrumb route
  - With high cache TTL
  - Blocked by: T-022
  - Blocks: T-036, T-037

- [ ] **T-034** (complexity: 3) - Create GET /destinations/by-path route
  - IMPORTANT: Must be registered before :id routes
  - Blocked by: T-023
  - Blocks: T-036, T-037

- [ ] **T-035** (complexity: 3) - Update GET /destinations list/search with hierarchy filters
  - Add hierarchy query params to existing route
  - Blocked by: T-024
  - Blocks: T-036, T-037

- [ ] **T-036** (complexity: 2) - Register new hierarchy routes in destination router
  - Route ordering critical (by-path before :id)
  - Blocked by: T-030, T-031, T-032, T-033, T-034, T-035
  - Blocks: T-037

- [ ] **T-037** (complexity: 4) - Write integration tests for hierarchy API routes
  - Tests for all 5 hierarchy endpoints + updated search
  - Blocked by: T-029, T-036
  - Blocks: T-042

---

### Integration Phase - Frontend (4 tasks)

- [ ] **T-038** (complexity: 3) - Update getDestinationUrl utility for hierarchical URLs
  - Path-based URL generation replacing slug-based
  - Blocked by: T-006
  - Blocks: T-040

- [ ] **T-039** (complexity: 3) - Create Breadcrumb Astro component
  - Accessible breadcrumb with hierarchy navigation
  - Blocked by: T-010
  - Blocks: T-040

- [ ] **T-040** (complexity: 4) - Create dynamic destination route [...path].astro
  - Catch-all route resolving hierarchy URLs
  - Blocked by: T-038, T-039
  - Blocks: T-041, T-042

- [ ] **T-041** (complexity: 4) - Update destination search/filter UI with hierarchy support
  - Hierarchy filter controls + updated destination cards
  - Blocked by: T-040
  - Blocks: T-042

---

### Testing Phase (1 task)

- [ ] **T-042** (complexity: 4) - End-to-end validation and quality assurance
  - typecheck, lint, test, build, manual smoke test
  - Blocked by: T-037, T-040, T-041
  - Blocks: T-043

---

### Docs Phase (1 task)

- [ ] **T-043** (complexity: 3) - Update CLAUDE.md documentation for affected packages
  - 6 CLAUDE.md files: db, schemas, service-core, api, web, seed
  - Blocked by: T-042
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001
Level 1: T-002, T-006, T-017
Level 2: T-003, T-007, T-008, T-010, T-038
Level 3: T-004, T-009, T-039
Level 4: T-005, T-011
Level 5: T-012, T-013, T-014, T-018, T-020, T-021, T-023, T-024, T-027
Level 6: T-015, T-019, T-022, T-025(partial), T-028, T-030, T-031, T-034
Level 7: T-016, T-026, T-029, T-032, T-033, T-035, T-040
Level 8: T-036, T-037(partial), T-041
Level 9: T-037, T-042
Level 10: T-043
```

## Parallel Tracks

After T-001 completes, 4 tracks can proceed in parallel:

1. **Database Track**: T-002 -> T-003 -> T-004 -> T-005 -> T-013/T-014 -> T-015 -> T-016
2. **Schema Track**: T-006 -> T-007/T-008/T-010 -> T-009 -> T-011 -> T-012
3. **Helper Track**: T-017 (merges into service track)
4. **Frontend URL Track**: T-038 (after T-006)

After T-011 and T-005 complete, service and integration tracks unlock.

## Suggested Start

Begin with **T-001** (complexity: 2) - Create DestinationType Zod enum and DESTINATION_TYPE_LEVELS constant. It has no dependencies and unblocks 6 other tasks across multiple tracks.
