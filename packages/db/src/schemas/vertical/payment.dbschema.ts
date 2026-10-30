import { sql } from 'drizzle-orm';
import { check, integer, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { addonInstances } from './addon-product.dbschema.ts';
import { quotedList } from './quoted-list.ts';
import { subscriptions } from './subscription.dbschema.ts';

export const PAYMENT_STATUSES = [
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'CHARGED_BACK'
] as const;

/** Provider payment fact for a subscription or one-time addon (B5.md, AC:B5:32). */
export const payments = pgTable(
    'payment',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** suscripción */
        subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
        /** instancia de addon */
        addonInstanceId: uuid('addon_instance_id').references(() => addonInstances.id),
        /** monto en unidad mínima */
        amount: integer('amount').notNull(),
        /** moneda */
        currency: varchar('currency', { length: 3 }).notNull(),
        /** estado */
        status: varchar('status', { length: 32 }).notNull(),
        /** proveedor */
        provider: varchar('provider', { length: 32 }).notNull(),
        /** id del hecho en el proveedor */
        providerFactId: varchar('provider_fact_id', { length: 255 }).notNull(),
        /** id del pago embebido */
        providerPaymentId: varchar('provider_payment_id', { length: 255 }),
        /** fecha del hecho */
        factAt: timestamp('fact_at', { withTimezone: true }).notNull(),
        /** monto reembolsado acumulado */
        refundedAmount: integer('refunded_amount').notNull().default(0),
        /** versión optimista */
        version: integer('version').notNull().default(1),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        oneSubject: check(
            'ck_payment_one_subject',
            sql`(${t.subscriptionId} IS NOT NULL) <> (${t.addonInstanceId} IS NOT NULL)`
        ),
        amountNonnegative: check('ck_payment_amount_nonnegative', sql`${t.amount} >= 0`),
        status: check('ck_payment_status', sql`${t.status} IN (${quotedList(PAYMENT_STATUSES)})`),
        refundedAmount: check(
            'ck_payment_refunded_amount',
            sql`${t.refundedAmount} >= 0 AND ${t.refundedAmount} <= ${t.amount}`
        ),
        version: check('ck_payment_version', sql`${t.version} >= 1`),
        providerFact: unique('uq_payment_provider_fact').on(t.provider, t.providerFactId)
    })
);

/** Insert shape for a payment. */
export type InsertPayment = typeof payments.$inferInsert;
/** Select shape for a payment. */
export type SelectPayment = typeof payments.$inferSelect;
