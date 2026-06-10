# SPEC-209: Admin SSR memory leak + cheap healthcheck

## Progress: 0/13 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Critical Path:** T-004 -> T-006 -> T-009 -> T-010 -> T-011 -> T-012 -> T-013 (7 steps)
**Parallel Tracks:** 2 identified (Track A: healthcheck route; Track B: tests + investigation)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Verify TanStack Start server-route primitive for admin version
  - Investigate which mechanism the installed TanStack Start version provides for raw (non-SSR) HTTP handlers
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-004** (complexity: 2) - Define heap-snapshot procedure and RSS-band baseline
  - Produce the documented, executable staging procedure (heap snapshot trigger, RSS polling, acceptance band)
  - Blocked by: none
  - Blocks: T-006, T-012

### Core Phase

- [ ] **T-002** (complexity: 2) - Implement /healthz server route returning 200 without React SSR
  - Implement the cheap healthcheck endpoint that bypasses SSR and QZPayBilling entirely
  - Blocked by: T-001
  - Blocks: T-003, T-005

- [ ] **T-003** (complexity: 1) - Repoint Dockerfile HEALTHCHECK to /healthz
  - Add HEALTHCHECK instruction to Dockerfile runner stage; note Coolify UI operator step
  - Blocked by: T-002
  - Blocks: T-008 (docs)

- [ ] **T-009** (complexity: 3) - Implement client-only billing guard in __root.tsx
  - Move createQZPayBilling into useEffect + useRef; ensure no server-side construction
  - Blocked by: T-006, T-007, T-008
  - Blocks: T-010, T-011

### Testing Phase

- [ ] **T-005** (complexity: 2) - Write integration test for /healthz response contract
  - Test 200 status, body shape, Content-Type, no QZPayBilling construction on probe
  - Blocked by: T-002
  - Blocks: T-011

- [ ] **T-006** (complexity: 3) - Write regression test reproducing SSR billing construction bug
  - N-render loop asserting createQZPayBilling called at most once (fails before fix, passes after)
  - Blocked by: T-004
  - Blocks: T-009

- [ ] **T-007** (complexity: 2) - Write static-analysis guard test for admin root SSR-unsafe construction
  - Static scan of __root.tsx asserting createQZPayBilling only in client-guarded context
  - Blocked by: none
  - Blocks: T-009

- [ ] **T-008** (complexity: 2) - Write static-analysis guard test for web root SSR-unsafe construction
  - Pin test asserting web root/layouts have no createQZPayBilling / new QueryClient outside client context
  - Blocked by: T-007
  - Blocks: T-009

- [ ] **T-010** (complexity: 2) - Smoke-test admin billing pages after client-only billing fix
  - Manual smoke: billing pages load, QZPayProvider non-null client-side, no console errors
  - Blocked by: T-009
  - Blocks: T-011, T-012

- [ ] **T-011** (complexity: 2) - Write post-fix integration test asserting no billing initialization on SSR
  - Extend regression test: server renders produce 0 createQZPayBilling calls; client mount produces exactly 1
  - Blocked by: T-005, T-009, T-010
  - Blocks: T-012

- [ ] **T-012** (complexity: 3) - Execute staging heap-snapshot and RSS-band validation
  - Deploy to staging; execute 30-min RSS probe loop before/after fix; record results; optional heap snapshot
  - Blocked by: T-004, T-010, T-011
  - Blocks: T-013

### Docs Phase

- [ ] **T-013** (complexity: 1) - Update apps/admin/CLAUDE.md with healthcheck contract and memory-leak fix
  - Add Healthcheck and SSR Safety Rules sections; link to procedure document
  - Blocked by: T-012
  - Blocks: none

---

## Dependency Graph

```
Level 0 (no blockers):    T-001, T-004, T-007

Level 1:
  T-001 -> T-002
  T-004 -> T-006
  T-007 -> T-008

Level 2:
  T-002 -> T-003
  T-002 -> T-005
  T-006 -> T-009 (also needs T-007, T-008)
  T-008 -> T-009 (also needs T-006, T-007)

Level 3:
  T-003 (feeds docs T-013 indirectly)
  T-009 -> T-010

Level 4:
  T-005 -> T-011 (also needs T-009, T-010)
  T-010 -> T-011

Level 5:
  T-011 -> T-012 (also needs T-004, T-010)

Level 6:
  T-012 -> T-013
```

## Parallel Tracks

**Track A — Healthcheck implementation (unblocked start):**
T-001 -> T-002 -> T-003
              -> T-005

**Track B — Tests + investigation (unblocked start, parallel with Track A):**
T-004 -> T-006 -> T-009
T-007 -> T-008 -> T-009

**Merge point:** T-009 (depends on T-006 + T-007 + T-008)

**Final sequential chain:** T-009 -> T-010 -> T-011 -> T-012 -> T-013

## Critical Path

T-004 -> T-006 -> T-009 -> T-010 -> T-011 -> T-012 -> T-013 (7 steps, total complexity: 2+3+3+2+2+3+1 = 16)

Note: T-004 is a parallel-start task alongside T-001 and T-007. Start T-001, T-004, and T-007 simultaneously on day 1.

## Suggested Start

Begin with **T-001** (complexity: 2), **T-004** (complexity: 2), and **T-007** (complexity: 2) simultaneously — all have zero dependencies and collectively unblock the entire graph.

- T-001: unblocks T-002 (healthcheck implementation)
- T-004: unblocks T-006 (regression test) and T-012 (staging validation)
- T-007: unblocks T-008 (web guard test) which together unblock T-009 (the fix)

The critical-path bottleneck is T-009 (the leak fix, complexity 3) — it requires T-006, T-007, and T-008 to all be green before it can be implemented. This enforces the TDD gate: tests must be red-on-unfixed-code before the fix lands.
