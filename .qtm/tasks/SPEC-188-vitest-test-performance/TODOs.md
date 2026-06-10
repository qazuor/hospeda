# SPEC-188: Vitest Test-Suite Performance — Cut Per-File Overhead Without Saturating the Machine

## Progress: 0/21 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Critical Path:** T-001 -> T-003 -> T-010 -> T-007 -> T-008 -> T-015 -> T-017 -> T-018 -> T-020 -> T-021 (10 steps)
**Parallel Tracks:** 4 identified

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Extend baseline measurement to service-core, db, and schemas packages
  - Run per-package timing measurements on service-core, db, schemas (sequential, machine-safe); update spec.md §3
  - Blocked by: none
  - Blocks: T-003, T-010

- [ ] **T-002** (complexity: 1) - Record CI per-shard timing baseline from recent workflow runs
  - Pull last 3-5 CI runs via gh, extract 4-shard wall-clock times; stub docs/guides/test-performance.md
  - Blocked by: none
  - Blocks: T-020

- [ ] **T-003** (complexity: 1) - Lock SC-3 concurrency ceiling from leo-laptop hardware specs
  - Compute min(cores-2, RAM/2) ceiling; document in spec.md §3 and test-performance.md
  - Blocked by: T-001
  - Blocks: T-004, T-005

### Core Phase — Track A (machine-safety, low-risk, ship first)

- [ ] **T-004** (complexity: 2) - Create vitest.shared.config.ts skeleton with VITEST_MAX_FORKS env knob
  - New file at repo root; reads VITEST_MAX_FORKS env, sets pool/maxForks; unit test in vitest.shared.config.test.ts
  - Blocked by: T-003
  - Blocks: T-014

- [ ] **T-005** (complexity: 2) - Add concurrency cap to turbo.json test task pipeline
  - Add concurrency: <ceiling> to turbo.json test pipeline; verify with turbo --dry-run
  - Blocked by: T-003
  - Blocks: T-006, T-018

- [ ] **T-006** (complexity: 2) - Wire CI-side VITEST_MAX_FORKS override in ci.yml unit test job
  - Add VITEST_MAX_FORKS env key to Unit Tests job; CI value higher than local cap; YAML valid
  - Blocked by: T-005
  - Blocks: T-018

### Core Phase — Track B (import-graph diet, B2 first)

- [ ] **T-007** (complexity: 2) - Audit apps/api heavy import graph in setup.ts and module-level code
  - Read-only audit of setup.ts + top-10 slow files; document lazy-load candidates in spec.md §3
  - Blocked by: none
  - Blocks: T-008, T-009

- [ ] **T-008** (complexity: 3) - Lazy-load better-auth and heavy deps in apps/api test infrastructure
  - Convert top-level better-auth imports to dynamic in setup.ts + up to 3 helper files; verify 0 regressions
  - Blocked by: T-007
  - Blocks: T-010

- [ ] **T-009** (complexity: 3) - Trim apps/api test/setup.ts to minimal per-file setup
  - Remove/defer per-file global setup not needed by every file; move to per-suite beforeAll; 0 regressions
  - Blocked by: T-007
  - Blocks: T-010

- [ ] **T-010** (complexity: 2) - Measure collect-time delta after B2 changes on apps/api
  - Re-run baseline after T-008+T-009; compare vs 1101s; set or defer SC-2 target; update spec.md §3
  - Blocked by: T-008, T-009, T-001
  - Blocks: T-018

### Core Phase — Track B (pure packages + jsdom)

- [ ] **T-011** (complexity: 2) - Spike isolate:false on pure schema and util packages
  - Set isolate: false on packages/schemas + packages/utils; 3x green run; revert if flaky
  - Blocked by: none
  - Blocks: T-015

- [ ] **T-012** (complexity: 2) - Spike pool:threads on pure no-native-addon packages
  - Switch packages/schemas + packages/utils to pool: threads; 3x green; revert on segfault/flake
  - Blocked by: T-011
  - Blocks: T-015

