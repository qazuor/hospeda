# SPEC-217: Deterministic Billing for E2E (QZPay test-control wiring + date-aware publish gate)

## Progress: 0/16 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Critical Path:** T-001 -> T-003 -> T-004 -> T-009 -> T-014 -> T-015 -> T-016 (7 steps)
**Parallel Tracks:** 3 (gate-fix / fault-injection / CI-flag), converging at T-014

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Document middleware 6h grace + decide shared is-sub-live predicate shape
  - Investigation only. Locate BILLING_CRON_LAG_GRACE_HOURS + middleware grace; decide shared predicate signature.
  - Blocked by: none
  - Blocks: T-003

- [ ] **T-002** (complexity: 3) - Map ControllableOperation enum to QZPay adapter methods
  - Investigation only. Build the op-name -> adapter-method map from qzpay-core for the wiring.
  - Blocked by: none
  - Blocks: T-006

### Core Phase

- [ ] **T-003** (complexity: 3) - Extract shared isSubscriptionLive(status, dates, grace) predicate
  - Single source of truth, reuses the 6h grace constant. Unit tests for status x date x grace.
  - Blocked by: T-001
  - Blocks: T-004, T-005

- [ ] **T-004** (complexity: 2) - Make checkEligibility date-aware via the shared predicate
  - Closes the prod gap (G4). Unit tests for expired-trial/active past+within grace.
  - Blocked by: T-003
  - Blocks: T-008, T-009

- [ ] **T-005** (complexity: 2) - Refactor entitlement middleware grace to the shared predicate
  - No behavior change; dedup. Regression test that active-sub grace is unchanged.
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-006** (complexity: 3) - Wire applyTestControl into the MercadoPago adapter
  - Wrap each ControllableOperation; no-op when disabled. Unit tests per op + no-op path.
  - Blocked by: T-002
  - Blocks: T-011, T-012, T-013

### Integration Phase

- [ ] **T-007** (complexity: 1) - Enable HOSPEDA_QZPAY_TEST_CONTROL_ENABLED in e2e-pr.yml
  - One-line env addition so Group B specs run in PR P0 (OQ-3).
  - Blocked by: none
  - Blocks: T-011, T-012, T-013

### Testing Phase

- [ ] **T-008** (complexity: 2) - Un-gate host-04 + host-07b, verify they pass vs the date-aware gate
  - They already set status='cancelled'; date-aware gate blocks. AC-1.2, AC-1.3.
  - Blocked by: T-004
  - Blocks: T-014

- [ ] **T-009** (complexity: 2) - Fix forceTrialExpired + un-gate host-03 (trial-expired blocks writes)
  - Keep status='trialing', backdate trial_end beyond grace; gate now blocks. AC-1.1.
  - Blocked by: T-004
  - Blocks: T-010, T-014

- [ ] **T-010** (complexity: 2) - Assert e2e helper terminal statuses match cron output
  - AC-1.4 guard: trial-expiry -> 'cancelled', finalize-cancelled-subs -> 'cancelled'.
  - Blocked by: T-009
  - Blocks: none

- [ ] **T-011** (complexity: 2) - Un-skip host-07c (startTrial timeout safety)
  - failNext(startTrial, TIMEOUT) -> 5xx + DRAFT + no sub row. AC-2.1.
  - Blocked by: T-006, T-007
  - Blocks: T-014

- [ ] **T-012** (complexity: 2) - Un-skip host-07d (tx compensation)
  - failNext(updateSubscription) -> cancelTrial compensation. AC-2.2.
  - Blocked by: T-006, T-007
  - Blocks: T-014

- [ ] **T-013** (complexity: 2) - Un-skip res-01 (api-down checkout retry)
  - First publish 5xx no sub, retry succeeds. AC-2.3.
  - Blocked by: T-006, T-007
  - Blocks: T-014

- [ ] **T-016** (complexity: 1) - Soak: 3 consecutive green PR P0 runs
  - Confirm zero flakiness on the 6 un-skipped specs; nightly fallback if Group B flakes.
  - Blocked by: T-015
  - Blocks: none

### Docs Phase

- [ ] **T-014** (complexity: 2) - Rewrite skip comments/messages to reflect the real mechanism
  - US-3: remove the wrong 'entitlement draft-defaults' model; state real preconditions.
  - Blocked by: T-008, T-009, T-011, T-012, T-013
  - Blocks: T-015

### Cleanup Phase

- [ ] **T-015** (complexity: 2) - Add a no-silent-skip regression guard
  - Fails CI if any of the 6 specs is fixme/skip again without a documented precondition.
  - Blocked by: T-014
  - Blocks: T-016

---

## Dependency Graph

Level 0: T-001, T-002, T-007
Level 1: T-003, T-006
Level 2: T-004, T-005, T-011, T-012, T-013
Level 3: T-008, T-009
Level 4: T-010, T-014
Level 5: T-015
Level 6: T-016

## Suggested Start

Begin with **T-001** (complexity: 2) and **T-002** (complexity: 3) in parallel — both have
no dependencies and open the two main tracks (gate fix via T-001->T-003->T-004; fault
injection via T-002->T-006). **T-007** (the one-line CI flag) can also be done at any time.

Land **Phase: core + Group A first** (T-001->T-004->T-008/T-009): it closes the production
gap and needs no env flag, the higher-value/lower-risk half.
