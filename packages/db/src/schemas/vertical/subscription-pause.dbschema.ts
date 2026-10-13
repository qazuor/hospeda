import { sql } from 'drizzle-orm';
import {
    check,
    integer,
    pgTable,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { quotedList } from './quoted-list.ts';
import { subscriptions } from './subscription.dbschema.ts';

/** Why a subscription is paused: the owner asked for it, or a courtesy pause (B/02 §2.2). */
export const SUBSCRIPTION_PAUSE_REASONS = ['CUSTOMER_REQUEST', 'COURTESY'] as const;

/**
 * One pause of a subscription (B/02 §2.2; AC:B4:4): its reason, the months asked for, when it
 * started, when it was expected to end and when it actually ended. At most one pause per
 * subscription has no `actual_end_at` (`uq_subscription_pause_open`). `retentionStopped` reads it;
 * this cut ships the table without a production writer (S36, S32/S33 write it later).
 */
export const subscriptionPauses = pgTable(
    'subscription_pause',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** la suscripción pausada */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** motivo */
        reason: varchar('reason', { length: 32 }).notNull(),
        /** meses pedidos (S32 abre sin meses) */
        requestedMonths: integer('requested_months'),
        /** inicio */
        startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
        /** fin previsto (S32 abre sin fin previsto) */
        expectedEndAt: timestamp('expected_end_at', { withTimezone: true }),
        /** fin real */
        actualEndAt: timestamp('actual_end_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        reasonCheck: check(
            'ck_subscription_pause_reason',
            sql`${t.reason} IN (${quotedList(SUBSCRIPTION_PAUSE_REASONS)})`
        ),
        expectedEndAfterStart: check(
            'ck_subscription_pause_expected_end',
            sql`${t.expectedEndAt} IS NULL OR ${t.expectedEndAt} >= ${t.startsAt}`
        ),
        actualEndAfterStart: check(
            'ck_subscription_pause_actual_end',
            sql`${t.actualEndAt} IS NULL OR ${t.actualEndAt} >= ${t.startsAt}`
        ),
        openPause: uniqueIndex('uq_subscription_pause_open')
            .on(t.subscriptionId)
            .where(sql`${t.actualEndAt} IS NULL`)
    })
);

/** Insert shape for a subscription pause (B/02 §2.2). */
export type InsertSubscriptionPause = typeof subscriptionPauses.$inferInsert;
/** Select shape for a subscription pause (B/02 §2.2). */
export type SelectSubscriptionPause = typeof subscriptionPauses.$inferSelect;
