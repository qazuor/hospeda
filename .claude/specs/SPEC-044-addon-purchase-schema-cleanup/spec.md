# SPEC-044: Addon Purchase Schema Cleanup

## Metadata

- **ID**: SPEC-044
- **Status**: in-progress
- **Created**: 2026-03-16
- **Updated**: 2026-04-08
- **Priority**: high
- **Effort**: medium (2-3 days)
- **Origin**: SPEC-038 gaps GAP-038-45 and GAP-038-25
- **Related**: SPEC-038 (Addon Entitlements Architecture Fix)

---

## Overview

This spec addresses three related consistency gaps in `billing_addon_purchases` discovered during the SPEC-038 addon entitlements architecture audit.

**GAP-038-45 (Soft-Delete):** `billing_addon_purchases` lacks a `deleted_at` column, making it impossible to soft-delete records using the `BaseModel.softDelete()` method. The unique partial index on `(customer_id, addon_slug)` also fails to account for soft-deleted rows, which means a customer who repurchases an addon after soft-deletion would hit a uniqueness constraint violation.

**GAP-038-25 (Column Spelling):** The database column `cancelled_at` uses British English while the TypeScript type `UserAddon` exposes `canceledAt` (American English). The Drizzle ORM maps the DB column to `cancelledAt` on the JS object, but `UserAddon` declares `canceledAt`, so the property name mismatch causes silent `undefined` values when reading the cancellation timestamp.

**GAP (Status Value Spelling):** Related to GAP-038-25 but distinct: the service code writes `status: 'cancelled'` (British, double-L) to the database at `addon.user-addons.ts:292`, while `UserAddon.status` is typed as `'active' | 'expired' | 'canceled'` (American, single-L). The cast at `addon.user-addons.ts:106` masks this at compile time, but any runtime comparison like `addon.status === 'canceled'` silently fails because the DB value is `'cancelled'`. Additionally, `customer-addons.schema.ts` uses `'cancelled'` (British) in its Zod enum while `addon.schema.ts` uses `'canceled'` (American), creating inconsistent validation across endpoints.

---

## Goals

1. Add soft-delete capability to `billing_addon_purchases` by adding a `deleted_at` column.
2. Fix the unique partial index and the active-customer index to exclude soft-deleted rows.
3. Rename the DB column `cancelled_at` to `canceled_at` to match American English convention.
4. Standardize the status value from `'cancelled'` to `'canceled'` in both DB data and all code.
5. Update ALL queries, schemas, types, routes, and tests to reflect the changes.
6. Provide a safe migration path for production data.

---

## Scope

### In Scope

- Adding `deleted_at` column (nullable timestamp) to `billing_addon_purchases`
- Renaming database column `cancelled_at` to `canceled_at`
- Updating existing rows: `UPDATE billing_addon_purchases SET status = 'canceled' WHERE status = 'cancelled'`
- Dropping and recreating both partial indexes to include `AND deleted_at IS NULL`
- Updating the Drizzle schema file
- Generating the Drizzle migration (with manual SQL review and possible hand-editing)
- Updating ALL references to `cancelledAt` in services, routes, schemas, types, tests, and mocks
- Updating ALL references to `'cancelled'` status value in addon-related code (services, schemas, admin frontend types, admin frontend components)
- Updating i18n keys in `admin-billing.json` (es/en/pt) for addon purchase status labels: `purchasedStatuses.cancelled` → `purchasedStatuses.canceled` AND `statusCancelled` → `statusCanceled` (two distinct keys per locale)
- Adding `isNull(billingAddonPurchases.deletedAt)` to ALL raw Drizzle SELECT queries on this table
- Unit tests covering soft-delete behavior and the renamed field

### Out of Scope

- Changes to addon purchase business logic (expiration, entitlement grant/revoke) .. those belong to SPEC-038
- Changes to any other billing table schemas (no other billing table has `deletedAt` either, but that is a separate concern)
- Subscription-related `'cancelled'` status values .. subscriptions use British spelling throughout, which is a separate concern
- MercadoPago external API status values .. the payment webhook handler at `payment-logic.ts:75` compares against MercadoPago's own `'cancelled'` status, which is an external API value and must NOT be changed
- Documentation-only files (`docs/runbooks/`, `docs/examples/`, `packages/*/docs/examples/`) .. these are non-executable reference material and are updated separately if desired
- Backfill of historical data beyond the column default and status rename

---

## User Stories

### US-1: Soft-Delete Consistency

As a platform operator,
I want addon purchases to support soft-delete like other entities,
so that deleting a purchase record preserves audit history and allows repurchase.

**Acceptance Criteria:**

Given an active addon purchase record in `billing_addon_purchases`,
When a soft-delete operation is executed on that record,
Then `deleted_at` is set to the current timestamp and the row is NOT physically removed.

Given a soft-deleted addon purchase,
When a query filters for active addon purchases using `status = 'active'`,
Then the soft-deleted record is NOT returned, even if its status column still holds `'active'`.

Given a soft-deleted addon purchase for a specific `(customer_id, addon_slug)` pair,
When the same customer repurchases the same addon and a new active record is created,
Then the unique constraint is NOT violated, because the soft-deleted record has `deleted_at IS NOT NULL` and the partial index excludes it.

Given a request to restore a soft-deleted addon purchase,
When `BillingAddonPurchaseModel.restore()` is called on that record,
Then `deleted_at` is set back to NULL and the record becomes visible in standard queries again.

### US-2: American English Spelling for canceledAt Column

