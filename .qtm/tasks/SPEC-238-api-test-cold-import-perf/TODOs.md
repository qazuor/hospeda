# SPEC-238: Reduce apps/api per-file test cold-import overhead (~9% suite speedup)

## Progress: 0/10 tasks (0%)

**Average Complexity:** 2.0/3 (max)
**Critical Path:** T-001 -> T-002 -> T-003 -> T-004 -> T-006 -> T-007 -> T-009 -> T-010 (8 steps)
**Parallel Tracks:** 2 (service-core lever T-002..T-004/T-006 ‖ Sentry mock T-005)

> Scope note: of the 3 levers in the spec, the shared vitest config already
> exists on staging. Remaining work = (1) drop the global service-core
> `...actual` spread, (2) mock Sentry. AC#1 (~9%) is authoritative on the
> self-hosted CI runner, not the local dev machine.

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Measure local baseline (collect + wall time) for apps/api unit suite
  - 3 clean runs, record median; local proxy only, CI is authoritative
  - Blocked by: none
  - Blocks: T-002, T-005

### Core Phase

- [ ] **T-002** (complexity: 3) - Inventory real @repo/service-core exports consumed via the global mock spread
  - Grep + classify all named imports; list enums/constants/pure-fns from `...actual`
  - Blocked by: T-001
  - Blocks: T-003

- [ ] **T-003** (complexity: 3) - Author service-core-extras mock with explicit enums/constants/pure-fns
  - Enums from @repo/schemas SSOT; ServiceError from existing stub; faithful contracts
  - Blocked by: T-002
  - Blocks: T-004

- [ ] **T-004** (complexity: 3) - Drop importOriginal/...actual from global mock; wire extras; repair fallout
  - The main ~80% cold-import trim; iterate suite to green
  - Blocked by: T-003
  - Blocks: T-006

- [ ] **T-005** (complexity: 2) - Mock Sentry (@sentry/node + @sentry/profiling-node) in test setup
  - Prevents native addon load + init per file; parallel to the service-core track
  - Blocked by: T-001
  - Blocks: T-007

### Integration Phase

- [ ] **T-006** (complexity: 2) - Audit tests with local importOriginal of service-core still load real logic
  - Confirm ~42 real-logic tests still resolve real module; document two-tier pattern
  - Blocked by: T-004
  - Blocks: T-007

### Testing Phase

- [ ] **T-007** (complexity: 2) - Full suite green + measure post-change delta vs baseline
  - 3 clean runs, median; document local delta; flag CI as authoritative
  - Blocked by: T-005, T-006
  - Blocks: T-008, T-009

- [ ] **T-008** (complexity: 1) - Verify machine-safety invariant (concurrency / peak memory unchanged)
  - maxForks stays 3; no new parallelism; memory should drop not rise
  - Blocked by: T-007
  - Blocks: T-010

### Docs Phase

- [ ] **T-009** (complexity: 1) - Document the technique in docs/guides/test-performance.md
  - Two-tier mock, Sentry mock, shared config, measurement caveat
  - Blocked by: T-007
  - Blocks: T-010

### Cleanup Phase

- [ ] **T-010** (complexity: 1) - Update AC checkboxes + close-out governance (indexes, CSV)
  - Tick local-satisfied ACs; AC#1 pending CI; sync indexes + CSV; draft PR
  - Blocked by: T-008, T-009
  - Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002, T-005
Level 2: T-003
Level 3: T-004
Level 4: T-006
Level 5: T-007
Level 6: T-008, T-009
Level 7: T-010

## Suggested Start

Begin with **T-001** (complexity: 2) - no dependencies, establishes the
before/after baseline and unblocks both the service-core lever and the Sentry mock.
