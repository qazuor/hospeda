# SPEC-261: Stabilize commerce-owner E2E and promote back to @p0

## Progress: 0/9 tasks (0%)

**Average Complexity:** 2.2/3 (max)
**Critical Path:** T-001 -> T-002 -> T-003 -> T-004 -> T-005 -> T-007 -> T-008 (7 steps)
**Parallel Tracks:** 2 (T-006 + T-009 branch off T-005)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Diagnose the apps/e2e web prod-build blocker (validateWebEnv)
  - Root-cause why the local apps/e2e stack fails: web prod build throws at validateWebEnv (PUBLIC_SENTRY_DSN/PUBLIC_POSTHOG_KEY).
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 3) - Unblock the local apps/e2e stack bring-up
  - Apply chosen fix (supply PUBLIC_* build env OR run web in dev mode for E2E); get the 3-server harness healthy.
  - Blocked by: T-001
  - Blocks: T-003

### Core Phase

- [ ] **T-003** (complexity: 2) - Run commerce-01 locally with a Playwright trace
  - Capture trace/DOM/network around the save → PATCH that never fires in headless CI.
  - Blocked by: T-002
  - Blocks: T-004

- [ ] **T-004** (complexity: 3) - Root-cause the editor dirty-tracking / no-PATCH issue
  - Why `dirty` stays empty under Playwright headless (hydration / island remount / controlled-input wrapper / client:load vs visible).
  - Blocked by: T-003
  - Blocks: T-005

- [ ] **T-005** (complexity: 3) - Apply the real fix to commerce-01
  - Make save reliably dirty the form + fire PATCH; ≥3 consecutive green local runs.
  - Blocked by: T-004
  - Blocks: T-006, T-007, T-009

- [ ] **T-006** (complexity: 2) - Re-validate commerce-02 (access control) under the fixed harness
  - Tourist + cross-owner blocked, reliably green ×3.
  - Blocked by: T-005
  - Blocks: T-007, T-009

### Integration Phase

- [ ] **T-007** (complexity: 1) - Promote commerce-01 & commerce-02 @p1 -> @p0
  - Swap tags, drop the SPEC-252 deprioritization note, confirm p0 selector matches both.
  - Blocked by: T-005, T-006
  - Blocks: T-008

- [ ] **T-008** (complexity: 2) - Confirm e2e-pr's e2e:test:p0 runs and passes both specs
  - Green in headless CI; satisfies AC-4.
  - Blocked by: T-007
  - Blocks: none

### Docs Phase

- [ ] **T-009** (complexity: 2) - Document the local E2E run procedure + dirty-tracking gotcha
  - Runbook: e2e:up + commerce trace run; root cause + fix for the controlled-input gotcha.
  - Blocked by: T-005, T-006
  - Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002
Level 2: T-003
Level 3: T-004
Level 4: T-005
Level 5: T-006
Level 6: T-007, T-009
Level 7: T-008

## Suggested Start

Begin with **T-001** (complexity: 2) - no dependencies, unblocks the whole chain. It is also already half-diagnosed: the wt-create build reproduced the exact `validateWebEnv` failure (PUBLIC_SENTRY_DSN + PUBLIC_POSTHOG_KEY required in production).
