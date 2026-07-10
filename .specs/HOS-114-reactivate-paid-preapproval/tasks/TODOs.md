# HOS-114: Route paid reactivation through the card-collecting checkout

## Progress: 14/16 tasks (88%) — all code + tests done; only staging/prod ops remain

Added from code review (owner: full robustness):

- [x] **T-015** - Harden webhook supersession cancel (provider retrieve for lapsed flow, terminal allow-list) + map business errors to 409/404.
- [x] **T-016** - Reconcile backstop cron (hourly) for orphaned superseded subs; shared completeSupersessionPairing fn; covers lapsed flow via provider re-verify.

958 API tests green. Two review rounds; 3 blockers total fixed (webhook cancel-masking, cron lapsed-flow gap, deny-list misclassification).

**Deferred follow-up:** partial unique index on (subscription_id, metadata->>'supersededSubscriptionId') for atomic one-audit-per-pairing (TODO in code, no money impact).

**Follow-up flagged (out of scope):** initiateCommerceMonthlySubscription (SPEC-239) +
initiatePartnerMonthlySubscription (SPEC-271) still inline the mode:'paid' create block
instead of using createPaidSubscription — pre-existing, candidate for a cleanup spec.

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-001 -> T-002 -> T-005 -> T-007 -> T-011 -> T-014 (6 steps)
**Parallel Tracks:** 3 identified

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Document current reactivate wiring, web callers, and webhook activation handler
  - DONE → see docs/notes.md. Corrected 3 spec claims: webhook is subscription-logic.ts/subscription_preapproval (not routes/billing/authorized_payment); response schemas are local inline in trial.ts (not @repo/schemas); /reactivate has no web wrapper, live caller is E2E host-02.
  - Blocked by: none
  - Blocks: T-002, T-004, T-007

### Core Phase

- [x] **T-002** (complexity: 3) - Extract shared low-level paid-subscription-create helper
  - DONE: createPaidSubscription helper + error moved to neutral module. 185 tests green.
  - Blocked by: T-001
  - Blocks: T-003, T-005, T-006

- [x] **T-003** (complexity: 2) - Refactor initiatePaidMonthlySubscription to consume the shared helper
  - DONE: pure extraction, /start-paid green (R-5 verified).
  - Blocked by: T-002
  - Blocks: T-012

- [x] **T-004** (complexity: 3) - Add plan-resolution + validation guard for reactivation
  - DONE: resolveReactivationPlan (planId=UUID confirmed). 53 tests green. Free = unitAmount===0.
  - Blocked by: T-001
  - Blocks: T-005, T-006

- [x] **T-005** (complexity: 3) - Rewrite reactivateFromTrial to route through paid checkout
  - DONE: guard + helper + checkoutUrl + incomplete + supersedesSubscriptionId; sync cancel/audit/clearCache deferred to T-007.
  - Blocked by: T-002, T-004
  - Blocks: T-007, T-008, T-010

- [x] **T-006** (complexity: 3) - Rewrite reactivateSubscription to route through paid checkout
  - DONE: same pattern, unique guards preserved.
  - Blocked by: T-002, T-004
  - Blocks: T-007, T-008, T-010

### Integration Phase

- [x] **T-007** (complexity: 3) - Handle old-subscription supersession on webhook confirmation
  - DONE: gated PENDING_PROVIDER->ACTIVE; idempotent via audit-row existence (not sub status). 147 tests green. Closes double-sub window.
  - Blocked by: T-001, T-005, T-006
  - Blocks: T-011, T-013

- [x] **T-008** (complexity: 2) - Update response schema + route handlers to return checkoutUrl
  - DONE: schemas moved to @repo/schemas (owner-decided), routes wired, error codes mapped. 15/15 schema tests.
  - Blocked by: T-005, T-006
  - Blocks: T-009

- [x] **T-009** (complexity: 2) - Update E2E contract test + dead wrapper type
  - DONE: host-02 spec updated to {checkoutUrl,status:'incomplete'} shape; endpoints-protected wrapper type refreshed.
  - Blocked by: T-008
  - Blocks: none

### Testing Phase

- [x] **T-010** (complexity: 3) - Regression test: reactivate no longer creates phantom-active subs
  - DONE: reactivateFromTrial already covered; added full reactivateSubscription (HOS-114) describe block (had zero direct unit coverage).
  - Blocked by: T-005, T-006
  - Blocks: none

- [x] **T-011** (complexity: 3) - Webhook supersession ordering tests (abandon + confirm)
  - DONE: abandon+confirm+idempotency via T-007 webhook tests + T-010 service assertions.
  - Blocked by: T-007
  - Blocks: T-014

- [x] **T-012** (complexity: 2) - Guard /start-paid regression after helper extraction
  - DONE: 236 tests green; AC-7 holds in scope (2 pre-existing duplicates flagged as follow-up).
  - Blocked by: T-003
  - Blocks: none

### Cleanup Phase

- [ ] **T-013** (complexity: 1) - Run phantom-sub detection query on staging + prod
  - AC-8/OQ-4: expected zero -> record no-op in closeout.md; rows -> owner-signed remediation
  - Blocked by: T-007
  - Blocks: T-014

- [ ] **T-014** (complexity: 2) - Apply smoke-gate labels and run MP sandbox staging smoke
  - §13: staging smoke (trial + lapsed) + sign-off; prod smoke before promotion; keep labels until Done
  - Blocked by: T-011, T-013
  - Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002, T-004
Level 2: T-003, T-005, T-006
Level 3: T-007, T-008, T-010, T-012
Level 4: T-009, T-011, T-013
Level 5: T-014

## Suggested Start

Begin with **T-001** (complexity: 2) - no dependencies, and it de-risks the two
riskiest later tasks (T-007 webhook path, T-005/T-006 route wiring) by pinning
the exact file anchors and confirming the endpoints are unwired.
