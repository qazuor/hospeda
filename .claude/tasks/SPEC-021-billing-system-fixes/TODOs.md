# SPEC-021: Billing System Fixes & Production Readiness

## Status: COMPLETED (2026-03-02)

38 atomic tasks across 6 phases. Average complexity: 2.8/4.
Covers 12 user stories (BILL-01 to BILL-12) from the production readiness audit.

---

## Phase 1: Critical Fixes - Webhook, Grace Period & Dunning (10 tasks)

- [x] **T-001** [C3] Implement webhook retry logic in retryWebhookEvent function
- [x] **T-002** [C3] Write unit tests for webhook retry logic
- [x] **T-003** [C4] Create past-due grace period middleware
- [x] **T-004** [C2] Register grace period middleware in protected billing routes
- [x] **T-005** [C3] Write unit tests for grace period middleware
- [x] **T-006** [C3] Fix trial extend to update actual trialEnd field on subscription
- [x] **T-007** [C3] Write unit tests for trial extend fix
- [x] **T-008** [C3] Create billing_dunning_attempts table migration
- [x] **T-009** [C4] Create dunning cron job with configurable retry schedule
- [x] **T-010** [C3] Write unit tests for dunning cron job

## Phase 2: Billing Route Security (6 tasks)

- [x] **T-011** [C4] Create billing ownership verification middleware
- [x] **T-012** [C2] Apply ownership middleware to billing customer routes
- [x] **T-013** [C2] Apply ownership middleware to subscription routes
- [x] **T-014** [C2] Apply ownership middleware to invoice and payment routes
- [x] **T-015** [C4] Write integration tests for billing ownership verification
- [x] **T-016** [C4] Migrate admin-only billing operations to /admin/billing/

## Phase 3: Trial & Subscription Improvements (8 tasks)

- [x] **T-017** [C4] Create POST /api/v1/billing/trial/reactivate endpoint
- [x] **T-018** [C3] Write tests for trial reactivation endpoint
- [x] **T-019** [C2] Trial auto-start for HOST only (scope changed, see docs/decisions/ADR-009-trial-host-only.md)
- [x] **T-020** [C3] Write tests for simplified trial auto-start
- [x] **T-021** [C3] Fix quarterly/semi_annual interval mapping in plan-change.ts
- [x] **T-022** [C2] Write tests for interval mapping fixes
- [x] **T-023** [C3] Properties limit enforcement (deferred, see docs/decisions/ADR-013-deferred-limit-enforcement.md)
- [x] **T-024** [C3] Staff accounts limit enforcement (deferred, see docs/decisions/ADR-013-deferred-limit-enforcement.md)

## Phase 4: Notifications & Redis (6 tasks)

- [x] **T-025** [C3] Initialize Redis client using HOSPEDA_REDIS_URL env var
- [x] **T-026** [C2] Wire Redis client into notification retry service
- [x] **T-027** [C2] Fetch actual plan price for renewal reminder notifications
- [x] **T-028** [C2] Write tests for renewal reminder with real prices
- [x] **T-029** [C3] Persist notification idempotency keys in Redis/DB instead of memory
- [x] **T-030** [C2] Write tests for idempotency key persistence

> **Note:** BILL-15 (IVA handling) deferred to SPEC-028-iva-tax-handling

## Phase 5: AFIP Decision Gate (3 tasks)

- [x] **T-031** [C2] Research AFIP requirements (see .claude/specs/SPEC-028-iva-tax-handling/afip-research.md)
- [x] **T-032** [C2] Create AFIP decision document (see docs/decisions/ADR-008-afip-deferred-v2.md)
- [x] **T-033** [C2] Define v1 launch strategy (see docs/billing/v1-launch-strategy.md)

## Phase 6: Testing & Verification (5 tasks)

- [x] **T-034** [C4] Write integration test for complete trial lifecycle
- [x] **T-035** [C3] Write integration test for webhook retry -> subscription update flow
- [x] **T-036** [C3] Write integration test for grace period -> block flow
- [x] **T-037** [C2] Run full billing test suite and verify coverage >80%
- [x] **T-038** [C3] Manual QA checklist documented (see docs/testing/billing-qa-checklist.md)

---

## Decision Documentation

| Decision | Document | Summary |
|----------|----------|---------|
| Trial HOST-only | `docs/decisions/ADR-009-trial-host-only.md` | No COMPLEX role exists. All owners are HOST. |
| Deferred limits | `docs/decisions/ADR-013-deferred-limit-enforcement.md` | Properties/staff stubs are intentional. Implementation plan included. |
| AFIP deferred to v2 | `docs/decisions/ADR-008-afip-deferred-v2.md` | Manual invoicing for v1. Hard deadline: 100 subs or Q4 2026. |
| v1 launch strategy | `docs/billing/v1-launch-strategy.md` | Trial flow, MercadoPago, feature matrix. |
| Manual QA | `docs/testing/billing-qa-checklist.md` | 10 test scenarios with step-by-step instructions. |

---

## Key Files Referenced

| File | Tasks | Description |
|------|-------|-------------|
| `apps/api/src/cron/jobs/webhook-retry.job.ts` | T-001, T-002 | Webhook retry cron (546 lines) |
| `apps/api/src/middlewares/past-due-grace.middleware.ts` | T-003, T-004, T-005 | Grace period middleware |
| `packages/billing/src/constants/billing.constants.ts` | T-003, T-009 | PAYMENT_GRACE_PERIOD_DAYS=3 |
| `apps/api/src/services/trial.service.ts` | T-006, T-007, T-017 | Trial extend + reactivate |
| `packages/db/src/schemas/billing/billing_dunning_attempt.dbschema.ts` | T-008 | Dunning attempts table |
| `packages/db/src/migrations/0015_bent_nekra.sql` | T-008 | Migration file |
| `apps/api/src/cron/jobs/dunning.job.ts` | T-009, T-010 | Dunning cron job (344 lines) |
| `apps/api/src/middlewares/billing-ownership.middleware.ts` | T-011..T-015 | Ownership verification |
| `apps/api/src/middlewares/billing-admin-guard.middleware.ts` | T-016 | Admin access control |
| `apps/api/src/routes/billing/index.ts` | T-004, T-012..T-016 | Billing route registration |
| `apps/api/src/routes/billing/trial.ts` | T-017 | Trial routes (reactivate) |
| `apps/api/src/lib/auth.ts` | T-019, T-020 | User create hook (HOST trial) |
| `apps/api/src/routes/billing/plan-change.ts` | T-021, T-022 | Interval mapping |
| `apps/api/src/middlewares/limit-enforcement.ts` | T-023, T-024 | Limit enforcement (stubs for properties/staff) |
| `apps/api/src/utils/redis.ts` | T-025, T-026, T-029 | Redis client singleton |
| `apps/api/src/cron/jobs/notification-schedule.job.ts` | T-026, T-027, T-029 | Notifications with real pricing + Redis |
