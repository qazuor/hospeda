# SPEC-054: Admin Entity List Filter Bar & Default Filters Indicator

## Progress: 0/25 tasks (0%)

**Average Complexity:** 2.0/4 (max)
**Critical Path:** T-001 -> T-003 -> T-005 -> T-006 -> T-007 -> T-016 -> T-025 (7 steps)
**Parallel Tracks:** 4 identified

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Create filter-types.ts with core type definitions
  - FilterControlType, FilterControlConfig, FilterBarConfig, ActiveFilters, FilterChipData
  - Blocked by: none
  - Blocks: T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009

- [ ] **T-002** (complexity: 1) - Add filterBarConfig property to EntityConfig in types.ts
  - Import FilterBarConfig, add optional property to EntityConfig
  - Blocked by: T-001
  - Blocks: T-018..T-022

### Core Phase

- [ ] **T-003** (complexity: 2) - Create filter-utils.ts with extractActiveFilters and computeDefaultFilters
  - FILTER_CLEARED_SENTINEL, extractActiveFilters, computeDefaultFilters, filtersEqual
  - Blocked by: T-001
  - Blocks: T-005, T-006

- [ ] **T-004** (complexity: 2) - Add buildFilterChips and buildFilterParamUpdate to filter-utils.ts
  - buildFilterChips (sorted by order), buildFilterParamUpdate (sentinel logic)
  - Blocked by: T-001
  - Blocks: T-005, T-006

- [ ] **T-005** (complexity: 3) - Write unit tests for filter-utils.ts
  - 19 test cases covering all 5 functions. Target: 100% line coverage
  - Blocked by: T-003, T-004
  - Blocks: T-006

- [ ] **T-006** (complexity: 3) - Create useFilterState hook
  - Core state hook bridging URL params with filter state. Memoized.
  - Blocked by: T-003, T-004, T-005
  - Blocks: T-007, T-016

- [ ] **T-007** (complexity: 3) - Write unit tests for useFilterState hook
  - 11 test cases with renderHook. Target: >= 90% coverage
  - Blocked by: T-006
  - Blocks: T-016

- [ ] **T-008** (complexity: 2) - Create FilterChip component
  - Badge composition, default vs user styling, CloseIcon, a11y
  - Blocked by: T-001
  - Blocks: T-009

- [ ] **T-009** (complexity: 2) - Create ActiveFilterChips component
  - Horizontal chip row, aria-live, focus management
  - Blocked by: T-008
  - Blocks: T-013

- [ ] **T-010** (complexity: 2) - Create FilterSelect component
  - shadcn Select wrapper, All option, active styling
  - Blocked by: T-001
  - Blocks: T-013, T-023

- [ ] **T-011** (complexity: 2) - Create FilterBoolean component
  - shadcn Select with Yes/No/All, i18n
  - Blocked by: T-001
  - Blocks: T-013, T-023

- [ ] **T-012** (complexity: 1) - Create FilterActions component
  - Clear all + Reset to defaults buttons, conditional visibility
  - Blocked by: T-001
  - Blocks: T-013

- [ ] **T-013** (complexity: 3) - Create FilterBar container component
  - Assembles all sub-components, sorted by order, layout
  - Blocked by: T-009, T-010, T-011, T-012
  - Blocks: T-014, T-016, T-024

- [ ] **T-014** (complexity: 1) - Create filters/index.ts barrel exports
  - Named exports for all filter components and types
  - Blocked by: T-013
  - Blocks: T-016

### Integration Phase

- [ ] **T-015** (complexity: 3) - Refactor createEntityApi to RO-RO pattern with filterBarConfig support
  - New CreateEntityApiParams type, dual-path filter logic
  - Blocked by: none
  - Blocks: T-016

- [ ] **T-016** (complexity: 3) - Integrate FilterBar into EntityListPage
  - validateSearch update, useFilterState wiring, JSX, empty state
  - Blocked by: T-006, T-013, T-014, T-015
  - Blocks: T-018..T-022, T-025

- [ ] **T-017** (complexity: 2) - Create i18n admin-filters translation files and register namespace
  - 3 JSON files (en/es/pt), namespace registration, generate-types
  - Blocked by: none
  - Blocks: T-018..T-022

- [ ] **T-018** (complexity: 2) - Add filterBarConfig to destinations.config.ts
  - destinationType (default: CITY), status, isFeatured, includeDeleted
  - Blocked by: T-002, T-016, T-017

- [ ] **T-019** (complexity: 1) - Add filterBarConfig to accommodations.config.ts
  - status, type, isFeatured, includeDeleted
  - Blocked by: T-002, T-016, T-017

- [ ] **T-020** (complexity: 1) - Add filterBarConfig to events.config.ts
  - status, category, isFeatured, includeDeleted
  - Blocked by: T-002, T-016, T-017

- [ ] **T-021** (complexity: 1) - Add filterBarConfig to posts.config.ts
  - status, category, isFeatured, isNews, includeDeleted
  - Blocked by: T-002, T-016, T-017

- [ ] **T-022** (complexity: 1) - Add filterBarConfig to users.config.ts
  - role, includeDeleted
  - Blocked by: T-002, T-016, T-017

### Testing Phase

- [ ] **T-023** (complexity: 3) - Write component tests for FilterSelect and FilterBoolean
  - 11 test cases across 2 components
  - Blocked by: T-010, T-011

- [ ] **T-024** (complexity: 3) - Write component tests for FilterBar, FilterChip, FilterActions, ActiveFilterChips
  - 14 test cases across components
  - Blocked by: T-013

- [ ] **T-025** (complexity: 3) - Write integration tests for EntityListPage with FilterBar
  - 12 test cases: render, URL persistence, defaults, a11y
  - Blocked by: T-016, T-018..T-022

---

## Dependency Graph

Level 0: T-001, T-015, T-017
Level 1: T-002, T-003, T-004, T-008, T-010, T-011, T-012
Level 2: T-005, T-009
Level 3: T-006, T-013
Level 4: T-007, T-014, T-023, T-024
Level 5: T-016
Level 6: T-018, T-019, T-020, T-021, T-022
Level 7: T-025

## Suggested Start

Begin with **T-001** (complexity: 1), **T-015** (complexity: 3), and **T-017** (complexity: 2) in parallel - they have no dependencies and unblock the most tasks.
