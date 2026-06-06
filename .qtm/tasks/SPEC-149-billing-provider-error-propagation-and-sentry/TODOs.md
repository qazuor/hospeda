# SPEC-149: Billing provider error propagation + Sentry context + retry policy

## Progress: 0/15 tasks (0%)

**Average Complexity:** 2.3/10
**Critical Path:** T-001 -> T-002 -> T-004/005/006 -> T-010 -> T-012 -> T-013 -> T-014 -> T-015
**Parallel-eligible (sequential agents):** T-003, T-007→T-008, T-009 interleave with the helper chain

---

### Setup Phase

- [ ] **T-001** (2) - Provider ServiceErrorCodes in @repo/schemas — blocks T-002
- [ ] **T-002** (3) - billing-provider-error helper (detect/map/Retry-After) — blocked by T-001
- [ ] **T-003** (2) - Explicit throw strategy + extended BillingContext

### Core Phase

- [ ] **T-004** (3) - Wire mapping+Sentry: start-paid monthly/annual — blocked by T-002, T-003
- [ ] **T-005** (3) - Wire mapping+Sentry: addon purchase — blocked by T-002, T-003
- [ ] **T-006** (2) - Wire mapping+Sentry: plan-change — blocked by T-002, T-003
- [ ] **T-007** (3) - Webhook handlers mark failed on transient errors (absorbed orphan fix)
- [ ] **T-008** (3) - Dead-letter retry covers the 2 missing event types — blocked by T-007
- [ ] **T-009** (2) - Sentry on cron success:false results

### Testing Phase

- [ ] **T-010** (2) - Update e2e error-mapping expectations (AC 8-10) — blocked by T-004/005/006
- [ ] **T-011** (2) - No-server-retry pinning + Retry-After e2e — blocked by T-002
- [ ] **T-012** (2) - Mock sweep (schemas enum growth! re-run "green" files) — blocked by all code
- [ ] **T-013** (2) - Quality gate + adversarial review — blocked by T-012

### Docs Phase

- [ ] **T-014** (1) - Smoke registration + Sentry alert coordination note — blocked by T-013
- [ ] **T-015** (2) - PR + CI + merge + closeout — blocked by T-014

---

## Suggested Start

**T-001** (ServiceErrorCodes) — foundation of the helper chain. T-007 (webhook fix) and T-009 (cron alerting) have no deps and interleave.
