import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { pricingPlans } from '../catalog/pricingPlan.dbschema.js';
import {
    LifecycleStatusPgEnum,
    PaymentMethodPgEnum,
    PaymentStatusPgEnum,
    PaymentTypePgEnum,
    PriceCurrencyPgEnum
} from '../enums.dbschema.js';
import { users } from '../user/user.dbschema.js';
import { invoices } from './invoice.dbschema.js';

export const payments = pgTable('payments', {
    id: uuid('id').primaryKey().defaultRandom(),

    // Core relationships
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),

    paymentPlanId: uuid('payment_plan_id').references(() => pricingPlans.id, {
        onDelete: 'set null'
    }),

    invoiceId: uuid('invoice_id').references(() => invoices.id, {
        onDelete: 'set null'
    }),

    // Payment type and status
    type: PaymentTypePgEnum('type').notNull(),
    status: PaymentStatusPgEnum('status').notNull(),
    paymentMethod: PaymentMethodPgEnum('payment_method'),

    // Amount information
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull().$type<number>(),
    currency: PriceCurrencyPgEnum('currency').notNull(),

    // Mercado Pago integration
    mercadoPagoPaymentId: text('mercado_pago_payment_id'),
    mercadoPagoPreferenceId: text('mercado_pago_preference_id'),

    // External reference and description
    externalReference: text('external_reference'),
    description: text('description'),

    // Metadata and additional info
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    // Important dates
    processedAt: timestamp('processed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Failure handling
    failureReason: text('failure_reason'),

    // Raw Mercado Pago response
    mercadoPagoResponse: jsonb('mercado_pago_response').$type<Record<string, unknown>>(),

    // Lifecycle fields
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
    isActive: boolean('is_active').notNull().default(true),
    isDeleted: boolean('is_deleted').notNull().default(false),

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

export const paymentRelations = relations(payments, ({ one }) => ({
    // User relationship
    user: one(users, {
        fields: [payments.userId],
        references: [users.id],
        relationName: 'payment_user'
    }),

    // Pricing plan relationship
    pricingPlan: one(pricingPlans, {
        fields: [payments.paymentPlanId],
        references: [pricingPlans.id],
        relationName: 'payment_pricing_plan'
    }),

    // Invoice relationship
    invoice: one(invoices, {
        fields: [payments.invoiceId],
        references: [invoices.id],
        relationName: 'payment_invoice'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [payments.createdById],
        references: [users.id],
        relationName: 'payment_created_by'
    }),
    updatedBy: one(users, {
        fields: [payments.updatedById],
        references: [users.id],
        relationName: 'payment_updated_by'
    }),
    deletedBy: one(users, {
        fields: [payments.deletedById],
        references: [users.id],
        relationName: 'payment_deleted_by'
    })
}));
