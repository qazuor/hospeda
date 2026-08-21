import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';

/**
 * Orphan payment queue (HOS-714).
 *
 * A row here means: **MercadoPago confirmed a charge that Hospeda could not
 * apply**. The customer's money moved, the entitlement did not.
 *
 * Before HOS-714 those payments were dropped on the floor with a `warn`
 * (`'… — payment ignored'`) and nothing else: no refund, no retry, no alert,
 * no record. The owner's decision (20/08/2026) is that such a payment is
 * neither discarded nor auto-refunded — it is **queued here with its reason
 * and alerted on**, and a human decides the outcome (grant the plan, refund,
 * or dismiss).
 *
 * Why not auto-refund: a refund can give back money that was legitimately
 * owed, and the refund path itself only just had a severe defect fixed
 * (HOS-704). Why not apply it anyway: widening the accepted statuses requires
 * first verifying what MercadoPago does to a past-due preapproval on a plan
 * change — an open question, not a decision.
 *
 * ## Deliberately NOT foreign-keyed
 *
 * `subscriptionId` / `customerId` are plain uuids with no `references()`.
 * One of the queued reasons is literally
 * `subscription-not-found` — the subscription id came from the payment's
 * metadata and has no matching local row. A FK would make the very case this
 * table exists to capture un-insertable.
 *
 * ## Idempotency
 *
 * `orphanPayments_provider_payment_idx` is UNIQUE on
 * `(provider, provider_payment_id)`. MercadoPago redelivers `payment.updated`
 * for the same charge repeatedly; the writer inserts with
 * `onConflictDoNothing()` so a redelivery neither duplicates the row nor
 * re-fires the incident alert.
 */
export const billingOrphanPayments = pgTable(
    'billing_orphan_payments',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** Payment provider that confirmed the charge. */
        provider: varchar('provider', { length: 50 }).notNull().default('mercadopago'),

        /** The provider's own payment id (MercadoPago `payment.id`). */
        providerPaymentId: varchar('provider_payment_id', { length: 255 }).notNull(),

        /**
         * Which confirmation flow could not apply the payment.
         * See `OrphanPaymentFlow` in the API's orphan-payment-queue service.
         */
        flow: varchar('flow', { length: 64 }).notNull(),

        /**
         * Why it could not be applied.
         * See `OrphanPaymentReason` in the API's orphan-payment-queue service.
         */
        reason: varchar('reason', { length: 64 }).notNull(),

        /** Local subscription the payment was meant for. No FK — it may not exist. */
        subscriptionId: uuid('subscription_id'),

        /** Local billing customer, when the subscription row was found. No FK — see above. */
        customerId: uuid('customer_id'),

        /** Charged amount in centavos (integer money, per repo policy). */
        amount: integer('amount').notNull(),

        /** ISO-4217 currency of the charge. */
        currency: varchar('currency', { length: 3 }).notNull(),

        /**
         * `false` when the charge came from the MercadoPago sandbox.
         *
         * ALWAYS derived from `HOSPEDA_MERCADO_PAGO_SANDBOX`, never hard-coded
         * (HOS-708 / HOS-719 — the one rule with no exception to remember: every
         * write to a `livemode` column derives it from the environment).
         *
         * Load-bearing for THIS table specifically: the queue exists so a human
         * can look at a stranded payment and decide what to do about it, and the
         * first thing that decision needs is whether real money moved. Without
         * this column a sandbox test and a genuine stranded charge are the same
         * row. Note there is no `DEFAULT` here on purpose — a caller that
         * forgets it fails loudly instead of silently claiming production.
         */
        livemode: boolean('livemode').notNull(),

        /**
         * The local subscription status observed at discard time — the value
         * that made the payment inapplicable. `null` when no local row existed.
         */
        observedStatus: varchar('observed_status', { length: 50 }),

        /** Caller label of whatever observed the orphan (`webhook`, a cron job, …). */
        source: varchar('source', { length: 64 }).notNull(),

        /** `unresolved` | `resolved` | `dismissed`. */
        status: varchar('status', { length: 32 }).notNull().default('unresolved'),

        /** What the human did about it, filled in on resolution. */
        resolutionNote: text('resolution_note'),

        /** Who resolved it. No FK: resolution may be recorded by an ops script. */
        resolvedById: uuid('resolved_by_id'),

        resolvedAt: timestamp('resolved_at', { withTimezone: true }),

        /** Flow-specific context (plan ids, metadata echoes) for the human triaging it. */
        metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),

        detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        orphanPayments_provider_payment_idx: uniqueIndex('orphanPayments_provider_payment_idx').on(
            table.provider,
            table.providerPaymentId
        ),
        orphanPayments_status_idx: index('orphanPayments_status_idx').on(table.status),
        orphanPayments_subscriptionId_idx: index('orphanPayments_subscriptionId_idx').on(
            table.subscriptionId
        ),
        orphanPayments_customerId_idx: index('orphanPayments_customerId_idx').on(table.customerId),
        orphanPayments_detectedAt_idx: index('orphanPayments_detectedAt_idx').on(table.detectedAt)
    })
);
