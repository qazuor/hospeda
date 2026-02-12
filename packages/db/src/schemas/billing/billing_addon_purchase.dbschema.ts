import { relations, sql } from 'drizzle-orm';
import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
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
        addonId: uuid('addon_id').references(() => billingAddons.id, { onDelete: 'restrict' }),
        status: varchar('status', { length: 50 }).notNull().default('pending'),
        purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
        paymentId: varchar('payment_id', { length: 255 }),
        limitAdjustments: jsonb('limit_adjustments').$type<LimitAdjustment[]>().default([]),
        entitlementAdjustments: jsonb('entitlement_adjustments')
            .$type<EntitlementAdjustment[]>()
            .default([]),
        metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
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
            .where(sql`status = 'active'`)
    })
);

/**
 * Relations for billing_addon_purchases
 */
export const billingAddonPurchasesRelations = relations(billingAddonPurchases, ({ one }) => ({
    customer: one(billingCustomers, {
        fields: [billingAddonPurchases.customerId],
        references: [billingCustomers.id]
    })
}));
