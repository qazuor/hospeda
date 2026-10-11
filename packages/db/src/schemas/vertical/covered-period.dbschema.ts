import { sql } from 'drizzle-orm';
import { check, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { manualPayments } from './manual-payment.dbschema.ts';
import { payments } from './payment.dbschema.ts';
import { subscriptions } from './subscription.dbschema.ts';

/** Subscription period covered by exactly one credited payment (B5.md, AC:B5:32). */
export const coveredPeriods = pgTable(
    'covered_period',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** suscripción */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** inicio del período */
        periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
        /** pago automático */
        paymentId: uuid('payment_id').references(() => payments.id),
        /** pago manual */
        manualPaymentId: uuid('manual_payment_id').references(() => manualPayments.id),
        /** cuándo se acreditó */
        creditedAt: timestamp('credited_at', { withTimezone: true }).notNull(),
        /** cuándo se liberó */
        releasedAt: timestamp('released_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        onePayment: check(
            'ck_covered_period_one_payment',
            sql`(${t.paymentId} IS NOT NULL) <> (${t.manualPaymentId} IS NOT NULL)`
        ),
        openPeriod: uniqueIndex('uq_covered_period_open_subscription_period')
            .on(t.subscriptionId, t.periodStart)
            .where(sql`${t.releasedAt} IS NULL`)
    })
);

/** Insert shape for a covered period. */
export type InsertCoveredPeriod = typeof coveredPeriods.$inferInsert;
/** Select shape for a covered period. */
export type SelectCoveredPeriod = typeof coveredPeriods.$inferSelect;
