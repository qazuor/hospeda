import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { subscriptions } from './subscription.dbschema.ts';

export const COURTESY_CLOSE_REASONS = [
    'VENTANA_DE_AUTORIZACION_VENCIDA',
    'GRANT_PERMANENTE_OTORGADO',
    'DESTINO_DE_PLAN_NO_MENSUAL',
    'CONTRACARGO_DE_LA_PREDECESORA'
] as const;

/** Courtesy grant covering exactly the subscription it pauses. */
export const courtesyGrants = pgTable(
    'courtesy_grant',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** beneficiario */
        beneficiaryUserId: uuid('beneficiary_user_id')
            .notNull()
            .references(() => users.id),
        /** meses */
        months: integer('months').notNull(),
        /** inicio */
        startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
        /** fin */
        endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
        /** quién lo firmó */
        grantedBy: uuid('granted_by')
            .notNull()
            .references(() => users.id),
        /** motivo */
        reason: text('reason').notNull(),
        /** la suscripción que pausa */
        subscriptionId: uuid('subscription_id')
            .notNull()
            .references(() => subscriptions.id),
        /** saldo_meses */
        balanceMonths: integer('balance_months'),
        /** saldo_cerrado_en */
        balanceClosedAt: timestamp('balance_closed_at', { withTimezone: true }),
        /** motivo_cierre */
        closeReason: varchar('close_reason', { length: 48 }),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        monthsCheck: check('ck_courtesy_grant_months', sql`${t.months} > 0`),
        balanceMonthsCheck: check(
            'ck_courtesy_grant_balance_months',
            sql`${t.balanceMonths} IS NULL OR ${t.balanceMonths} >= 0`
        ),
        closeReasonCheck: check(
            'ck_courtesy_grant_close_reason',
            sql`${t.closeReason} IN (${quotedList(COURTESY_CLOSE_REASONS)})`
        ),
        balanceCloseCheck: check(
            'ck_courtesy_grant_balance_close',
            sql`(${t.balanceClosedAt} IS NULL) = (${t.closeReason} IS NULL) AND (${t.balanceClosedAt} IS NULL OR ${t.balanceMonths} IS NOT NULL)`
        )
    })
);
