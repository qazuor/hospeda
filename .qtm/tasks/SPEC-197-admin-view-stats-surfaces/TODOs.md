# SPEC-197: Admin View-Stats Surfaces

## Progress: 21/21 tasks (100%) — completed 2026-06-06

**Average Complexity:** 2.2/10
**Critical Path:** T-003 -> T-006 -> T-007 -> T-009 -> T-017 -> T-018 -> T-020 -> T-021 (8 steps)
**Parallel Tracks:** 3 (backend chain, frontend WindowToggle+dashboards, list/detail surfaces after routes)

---

### Setup Phase

- [x] **T-001** (complexity: 1) - Verify ANALYTICS_VIEW seed assignment and VIEW_BASIC_STATS entitlement key
  - Verify role seed + entitlement key exist; document findings, no code expected
  - Blocked by: none
  - Blocks: T-004, T-007, T-008, T-013

- [x] **T-002** (complexity: 1) - Verify entityView schema exports from @repo/schemas
  - Confirm TrackableEntityTypeSchema, EntityViewStatsSchema, EntityViewWindowSchema ('7d'/'30d')
  - Blocked by: none
  - Blocks: T-005, T-006

- [x] **T-003** (complexity: 1) - Add zodError translation keys for new admin view schemas
  - 3 keys x 3 locales in validation.json (GAP-010); run check-locales
  - Blocked by: none
  - Blocks: T-006

### Core Phase

- [x] **T-004** (complexity: 3) - Add getTopViewedEntities to EntityViewModel
  - Raw SQL ranked by total DESC, parameterized limit, AS "unique" quoting; unit tests
  - Blocked by: T-001
  - Blocks: T-007

- [x] **T-005** (complexity: 3) - Add getDailySeries to EntityViewModel
  - Date-bucketed counts, days-with-data only (gap-fill is service concern); unit tests
  - Blocked by: T-002
  - Blocks: T-007

- [x] **T-006** (complexity: 3) - Add getAdminSummaryTotals model method + new admin Zod schemas
  - Group by entity_type without IN-list; 6 new Zod schemas + barrel; extract-zod-keys verify
  - Blocked by: T-002, T-003
  - Blocks: T-007

- [x] **T-007** (complexity: 3) - Add four admin methods to EntityViewService
  - getAdminSummary/Batch/TopEntities/DailySeries, ANALYTICS_VIEW gate, lazy getter preserved, gap-fill 90 rows
  - Blocked by: T-001, T-004, T-005, T-006
  - Blocks: T-008, T-009, T-010, T-011

### Integration Phase

- [x] **T-008** (complexity: 2) - Create admin views router + GET /admin/views/summary
  - index.ts mount at /api/v1/admin/views/ + summary route + tests + gate-matrix row
  - Blocked by: T-001, T-007
  - Blocks: T-015, T-019

- [x] **T-009** (complexity: 2) - Implement GET /admin/views/batch
  - Comma-separated UUIDs max 100, zero-fill; tests incl. 101-item + invalid-UUID; gate-matrix row
  - Blocked by: T-007
  - Blocks: T-016, T-017

- [x] **T-010** (complexity: 2) - Implement GET /admin/views/top
  - limit 1-50 default 10, ordered total DESC; tests incl. limit bounds; gate-matrix row
  - Blocked by: T-007
  - Blocks: T-019

- [x] **T-011** (complexity: 2) - Implement GET /admin/views/daily-series
  - No params, 90-row zero-filled invariant; tests; gate-matrix row
  - Blocked by: T-007
  - Blocks: T-019

- [x] **T-012** (complexity: 1) - Implement shared WindowToggle component
  - Single 7d/30d toggle (Shadcn ToggleGroup), used by ALL six surfaces; tests + i18n
  - Blocked by: none
  - Blocks: T-013, T-014, T-015, T-019

- [x] **T-013** (complexity: 3) - Fill HOST card G views deferredSlot with locked-state-aware source
  - Proactive entitlement check from cached host.billing.plan; locked UI + CTA; atomic slot swap
  - Blocked by: T-001, T-012
  - Blocks: T-020

- [x] **T-014** (complexity: 2) - Fill EDITOR cards E/F views deferredSlots
  - editor.posts.views + editor.events.views sources; independent window state; atomic swap
  - Blocked by: T-012
  - Blocks: T-020

- [x] **T-015** (complexity: 2) - Add admin-card-views summary card to adminBaseDashboard
  - admin.views.summary source; update SPEC-155 card-count test atomically
  - Blocked by: T-008, T-012
  - Blocks: T-020

- [x] **T-016** (complexity: 3) - Implement EntityViewStatChips on detail pages
  - 4 chips via batch endpoint; 'stats-chips' section type; viewOnly; permission-guarded
  - Blocked by: T-009
  - Blocks: T-020

- [x] **T-017** (complexity: 3) - Add 'Vistas (30d)' derived column to accommodations list
  - Secondary batch useQuery, Map cache, enableSorting: false, permission guard
  - Blocked by: T-009
  - Blocks: T-018, T-020

- [x] **T-018** (complexity: 2) - Add 'Vistas (30d)' column to posts and events lists
  - Replicate T-017 pattern; extract shared hook if feasible
  - Blocked by: T-017
  - Blocks: T-020

- [x] **T-019** (complexity: 3) - Create /analytics/views page (tiles + top-10 + 30d chart)
  - Sibling of business.tsx; summary tiles + top-10 with name resolution + recharts 3-line chart
  - Blocked by: T-008, T-010, T-011, T-012
  - Blocks: T-020

### Testing Phase

- [x] **T-020** (complexity: 2) - Analytics page tests + full typecheck/test/build gate
  - views.test.tsx; pnpm typecheck + test + build; local CI guards (type-casts, schema-drift, zod-keys, locales)
  - Blocked by: T-013, T-014, T-015, T-016, T-018, T-019
  - Blocks: T-021

- [x] **T-021** (complexity: 2) - Real-DB smoke of all four admin endpoints
  - db:fresh-dev + beacons + verify summary/daily-series/top; sign-off in PR description
  - Blocked by: T-020
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003, T-012
Level 1: T-004, T-005, T-006, T-013*, T-014*
Level 2: T-007
Level 3: T-008, T-009, T-010, T-011
Level 4: T-015, T-016, T-017, T-019
Level 5: T-018
Level 6: T-020
Level 7: T-021

*T-013/T-014 consume the SPEC-159 protected endpoints (already live), so they only wait on T-012 (+T-001 for T-013) — they can run in parallel with the backend chain.

## Suggested Start

Begin with **T-001, T-002, T-003** (all complexity 1, no dependencies) — together they unblock the entire core phase. **T-012** (WindowToggle) is also dependency-free and unblocks all frontend tasks.
