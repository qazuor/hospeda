# SPEC-218: astro check in web CI

## Progress: 1/10 tasks (10%)

**Average Complexity:** 1.9/3 (max)
**Critical Path:** T-001 -> T-005/T-006 -> T-008 -> T-009 -> T-010 (5 steps)
**Parallel Tracks:** T-002..T-007 all parallel after T-001

---

### Setup Phase

- [x] **T-001** (complexity: 1) - Add env.d.ts to tsconfig.files so the App.Locals augmentation loads
  - DONE: `files: ["src/env.d.ts"]`. Verified 185 -> 68 errors, 117 Locals -> 0, tsc green.
  - Blocked by: none
  - Blocks: T-002, T-003, T-004, T-005, T-006, T-007

- [ ] **T-002** (complexity: 2) - Add compile-time App.Locals regression guard
  - Type assertion that fails to compile if augmentation not loaded.
  - Blocked by: T-001
  - Blocks: T-008

### Core Phase (all parallel after T-001)

- [ ] **T-003** (complexity: 2) - Fix ts(7006) implicit-any params (6) [mechanical]
  - Blocked by: T-001 / Blocks: T-008
- [ ] **T-004** (complexity: 2) - Fix ts(2724) imports + ts(2353) interface gaps (BreadcrumbItem.href)
  - Blocked by: T-001 / Blocks: T-008
- [ ] **T-005** (complexity: 3) - Fix ts(2322) type-assign mismatches (22)
  - Blocked by: T-001 / Blocks: T-008
- [ ] **T-006** (complexity: 3) - Fix ts(2339) non-Locals (21) + ts(2345) args (9) [W6/W8 class — check real bugs]
  - Blocked by: T-001 / Blocks: T-008
- [ ] **T-007** (complexity: 2) - Fix ts(2352) conversions (5) + ts(2358) instanceof (1)
  - Blocked by: T-001 / Blocks: T-008

### Testing Phase

- [ ] **T-008** (complexity: 1) - Verify astro check exits 0 on full tree
  - Blocked by: T-002..T-007 / Blocks: T-009

### Integration Phase

- [ ] **T-009** (complexity: 2) - Wire astro check into web typecheck script + confirm CI
  - Blocked by: T-008 / Blocks: T-010

### Docs Phase

- [ ] **T-010** (complexity: 1) - Document .astro typechecking + env.d.ts files invariant
  - Blocked by: T-009 / Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002, T-003, T-004, T-005, T-006, T-007
Level 2: T-008
Level 3: T-009
Level 4: T-010

## Suggested Start

Begin with **T-001** (complexity: 1) — no dependencies, unblocks the entire core phase and delivers the 117-error win in one line.