As a developer reading or writing addon purchase data,
I want the cancellation timestamp to be consistently named `canceledAt` (American English) everywhere,
so that I can access the value without knowing that a spelling mismatch exists.

**Acceptance Criteria:**

Given the database column is renamed from `cancelled_at` to `canceled_at`,
When Drizzle maps the column to a JavaScript object,
Then the object property is `canceledAt` (not `cancelledAt`), matching the `UserAddon` TypeScript type.

Given code that previously wrote `purchase.cancelledAt`,
When the rename migration is applied,
Then the code is updated to use `purchase.canceledAt` and TypeScript compiles without errors.

Given the `cancelUserAddon` function executes a cancellation,
When the UPDATE query runs,
Then it sets `canceledAt: new Date()` (American spelling) and the Drizzle schema maps this correctly to `canceled_at` in SQL.

### US-3: American English Spelling for Status Value

As a developer comparing addon purchase status values,
I want the status value to be consistently `'canceled'` (American English) in the database and all code,
so that `addon.status === 'canceled'` works correctly at runtime.

**Acceptance Criteria:**

Given existing rows in `billing_addon_purchases` with `status = 'cancelled'` (British),
When the migration is applied,
Then those rows are updated to `status = 'canceled'` (American).

Given the `cancelUserAddon` function at `addon.user-addons.ts`,
When it writes the cancellation status,
Then it writes `status: 'canceled'` (American, single-L) instead of `'cancelled'`.

Given the Zod schema `ADDON_PURCHASE_STATUSES` in `customer-addons.schema.ts`,
When it validates the status field,
Then the enum value is `'canceled'` (not `'cancelled'`).

Given the admin frontend type `PurchasedAddon` in `billing-addons/types.ts`,
When it defines the status union type,
Then it uses `'canceled'` (not `'cancelled'`).

### US-4: Query Correctness After Schema Change

As a developer consuming addon purchase queries,
I want all existing queries to remain correct after the schema changes,
so that soft-deleted records are never surfaced as active addons.

**Acceptance Criteria:**

Given any direct `db.select().from(billingAddonPurchases).where(...)` call in any service or route,
When the soft-delete column exists,
Then the WHERE clause explicitly includes `isNull(billingAddonPurchases.deletedAt)`.

**IMPORTANT:** `BaseModel.findAll()` does NOT automatically filter `deleted_at IS NULL`. Every raw Drizzle query must add this filter explicitly. Do not rely on BaseModel for automatic soft-delete filtering.

Specific queries that require the `deletedAt` filter:

| File | Function/Location | Query Type |
|------|-------------------|------------|
| `addon.user-addons.ts` | `getUserAddons()` ~line 55 | SELECT active addons |
| `addon.user-addons.ts` | `cancelUserAddon()` ~line 247 | SELECT by purchase ID |
| `addon-expiration.service.ts` | `findExpiredAddons()` ~line 156 | SELECT expired addons |
| `addon-expiration.service.ts` | `findExpiringAddons()` ~line 269 | SELECT expiring addons |
| `addon-expiration.service.ts` | lookup by ID ~line 366 | SELECT by purchase ID |
| `addon-entitlement.service.ts` | `getCustomerAddonAdjustments()` ~line 525 | SELECT active addons |
| `routes/billing/admin/customer-addons.ts` | count query ~line 65 | SELECT COUNT |
| `routes/billing/admin/customer-addons.ts` | paginated query ~line 74 | SELECT paginated |
| `routes/billing/addons.ts` | ownership check ~line 315 | SELECT by purchase ID + customerId + status |

**Note on admin customer-addons route:** The admin route queries may optionally show soft-deleted records when an `includeDeleted` query parameter is passed. By default, soft-deleted records should be excluded. The implementer should add `isNull(billingAddonPurchases.deletedAt)` to the default conditions array and skip it only when `includeDeleted` is explicitly true.

---

## UX Considerations

### Admin Panel Impact

The admin customer-addons endpoint response shape changes: the `cancelledAt` field becomes `canceledAt`. The admin frontend does NOT currently display or reference the cancellation timestamp field (only `purchasedAt` and `expiresAt` are displayed in the UI), so the rename is safe from a UI perspective. However, the `CustomerAddonResponseSchema` Zod schema at `customer-addons.schema.ts:74` must be updated to validate the new field name.

The admin frontend DOES reference the status value `'cancelled'` in:
- `billing-addons/types.ts:60` .. `PurchasedAddon.status` type union
- `billing-addons/types.ts:68` .. `PurchasedAddonFilters.status` type union
- `purchased-columns.tsx:87-88` .. filter dropdown option value and i18n label
- `purchased-columns.tsx:179` .. conditional rendering for expired/cancelled actions
- `components/PurchasedAddonDetailsDialog.tsx:33` .. `getStatusVariant()` switch case for badge color

Additionally, the route file `routes/_authed/billing/addons.tsx` references `'cancelled'` in:
- `addons.tsx:46` .. `StatusFilter` type union includes `'cancelled'`
- `addons.tsx:261` .. `<SelectItem value="cancelled">` dropdown option
- `addons.tsx:262` .. `t('admin-billing.addons.statusCancelled')` i18n key reference

All of these must be updated to `'canceled'` as part of this spec.

Additionally, there are TWO distinct i18n keys per locale that must be renamed:
1. `admin-billing.addons.purchasedStatuses.cancelled` → `purchasedStatuses.canceled` (used in `purchased-columns.tsx`)
2. `admin-billing.addons.statusCancelled` → `statusCanceled` (used in `addons.tsx`)

### Error States

