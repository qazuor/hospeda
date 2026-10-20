import { sql } from 'drizzle-orm';
import {
    check,
    foreignKey,
    index,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { manualPayments } from './manual-payment.dbschema.ts';
import { payments } from './payment.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { subscriptions } from './subscription.dbschema.ts';

/**
 * Acts that turn off the `S19` flag, one per row of the succession table
 * (B7.md, AC:B7:16; `12` §5.3): `REEVALUATED` (branch 2, `S3` re-evaluates through
 * `S5`/`S7`), `SUCCESSION_CLOSED` (branches 1, 5 and 6, `S18`), `PERSON_RESOLVED`
 * (branch 3 and mark 4), `PERMANENT_GRANT` (branch 4, `S13`) and
 * `REVOCATION_REFUNDED` (branch 6 through `S36`, its `RF1`).
 */
export const SUCCESSION_RETAINED_PAYMENT_RELEASE_REASONS = [
    'REEVALUATED',
    'SUCCESSION_CLOSED',
    'PERSON_RESOLVED',
    'PERMANENT_GRANT',
    'REVOCATION_REFUNDED'
] as const;

/**
 * Payment of the unpaid period retained by `S19` over the predecessor of a live
 * succession (B7.md, AC:B7:16; `04-catalogos.md`, TRANS:B:S19). The spec says the
 * payment "is recorded and left pending" without naming where; HOS-1561 note H1
 * (option A) places "the flag" here. A row is open while `released_at` is null; a
 * payment has at most one open retention, so recording it is idempotent. The
 * polymorphic payment mirrors `reconciliation_mark_payment`: exactly one of the
 * provider payment or the manual payment (Phase 4).
 */
export const successionRetainedPayments = pgTable(
    'succession_retained_payment',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** predecesora que retiene el pago */
        subscriptionId: uuid('subscription_id').notNull(),
        /** pago automático */
        paymentId: uuid('payment_id'),
        /** pago manual */
        manualPaymentId: uuid('manual_payment_id'),
        /** ancla del período impago al retener */
        unpaidSince: timestamp('unpaid_since', { withTimezone: true }).notNull(),
        /** cuándo se retuvo */
        retainedAt: timestamp('retained_at', { withTimezone: true }).notNull().defaultNow(),
        /** cuándo se apagó la bandera */
        releasedAt: timestamp('released_at', { withTimezone: true }),
        /** el acto que la apagó */
        releaseReason: varchar('release_reason', { length: 32 }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        onePayment: check(
            'ck_succession_retained_payment_one_payment',
            sql`(${t.paymentId} IS NOT NULL) <> (${t.manualPaymentId} IS NOT NULL)`
        ),
        release: check(
            'ck_succession_retained_payment_release',
            sql`(${t.releasedAt} IS NULL) = (${t.releaseReason} IS NULL)`
        ),
        releaseReasonValues: check(
            'ck_succession_retained_payment_release_reason',
            sql`${t.releaseReason} IN (${quotedList(SUCCESSION_RETAINED_PAYMENT_RELEASE_REASONS)})`
        ),
        subscriptionFk: foreignKey({
            name: 'fk_succession_retained_payment_subscription',
            columns: [t.subscriptionId],
            foreignColumns: [subscriptions.id]
        }),
        paymentFk: foreignKey({
            name: 'fk_succession_retained_payment_payment',
            columns: [t.paymentId],
            foreignColumns: [payments.id]
        }),
        manualPaymentFk: foreignKey({
            name: 'fk_succession_retained_payment_manual_payment',
            columns: [t.manualPaymentId],
            foreignColumns: [manualPayments.id]
        }),
        openPayment: uniqueIndex('uq_succession_retained_payment_open_payment')
            .on(t.paymentId)
            .where(sql`${t.releasedAt} IS NULL`),
        openManualPayment: uniqueIndex('uq_succession_retained_payment_open_manual_payment')
            .on(t.manualPaymentId)
            .where(sql`${t.releasedAt} IS NULL`),
        openSubscription: index('idx_succession_retained_payment_open_subscription')
            .on(t.subscriptionId)
            .where(sql`${t.releasedAt} IS NULL`)
    })
);

/** Insert shape for a succession retained payment. */
export type InsertSuccessionRetainedPayment = typeof successionRetainedPayments.$inferInsert;
/** Select shape for a succession retained payment. */
export type SelectSuccessionRetainedPayment = typeof successionRetainedPayments.$inferSelect;
