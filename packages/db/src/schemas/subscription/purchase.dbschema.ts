import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { integer, jsonb, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pricingPlans } from '../catalog/pricingPlan.dbschema';
import { clients } from '../client/client.dbschema';
import { PriceCurrencyPgEnum, PurchaseStatusPgEnum } from '../enums.dbschema';
import { payments } from '../payment/payment.dbschema';
import { discountCodes } from '../promotion/discountCode.dbschema';
import { users } from '../user/user.dbschema';
import { subscriptionItems } from './subscriptionItem.dbschema';

export const purchases = pgTable('purchases', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relations
    clientId: uuid('client_id')
        .notNull()
        .references(() => clients.id, { onDelete: 'cascade' }),
    pricingPlanId: uuid('pricing_plan_id')
        .notNull()
        .references(() => pricingPlans.id, { onDelete: 'restrict' }),

    // Billing information
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull().$type<number>(),
    currency: PriceCurrencyPgEnum('currency').notNull(),

    // Purchase status
    status: PurchaseStatusPgEnum('status').notNull(),

    // Quantity
    quantity: integer('quantity').notNull().default(1),

    // Optional relations
    paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    discountCodeId: uuid('discount_code_id').references(() => discountCodes.id, {
        onDelete: 'set null'
    }),

    // Purchase timestamp
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' }),

    // Admin metadata
    adminInfo: jsonb('admin_info').$type<AdminInfoType>()
});

export const purchaseRelations = relations(purchases, ({ one, many }) => ({
    // Parent relations
    client: one(clients, {
        fields: [purchases.clientId],
        references: [clients.id]
    }),
    pricingPlan: one(pricingPlans, {
        fields: [purchases.pricingPlanId],
        references: [pricingPlans.id]
    }),
    payment: one(payments, {
        fields: [purchases.paymentId],
        references: [payments.id],
        relationName: 'purchase_payment'
    }),
    discountCode: one(discountCodes, {
        fields: [purchases.discountCodeId],
        references: [discountCodes.id],
        relationName: 'purchase_discount_code'
    }),

    // Child relations
    subscriptionItems: many(subscriptionItems, {
        relationName: 'subscription_items_from_purchase'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [purchases.createdById],
        references: [users.id],
        relationName: 'purchase_created_by'
    }),
    updatedBy: one(users, {
        fields: [purchases.updatedById],
        references: [users.id],
        relationName: 'purchase_updated_by'
    }),
    deletedBy: one(users, {
        fields: [purchases.deletedById],
        references: [users.id],
        relationName: 'purchase_deleted_by'
    })
}));
