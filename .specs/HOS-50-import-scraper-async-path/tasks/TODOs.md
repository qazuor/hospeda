# HOS-50: Accommodation import — async extraction path for slow/blocked sources (SPEC-277 R3)

## Progress: 18/19 tasks (95%)

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-001 -> T-005 -> T-006 -> T-011 -> T-013 -> T-018 (6 steps)
**Parallel Tracks:** 3 identified (setup/core foundation T-001..T-004/T-009; web polling surface T-012->T-013; admin polling surface T-014->T-015), converging at T-018.

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Add async import Zod schemas — DONE
  - New start/status request/response schemas in accommodation-import.schema.ts
  - Blocked by: none
  - Blocks: T-005, T-006, T-010, T-011, T-012, T-014

### Core Phase

- [x] **T-002** (complexity: 1) - Add ApifyRunStatus to ImportFailureCode mapping helper — DONE
  - Blocked by: none
  - Blocks: T-006

- [x] **T-003** (complexity: 1) - Extend ImportSourceAdapter interface for async mode — DONE
  - Blocked by: none
  - Blocks: T-007, T-008

- [x] **T-004** (complexity: 2) - Create startApifyRun retry wrapper for R1 — DONE
  - Blocked by: none
  - Blocks: T-007, T-008

- [x] **T-005** (complexity: 2) - Implement resolveImportRunStatus running/succeeded branches — DONE
  - Blocked by: T-001
  - Blocks: T-006

- [x] **T-006** (complexity: 3) - Extend resolveImportRunStatus with terminal-failure branch and R2 fallback — DONE
  - Blocked by: T-001, T-002, T-005
  - Blocks: T-011

- [x] **T-007** (complexity: 2) - Add async extraction mode to Airbnb adapter — DONE
  - Blocked by: T-003, T-004
  - Blocks: T-010

- [x] **T-008** (complexity: 3) - Add async extraction mode to Booking adapter — DONE
  - Blocked by: T-003, T-004
  - Blocks: T-010

- [x] **T-009** (complexity: 3) - Extract finalizeImportDraft reusable post-extraction pipeline — DONE
  - Blocked by: none
  - Blocks: T-011, T-016

### Integration Phase

- [x] **T-010** (complexity: 3) - Modify import-from-url route to dispatch 202 for async sources — DONE
  - Blocked by: T-001, T-007, T-008
  - Blocks: T-013, T-015, T-016, T-017, T-019

- [x] **T-011** (complexity: 3) - Create GET import-from-url status polling route — DONE
  - Blocked by: T-001, T-006, T-009
  - Blocks: T-013, T-015, T-016, T-019

- [x] **T-012** (complexity: 2) - Build web import-status polling hook — DONE
  - Blocked by: T-001
  - Blocks: T-013

- [x] **T-013** (complexity: 3) - Wire ImportFromUrl.client.tsx to the async polling flow — DONE
  - Blocked by: T-010, T-011, T-012
  - Blocks: T-018

- [x] **T-014** (complexity: 2) - Build admin import-status query hook — DONE
  - Blocked by: T-001
  - Blocks: T-015

- [x] **T-015** (complexity: 3) - Wire ImportFromUrlSection.tsx to the async polling flow — DONE
  - Blocked by: T-010, T-011, T-014
  - Blocks: T-018

### Testing Phase

- [x] **T-016** (complexity: 3) - Write integration tests for the full async 202+poll route contract — DONE
  - Blocked by: T-009, T-010, T-011
  - Blocks: T-018

- [x] **T-017** (complexity: 1) - Write regression tests for the unchanged synchronous contract — DONE
  - Blocked by: T-010
  - Blocks: none

- [x] **T-018** (complexity: 2) - Run cross-cutting client polling UX regression pass — DONE (no gap found)
  - Blocked by: T-013, T-015, T-016
  - Blocks: none

### Docs Phase

- [ ] **T-019** (complexity: 1) - Document the new async import contract
  - Blocked by: T-010, T-011
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002, T-003, T-004, T-009
Level 1: T-005, T-007, T-008, T-012, T-014
Level 2: T-006, T-010
Level 3: T-011, T-017
Level 4: T-013, T-015, T-016, T-019
Level 5: T-018

## Suggested Start

Begin with **T-001** (complexity: 2) - it has no dependencies and unblocks 6 other tasks (the widest fan-out in the graph). T-002, T-003, T-004, and T-009 can run in parallel with it — all five are Level 0 with no blockers.