- If the migration fails partway through, the `deleted_at` addition is independent and safe. The column rename and status update should be in the same migration to ensure atomicity.
- If the column rename is deployed without updating service code simultaneously, any write to `cancelledAt` on the Drizzle table object will silently write `null`. The code changes and the migration MUST be deployed atomically (same deploy).

### Deployment Strategy

This change requires an **atomic deployment**: migration + code must be deployed together in a single release. The rationale:

1. `deleted_at` addition is backward compatible .. old code simply ignores it. Safe alone.
2. Column rename `cancelled_at` → `canceled_at` is NOT backward compatible .. old Drizzle schema looks for `cancelled_at`, new schema looks for `canceled_at`. If migration runs but old code is still live, writes to `cancelledAt` produce `null`. If new code runs but migration hasn't run, reads from `canceledAt` produce `undefined`.
3. Status value update `'cancelled'` → `'canceled'` must be coordinated with code that writes/reads status values.

**Recommended approach:** Deploy migration + code in a single atomic release. PostgreSQL `ALTER TABLE RENAME COLUMN` acquires `ACCESS EXCLUSIVE` lock for milliseconds only (metadata-only operation). For a write-infrequent table like `billing_addon_purchases`, this is safe without a maintenance window.

---

## Technical Design

### Files Affected

#### Database Layer

| File | Change |
|------|--------|
| `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts` | Add `deletedAt` column. Rename `cancelledAt` → `canceledAt`. Update both partial index WHERE conditions to add `AND deleted_at IS NULL`. |
| `packages/db/src/migrations/NNNN_addon_purchase_schema_cleanup.sql` | Generated + reviewed migration. See Migration SQL section below. |

#### API Services

| File | Lines | Change |
|------|-------|--------|
| `apps/api/src/services/addon.user-addons.ts` | ~109 | `purchase.cancelledAt` → `purchase.canceledAt` |
| `apps/api/src/services/addon.user-addons.ts` | ~55-63 | Add `isNull(billingAddonPurchases.deletedAt)` to WHERE |
| `apps/api/src/services/addon.user-addons.ts` | ~247-256 | Add `isNull(billingAddonPurchases.deletedAt)` to WHERE |
| `apps/api/src/services/addon.user-addons.ts` | ~292 | `cancelledAt: new Date()` → `canceledAt: new Date()` |
| `apps/api/src/services/addon.user-addons.ts` | ~292 | `status: 'cancelled'` → `status: 'canceled'` |
| `apps/api/src/services/addon-expiration.service.ts` | ~156-165 | Add `isNull(billingAddonPurchases.deletedAt)` to WHERE |
| `apps/api/src/services/addon-expiration.service.ts` | ~269-279 | Add `isNull(billingAddonPurchases.deletedAt)` to WHERE |
| `apps/api/src/services/addon-expiration.service.ts` | ~366-370 | Add `isNull(billingAddonPurchases.deletedAt)` to WHERE |
| `apps/api/src/services/addon-entitlement.service.ts` | ~525-533 | Add `isNull(billingAddonPurchases.deletedAt)` to WHERE |
| `apps/api/src/services/addon.user-addons.ts` | ~213 | JSDoc comment says `status to 'cancelled'` → update to `status to 'canceled'` for consistency. |
| `apps/api/src/services/addon.service.ts` | ~162 | JSDoc comment says `status='cancelled'` → update to `status='canceled'` for consistency. |
| `apps/api/src/services/addon.types.ts` | -- | No change needed. `UserAddon.canceledAt` and `UserAddon.status: 'canceled'` already use American spelling. |

#### API Routes

| File | Lines | Change |
|------|-------|--------|
| `apps/api/src/routes/billing/admin/customer-addons.ts` | ~65-69 | Add `isNull(billingAddonPurchases.deletedAt)` to count query WHERE |
| `apps/api/src/routes/billing/admin/customer-addons.ts` | ~74-99 | Add `isNull(billingAddonPurchases.deletedAt)` to select query WHERE. Change `.cancelledAt` → `.canceledAt` in SELECT columns (line ~86). |
| `apps/api/src/routes/billing/admin/customer-addons.ts` | ~122 | `row.cancelledAt` → `row.canceledAt` in response mapping |
| `apps/api/src/routes/billing/addons.ts` | ~315-325 | Add `isNull(billingAddonPurchases.deletedAt)` to the ownership-check query WHERE clause (alongside existing `eq(status, 'active')` and `eq(customerId, ...)` conditions). |

#### API Schemas (Zod)

| File | Lines | Change |
|------|-------|--------|
| `apps/api/src/schemas/customer-addons.schema.ts` | 20 | `'cancelled'` → `'canceled'` in `ADDON_PURCHASE_STATUSES` array |
| `apps/api/src/schemas/customer-addons.schema.ts` | 74 | `cancelledAt:` → `canceledAt:` in `CustomerAddonResponseSchema` |

#### Admin Frontend

