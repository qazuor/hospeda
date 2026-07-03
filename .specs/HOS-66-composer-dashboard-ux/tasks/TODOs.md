# HOS-66: Social Posts — Composer + Dashboard UX

## Progress: 20/27 tasks (74%)

**Average Complexity:** 2.0/3 (max)
**Decomposition:** direct atomic pass (all tasks ≤ 3 complexity, grounded against current code)
**Blocked:** 4 tasks (T-013..T-016, G-8) — waiting on HOS-65 (Publishing Engine Extension), still in Linear Backlog.

**Scope note (found while atomizing, not assumed from spec.md alone):** G-5's catalog
active-campaigns/batches list and G-4/G-5's `campaignSlug`/`batchSlug` fields on draft
ingestion are **already implemented** (verified in `catalog.ts` and
`social-draft-ingestion.service.ts`). The remaining real gap is that slug resolution is
currently **resolve-only** (`resolveSlugToId` returns `null` on no match, never creates) —
spec G-5 requires resolve-**or-create**. Tasks below reflect only the actual remaining work.

---

### Core Phase

- [x] **T-001** (complexity: 2) - Implement resolve-or-create for campaign/batch slugs
  - Blocked by: none
  - Blocks: T-002, T-004

- [x] **T-002** (complexity: 2) - Echo campaign/batch resolution outcome in draft response
  - Blocked by: T-001
  - Blocks: T-003, T-004

- [x] **T-005** (complexity: 3) - Add date-range filtering to dashboard service
  - Blocked by: none
  - Blocks: T-006, T-007

- [x] **T-006** (complexity: 3) - Add per-platform breakdown aggregation to dashboard service
  - Blocked by: T-005
  - Blocks: T-007

- [x] **T-021** (complexity: 2) - Define public-data-pull response schema (`social-public-data.http.schema.ts`, 11 tests)
  - Blocked by: none
  - Blocks: T-022

- [x] **T-022** (complexity: 3) - Implement public-data aggregation service (`SocialPublicDataService`, 10 tests; delegated + orchestrator-verified)
  - Blocked by: T-021
  - Blocks: T-023, T-027

### Integration Phase

- [x] **T-003** (complexity: 2) - Update GPT-facing route descriptions for fuzzy-duplicate + implicit fallback
  - Blocked by: T-002
  - Blocks: T-004, T-027

- [x] **T-007** (complexity: 2) - Wire dashboard route + schema for date range and platform breakdown
  - Blocked by: T-005, T-006
  - Blocks: T-009, T-010, T-012

- [x] **T-008** (complexity: 2) - Ensure admin posts list response exposes thumbnailUrl (already implemented — closed by verification)
  - Blocked by: none
  - Blocks: T-011

- [x] **T-009** (complexity: 3) - Add date-range picker to admin dashboard page
  - Blocked by: T-007
  - Blocks: T-012

- [x] **T-010** (complexity: 2) - Add per-platform breakdown chart to dashboard
  - Blocked by: T-007
  - Blocks: T-012

- [x] **T-011** (complexity: 2) - Add thumbnail column to social posts table
  - Blocked by: T-008
  - Blocks: T-012

- [ ] **T-013** (complexity: 3) ⚠ BLOCKED (HOS-65) - Scaffold admin compose-social-post page
  - Blocked by: none (external: HOS-65)
  - Blocks: T-014

- [ ] **T-014** (complexity: 3) ⚠ BLOCKED (HOS-65) - Add platform multi-select creating N target rows
  - Blocked by: T-013
  - Blocks: T-015, T-016

- [ ] **T-015** (complexity: 2) ⚠ BLOCKED (HOS-65) - Add per-platform caption override affordance
  - Blocked by: T-014
  - Blocks: T-016

- [x] **T-023** (complexity: 2) - Add public-data-pull API route (`public-data.ts`, 8 route tests)
  - Blocked by: T-022
  - Blocks: T-024

- [ ] **T-025** (complexity: 1) - Create /marketing hub landing page
  - Blocked by: none
  - Blocks: T-026

### Cleanup Phase (G-9 icon audit)

- [x] **T-017** (complexity: 1) - Audit social admin components for inline SVG / direct phosphor imports (RESULT: empty inventory — subtree already clean; see state.json note)
  - Blocked by: none
  - Blocks: T-018, T-019

- [x] **T-018** (complexity: 2) - Replace icon imports in social posts subtree (CLOSED BY VERIFICATION — nothing to replace, subtree already clean)
  - Blocked by: T-017
  - Blocks: T-020

- [x] **T-019** (complexity: 2) - Replace icon imports in remaining social subtree (CLOSED BY VERIFICATION — nothing to replace, subtree already clean)
  - Blocked by: T-017
  - Blocks: T-020

### Testing Phase

- [x] **T-004** (complexity: 2) - Integration tests for batch/campaign auto-detection acceptance criteria (AC-1/AC-2/AC-3)
  - Blocked by: T-001, T-002, T-003

- [x] **T-012** (complexity: 2) - Verify dashboard AC-4 end-to-end
  - Blocked by: T-007, T-009, T-010, T-011

- [ ] **T-016** (complexity: 2) ⚠ BLOCKED (HOS-65) - Verify AC-5 end-to-end
  - Blocked by: T-014, T-015

- [x] **T-020** (complexity: 1) - Add CI guard against inline SVG / direct phosphor imports (AC-6) — `no-inline-icons.guard.test.ts`, 7/7 green
  - Blocked by: T-018, T-019

- [x] **T-024** (complexity: 2) - Verify public-data-pull scoping and auth end-to-end (`social-public-data-scope.test.ts`, 6 tests — R-1 guard)
  - Blocked by: T-023

- [ ] **T-026** (complexity: 1) - Verify AC-7 marketing hub route
  - Blocked by: T-025

### Docs Phase

- [ ] **T-027** (complexity: 1) - Document campaign/batch resolve-or-create and public-data-pull scope
  - Blocked by: T-001, T-002, T-003, T-022

---

## Dependency Graph (levels, ignoring the externally-blocked G-8 track)

Level 0: T-001, T-005, T-008, T-017, T-021, T-025, T-013(external)
Level 1: T-002, T-006, T-018, T-019, T-022, T-026, T-014(external)
Level 2: T-003, T-007, T-020, T-023, T-015(external)
Level 3: T-004, T-009, T-010, T-011, T-024, T-016(external)
Level 4: T-012, T-027

## Suggested Start

Begin with **T-001** (complexity: 2) - Implement resolve-or-create for campaign/batch
slugs. No dependencies, unblocks the rest of the G-4/G-5 backend track. Parallel tracks
available immediately: T-005 (dashboard), T-008 (thumbnail backend), T-017 (icon audit),
T-021 (public-data schema), T-025 (marketing hub) all have no blockers either.
