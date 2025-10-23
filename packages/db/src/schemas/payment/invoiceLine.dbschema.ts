import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { decimal, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pricingPlans } from '../catalog/pricingPlan.dbschema.js';
import { subscriptionItems } from '../subscription/subscriptionItem.dbschema.js';
import { users } from '../user/user.dbschema.js';
import { invoices } from './invoice.dbschema.js';

export const invoiceLines = pgTable('invoice_lines', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Invoice relationship (required)
    invoiceId: uuid('invoice_id')
        .references(() => invoices.id, { onDelete: 'cascade' })
        .notNull(),

    // Pricing plan relationship (optional - may be null for custom items)
    pricingPlanId: uuid('pricing_plan_id').references(() => pricingPlans.id, {
        onDelete: 'restrict'
    }),

    // Subscription item relationship (optional - links to what this line is billing for)
    subscriptionItemId: uuid('subscription_item_id').references(() => subscriptionItems.id, {
        onDelete: 'restrict'
    }),

    // Line item details
    description: text('description').notNull(),
    quantity: integer('quantity').notNull().default(1),

    // Line-level pricing
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
    lineAmount: decimal('line_amount', { precision: 10, scale: 2 }).notNull(),

    // Tax information
    taxRate: decimal('tax_rate', { precision: 5, scale: 4 }).default('0.0000'),
    taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }).notNull().default('0.00'),

    // Discount information
    discountRate: decimal('discount_rate', { precision: 5, scale: 4 }).default('0.0000'),
    discountAmount: decimal('discount_amount', { precision: 10, scale: 2 })
        .notNull()
        .default('0.00'),

    // Total line amount after tax and discount
    totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),

    // Billing period (for subscription items)
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),

    // Line metadata
    metadata: jsonb('metadata'),

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

export const invoiceLineRelations = relations(invoiceLines, ({ one }) => ({
    // Invoice relationship
    invoice: one(invoices, {
        fields: [invoiceLines.invoiceId],
        references: [invoices.id]
    }),

    // Pricing plan relationship
    pricingPlan: one(pricingPlans, {
        fields: [invoiceLines.pricingPlanId],
        references: [pricingPlans.id]
    }),

    // Subscription item relationship
    subscriptionItem: one(subscriptionItems, {
        fields: [invoiceLines.subscriptionItemId],
        references: [subscriptionItems.id]
    }),

    // User relationships for audit
    createdBy: one(users, {
        fields: [invoiceLines.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [invoiceLines.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [invoiceLines.deletedById],
        references: [users.id]
    })
}));