- [ ] **T-013** (complexity: 3) - Spike environmentMatchGlobs node/jsdom split on apps/admin
  - Add environmentMatchGlobs to apps/admin; component globs to jsdom, rest to node; 3x green; record delta
  - Blocked by: none
  - Blocks: T-016

### Integration Phase

- [ ] **T-014** (complexity: 2) - Extend vitest.shared.config.ts with full base settings
  - Add environment: node, testTimeout, reporter, coverage passthrough; update vitest.shared.config.test.ts
  - Blocked by: T-004
  - Blocks: T-015, T-016

- [ ] **T-015** (complexity: 3) - Migrate node-environment packages to extend vitest.shared.config.ts
  - Update ~16 vitest.config.ts files to use mergeConfig(shared, local); remove duplicated knobs; green per package
  - Blocked by: T-014, T-011, T-012
  - Blocks: T-017, T-019

- [ ] **T-016** (complexity: 3) - Migrate jsdom packages to extend shared config with environment split
  - Update 5 jsdom package vitest configs; apply T-013 env split to apps/admin; green per package
  - Blocked by: T-014, T-013
  - Blocks: T-017, T-019

### Testing Phase

- [ ] **T-017** (complexity: 2) - Run 3-consecutive-green validation for each accepted lever
  - 3x green per lever per package; revert any flake; record validation table in test-performance.md
  - Blocked by: T-015, T-016
  - Blocks: T-018

- [ ] **T-018** (complexity: 2) - Perform SC-3 local full-suite machine-safety sign-off on leo-laptop
  - Full pnpm test on leo-laptop with monitoring; record sign-off in spec.md §9 (date, peak mem, time)
  - Blocked by: T-005, T-006, T-010, T-017
  - Blocks: T-020

- [ ] **T-019** (complexity: 1) - Verify coverage thresholds and .only/.skip guard still pass
  - Run pnpm test:coverage + .only/.skip guard check; both must exit 0
  - Blocked by: T-015, T-016
  - Blocks: T-021

### Docs Phase

- [ ] **T-020** (complexity: 2) - Write docs/guides/test-performance.md
  - Complete guide: concurrency cap formula, env knobs, B2 findings, baseline table, lever results, re-measure procedure
  - Blocked by: T-018, T-002
  - Blocks: T-021

- [ ] **T-021** (complexity: 1) - Update ci.yml test-unit comment with new baseline and cap decision
  - Update Unit Tests comment with new timings + VITEST_MAX_FORKS note; propose cap lowering (not applied)
  - Blocked by: T-020, T-019
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001, T-002, T-007, T-011, T-013
Level 1: T-003, T-010 (partial — also needs T-008/T-009), T-012
Level 2: T-004, T-005, T-008, T-009, T-015 (partial — needs T-012/T-014)
Level 3: T-006, T-010 (full), T-014
Level 4: T-015, T-016, T-018 (partial)
Level 5: T-017, T-019
Level 6: T-018 (full)
Level 7: T-020
Level 8: T-021
```

### Parallel Tracks

```
Track A (machine-safety):   T-001 -> T-003 -> T-004 -> T-014 -> T-015 -> T-017 -> T-018 -> T-020 -> T-021
                                   -> T-005 -> T-006 -> T-018
Track B2 (import-graph):    T-007 -> T-008 -> T-010 -> T-018
                             T-007 -> T-009 -> T-010
Track B3 (pure packages):   T-011 -> T-012 -> T-015
Track B4 (jsdom):           T-013 -> T-016 -> T-017
Track CI baseline:          T-002 -> T-020
```

### Critical Path (longest weighted chain)

**T-001 → T-003 → T-004 → T-014 → T-015 → T-017 → T-018 → T-020 → T-021**
(9 sequential steps, weighted length = 1+1+2+2+3+2+2+2+1 = 16)

---

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks T-003 and T-010.

**T-001 is a Track A task** (baseline measurement that feeds the SC-3 ceiling calculation needed for the concurrency cap).

Simultaneously start: **T-002** (complexity: 1, no deps), **T-007** (complexity: 2, no deps), **T-011** (complexity: 2, no deps), **T-013** (complexity: 3, no deps) — all four are independent and can run in parallel.
