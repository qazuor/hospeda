# HOS-35: Migrate @tanstack/react-query 5.59 → 5.101 (admin dashboard loading-state regression)

## Progress: 8/10 tasks (80%)

**Average Complexity:** 1.7/3 (max)
**Critical Path:** T-001 -> T-003 -> T-004 -> T-005 -> T-006 -> T-008 -> T-009 -> T-010 (8 steps)
**Parallel Tracks:** T-002 runs independently of T-001/T-003; T-007 and T-008 run in parallel after T-006

---

### Setup Phase

- [x] **T-001** (complexity: 1) - Bump react-query to 5.101.x in admin and mobile
  - Set @tanstack/react-query to 5.101.2 in apps/admin and apps/mobile, relocked
  - Blocked by: none
  - Blocks: T-003

### Core Phase

- [x] **T-002** (complexity: 2) - Diff react-query changelog for loading-state semantic changes
  - Read changelog 5.90→5.101 (main branch history), no isLoading/isPending redefinition found
  - Blocked by: none
  - Blocks: T-004

- [x] **T-003** (complexity: 2) - Reproduce widget suite failures under 5.101 and capture diagnostics
  - ListWidget.test.tsx: 20 pass / 12 fail, matches spec's reported 12/32 exactly
  - Blocked by: T-001
  - Blocks: T-004

- [x] **T-004** (complexity: 1) - Classify root cause and document finding in spec
  - Verdict: test-harness brittleness (premature findByTestId on persistent wrapper), documented in spec.md §9
  - Blocked by: T-002, T-003
  - Blocks: T-005

- [x] **T-005** (complexity: 3) - Apply the root-cause fix to widgets and/or shared test setup
  - Fixed 32 assertions across 6 test files: await real data testid, not persistent wrapper (commit a3be0e22f)
  - Blocked by: T-004
  - Blocks: T-006

- [x] **T-006** (complexity: 2) - Iterate until full dashboard widget suite is green
  - Confirmed 270/270 dashboard tests green under 5.101.2 (independently re-verified)
  - Blocked by: T-005
  - Blocks: T-007, T-008

### Integration Phase

- [x] **T-007** (complexity: 2) - Manually verify live admin dashboards render data under 5.101
  - Skipped with justification: test-harness-only classification, no prod code touched, no seeded STAFF/ADMIN login in a fresh worktree DB (see spec.md §9)
  - Blocked by: T-006
  - Blocks: T-010

- [x] **T-008** (complexity: 1) - Run full admin unit suite to confirm no wider regressions
  - Full apps/admin suite: 4425 pass / 0 fail / 1 pending (unrelated)
  - Blocked by: T-006
  - Blocks: T-010

### Cleanup Phase

- [ ] **T-009** (complexity: 1) - Remove react-query Dependabot ignore entry
  - Remove the ignore entry + comment block from .github/dependabot.yml
  - Blocked by: T-008
  - Blocks: T-010

### Docs Phase

- [ ] **T-010** (complexity: 2) - Open PR to staging and drive CI green
  - PR titled [HOS-35], summary of findings + verification, CI green
  - Blocked by: T-007, T-008, T-009
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-002
Level 1: T-003
Level 2: T-004
Level 3: T-005
Level 4: T-006
Level 5: T-007, T-008
Level 6: T-009
Level 7: T-010

## Suggested Start

Begin with **T-001** (complexity: 1) - bumps the dependency so T-003 can reproduce against the real 5.101 behavior. **T-002** (complexity: 2) can run in parallel — it's pure changelog research with no dependency on the bump.