| File | Lines | Change |
|------|-------|--------|
| `apps/admin/src/features/billing-addons/types.ts` | ~60 | `'cancelled'` → `'canceled'` in `PurchasedAddon.status` union type |
| `apps/admin/src/features/billing-addons/types.ts` | ~68 | `'cancelled'` → `'canceled'` in `PurchasedAddonFilters.status` union type |
| `apps/admin/src/features/billing-addons/purchased-columns.tsx` | ~87-88 | Filter dropdown option: `value: 'cancelled'` → `value: 'canceled'` and `label: t('admin-billing.addons.purchasedStatuses.canceled')` (update i18n key reference) |
| `apps/admin/src/features/billing-addons/purchased-columns.tsx` | ~179 | `row.status === 'cancelled'` → `row.status === 'canceled'` |
| `apps/admin/src/features/billing-addons/components/PurchasedAddonDetailsDialog.tsx` | ~33 | `case 'cancelled':` → `case 'canceled':` in `getStatusVariant()` switch statement |
| `apps/admin/src/routes/_authed/billing/addons.tsx` | ~46 | `type StatusFilter = '...' \| 'cancelled'` → `'canceled'` in the union type |
| `apps/admin/src/routes/_authed/billing/addons.tsx` | ~261 | `<SelectItem value="cancelled">` → `<SelectItem value="canceled">` |
| `apps/admin/src/routes/_authed/billing/addons.tsx` | ~262 | `t('admin-billing.addons.statusCancelled')` → `t('admin-billing.addons.statusCanceled')` (note: different i18n key than `purchasedStatuses`) |

#### i18n Locale Files

| File | Lines | Change |
|------|-------|--------|
| `packages/i18n/src/locales/es/admin-billing.json` | ~316 | Rename key `"cancelled": "Cancelado"` → `"canceled": "Cancelado"` under `addons.purchasedStatuses` |
| `packages/i18n/src/locales/en/admin-billing.json` | ~316 | Rename key `"cancelled": "Cancelled"` → `"canceled": "Cancelled"` under `addons.purchasedStatuses` |
| `packages/i18n/src/locales/pt/admin-billing.json` | ~316 | Rename key `"cancelled": "Cancelado"` → `"canceled": "Cancelado"` under `addons.purchasedStatuses` |

| `packages/i18n/src/locales/es/admin-billing.json` | ~256 | Rename key `"statusCancelled": "Cancelado"` → `"statusCanceled": "Cancelado"` under `addons` (separate from `purchasedStatuses`) |
| `packages/i18n/src/locales/en/admin-billing.json` | ~256 | Rename key `"statusCancelled": "Cancelled"` → `"statusCanceled": "Cancelled"` under `addons` |
| `packages/i18n/src/locales/pt/admin-billing.json` | ~256 | Rename key `"statusCancelled": "Cancelado"` → `"statusCanceled": "Cancelado"` under `addons` |

**Note on i18n keys:** There are TWO distinct addon-related cancelled keys per locale: `addons.purchasedStatuses.cancelled` (line ~316) AND `addons.statusCancelled` (line ~256). BOTH must be renamed. The `sponsorships.statuses.cancelled` and `subscriptions.statuses.cancelled` keys are for other billing entities and are explicitly out of scope.

#### Test Files

| File | Lines | Change |
|------|-------|--------|
| `apps/api/test/setup.ts` | ~151 | `cancelledAt: 'cancelled_at'` → `canceledAt: 'canceled_at'` |
| `apps/api/test/helpers/mocks/db-mock.ts` | ~22 | `cancelledAt: 'cancelled_at'` → `canceledAt: 'canceled_at'` |
| `apps/api/test/services/addon.service.test.ts` | ~65 | `cancelledAt: 'cancelledAt'` → `canceledAt: 'canceled_at'` (note: the original value `'cancelledAt'` is a pre-existing bug.. the correct snake_case column name is `'canceled_at'`, matching the convention used in `test/setup.ts` and `db-mock.ts`) |
| `apps/api/test/services/addon-expiration.service.test.ts` | ~32, 93, 121, 408, 421, 432 | All `cancelledAt` refs → `canceledAt`. Status `'cancelled'` → `'canceled'`. Error message expectation at line ~432: `"Cannot expire add-on with status 'cancelled'"` → `"Cannot expire add-on with status 'canceled'"`. |
| `apps/api/test/helpers/mock-factories.ts` | ~98 | Already uses `canceledAt: null` (American). No change needed. |
| New test file or additions to existing tests | -- | Add soft-delete coverage (see Phase 4). |

#### Files NOT Requiring Changes (Explicitly Out of Scope)

| File | Reason |
|------|--------|
| `apps/api/src/schemas/addon.schema.ts:73,76` | Already uses American spelling (`'canceled'` in status enum, `canceledAt` in response schema). No change needed. |
| `apps/api/src/services/billing-metrics.service.ts:215` | Uses `status = 'canceled'` but this is a raw SQL query on `billing_subscriptions` (NOT `billing_addon_purchases`). Out of scope. |
| `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts:75` | Compares against MercadoPago external API `'cancelled'` status. This is an external value, not our domain. |
| `apps/api/src/services/addon.checkout.ts` | Uses `billingAddonPurchases` for INSERT only (creating new purchases). Does not reference `cancelledAt` or `'cancelled'` status. The new `deletedAt` column is nullable and not set on insert, so no change needed. |
| `apps/api/test/integration/addon-expiration-flow.test.ts` | Integration test that does raw INSERTs and SELECTs on `billingAddonPurchases`. Does not reference `cancelledAt` or `'cancelled'` status. Raw SELECTs do not need `isNull(deletedAt)` because test data never has soft-deleted records. No change needed, but implementer should be aware this file exists. |
| `apps/web/src/components/account/SubscriptionActiveView.client.tsx:218` | Uses `'cancelled'` for subscription status, not addon purchases. |
| `apps/web/src/lib/api/endpoints-protected.ts:88` | Subscription status type, not addon purchases. |
| `packages/i18n/src/locales/*/admin-billing.json` (sponsorships/subscriptions keys) | `sponsorships.statuses.cancelled` and `subscriptions.statuses.cancelled` i18n keys are for other billing entities, not addon purchases. |
| `docs/runbooks/billing-incidents.md` | Documentation/runbook SQL examples. Non-executable. Update separately if desired. |
| `packages/logger/docs/examples/*.ts` | Example code files. Non-executable. |
| `packages/service-core/docs/examples/*.ts` | Example code files. Non-executable. |
| `packages/schemas/docs/api/schema-reference.md` | Documentation reference. |
| `packages/db/src/billing/migrate-addon-purchases.ts` | One-time migration script. Unlikely to run again. |

