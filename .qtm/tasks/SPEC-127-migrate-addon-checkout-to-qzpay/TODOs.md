# SPEC-127: Migrate addon.checkout.ts to qzpay path (Phase E)

## Progress: 0/15 tasks (0%)

**Average Complexity:** 2.1/10
**Critical Path:** T-001 -> T-002 -> T-003 -> T-005 -> T-006 -> T-010 -> T-011 -> T-012 -> T-013 -> T-014 -> T-015 (11 steps)
**Parallel Tracks:** 2 (T-004 parity test; T-007/T-009/T-010 fan-out after T-006)

---

### Core Phase

- [ ] **T-001** (complexity: 2) - Write failing regression tests for the dual-resolve planId bug (both sites)
  - Reproduce UUID-planId silent failures at the category gate (233) and limit baseline (505)
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 3) - Implement dual-resolve via PlanService at both ALL_PLANS sites
  - resolvePlanByIdOrSlug pattern (addon-plan-change.service.ts:66); update line-538 test
  - Blocked by: T-001
  - Blocks: T-003, T-005

- [ ] **T-003** (complexity: 3) - Cut over catalog reads to AddonCatalogService.getBySlug
  - Absorbed SPEC-192 deferred cutover at both entry points (~177, ~469)
  - Blocked by: T-002
  - Blocks: T-004, T-005

- [ ] **T-004** (complexity: 2) - Add catalog-cutover parity regression test
  - Pattern: qzpay-admin-hooks.cutover.test.ts
  - Blocked by: T-003
  - Blocks: none

- [ ] **T-005** (complexity: 1) - Drop @repo/billing catalog imports from addon.checkout.ts
  - Remove ALL_PLANS + getAddonBySlug import; grep + typecheck
  - Blocked by: T-002, T-003
  - Blocks: T-006

- [ ] **T-006** (complexity: 3) - Migrate createAddonCheckout to billing.checkout.create()
  - Target shape per spec (unitAmount in centavos, title, order_id metadata, providerInitPoint)
  - Blocked by: T-005
  - Blocks: T-007, T-008, T-009, T-010

- [ ] **T-007** (complexity: 3) - Migrate addon.checkout.test.ts mocks to billing.checkout.create
  - Remove vi.mock('mercadopago'); re-target all 32 assertions
  - Blocked by: T-006
  - Blocks: T-008, T-012

- [ ] **T-010** (complexity: 3) - Schedule one_time_payment polling job from addon checkout
  - Mirror annual flow; subscriptionId = active sub; addon metadata
  - Blocked by: T-006
  - Blocks: T-011

- [ ] **T-011** (complexity: 3) - Dispatch addon confirmations in runOneTimePaymentPoll
  - Metadata-driven branch; reuse idempotent webhook confirmation path
  - Blocked by: T-010
  - Blocks: T-012

### Integration Phase

- [ ] **T-008** (complexity: 1) - Remove mercadopago from apps/api dependencies
  - Grep-verify last importer; package.json + lockfile
  - Blocked by: T-006, T-007
  - Blocks: none

- [ ] **T-009** (complexity: 2) - Update extractAddonFromReference fallback for new external_reference semantics
  - Legacy refs still warn; surface metadata.order_id
  - Blocked by: T-006
  - Blocks: T-012

### Testing Phase

- [ ] **T-012** (complexity: 2) - Post-cutover mock sweep across the repo
  - Grep all vi.mock of touched modules; fix stale enumerated factories
  - Blocked by: T-007, T-009, T-011
  - Blocks: T-013

- [ ] **T-013** (complexity: 1) - Quality gate: typecheck + lint + targeted test runs
  - Per-package typecheck; sequential targeted vitest (owner constraint)
  - Blocked by: T-012
  - Blocks: T-014

### Docs Phase

- [ ] **T-014** (complexity: 1) - Register deferred smoke sections + cutover sign-off docs
  - SPEC-193 pending-smoke list + deferred-checkout-cutover.md sign-off
  - Blocked by: T-013
  - Blocks: T-015

- [ ] **T-015** (complexity: 1) - Open PR to staging and merge on green CI
  - Orphan-commit guard; behavior notes in PR; merge only on green statusCheckRollup
  - Blocked by: T-014
  - Blocks: none

---

## Dependency Graph

Level 0: T-001
Level 1: T-002
Level 2: T-003
Level 3: T-004, T-005
Level 4: T-006
Level 5: T-007, T-009, T-010
Level 6: T-008, T-011
Level 7: T-012
Level 8: T-013
Level 9: T-014
Level 10: T-015

## Suggested Start

Begin with **T-001** (complexity: 2) - failing regression tests for the live dual-resolve bug; no dependencies, unblocks the whole chain.
