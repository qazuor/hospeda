# SPEC-044: Addon Purchase Schema Cleanup

## Progress: 0/21 tasks (0%)

**Average Complexity:** 2.0/4 (max)
**Critical Path:** T-001 -> T-003 -> T-016 -> T-017 -> T-020 -> T-021 (6 steps)
**Parallel Tracks:** 3 identified (services, routes, admin frontend)

---

### Setup Phase

- [ ] **T-001** (complexity: 2) - Update Drizzle schema: rename cancelledAt, add deletedAt, update index WHERE clauses
  - Edit billing_addon_purchase.dbschema.ts: rename property, add column, update 2 index conditions
  - Blocked by: none
  - Blocks: T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009, T-010

- [ ] **T-002** (complexity: 3) - Generate Drizzle migration, review SQL, and hand-edit as needed
  - Run pnpm db:generate, answer YES to rename, review SQL, append status migration
  - Blocked by: T-001
  - Blocks: T-020

### Core Phase

- [ ] **T-003** (complexity: 2) - Rename cancelledAt and status 'cancelled' in addon.user-addons.ts + addon.service.ts
  - Rename property access, change status value, update 2 JSDoc comments
  - Blocked by: T-001
  - Blocks: T-016, T-017, T-019

- [ ] **T-004** (complexity: 2) - Add isNull(deletedAt) filter to addon.user-addons.ts queries
  - Add soft-delete filter to getUserAddons() and cancelUserAddon() queries
  - Blocked by: T-001
  - Blocks: T-018

- [ ] **T-005** (complexity: 2) - Add isNull(deletedAt) filter to addon-expiration.service.ts queries
  - Add soft-delete filter to findExpiredAddons(), findExpiringAddons(), lookup by ID
  - Blocked by: T-001
  - Blocks: T-018

- [ ] **T-006** (complexity: 1) - Add isNull(deletedAt) filter to addon-entitlement.service.ts query
  - Add soft-delete filter to getCustomerAddonAdjustments()
  - Blocked by: T-001
  - Blocks: T-018

- [ ] **T-007** (complexity: 3) - Update admin customer-addons route: rename + deletedAt filter
  - Add deletedAt filter to count+paginated queries, rename cancelledAt in SELECT + response
  - Blocked by: T-001
  - Blocks: T-018

- [ ] **T-008** (complexity: 1) - Add isNull(deletedAt) filter to addons.ts ownership check
  - Add soft-delete filter to ownership-check query
  - Blocked by: T-001
  - Blocks: T-020

- [ ] **T-009** (complexity: 1) - Update customer-addons.schema.ts Zod schemas
  - Change 'cancelled' → 'canceled' in status enum, rename cancelledAt field
  - Blocked by: T-001
  - Blocks: T-011, T-012, T-014

- [ ] **T-010** (complexity: 1) - Run typecheck to verify all API layer changes
  - Verify zero TS errors in apps/api and packages/db
  - Blocked by: T-001, T-003, T-004, T-005, T-006, T-007, T-008, T-009
  - Blocks: T-011

### Integration Phase

- [ ] **T-011** (complexity: 1) - Update admin frontend types: billing-addons types.ts
  - Change 'cancelled' → 'canceled' in PurchasedAddon.status and PurchasedAddonFilters.status
  - Blocked by: T-009, T-010
  - Blocks: T-012, T-013, T-014

- [ ] **T-012** (complexity: 2) - Update purchased-columns.tsx: filter dropdown and status check
  - Change filter value, i18n label ref, and status comparison
  - Blocked by: T-011
  - Blocks: T-015

- [ ] **T-013** (complexity: 1) - Update PurchasedAddonDetailsDialog.tsx: switch case
  - Change case 'cancelled' → case 'canceled' in getStatusVariant()
  - Blocked by: T-011
  - Blocks: T-015

- [ ] **T-014** (complexity: 2) - Update addons.tsx route: StatusFilter type + SelectItem
  - Change StatusFilter type, SelectItem value, and i18n key reference
  - Blocked by: T-009, T-011
  - Blocks: T-015

- [ ] **T-015** (complexity: 2) - Rename i18n keys in all 3 locale files (es, en, pt)
  - 6 key renames: statusCancelled → statusCanceled + purchasedStatuses.cancelled → canceled
  - Blocked by: T-012, T-013, T-014
  - Blocks: T-020

### Testing Phase

- [ ] **T-016** (complexity: 2) - Update test mocks: setup.ts, db-mock.ts, addon.service.test.ts
  - Rename cancelledAt in 3 mock files, fix pre-existing camelCase bug
  - Blocked by: T-003
  - Blocks: T-017, T-018, T-019

- [ ] **T-017** (complexity: 3) - Update addon-expiration.service.test.ts assertions
  - Rename fields, update status values, fix error message assertion
  - Blocked by: T-003, T-016
  - Blocks: T-020

- [ ] **T-018** (complexity: 4) - Add new unit tests for soft-delete behavior
  - 5 new tests: getUserAddons, findExpiredAddons, getCustomerAddonAdjustments, admin list, unique index
  - Blocked by: T-004, T-005, T-006, T-007, T-016
  - Blocks: T-020

- [ ] **T-019** (complexity: 2) - Add test for cancelUserAddon status value consistency
  - Verify cancelUserAddon writes status 'canceled' (not 'cancelled')
  - Blocked by: T-003, T-016
  - Blocks: T-020

### Validation Phase

- [ ] **T-020** (complexity: 2) - Run full validation suite: typecheck + lint + test + grep
  - Complete monorepo validation with spelling grep checks
  - Blocked by: T-002, T-008, T-015, T-017, T-018, T-019
  - Blocks: T-021

- [ ] **T-021** (complexity: 2) - Apply migration to dev database and verify
  - Run db:migrate, verify columns, verify status data migration
  - Blocked by: T-020
  - Blocks: none

---

## Dependency Graph

```
Level 0: T-001
Level 1: T-002, T-003, T-004, T-005, T-006, T-007, T-008, T-009
Level 2: T-010, T-016
Level 3: T-011, T-017, T-018, T-019
Level 4: T-012, T-013, T-014
Level 5: T-015
Level 6: T-020
Level 7: T-021
```

## Parallel Tracks

After T-001 completes, three tracks can run in parallel:
1. **Service track**: T-003, T-004, T-005, T-006 (all independent service file edits)
2. **Route track**: T-007, T-008 (route file edits)
3. **Schema track**: T-009 (Zod schema update)

After T-010 (typecheck), admin frontend tasks T-011 → T-012/T-013/T-014 → T-015 run sequentially.

## Suggested Start

Begin with **T-001** (complexity: 2) - Update Drizzle schema file. It has no dependencies and unblocks 9 other tasks.