### Schema Change Detail

**Current schema (abbreviated):**
```
billing_addon_purchases
  id             uuid PK
  customer_id    uuid NOT NULL
  addon_slug     varchar(100) NOT NULL
  status         varchar(50) NOT NULL default 'pending'
  purchased_at   timestamp with time zone NOT NULL
  expires_at     timestamp with time zone nullable
  cancelled_at   timestamp with time zone nullable   <-- British spelling
  created_at     timestamp with time zone NOT NULL
  updated_at     timestamp with time zone NOT NULL
  -- NO deleted_at column
```

**Target schema (abbreviated):**
```
billing_addon_purchases
  id             uuid PK
  customer_id    uuid NOT NULL
  addon_slug     varchar(100) NOT NULL
  status         varchar(50) NOT NULL default 'pending'
  purchased_at   timestamp with time zone NOT NULL
  expires_at     timestamp with time zone nullable
  canceled_at    timestamp with time zone nullable   <-- American spelling (renamed)
  created_at     timestamp with time zone NOT NULL
  updated_at     timestamp with time zone NOT NULL
  deleted_at     timestamp with time zone nullable   <-- NEW
```

### Index Change Detail

**Current unique partial index:**
```sql
CREATE UNIQUE INDEX idx_addon_purchases_active_unique
  ON billing_addon_purchases (customer_id, addon_slug)
  WHERE status = 'active';
```

**Target unique partial index:**
```sql
CREATE UNIQUE INDEX idx_addon_purchases_active_unique
  ON billing_addon_purchases (customer_id, addon_slug)
  WHERE status = 'active' AND deleted_at IS NULL;
```

**Current active-customer index:**
```sql
CREATE INDEX "addonPurchases_active_customer_idx"
  ON billing_addon_purchases (customer_id)
  WHERE status = 'active';
```

**Target active-customer index:**
```sql
CREATE INDEX "addonPurchases_active_customer_idx"
  ON billing_addon_purchases (customer_id)
  WHERE status = 'active' AND deleted_at IS NULL;
```

### Drizzle Schema Update

The Drizzle schema object in `billing_addon_purchase.dbschema.ts` must change:

1. Rename property `cancelledAt` to `canceledAt` (column name becomes `canceled_at`).
2. Add `deletedAt: timestamp('deleted_at', { withTimezone: true })` (nullable, no default).
3. Update `.where()` SQL conditions on both partial indexes to: `` sql`status = 'active' AND deleted_at IS NULL` ``

### Migration SQL

The migration must include four operations in this order:

```sql
-- Step 1: Add deleted_at column (backward compatible)
ALTER TABLE billing_addon_purchases
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Step 2: Drop and recreate partial indexes with new condition
DROP INDEX IF EXISTS idx_addon_purchases_active_unique;
CREATE UNIQUE INDEX idx_addon_purchases_active_unique
  ON billing_addon_purchases (customer_id, addon_slug)
  WHERE status = 'active' AND deleted_at IS NULL;

DROP INDEX IF EXISTS "addonPurchases_active_customer_idx";
CREATE INDEX "addonPurchases_active_customer_idx"
  ON billing_addon_purchases (customer_id)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Step 3: Rename column
ALTER TABLE billing_addon_purchases
  RENAME COLUMN cancelled_at TO canceled_at;

-- Step 4: Standardize status values (data migration)
UPDATE billing_addon_purchases
  SET status = 'canceled'
  WHERE status = 'cancelled';
```

### Drizzle-kit Migration Generation Notes

**CRITICAL: Read this before running `pnpm db:generate`.**

1. **Column rename detection:** When `pnpm db:generate` (drizzle-kit) detects that `cancelledAt` was removed and `canceledAt` was added, it will interactively prompt: _"Is X column renamed?"_ **You MUST answer YES.** If you answer NO, drizzle-kit generates DROP COLUMN + ADD COLUMN, which **PERMANENTLY LOSES all `cancelled_at` data**.

