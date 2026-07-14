# HOS-143: Point of Interest (POI) Admin CRUD API

## Progress: 0/16 tasks (0%)

**Average Complexity:** 2.3/3
**Critical Path:** T-004 → T-006 → T-012 → T-014 → T-016
**Parallel Tracks:** schemas (T-001..T-004) run in parallel

---

### Setup Phase (schemas)

- [ ] **T-001** (2) - Add PointOfInterestAdminSearchSchema — blocks T-007, T-008
- [ ] **T-002** (2) - Add PointOfInterest batch schemas (requiredFields ['id','slug']) — blocks T-008
- [ ] **T-003** (2) - Add destination-relation schemas — blocks T-005, T-011
- [ ] **T-004** (2) - Add category-assignment schemas (refine + max 10) — blocks T-006, T-012

### Core Phase (service)

- [ ] **T-005** (3) - updatePointOfInterestDestinationRelation — blockedBy T-003 — blocks T-011
- [ ] **T-006** (3) - setCategoriesForPointOfInterest (txn full-replace, existing category service) — blockedBy T-004 — blocks T-012
- [ ] **T-007** (3) - admin-search filters hasOwnPage/verified/categoryId (AND) — blockedBy T-001 — blocks T-010

### Integration Phase (routes)

- [ ] **T-008** (3) - Standard CRUD admin tier (9 files + index) — blockedBy T-001, T-002 — blocks T-009, T-010
- [ ] **T-009** (1) - Register admin POI routes — blockedBy T-008 — blocks T-010, T-011, T-012
- [ ] **T-011** (3) - Destination-relation sub-router + tests — blockedBy T-003, T-005, T-009
- [ ] **T-012** (3) - Category-assignment routes + tests — blockedBy T-004, T-006, T-009
- [ ] **T-013** (2) - AI-translate add pointOfInterest (6 sites) — blockedBy T-009

### Testing Phase

- [ ] **T-010** (3) - Integration tests: standard CRUD tier — blockedBy T-007, T-008, T-009

### Docs Phase

- [ ] **T-014** (2) - Gate-matrix rows (15 routes, Decision:none) — blockedBy T-011, T-012
- [ ] **T-015** (1) - Spec closeout + Linear notes — blockedBy T-014

### Cleanup Phase

- [ ] **T-016** (2) - Quality gate: typecheck + suites + coverage — blockedBy T-010, T-013, T-015

---

## Dependency Levels

Level 0: T-001, T-002, T-003, T-004
Level 1: T-005, T-006, T-007, T-008
Level 2: T-009
Level 3: T-010, T-011, T-012, T-013
Level 4: T-014
Level 5: T-015
Level 6: T-016

## Suggested Start

Begin with the four schema tasks **T-001..T-004** (no deps, all complexity 2) — they unblock the whole tree.
