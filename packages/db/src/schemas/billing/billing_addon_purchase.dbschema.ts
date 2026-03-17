import { relations, sql } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { billingAddons, billingCustomers, billingSubscriptions } from '../../billing/index.ts';

/**
 * Limit adjustments stored as JSONB
 */
export interface LimitAdjustment {
    limitKey: string;
    increase: number;
    previousValue: number;
    newValue: number;
}

/**
 * Entitlement adjustments stored as JSONB
 */
export interface EntitlementAdjustment {
    entitlementKey: string;
    granted: boolean;
}

/**
 * Billing add-on purchases table
 * Tracks customer purchases of add-ons with limit/entitlement adjustments
 */
export const billingAddonPurchases = pgTable(
    'billing_addon_purchases',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'restrict' }),
        subscriptionId: uuid('subscription_id').references(() => billingSubscriptions.id, {
            onDelete: 'set null'
        }),
        addonSlug: varchar('addon_slug', { length: 100 }).notNull(),
        addonId: uuid('addon_id').references(() => billingAddons.id, { onDelete: 'set null' }),
        /**
         * Purchase lifecycle status.
         *
         * Valid values: `active` | `expired` | `canceled` | `pending`
         *
         * A CHECK constraint enforcing this set is applied at the database level via migration
         * `0025_addon_purchases_status_check.sql`. Drizzle cannot express this constraint
         * declaratively because `.check()` with an IN-list would regenerate on every schema push.
         * Run `packages/db/scripts/apply-postgres-extras.sh` after any schema push to ensure the
         * constraint is present.
         */
        status: varchar('status', { length: 50 }).notNull().default('pending'),
        purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        canceledAt: timestamp('canceled_at', { withTimezone: true }),
        paymentId: varchar('payment_id', { length: 255 }),
        /**
         * Array of limit adjustments applied by this add-on purchase.
         *
         * Must be a JSON array (or NULL). A CHECK constraint `chk_limit_adjustments_type`
         * enforcing `jsonb_typeof(limit_adjustments) = 'array'` is applied via migration
         * `0026_addon_purchases_jsonb_check.sql`. Drizzle cannot express this constraint because
         * `.check()` does not support PostgreSQL function calls like `jsonb_typeof()`.
         * Run `packages/db/scripts/apply-postgres-extras.sh` after any schema push.
         */
        limitAdjustments: jsonb('limit_adjustments').$type<LimitAdjustment[]>().default([]),
        /**
         * Array of entitlement adjustments applied by this add-on purchase.
         *
         * Must be a JSON array (or NULL). A CHECK constraint `chk_entitlement_adjustments_type`
         * enforcing `jsonb_typeof(entitlement_adjustments) = 'array'` is applied via migration
         * `0026_addon_purchases_jsonb_check.sql`. Drizzle cannot express this constraint because
         * `.check()` does not support PostgreSQL function calls like `jsonb_typeof()`.
         * Run `packages/db/scripts/apply-postgres-extras.sh` after any schema push.
         */
        entitlementAdjustments: jsonb('entitlement_adjustments')
            .$type<EntitlementAdjustment[]>()
            .default([]),
        metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        addonPurchases_customerId_idx: index('addonPurchases_customerId_idx').on(table.customerId),
        addonPurchases_addonSlug_idx: index('addonPurchases_addonSlug_idx').on(table.addonSlug),
        addonPurchases_status_idx: index('addonPurchases_status_idx').on(table.status),
        addonPurchases_expiresAt_idx: index('addonPurchases_expiresAt_idx').on(table.expiresAt),
        addonPurchases_customer_status_idx: index('addonPurchases_customer_status_idx').on(
            table.customerId,
            table.status
        ),
        addonPurchases_customer_addon_idx: index('addonPurchases_customer_addon_idx').on(
            table.customerId,
            table.addonSlug
        ),
        addonPurchases_active_customer_idx: index('addonPurchases_active_customer_idx')
            .on(table.customerId)
            .where(sql`status = 'active' AND deleted_at IS NULL`),
        addonPurchasesActiveUnique: uniqueIndex('idx_addon_purchases_active_unique')
            .on(table.customerId, table.addonSlug)
            .where(sql`status = 'active' AND deleted_at IS NULL`),
        addonPurchases_entitlement_idx: index('addonPurchases_entitlement_idx').on(
            table.customerId,
            table.status,
            table.expiresAt
        ),
        addonPurchases_subscription_active_idx: index('idx_addon_purchases_subscription_active')
            .on(table.subscriptionId)
            .where(sql`status = 'active' AND deleted_at IS NULL`)
    })
);

/**
 * Relations for billing_addon_purchases
 */
export const billingAddonPurchasesRelations = relations(billingAddonPurchases, ({ one }) => ({
    customer: one(billingCustomers, {
        fields: [billingAddonPurchases.customerId],
        references: [billingCustomers.id]
    }),
    subscription: one(billingSubscriptions, {
        fields: [billingAddonPurchases.subscriptionId],
        references: [billingSubscriptions.id]
    }),
    addon: one(billingAddons, {
        fields: [billingAddonPurchases.addonId],
        references: [billingAddons.id]
    })
}));