2. **Partial index WHERE clause bug:** There are known drizzle-kit bugs ([#461](https://github.com/drizzle-team/drizzle-kit-mirror/issues/461), [#4790](https://github.com/drizzle-team/drizzle-orm/issues/4790)) where partial index WHERE clauses generate parameterized placeholders (`$1`) instead of literal values. After generation, **inspect the migration SQL**. If the WHERE clause contains `$1` instead of literal `'active'`, you must hand-edit the migration SQL using the reference SQL above.

3. **Status data migration:** Drizzle-kit will NOT generate the `UPDATE ... SET status = 'canceled' WHERE status = 'cancelled'` statement. This must be **manually appended** to the generated migration file.

4. **Review checklist** for the generated migration:
   - [ ] `ADD COLUMN deleted_at TIMESTAMPTZ` is present
   - [ ] `RENAME COLUMN cancelled_at TO canceled_at` is present (NOT DROP + ADD)
   - [ ] Both indexes are DROPped and reCREATEd with `AND deleted_at IS NULL`
   - [ ] Index WHERE clauses use literal values, not `$1` placeholders
   - [ ] `UPDATE billing_addon_purchases SET status = 'canceled' WHERE status = 'cancelled'` is present at the end

---

## Acceptance Criteria (BDD)

### AC-1: Columns Exist Post-Migration

Given the migration has been applied to the database,
When the table structure of `billing_addon_purchases` is inspected,
Then a column `deleted_at` of type `timestamptz` (nullable) exists,
And a column `canceled_at` of type `timestamptz` (nullable) exists,
And no column named `cancelled_at` (with double-L) exists.

### AC-2: Existing Rows Unaffected (timestamps) and Status Migrated

Given existing rows in `billing_addon_purchases` before the migration,
When the migration is applied,
Then all existing rows have `deleted_at = NULL`,
And all existing rows retain their original `cancelled_at` timestamp value, now accessible as `canceled_at`,
And any row that previously had `status = 'cancelled'` now has `status = 'canceled'`.

### AC-3: Unique Index Behavior

Given a customer with a soft-deleted addon purchase for slug `extra-photos`,
When a new addon purchase for the same customer and slug `extra-photos` is inserted with `status = 'active'`,
Then no unique constraint violation occurs.

Given two active (non-deleted) addon purchases for the same `(customer_id, addon_slug)`,
When a second active purchase is attempted,
Then a unique constraint violation is raised, preventing the duplicate.

### AC-4: Service Query Correctness

Given a soft-deleted addon purchase with `status = 'active'` and `deleted_at = NOW()`,
When `getUserAddons()` is called for that customer,
Then the soft-deleted purchase is NOT included in the result.

Given a soft-deleted addon purchase,
When `findExpiredAddons()` is called,
Then the soft-deleted purchase is NOT included in the result.

Given a soft-deleted addon purchase,
When `getCustomerAddonAdjustments()` is called,
Then the soft-deleted purchase is NOT included in the result.

Given a soft-deleted addon purchase,
When the admin `customer-addons` list endpoint is called without `includeDeleted`,
Then the soft-deleted purchase is NOT included in the result.

### AC-5: canceledAt Field Mapping

Given an addon purchase with `canceled_at = '2026-03-10T12:00:00Z'` in the database,
When the Drizzle query result is mapped to a `UserAddon` object,
Then `userAddon.canceledAt === '2026-03-10T12:00:00Z'` (American spelling property works correctly).

Given the `cancelUserAddon()` function executes a cancellation,
When the UPDATE is applied,
Then the `canceled_at` column in the database is set to the current timestamp,
And the `status` column is set to `'canceled'` (American, single-L).

### AC-6: Status Value Consistency

Given the `cancelUserAddon` function writes a cancellation,
When the UPDATE is applied,
Then the status value written to the database is `'canceled'` (single-L, American).

Given the admin frontend filter options for addon purchase status,
When the dropdown renders,
Then it uses `'canceled'` (not `'cancelled'`) for the cancellation status option.

Given the `ADDON_PURCHASE_STATUSES` array in `customer-addons.schema.ts`,
When it validates a status query parameter,
Then `'canceled'` is accepted and `'cancelled'` is rejected.

### AC-7: TypeScript Compilation

Given the schema file and all service/route/test files are updated,
When `pnpm typecheck` is run across the monorepo,
Then TypeScript reports zero errors related to `cancelledAt`, `canceledAt`, `deletedAt`, or `'cancelled'` / `'canceled'` status values in any addon-related file.

### AC-8: Tests Pass

Given the updated schema, service code, route code, and admin frontend code,
When `pnpm test` is run,
Then all existing tests pass with no regressions,
And new tests covering soft-delete behavior, `canceledAt` field mapping, and `'canceled'` status value exist and pass.

### AC-9: No British Spelling Remnants

Given the full codebase (excluding explicitly out-of-scope files),
When a grep is run for `cancelledAt` and `'cancelled'` in addon-purchase-related files,
Then zero matches are found (excluding: MercadoPago webhook handler, subscription-related code, documentation-only files).

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Column rename causes ACCESS EXCLUSIVE lock on production | Low | Low | Lock is metadata-only, held for milliseconds. Table is write-infrequent. Safe without maintenance window. |
| Drizzle-kit generates DROP+ADD instead of RENAME (data loss) | Medium | Critical | When `drizzle-kit` prompts "Is column renamed?", answer YES. Always review generated SQL before applying. |
| Drizzle-kit generates broken partial index WHERE clauses with `$1` placeholders | High | High | Known bugs [#461](https://github.com/drizzle-team/drizzle-kit-mirror/issues/461), [#4790](https://github.com/drizzle-team/drizzle-orm/issues/4790). Hand-edit the migration SQL if placeholders appear. Reference SQL provided in this spec. |
| A query path is missed and surfaces soft-deleted records | Medium | Medium | Complete query audit table provided above. Grep for `billingAddonPurchases` and audit each usage. |
| Migration runs but code is not updated simultaneously | Medium | High | MUST deploy atomically. Migration + code in single release. |
| Admin frontend comparisons break on status value change | Medium | Medium | Update admin frontend types and components. Files listed in Files Affected table. |
| Status value `'cancelled'` exists in DB rows not caught by migration | Low | Medium | The data migration UPDATE catches all rows. Verify with `SELECT COUNT(*) FROM billing_addon_purchases WHERE status = 'cancelled'` post-migration. |

---

## Dependencies

- **SPEC-038**: Both specs touch `billing_addon_purchase.dbschema.ts`. If SPEC-038 is in progress, coordinate to avoid merge conflicts.
- **Drizzle migration tooling**: `pnpm db:generate` to produce migration SQL, `pnpm db:migrate` to apply.
- **No new packages required**: All changes use existing Drizzle, TypeScript, Biome, and Vitest tooling.

---

## Implementation Phases

### Phase 1: Schema and Migration (Day 1 morning)

1. Update `packages/db/src/schemas/billing/billing_addon_purchase.dbschema.ts`:
   - Rename `cancelledAt` property to `canceledAt` (column name `cancelled_at` → `canceled_at`).
   - Add `deletedAt: timestamp('deleted_at', { withTimezone: true })` (nullable, no default).
   - Update both partial index `.where()` conditions to: `` sql`status = 'active' AND deleted_at IS NULL` ``

2. Run `pnpm db:generate` to produce the migration file.
   - When prompted "Is column renamed?", answer **YES** for `cancelled_at` → `canceled_at`.

3. **Review the generated SQL carefully:**
   - Verify RENAME COLUMN (not DROP+ADD).
   - Verify partial index WHERE clauses use literal values (not `$1`).
   - If WHERE clauses are broken, hand-edit using the reference SQL from this spec.
   - Manually append the status data migration at the end of the file:
     ```sql
     UPDATE billing_addon_purchases SET status = 'canceled' WHERE status = 'cancelled';
     ```

4. Run `pnpm typecheck` .. expect compile errors at every site using `cancelledAt`. These errors are the complete checklist of files to update.

### Phase 2: API Service, Route, and Schema Updates (Day 1 afternoon)

5. Fix all TypeScript compile errors from Phase 1:
   - `addon.user-addons.ts`: rename `cancelledAt` → `canceledAt` in mapping (line ~109) and UPDATE SET clause (line ~293).
   - `addon.user-addons.ts`: change `status: 'cancelled'` → `status: 'canceled'` (line ~292).
   - `addon.service.ts`: update JSDoc comment at line ~162 from `status='cancelled'` to `status='canceled'`.
   - `routes/billing/admin/customer-addons.ts`: rename `cancelledAt` → `canceledAt` in SELECT (line ~86) and response mapping (line ~122).

6. Update Zod schemas:
   - `schemas/customer-addons.schema.ts`: change `'cancelled'` → `'canceled'` in `ADDON_PURCHASE_STATUSES` (line 20).
   - `schemas/customer-addons.schema.ts`: rename `cancelledAt` → `canceledAt` in `CustomerAddonResponseSchema` (line 74).

7. Add `isNull(billingAddonPurchases.deletedAt)` to every raw Drizzle SELECT query:
   - `addon.user-addons.ts` .. getUserAddons query (~line 55), cancelUserAddon lookup (~line 247)
   - `addon-expiration.service.ts` .. findExpiredAddons (~line 156), findExpiringAddons (~line 269), lookup by ID (~line 366)
   - `addon-entitlement.service.ts` .. getCustomerAddonAdjustments (~line 525)
   - `routes/billing/admin/customer-addons.ts` .. count query (~line 65), paginated query (~line 74)
   - `routes/billing/addons.ts` .. ownership check query (~line 315)

8. Run `pnpm typecheck` again .. must pass with zero errors.

### Phase 3: Admin Frontend Updates (Day 2 morning)

9. Update admin frontend addon types and components:
   - `apps/admin/src/features/billing-addons/types.ts` line ~60: change `'cancelled'` → `'canceled'` in `PurchasedAddon.status` type.
   - `apps/admin/src/features/billing-addons/types.ts` line ~68: change `'cancelled'` → `'canceled'` in `PurchasedAddonFilters.status` type.
   - `apps/admin/src/features/billing-addons/purchased-columns.tsx` line ~87: change filter dropdown `value: 'cancelled'` → `value: 'canceled'`.
   - `apps/admin/src/features/billing-addons/purchased-columns.tsx` line ~88: change label reference to `t('admin-billing.addons.purchasedStatuses.canceled')`.
   - `apps/admin/src/features/billing-addons/purchased-columns.tsx` line ~179: change `row.status === 'cancelled'` → `row.status === 'canceled'`.
   - `apps/admin/src/features/billing-addons/components/PurchasedAddonDetailsDialog.tsx` line ~33: change `case 'cancelled':` → `case 'canceled':` in `getStatusVariant()`.
   - `apps/admin/src/routes/_authed/billing/addons.tsx` line ~46: change `type StatusFilter = '...' | 'cancelled'` → `'canceled'`.
   - `apps/admin/src/routes/_authed/billing/addons.tsx` line ~261: change `<SelectItem value="cancelled">` → `<SelectItem value="canceled">`.
   - `apps/admin/src/routes/_authed/billing/addons.tsx` line ~262: change `t('admin-billing.addons.statusCancelled')` → `t('admin-billing.addons.statusCanceled')`.

10. Update i18n locale files (all 3 locales) .. TWO keys per locale:
    - `packages/i18n/src/locales/es/admin-billing.json` line ~256: rename key `"statusCancelled"` → `"statusCanceled"` under `addons`.
    - `packages/i18n/src/locales/en/admin-billing.json` line ~256: rename key `"statusCancelled"` → `"statusCanceled"` under `addons`.
    - `packages/i18n/src/locales/pt/admin-billing.json` line ~256: rename key `"statusCancelled"` → `"statusCanceled"` under `addons`.
    - `packages/i18n/src/locales/es/admin-billing.json` line ~316: rename key `"cancelled"` → `"canceled"` under `addons.purchasedStatuses`.
    - `packages/i18n/src/locales/en/admin-billing.json` line ~316: rename key `"cancelled"` → `"canceled"` under `addons.purchasedStatuses`.
    - `packages/i18n/src/locales/pt/admin-billing.json` line ~316: rename key `"cancelled"` → `"canceled"` under `addons.purchasedStatuses`.
    - **Do NOT change** `sponsorships.statuses.cancelled` or `subscriptions.statuses.cancelled` keys .. those are out of scope.

11. Run `pnpm typecheck` for admin app .. must pass.

### Phase 4: Test Updates and New Tests (Day 2 afternoon)

12. Update test mocks and assertions:
    - `test/setup.ts` line ~151: `cancelledAt: 'cancelled_at'` → `canceledAt: 'canceled_at'`
    - `test/helpers/mocks/db-mock.ts` line ~22: `cancelledAt: 'cancelled_at'` → `canceledAt: 'canceled_at'`
    - `test/services/addon.service.test.ts` line ~65: `cancelledAt: 'cancelledAt'` → `canceledAt: 'canceled_at'` (fixes pre-existing bug: original used camelCase `'cancelledAt'` instead of snake_case `'cancelled_at'`)
    - `test/services/addon-expiration.service.test.ts` lines ~32, ~93, ~121, ~408, ~421: all `cancelledAt` → `canceledAt`, all `'cancelled'` → `'canceled'`
    - `test/services/addon-expiration.service.test.ts` line ~432: error message expectation `"Cannot expire add-on with status 'cancelled'"` → `"Cannot expire add-on with status 'canceled'"` (this test asserts the error message content, so it must match the updated status value the service now writes)

13. Add new unit tests for soft-delete behavior:
    - A soft-deleted record with `status = 'active'` and `deletedAt = new Date()` is excluded from `getUserAddons()`.
    - A soft-deleted record is excluded from `findExpiredAddons()`.
    - A soft-deleted record is excluded from `getCustomerAddonAdjustments()`.
    - A soft-deleted record is excluded from admin customer-addons list.
    - The unique index allows repurchase after soft-delete (insert succeeds when prior active record is soft-deleted).

14. Add test for status value consistency:
    - `cancelUserAddon` writes `status: 'canceled'` (American) to the database.

15. Run `pnpm test` for `apps/api` and `apps/admin` .. must pass with coverage >= 90% on modified files.

### Phase 5: Final Validation (Day 3 morning)

16. Run full validation:
    - `pnpm typecheck` (entire monorepo)
    - `pnpm lint` (entire monorepo)
    - `pnpm test` (entire monorepo)
    - Grep verification: `rg 'cancelledAt|cancelled_at' --type ts` should return zero results in service/route/schema/test files (documentation files are acceptable).
    - Grep verification: `rg "'cancelled'" apps/api/src apps/admin/src` should return zero results for addon-related code (subscription and MercadoPago code is acceptable).
    - Grep verification: `rg '"cancelled"|"statusCancelled"' packages/i18n/src/locales/*/admin-billing.json` should return `"cancelled"` ONLY under `sponsorships.statuses` and `subscriptions.statuses` keys (not under `addons`), and zero `"statusCancelled"` matches.

17. Apply migration to dev database:
    - `pnpm db:migrate`
    - Verify with: `SELECT column_name FROM information_schema.columns WHERE table_name = 'billing_addon_purchases' ORDER BY ordinal_position;`
    - Verify no `'cancelled'` status remains: `SELECT COUNT(*) FROM billing_addon_purchases WHERE status = 'cancelled';` (should return 0)

---

## Definition of Done

- [ ] `billing_addon_purchases` table has `deleted_at` column (nullable timestamptz)
- [ ] `billing_addon_purchases` table column is named `canceled_at` (not `cancelled_at`)
- [ ] Unique partial index includes `AND deleted_at IS NULL`
- [ ] Active customer partial index includes `AND deleted_at IS NULL`
- [ ] Drizzle schema file reflects all changes (rename, new column, updated indexes)
- [ ] Migration file generated, reviewed (no `$1` placeholders), and includes status data migration
- [ ] All rows with `status = 'cancelled'` migrated to `status = 'canceled'`
- [ ] `pnpm typecheck` passes with zero errors across monorepo
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm test` passes for `apps/api` and `apps/admin` with coverage >= 90% on modified files
- [ ] No addon-related source file references `cancelledAt` (British spelling) .. grep check
- [ ] No addon-related source file uses `'cancelled'` as a status value .. grep check (excluding MercadoPago webhook and subscription code)
- [ ] All raw Drizzle queries on `billingAddonPurchases` include `isNull(deletedAt)` or route through BaseModel
- [ ] Admin customer-addons route updated with `deletedAt` filter and `canceledAt` field name
- [ ] Admin frontend types and components use `'canceled'` status value (types.ts lines 60+68, purchased-columns.tsx lines 87-88+179, PurchasedAddonDetailsDialog.tsx line 33, addons.tsx lines 46+261+262)
- [ ] i18n keys renamed in all 3 locales: `addons.purchasedStatuses.cancelled` → `canceled` AND `addons.statusCancelled` → `statusCanceled`
- [ ] Public-facing addon cancel route (`routes/billing/addons.ts:315`) includes `isNull(deletedAt)` in ownership check
- [ ] `CustomerAddonResponseSchema` and `ADDON_PURCHASE_STATUSES` use American spelling
- [ ] Spec status updated from `draft` to `completed` when all tasks pass quality gate
