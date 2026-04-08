# SPEC-043: Addon Lifecycle Events

## Progress: 0/26 tasks (0%)

**Average Complexity:** 3.1/4 (max)
**Critical Path:** T-001 -> T-005 -> T-007 -> T-014 -> T-025 (5 steps)
**Parallel Tracks:** 4 tracks identified

---

### Setup Phase

- [ ] **T-001** (complexity: 1) - Create addon-lifecycle constants file with ADDON_RECALC_SOURCE_ID
  - Constants file with sentinel UUID for aggregated limit recalculations
  - Blocked by: none
  - Blocks: T-005, T-006

- [ ] **T-002** (complexity: 2) - Create DB migration for subscription_id partial index
  - Index on billing_addon_purchases(subscription_id) WHERE status='active' AND deleted_at IS NULL
  - Blocked by: none
  - Blocks: T-007

- [ ] **T-003** (complexity: 3) - Add PLAN_DOWNGRADE_LIMIT_WARNING notification type, payload, i18n keys
  - NotificationType enum + PlanDowngradeLimitWarningPayload + i18n in es/en/pt
  - Blocked by: none
  - Blocks: T-004, T-011

- [ ] **T-004** (complexity: 3) - Create React Email template + wire into selectTemplate()
  - plan-downgrade-limit-warning.tsx template + selectTemplate() switch case
  - Blocked by: T-003
  - Blocks: T-011

### Core Phase

- [ ] **T-005** (complexity: 4) - Implement revokeAddonForSubscriptionCancellation()
  - Strict QZPay revocation per addon with fallbacks, fatal errors
  - Blocked by: T-001
  - Blocks: T-007, T-009, T-012, T-018

- [ ] **T-006** (complexity: 4) - Implement recalculateAddonLimitsForCustomer()
  - Shared aggregated limit recalculation function (Flow B + AC-3.9)
  - Blocked by: T-001
  - Blocks: T-010, T-013

- [ ] **T-007** (complexity: 4) - Implement webhook cancellation addon cleanup handler
  - Sequential processing, per-addon DB update, partial failure handling
  - Blocked by: T-005, T-002
  - Blocks: T-014, T-020

- [ ] **T-008** (complexity: 3) - Create admin subscription cancel route skeleton
  - Route validation, permission guard, subscription lookup, error responses
  - Blocked by: none
  - Blocks: T-009, T-017

- [ ] **T-009** (complexity: 4) - Implement admin cancel two-phase orchestration
  - Phase 1: parallel QZPay revocations. Phase 2: DB transaction + QZPay cancel
  - Blocked by: T-005, T-008
  - Blocks: T-017, T-021

- [ ] **T-010** (complexity: 4) - Implement Flow B addon limit recalculation core
  - Group by limitKey, compute newMaxValue, handle edge cases
  - Blocked by: T-006
  - Blocks: T-011, T-015, T-016, T-022

- [ ] **T-011** (complexity: 3) - Implement Flow B downgrade detection + notification
  - Detect downgrades, check usage, dispatch PLAN_DOWNGRADE_LIMIT_WARNING
  - Blocked by: T-010, T-003, T-004
  - Blocks: T-016, T-022

- [ ] **T-012** (complexity: 4) - Extend addon-expiry cron with revocation retry phase
  - Query orphaned active addons on cancelled subscriptions, retry with limit
  - Blocked by: T-005
  - Blocks: T-023

- [ ] **T-013** (complexity: 3) - Modify cancelUserAddon() for limit re-recalculation
  - Call recalculateAddonLimitsForCustomer() for limit-type addons (AC-3.9)
  - Blocked by: T-006
  - Blocks: T-024

### Integration Phase

- [ ] **T-014** (complexity: 3) - Integrate cancellation cleanup into webhook handler
  - Call handleSubscriptionCancellationAddons in subscription-logic.ts
  - Blocked by: T-007
  - Blocks: T-020, T-025

- [ ] **T-015** (complexity: 3) - Add planId comparison safety net to webhook handler
  - Compare planId, trigger recalculation on mismatch (AC-3.7)
  - Blocked by: T-010
  - Blocks: T-022

- [ ] **T-016** (complexity: 3) - Integrate Flow B into plan-change.ts route
  - Call recalculation after successful changePlan() (AC-3.8 primary trigger)
  - Blocked by: T-010, T-011
  - Blocks: T-022, T-026

- [ ] **T-017** (complexity: 1) - Mount admin subscription-cancel route
  - Import and mount in billing admin index.ts
  - Blocked by: T-009
  - Blocks: T-021, T-025

### Testing Phase

- [ ] **T-018** (complexity: 3) - Unit tests for revokeAddonForSubscriptionCancellation()
  - 7+ test cases: entitlement/limit/fallback/undefined/fatal error
  - Blocked by: T-005

- [ ] **T-019** (complexity: 3) - Unit tests for recalculateAddonLimitsForCustomer()
  - 7+ test cases: single/multiple/unlimited/missing/no remaining
  - Blocked by: T-006

- [ ] **T-020** (complexity: 4) - Unit tests for webhook cancellation handler
  - 9+ test cases covering AC-1.1 through AC-1.10
  - Blocked by: T-007, T-014

- [ ] **T-021** (complexity: 4) - Unit tests for admin cancel route
  - 9+ test cases covering AC-2.1 through AC-2.4
  - Blocked by: T-009, T-017

- [ ] **T-022** (complexity: 4) - Unit tests for Flow B recalculation + downgrade
  - 11+ test cases covering AC-3.1 through AC-4.4
  - Blocked by: T-010, T-011, T-015, T-016

- [ ] **T-023** (complexity: 3) - Unit tests for cron retry phase
  - 7+ test cases: orphaned detection, retry limit, metadata, Sentry
  - Blocked by: T-012

- [ ] **T-024** (complexity: 3) - Unit tests for cancelUserAddon() modification
  - 5+ test cases: limit recalc, entitlement unchanged, no remaining
  - Blocked by: T-013

- [ ] **T-025** (complexity: 4) - Integration tests for cancellation flow
  - 5+ test cases: webhook E2E, admin E2E, idempotency, cron recovery
  - Blocked by: T-014, T-017

- [ ] **T-026** (complexity: 4) - Integration tests for plan change flow
  - 6+ test cases: route triggers, upgrade/downgrade, webhook safety net
  - Blocked by: T-016

---

## Dependency Graph

```
Level 0: T-001, T-002, T-003, T-008
Level 1: T-004, T-005, T-006
Level 2: T-007, T-009, T-010, T-012, T-013, T-018, T-019
Level 3: T-011, T-014, T-015, T-017, T-023, T-024
Level 4: T-016, T-020, T-021, T-025
Level 5: T-022, T-026
```

## Parallel Tracks

- **Track A (Cancellation):** T-001 -> T-005 -> T-007 -> T-014 -> T-020/T-025
- **Track B (Recalculation):** T-001 -> T-006 -> T-010 -> T-011 -> T-016 -> T-022/T-026
- **Track C (Admin Route):** T-008 -> T-009 -> T-017 -> T-021
- **Track D (Setup):** T-002, T-003 -> T-004 (independent of tracks A/B)

## Suggested Start

Begin with **T-001** (complexity: 1) and **T-002** (complexity: 2) in parallel - they have no dependencies and unblock core service methods. Also start **T-003** and **T-008** concurrently.
