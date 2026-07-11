# HOS-123: Annual (one-time) reactivation support

## Progress: 0/23 tasks (0%)

**Average Complexity:** 2.1/3 (max)
**Critical Path:** T-012 -> T-013 -> T-014 -> T-022 -> T-023 (5 steps)
**Parallel Tracks:** 5 tracks identified (see below)

All 5 open questions (OQ-1..OQ-5) are already RESOLVED (spec §6, T-01 sign-off 2026-07-10). No open-question-resolution task is included — this list starts at implementation.

---

### Core Phase

- [ ] **T-001** (complexity: 3) - Extract createAnnualSubscription low-level helper
  - New file `apps/api/src/services/billing/create-annual-subscription.ts`, mirrors `paid-subscription-create.ts`
  - Blocked by: none
  - Blocks: T-002, T-008, T-009

- [ ] **T-002** (complexity: 2) - Refactor initiatePaidAnnualSubscription to consume createAnnualSubscription
  - No behavior change; keeps comp/trial/discount branches in place
  - Blocked by: T-001
  - Blocks: T-016

- [ ] **T-003** (complexity: 3) - Extend resolveReactivationPlan to resolve the annual interval
  - Adds `billingInterval` param + `NO_ANNUAL_PRICE` error path; monthly stays byte-for-byte unchanged
  - Blocked by: none
  - Blocks: T-008, T-009, T-021

- [ ] **T-004** (complexity: 2) - Add billingInterval + discriminated urls union to trial.types.ts
  - Widens `ReactivationCheckoutUrls`, `ReactivateFromTrialResult`, `ReactivateSubscriptionResult`
  - Blocked by: none
  - Blocks: T-006, T-007, T-008, T-009

- [ ] **T-005** (complexity: 1) - Move annual return-URL builders into shared checkout-return-urls.ts
  - `buildAnnualSuccessUrl`/`buildAnnualCancelUrl` currently private in start-paid.ts
  - Blocked by: none
  - Blocks: T-010, T-011

- [ ] **T-006** (complexity: 1) - Add billingInterval to reactivate request Zod schemas
  - Additive optional field, default 'monthly'
  - Blocked by: T-004
  - Blocks: T-010, T-011

- [ ] **T-007** (complexity: 2) - Widen reactivate response Zod schemas for the annual result shape
  - `status` enum widened to include `'pending_provider'`
  - Blocked by: T-004
  - Blocks: T-010, T-011

### Integration Phase

- [ ] **T-008** (complexity: 3) - Branch annual in TrialService.reactivateFromTrial
  - Blocked by: T-001, T-003, T-004
  - Blocks: T-010, T-016, T-021, T-022

- [ ] **T-009** (complexity: 3) - Branch annual in TrialService.reactivateSubscription
  - Blocked by: T-001, T-003, T-004
  - Blocks: T-011, T-016, T-021, T-022

- [ ] **T-010** (complexity: 2) - Wire billingInterval + URL resolution into reactivateTrialRoute
  - Blocked by: T-005, T-006, T-007, T-008
  - Blocks: T-015, T-018, T-020

- [ ] **T-011** (complexity: 2) - Wire billingInterval + URL resolution into reactivateSubscriptionRoute
  - Blocked by: T-005, T-006, T-007, T-009
  - Blocks: T-015, T-019, T-020

- [ ] **T-012** (complexity: 2) - Export completeReactivationSupersession as a shared trigger
  - Blocked by: none
  - Blocks: T-013

- [ ] **T-013** (complexity: 2) - Call supersession trigger from confirmAnnualSubscription on payment.updated
  - OQ-4: the big one — annual confirms on a different webhook than monthly supersession
  - Blocked by: T-012
  - Blocks: T-014, T-017, T-018, T-019, T-022

- [ ] **T-014** (complexity: 2) - Verify + harden reactivation-supersession-reconcile cron for annual subs
  - Audit found the candidate query is already interval-agnostic (no mpSubscriptionId filter)
  - Blocked by: T-013
  - Blocks: T-017, T-022

- [ ] **T-015** (complexity: 1) - Update web reactivateSubscription() caller for billingInterval
  - Currently dead code (no live callers) per its own JSDoc — low risk
  - Blocked by: T-010, T-011
  - Blocks: none

### Testing Phase

- [ ] **T-016** (complexity: 2) - Regression: monthly reactivation byte-for-byte unchanged
  - Blocked by: T-002, T-008, T-009
  - Blocks: T-023

- [ ] **T-017** (complexity: 2) - Idempotency: preapproval-path vs payment-path never double-cancel
  - OQ-5: reuses extras/029 partial unique index
  - Blocked by: T-013, T-014
  - Blocks: T-023

- [ ] **T-018** (complexity: 3) - E2E flow: annual reactivation from trial
  - Blocked by: T-010, T-013
  - Blocks: T-023

- [ ] **T-019** (complexity: 3) - E2E flow: annual reactivation from canceled subscription
  - Blocked by: T-011, T-013
  - Blocks: T-023

- [ ] **T-020** (complexity: 2) - Abandoned annual reactivation checkout reaped by cron
  - Blocked by: T-010, T-011
  - Blocks: T-023

- [ ] **T-021** (complexity: 2) - Integration regression: free/unknown plan rejection unchanged for annual
  - Blocked by: T-003, T-008, T-009
  - Blocks: T-023

- [ ] **T-023** (complexity: 2) - Manual MP-sandbox smoke: annual reactivation, both origins
  - Billing CORE — requires BOTH `status-needs-smoke-staging` AND `status-needs-smoke-prod` labels on HOS-123; do not close the issue while either is present
  - Blocked by: T-016, T-017, T-018, T-019, T-020, T-021, T-022
  - Blocks: none

### Docs Phase

- [ ] **T-022** (complexity: 1) - Update JSDoc references marking HOS-123 resolved
  - Sweep "deferred to HOS-123" comments in reactivation-plan-guard.ts, trial.service.ts, subscription-logic.ts
  - Blocked by: T-008, T-009, T-013, T-014
  - Blocks: T-023

---

## Dependency Graph (levels)

Level 0: T-001, T-003, T-004, T-005, T-012
Level 1: T-002, T-006, T-007, T-013
Level 2: T-008, T-009, T-014
Level 3: T-010, T-011
Level 4: T-015, T-016, T-017, T-018, T-019, T-020, T-021
Level 5: T-022
Level 6: T-023

## Parallel Tracks

- **Track A (annual-create refactor):** T-001 -> T-002
- **Track B (reactivation guard):** T-003
- **Track C (types + schemas):** T-004 -> {T-006, T-007}
- **Track D (shared URL builders):** T-005
- **Track E (webhook supersession wiring):** T-012 -> T-013 -> T-014

Tracks A+B+C converge at T-008/T-009 (service branch methods); +D converges at T-010/T-011 (routes). Testing phase (T-016..T-021) fans out widely across all prior tracks, converging with Track E + docs (T-022) at the final smoke gate (T-023).

## Suggested Start

Begin with **T-001**, **T-003**, **T-004**, **T-005**, and **T-012** in parallel (complexity: 3/3/2/1/2, no dependencies). T-001 has the widest downstream fan-out (unblocks T-002, T-008, T-009) and sits on the critical path's convergence point — start there first if working sequentially.
