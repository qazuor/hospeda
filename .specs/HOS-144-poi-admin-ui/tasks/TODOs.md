# HOS-144: Point of Interest (POI) Admin Management UI

## Progress: 0/26 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-010 → T-008 → T-009 → T-011 → T-014 → T-023 → T-026 (7 steps)
**Parallel Tracks:** categories (T-016→T-017→T-018/T-019) and destinations (T-020→T-021/T-022) run in parallel once T-009/T-011 land.

---

### Setup Phase (feature scaffolding)

- [ ] **T-001** (complexity: 2) - Create POI feature config (points-of-interest.config.ts)
  - Blocked by: none · Blocks: T-002, T-008
- [ ] **T-002** (complexity: 3) - Create POI DataTable columns (points-of-interest.columns.ts)
  - Blocked by: T-001 · Blocks: T-012
- [ ] **T-003** (complexity: 3) - Basic Info consolidated section
  - Blocked by: none · Blocks: T-007
- [ ] **T-004** (complexity: 3) - Location consolidated section (coords + keywords)
  - Blocked by: none · Blocks: T-007
- [ ] **T-005** (complexity: 2) - Curation consolidated section
  - Blocked by: none · Blocks: T-007
- [ ] **T-006** (complexity: 2) - States & Moderation consolidated section
  - Blocked by: none · Blocks: T-007
- [ ] **T-007** (complexity: 2) - Compose consolidated config + barrels
  - Blocked by: T-003, T-004, T-005, T-006 · Blocks: T-013, T-014
- [ ] **T-008** (complexity: 3) - POI CRUD query hooks
  - Blocked by: T-001, T-010 · Blocks: T-009
- [ ] **T-009** (complexity: 3) - POI page orchestration hook (+ payload builder: keywords/coords)
  - Blocked by: T-008 · Blocks: T-011, T-012, T-013, T-014, T-015, T-020
- [ ] **T-010** (complexity: 1) - Admin-local POI schema aliases
  - Blocked by: none · Blocks: T-008, T-016

### Core Phase (CRUD pages)

- [ ] **T-011** (complexity: 2) - PointOfInterestSubTabLayout component
  - Blocked by: T-009 · Blocks: T-014, T-015, T-018, T-021
- [ ] **T-012** (complexity: 3) - LIST route (index.tsx)
  - Blocked by: T-002, T-009 · Blocks: T-024
- [ ] **T-013** (complexity: 3) - CREATE route (new.tsx, afterCreateRedirectMode edit)
  - Blocked by: T-007, T-009 · Blocks: none
- [ ] **T-014** (complexity: 3) - EDIT route ($id_.edit.tsx)
  - Blocked by: T-007, T-009, T-011 · Blocks: T-023
- [ ] **T-015** (complexity: 2) - VIEW route ($id.tsx, Overview tab)
  - Blocked by: T-011, T-009 · Blocks: none

### Integration Phase (categories / destinations / ai-translate / nav)

- [ ] **T-016** (complexity: 3) - PoiCategorySelectField + category api utils
  - Blocked by: T-010 · Blocks: T-017
- [ ] **T-017** (complexity: 3) - PoiCategoryManager component
  - Blocked by: T-016 · Blocks: T-018, T-019
- [ ] **T-018** (complexity: 2) - Categories tab route ($id_.categories.tsx)
  - Blocked by: T-017, T-011 · Blocks: T-025, T-026
- [ ] **T-020** (complexity: 3) - PoiDestinationRelationManager component
  - Blocked by: T-009 · Blocks: T-021, T-022
- [ ] **T-021** (complexity: 2) - Destinations tab route ($id_.destinations.tsx)
  - Blocked by: T-020, T-011 · Blocks: T-025, T-026
- [ ] **T-023** (complexity: 2) - AI-translate wiring (TranslationSection widen + edit mount)
  - Blocked by: T-014 · Blocks: T-026
- [ ] **T-024** (complexity: 2) - Navigation registration (sidebar + create-action)
  - Blocked by: T-012 · Blocks: T-026

### Testing Phase

- [ ] **T-019** (complexity: 3) - PoiCategoryManager component tests
  - Blocked by: T-017 · Blocks: T-026
- [ ] **T-022** (complexity: 3) - PoiDestinationRelationManager component tests
  - Blocked by: T-020 · Blocks: T-026
- [ ] **T-026** (complexity: 2) - Quality gate + manual verification checklist
  - Blocked by: T-018, T-021, T-023, T-024, T-025, T-019, T-022 · Blocks: none

### Docs Phase

- [ ] **T-025** (complexity: 1) - Docs: POI relation-manager pattern in admin CLAUDE.md
  - Blocked by: T-018, T-021 · Blocks: T-026

---

## Dependency Graph (levels)

- Level 0: T-001, T-003, T-004, T-005, T-006, T-010
- Level 1: T-002, T-007, T-008, T-016
- Level 2: T-009, T-017
- Level 3: T-011, T-012, T-013, T-018, T-019
- Level 4: T-014, T-015, T-020, T-024
- Level 5: T-021, T-022, T-023
- Level 6: T-025
- Level 7: T-026

## Suggested Start

Begin with **T-010** (complexity: 1, schema aliases) and **T-001** (config) in parallel — both are dependency-free and unblock the hooks chain (T-008 → T-009) that the entire feature builds on. The 4 form sections (T-003..T-006) can be built in parallel alongside.
