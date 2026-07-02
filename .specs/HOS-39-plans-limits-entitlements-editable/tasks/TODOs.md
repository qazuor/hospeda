# HOS-39: Plans, Limits & Entitlements Editable Without Deploy

## Progress: 0/23 tasks (0%)

**Average Complexity:** 2.4/3 (max)
**Critical Path:** T-001 -> T-002 -> T-003 -> T-004 -> T-005 -> T-006 -> T-007 -> T-015 -> T-017 -> T-021 -> T-022 (11 steps)
**Parallel Tracks:** 3 identified (main attributes+migration chain, limits chain, addon-entitlement DB-lookup fix)

> Scope note: entitlement toggling, `sortOrder` editing, and trial-config editing are OUT OF SCOPE
> (see spec Q0/Q3) — they stay config-only per the existing Model C policy (SPEC-211). This task
> list only covers the `'commercial'`-layer fields: description, active, displayName,
> monthlyPriceArs, annualPriceArs, and limit VALUES.

---

### Setup Phase

- [ ] **T-001** (complexity: 3) - Add typed plan-attribute columns to qzpay-drizzle schema
  - Cross-repo change in the sibling qzpay repo; publish new qzpay-drizzle version
  - Blocked by: none
  - Blocks: T-002

- [ ] **T-002** (complexity: 1) - Bump qzpay-drizzle pin and install in Hospeda
  - Update packages/db/package.json pin, pnpm install, verify typecheck
  - Blocked by: T-001
  - Blocks: T-003

### Core Phase

- [ ] **T-003** (complexity: 3) - Write migration promoting metadata fields to typed columns
  - display_name/monthly_price_ars/annual_price_ars + backfill from metadata
  - Blocked by: T-002
  - Blocks: T-004

- [ ] **T-004** (complexity: 2) - Repoint MODEL_C_FIELD_SPLIT at new typed columns
  - Rename metadata.* keys to column names, keep 'commercial' classification
  - Blocked by: T-003
  - Blocks: T-005

- [ ] **T-005** (complexity: 3) - Update seed sync to read/write typed plan-attribute columns
  - detectDivergences/ensurePlan updated for the 3 fields
  - Blocked by: T-004
  - Blocks: T-006

- [ ] **T-006** (complexity: 3) - Add DB-backed plan-attribute read methods to PlanService
  - Shared read layer for T-007/T-010/T-011
  - Blocked by: T-005
  - Blocks: T-007, T-010, T-011

- [ ] **T-007** (complexity: 3) - Implement admin edit-plan-attributes mutation with atomic price write
  - Atomic billing_plans + billing_prices transaction (Q4=A)
  - Blocked by: T-006
  - Blocks: T-015

- [ ] **T-008** (complexity: 3) - Implement admin edit-plan-limit-values mutation
  - Independent of the migration chain (limits already a DB column)
  - Blocked by: none
  - Blocks: T-016

- [ ] **T-009** (complexity: 2) - Switch addon-entitlement limit-value lookup to DB
  - Independent of the migration chain
  - Blocked by: none
  - Blocks: T-020

- [ ] **T-010** (complexity: 2) - Admin plans list endpoint reads from DB
  - Resolves deferred bug #8 from SPEC-143 smoke (PR #1215)
  - Blocked by: T-006
  - Blocks: T-012, T-019

- [ ] **T-011** (complexity: 2) - Public listPlans endpoint reads from DB
  - Blocked by: T-006
  - Blocks: T-013, T-014, T-019

### Integration Phase

- [ ] **T-012** (complexity: 2) - Drop ALL_PLANS fallback in admin plans table
  - Blocked by: T-010
  - Blocks: T-023

- [ ] **T-013** (complexity: 3) - Convert owner pricing page from SSG to SSR+revalidation
  - Q5=C pattern per apps/web/CLAUDE.md
  - Blocked by: T-011
  - Blocks: T-021

- [ ] **T-014** (complexity: 2) - Convert tourist pricing page from SSG to SSR+revalidation
  - Blocked by: T-011
  - Blocks: T-021

- [ ] **T-015** (complexity: 3) - Build admin edit-plan-attributes UI
  - Includes price-change confirm dialog
  - Blocked by: T-007
  - Blocks: T-017, T-019

- [ ] **T-016** (complexity: 3) - Build admin edit-limits UI
  - Blocked by: T-008
  - Blocks: T-017, T-020

- [ ] **T-017** (complexity: 2) - Wire Cloudflare revalidation trigger on plan save
  - No API plan-cache to invalidate (Q7 = none exists)
  - Blocked by: T-015, T-016
  - Blocks: T-018, T-021

- [ ] **T-018** (complexity: 1) - Invalidate admin TanStack Query cache on plan mutation success
  - Blocked by: T-017
  - Blocks: none

### Testing Phase

- [ ] **T-019** (complexity: 3) - Integration test: admin attribute edit reflects live without deploy
  - Blocked by: T-010, T-011, T-015
  - Blocks: T-022, T-023

- [ ] **T-020** (complexity: 3) - Integration test: limit-value edit reflects at checkout without deploy
  - Blocked by: T-009, T-016
  - Blocks: T-022

- [ ] **T-021** (complexity: 3) - Integration test: web pricing page reflects DB change post-revalidation
  - Blocked by: T-013, T-014, T-017
  - Blocks: T-022

### Docs Phase

- [ ] **T-022** (complexity: 2) - Document the narrowed Model C admin-editable field policy
  - Blocked by: T-019, T-020, T-021
  - Blocks: none

### Cleanup Phase

- [ ] **T-023** (complexity: 2) - Audit and prune now-dead ALL_PLANS display-surface references
  - Blocked by: T-012, T-019
  - Blocks: none

---

## Dependency Graph

Level 0: T-001, T-008, T-009
Level 1: T-002, T-016
Level 2: T-003, T-020
Level 3: T-004
Level 4: T-005
Level 5: T-006
Level 6: T-007, T-010, T-011
Level 7: T-012, T-013, T-014, T-015
Level 8: T-017, T-019
Level 9: T-018, T-021, T-023
Level 10: T-022

## Suggested Start

Three tasks have no dependencies and can start immediately, in parallel:

- **T-001** (complexity: 3) - kicks off the main attributes+migration chain (cross-repo, coordinate first since it has the longest downstream chain)
- **T-008** (complexity: 3) - kicks off the limits-editing track, fully independent of the migration
- **T-009** (complexity: 2) - the addon-entitlement DB-lookup fix, fully independent

Recommended order: start T-001 first (longest critical path, cross-repo coordination adds lead time), and pick up T-008/T-009 in parallel while waiting on the qzpay publish.
