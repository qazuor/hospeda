# SPEC-038: Addon Entitlements Architecture Fix

## Progress: 22/22 tasks (100%)

**Average Complexity:** 2.2/2.5 (max)
**Critical Path:** T-001 -> T-002a -> T-002b -> T-004 -> T-010a -> T-010b -> T-015 (7 steps)
**Parallel Tracks:** 5 identified (T-002a/T-003a/T-005a/T-008/T-009a can start concurrently after T-001)

---

### Setup Phase

- [x] **T-001** (complexity: 2) - Update all QZPay dependencies to latest versions
  - COMPLETED. core ^1.2.0, drizzle ^1.2.0, hono ^1.1.1

### Core Phase

- [x] **T-002a** (complexity: 2) - Clean applyAddonEntitlements(): signature + remove obsolete code
  - Change signature (add purchaseId), remove INSERT, remove billing.plans.update, remove @ts-expect-error
  - Blocked by: T-001 (done)
  - Blocks: T-002b

- [x] **T-002b** (complexity: 2.5) - Implement grant/set calls with canonical config
  - billing.entitlements.grant(), billing.limits.set() with ALL_PLANS lookup, handle unlimited (-1)
  - Blocked by: T-002a
  - Blocks: T-004, T-010a

- [x] **T-003a** (complexity: 2) - Clean removeAddonEntitlements(): signature + remove obsolete code
  - Add purchaseId, remove status UPDATE, remove billing.plans.update, remove @ts-expect-error
  - Blocked by: T-001 (done)
  - Blocks: T-003b

- [x] **T-003b** (complexity: 2.5) - Implement revokeBySource/removeBySource with fallbacks
  - revokeBySource + fallback to revoke, removeBySource + fallback to remove
  - Blocked by: T-003a
  - Blocks: T-006, T-007, T-010a

- [x] **T-004** (complexity: 2.5) - Update addon.checkout.ts purchaseId
  - .returning({ id }), handle unique constraint 23505, pass purchaseId
  - Blocked by: T-002b
  - Blocks: T-010a, T-013

- [x] **T-005a** (complexity: 2) - Middleware merge: getByCustomerId + union/override
  - Add getByCustomerId calls, union entitlements (Set), override limits (Map)
  - Blocked by: T-001 (done)
  - Blocks: T-005b

- [x] **T-005b** (complexity: 2) - Middleware graceful degradation + no-cache
  - try-catch, Sentry, shouldCache=false on error
  - Blocked by: T-005a
  - Blocks: T-011a

- [x] **T-006** (complexity: 2) - Fix cron job billing instance + purchaseId
  - Null guard, pass billing to AddonExpirationService, pass purchaseId in expireAddon
  - Blocked by: T-003b
  - Blocks: T-012

- [x] **T-007** (complexity: 2) - Cancel route purchaseId
  - Pass purchaseId from atomic ownership query to removeAddonEntitlements
  - Blocked by: T-003b
  - Blocks: T-010a

- [x] **T-008** (complexity: 2) - Unique partial index on billing_addon_purchases
  - Drizzle schema + db:generate. DEPLOY AFTER code changes
  - Blocked by: T-001 (done)
  - Blocks: T-015

### Migration Phase

- [x] **T-009a** (complexity: 2.5) - Migration: billing init + entitlement backfill
  - Init QZPay instance, backfill billing_customer_entitlements from active purchases
  - Blocked by: T-001 (done)
  - Blocks: T-009b

- [x] **T-009b** (complexity: 2.5) - Migration: limit backfill + plan restoration + fix gaps
  - Limit backfill with canonical config, restore plans, fix empty logging/summary
  - Blocked by: T-009a
  - Blocks: T-014a

### Testing Phase

- [x] **T-010a** (complexity: 2.5) - Tests for applyAddonEntitlements (new flow)
  - Update mocks (remove @ts-expect-error), test grant/set/canonical/unlimited
  - Blocked by: T-002b, T-003b, T-004, T-007
  - Blocks: T-010b

- [x] **T-010b** (complexity: 2) - Tests for removeAddonEntitlements (new flow)
  - Test revokeBySource/removeBySource, fallbacks, idempotent cancel
  - Blocked by: T-010a
  - Blocks: T-015

- [x] **T-011a** (complexity: 2) - Middleware tests: merge scenarios
  - Plan-only, plan+addon entitlement union, plan+addon limit override, mixed limits
  - Blocked by: T-005b
  - Blocks: T-011b

- [x] **T-011b** (complexity: 2) - Middleware tests: error fallback + no-cache
  - Error degradation, no-cache on degraded, retry success
  - Blocked by: T-011a
  - Blocks: T-015

- [x] **T-012** (complexity: 2.5) - Cron job and expiration service tests
  - Billing instance pass-through, null guard, purchaseId, existing tests pass
  - Blocked by: T-006
  - Blocks: T-015

- [x] **T-013** (complexity: 2.5) - Checkout test: purchaseId + constraint violation
  - .returning({ id }), unique constraint handling, purchaseId propagation
  - Blocked by: T-004
  - Blocks: T-015

- [x] **T-014a** (complexity: 2.5) - Migration tests: backfill + idempotency
  - Entitlement/limit backfill, unlimited, idempotency, orphaned repair
  - Blocked by: T-009b
  - Blocks: T-014b

- [x] **T-014b** (complexity: 2) - Migration tests: plan restoration + dry-run + errors
  - Plan restoration, dry-run mode, missing subscription, billing init failure
  - Blocked by: T-014a
  - Blocks: T-015

### Validation Phase

- [x] **T-015** (complexity: 2) - Final quality gate
  - typecheck + lint + full test suite + zero @ts-expect-error verification
  - Blocked by: T-008, T-010b, T-011b, T-012, T-013, T-014b
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001 (DONE)
Level 1: T-002a, T-003a, T-005a, T-008, T-009a
Level 2: T-002b, T-003b, T-005b, T-009b
Level 3: T-004, T-006, T-007, T-011a
Level 4: T-010a, T-012, T-013, T-011b
Level 5: T-010b, T-014a
Level 6: T-014b
Level 7: T-015
```

## Notes

- QZPay changes (Q1-Q10) are ALREADY IMPLEMENTED in qzpay v1.2.0
- H9 and H10 were ALREADY RESOLVED (verified 2026-03-09)
- DEPLOYMENT ORDER is critical: code changes BEFORE unique index (T-008)
- All tasks now have complexity <= 2.5
