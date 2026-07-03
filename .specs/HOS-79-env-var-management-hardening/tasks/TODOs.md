# HOS-79: Env Var Management Hardening — Registry Completeness, Reconciliation, and Guided Setup

## Progress: 0/25 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Critical Path:** T-003 -> T-011 -> T-015 -> T-017 -> T-022 (5 steps)
**Parallel Tracks:** 4 identified at Level 0 (schema extraction ×4, usage/local/rules checks, repo-root extraction can all proceed independently before converging)

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Spike: confirm env-registry-types.ts needs no new fields
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 2) - Register the 3 known-missing env vars in the registry
  - Blocked by: T-001
  - Blocks: T-020

- [ ] **T-003** (complexity: 2) - Extract apps/api/src/utils/env-schema.ts (pure base schema)
  - Blocked by: none
  - Blocks: T-011, T-023

- [ ] **T-004** (complexity: 2) - Extract apps/admin/src/env-schema.ts (pure base schema)
  - Blocked by: none
  - Blocks: T-011, T-023

- [ ] **T-005** (complexity: 2) - Extract apps/mobile/src/lib/env-schema.ts (pure base schema)
  - Blocked by: none
  - Blocks: T-011, T-023

- [ ] **T-006** (complexity: 1) - Add apps/web/src/env-schema.ts re-export for naming consistency
  - Blocked by: none
  - Blocks: T-011, T-023

### Core Phase

- [ ] **T-007** (complexity: 3) - Build pnpm env:check:usage (source-usage-vs-registry scanner)
  - Blocked by: none
  - Blocks: T-013, T-020, T-024

- [ ] **T-008** (complexity: 3) - Build pnpm env:check:local (.env.local vs registry diff)
  - Blocked by: none
  - Blocks: T-013, T-018

- [ ] **T-009** (complexity: 1) - Author env-cross-checks.ts with the seeded REVALIDATION_SECRET rule
  - Blocked by: none
  - Blocks: T-010, T-011, T-016, T-021

- [ ] **T-010** (complexity: 3) - Build pnpm env:check:rules (three-state rule evaluator, local values)
  - Blocked by: T-009
  - Blocks: T-013, T-021

- [ ] **T-011** (complexity: 3) - Build scripts/generate-env-registry-json.ts + committed JSON artifact
  - Blocked by: T-003, T-004, T-005, T-006, T-009
  - Blocks: T-012, T-015, T-016, T-018, T-021

- [ ] **T-012** (complexity: 2) - Write the env-registry-json guard test
  - Blocked by: T-011
  - Blocks: T-021

- [ ] **T-013** (complexity: 1) - Wire pnpm env:doctor umbrella script
  - Blocked by: T-007, T-008, T-010
  - Blocks: T-025

### Integration Phase

- [ ] **T-014** (complexity: 2) - Extract scripts/server-tools/src/lib/repo-root.ts
  - Blocked by: none
  - Blocks: T-015, T-016

- [ ] **T-015** (complexity: 3) - Add hops env-reconcile command
  - Blocked by: T-011, T-014
  - Blocks: T-017, T-019, T-022

- [ ] **T-016** (complexity: 3) - Add hops env-check-rules command
  - Blocked by: T-009, T-011, T-014
  - Blocks: T-017, T-022

- [ ] **T-017** (complexity: 2) - Add hops env-doctor command (VPS umbrella)
  - Blocked by: T-015, T-016
  - Blocks: T-025

- [ ] **T-018** (complexity: 3) - Build the local interactive wizard (pnpm env:set)
  - Blocked by: T-008, T-011
  - Blocks: T-019, T-022

- [ ] **T-019** (complexity: 3) - Extend hops env-set with --wizard/--review-all (VPS variant)
  - Blocked by: T-018, T-015
  - Blocks: T-022

### Testing Phase

- [ ] **T-020** (complexity: 2) - Regression test: env:check:usage red-then-green on the 3 known-missing vars
  - Blocked by: T-007, T-002
  - Blocks: none

- [ ] **T-021** (complexity: 2) - Full test/typecheck pass — packages/config
  - Blocked by: T-009, T-010, T-011, T-012
  - Blocks: none

- [ ] **T-022** (complexity: 2) - Full test/typecheck pass — scripts/server-tools
  - Blocked by: T-015, T-016, T-017, T-018, T-019
  - Blocks: none

- [ ] **T-023** (complexity: 2) - Full test/typecheck pass — 4 apps post schema-extraction
  - Blocked by: T-003, T-004, T-005, T-006
  - Blocks: none

### Docs Phase

- [ ] **T-024** (complexity: 1) - Wire env:check:usage into CI guards job
  - Blocked by: T-007
  - Blocks: T-025

- [ ] **T-025** (complexity: 2) - Update docs/guides/env-management.md
  - Blocked by: T-013, T-017, T-024
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-014
Level 1: T-002, T-010, T-011, T-023, T-024
Level 2: T-012, T-013, T-015, T-016, T-018, T-020
Level 3: T-017, T-019, T-021
Level 4: T-022, T-025

## Suggested Start

Begin with any of the Level 0 tasks in parallel — **T-003/T-004/T-005/T-006** (schema extraction, 4 independent tracks) unblock the JSON-bridge work (T-011) fastest, and **T-007**/**T-008**/**T-009** (the 3 local checks) have no dependencies at all. **T-001** is the fastest single unblock (complexity 1, unblocks the registry registration T-002 which the regression test T-020 needs).
