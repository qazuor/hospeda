import { sql } from 'drizzle-orm';
import {
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { billingCustomers, billingSubscriptions } from '../../billing/index.ts';

/**
 * Billing dunning attempts table.
 * Records each individual payment retry attempt for past-due subscriptions.
 * Used for auditing, reporting, and debugging failed payment retries.
 *
 * The dunning cron job (via QZPay's SubscriptionLifecycleService) manages
 * the retry schedule and grace period logic. This table provides a local
 * audit trail of each attempt for observability and admin reporting.
 */
export const billingDunningAttempts = pgTable(
    'billing_dunning_attempts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => billingSubscriptions.id, { onDelete: 'cascade' }),
        customerId: uuid('customer_id')
            .notNull()
            .references(() => billingCustomers.id, { onDelete: 'restrict' }),
        attemptNumber: integer('attempt_number').notNull(),
        result: varchar('result', { length: 50 }).notNull(),
        amount: integer('amount'),
        currency: varchar('currency', { length: 3 }),
        paymentId: uuid('payment_id'),
        failureCode: varchar('failure_code', { length: 100 }),
        errorMessage: text('error_message'),
        provider: varchar('provider', { length: 50 }).notNull().default('mercadopago'),
        metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
        attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        dunningAttempts_subscriptionId_idx: index('dunningAttempts_subscriptionId_idx').on(
            table.subscriptionId
        ),
        dunningAttempts_customerId_idx: index('dunningAttempts_customerId_idx').on(
            table.customerId
        ),
        dunningAttempts_result_idx: index('dunningAttempts_result_idx').on(table.result),
        dunningAttempts_subscription_attempt_idx: index(
            'dunningAttempts_subscription_attempt_idx'
        ).on(table.subscriptionId, table.attemptNumber),
        dunningAttempts_customer_result_idx: index('dunningAttempts_customer_result_idx').on(
            table.customerId,
            table.result
        ),
        dunningAttempts_recent_idx: index('dunningAttempts_recent_idx')
            .on(table.attemptedAt)
            .where(sql`result = 'failed'`)
    })
);
