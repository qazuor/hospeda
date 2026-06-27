# SPEC-244: Test suite order-independence hardening

## Progress: 0/15 tasks (0%)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-001 → T-002 → T-004 → T-012 → T-013 → T-014 (6 steps)
**Parallel Tracks:** api fix (Phase 1) → admin ‖ web ‖ packages audits (Phases 2-4) → CI guard (Phase 5)

> Follow-up discovered during SPEC-222. The originally-reported test
> `accommodation-import.integration.test.ts` is NOT flaky (9/9 orders green) and
> needs NO change. This spec is test-infra hardening only — no product/source
> code, no assertion rewrites.

---

### Phase 1 — api audit + fix

- [ ] **T-001** (complexity: 2) - Audit apps/api/test/setup.ts global mocks for cross-file leakage
  - Blocked by: none
  - Blocks: T-002, T-003
- [ ] **T-002** (complexity: 3) - Move leaking api global mocks to opt-in per-file helpers
  - Blocked by: T-001
  - Blocks: T-004
- [ ] **T-003** (complexity: 3) - Wire opt-in mocks into files that relied on the ambient mock
  - Blocked by: T-001
  - Blocks: T-004
- [ ] **T-004** (complexity: 2) - Verify api suite order-independence across multiple shuffle seeds
  - Blocked by: T-002, T-003
  - Blocks: T-005, T-007, T-009, T-011, T-013

### Phase 2 — admin

- [ ] **T-005** (complexity: 2) - Audit apps/admin test suite under shuffle
  - Blocked by: T-004
  - Blocks: T-006
- [ ] **T-006** (complexity: 2) - Remediate admin leakage + verify multi-seed green
  - Blocked by: T-005
  - Blocks: T-015

### Phase 3 — web

- [ ] **T-007** (complexity: 2) - Audit apps/web test suite under shuffle (confirm Q5 applicability)
  - Blocked by: T-004
  - Blocks: T-008
- [ ] **T-008** (complexity: 2) - Remediate web leakage + verify multi-seed green
  - Blocked by: T-007
  - Blocks: T-015

### Phase 4 — packages

- [ ] **T-009** (complexity: 3) - Enumerate packages/* test suites + audit each under shuffle
  - Blocked by: T-004
  - Blocks: T-010
- [ ] **T-010** (complexity: 3) - Remediate packages/* leakage + verify multi-seed green
  - Blocked by: T-009
  - Blocks: T-015
- [ ] **T-011** (complexity: 1) - Document the remediation pattern + diagnosis reproduction
  - Blocked by: T-004
  - Blocks: T-014

### Phase 5 — CI shuffle guard

- [ ] **T-012** (complexity: 2) - Decide CI guard seed + scope strategy (Q3, Q4)
  - Blocked by: T-006, T-008, T-010
  - Blocks: T-013
- [ ] **T-013** (complexity: 3) - Implement CI shuffle guard job
  - Blocked by: T-004, T-012
  - Blocks: T-014
- [ ] **T-014** (complexity: 2) - Validate guard catches a re-introduced order-dependency
  - Blocked by: T-013, T-011
  - Blocks: none
- [ ] **T-015** (complexity: 2) - Full-monorepo shuffle regression sweep
  - Blocked by: T-006, T-008, T-010
  - Blocks: none

---

## Dependency Graph (levels)

- Level 0: T-001
- Level 1: T-002, T-003
- Level 2: T-004
- Level 3: T-005, T-007, T-009, T-011
- Level 4: T-006, T-008, T-010
- Level 5: T-012, T-015
- Level 6: T-013
- Level 7: T-014

## Suggested Start

Begin with **T-001** (complexity: 2) — audit `apps/api/test/setup.ts` to confirm
the full list of leaking module-scoped mocks (the confirmed offender is the
`PlanService` mock in the `vi.mock('@repo/service-core')` block). It unblocks the
whole api fix chain (T-002/T-003 → T-004), which in turn gates the per-suite
audits and the CI guard.

## Reproduction (diagnosis evidence)

```
# from apps/api
npx vitest run --sequence.shuffle --sequence.seed=<N>
```

Reliably fails 6–16 tests per order. Top offenders by frequency across 10 orders:
`addon-plan-change.service.test.ts` (32), `guest-reply.test.ts` (13),
`guest-thread.test.ts` (12), `subscription-plan.cutover.test.ts` (11). Root
cause: module-scoped global mocks in `apps/api/test/setup.ts` leak across files
under `pool: 'forks'` / `maxForks: 3` fork distribution.

## Sequencing rationale

api first (highest evidence + largest blast radius via shared `setup.ts`), then
admin/web/packages audits in parallel once the api remediation pattern is proven,
then the CI guard **last** (T-013) so it never blocks in-flight remediation.
