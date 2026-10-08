import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { subscriptions } from './subscription.dbschema.ts';

export const MANUAL_PAYMENT_STATUSES = ['AWAITING', 'REGISTERED', 'DECLARED_UNPAID'] as const;

/** Manual payment for a period; MP6 may create another row for the same period. */
export const manualPayments = pgTable(
    'manual_payment',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** suscripción */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** período (fecha de inicio) */
        periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
        /** estado */
        status: varchar('status', { length: 16 }).notNull(),
        /** quién lo registró */
        registeredBy: uuid('registered_by').references(() => users.id),
        /** cuándo */
        registeredAt: timestamp('registered_at', { withTimezone: true }),
        /** comprobante */
        proofRef: text('proof_ref'),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        statusCheck: check(
            'ck_manual_payment_status',
            sql`${t.status} IN (${quotedList(MANUAL_PAYMENT_STATUSES)})`
        ),
        registrationCheck: check(
            'ck_manual_payment_registration',
            sql`(${t.status} = 'REGISTERED') = (${t.registeredBy} IS NOT NULL AND ${t.registeredAt} IS NOT NULL)`
        ),
        proofCheck: check(
            'ck_manual_payment_proof',
            sql`${t.proofRef} IS NULL OR ${t.status} = 'REGISTERED'`
        )
    })
);
