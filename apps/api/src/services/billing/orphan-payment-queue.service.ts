/**
 * Orphan payment queue — the policy for a confirmed payment Hospeda cannot
 * apply (HOS-714).
 *
 * ## The rule
 *
 * MercadoPago tells us a charge cleared. We go to apply it and cannot: the
 * subscription is in a status the flow does not accept, or the local
 * subscription the payment names does not exist at all. The customer's money
 * moved; the entitlement did not.
 *
 * Before HOS-714 every such path improvised the same non-answer — a `warn`
 * saying `'payment ignored'`, `confirmed: false`, and nothing else. No refund,
 * no retry, no alert, no record. The customer sees a charge and no plan.
 *
 * The owner's decision (20/08/2026) is a single policy for all of them:
 *
 * > **Register it, alert on it, let a human resolve it.**
 *
 * Not auto-refunded (a refund can hand back money that was legitimately owed,
 * and the refund path only just had a severe defect fixed in HOS-704). Not
 * applied anyway (widening the accepted statuses first requires verifying what
 * MercadoPago does to a past-due preapproval on a plan change — an open
 * question, not a decision). Queued, so nothing is lost and a person decides.
 *
 * ## What callers get
 *
 * {@link recordOrphanPayment} never throws and never rejects. A confirmation
 * flow calls it on its way out of a discard branch; whatever happens inside,
 * the webhook keeps its original disposition. If the queue write itself fails,
 * the full payload is logged at `error` with `capture: true`, so the payment
 * survives in the logs and in Sentry even when the table does not receive it.
 *
 * @module services/billing/orphan-payment-queue
 */

import { type Major, toCentavos } from '@repo/billing';
import { billingOrphanPayments, getDb } from '@repo/db';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';

/**
 * Which confirmation flow could not apply the payment.
 *
 * Stored verbatim in `billing_orphan_payments.flow` so a human triaging the
 * queue knows which code path produced the row.
 */
export type OrphanPaymentFlow =
    /** Prorated delta paid upfront to move to a more expensive plan (SPEC-141 D7). */
    | 'plan-change-upgrade'
    /** Annual subscription paid upfront (SPEC-141 D1). */
    | 'annual-upfront';

/**
 * Why the payment could not be applied.
 *
 * Stored verbatim in `billing_orphan_payments.reason`. Kept coarse on purpose:
 * the precise status that blocked the flow travels in `observedStatus`, so a
 * new blocking status does not need a new reason code.
 */
export type OrphanPaymentReason =
    /** The subscription the payment names has no local row. */
    | 'subscription-not-found'
    /** A local row exists, but its status is not one the flow can act on. */
    | 'subscription-status-not-applicable';

/** Input for {@link recordOrphanPayment}. */
export interface RecordOrphanPaymentInput {
    /** The provider's own payment id (MercadoPago `payment.id`). */
    readonly providerPaymentId: string;
    /** Which confirmation flow hit the discard branch. */
    readonly flow: OrphanPaymentFlow;
    /** Why it could not apply the payment. */
    readonly reason: OrphanPaymentReason;
    /**
     * Charged amount in MAJOR units (pesos), as the webhook payload reports it.
     *
     * HOS-720 — `Major` rather than `number`, because this service converts it
     * to centavos for the queue row. Every caller is a confirmation flow whose
     * own `amount` originates in a qzpay adapter response measured in CENTAVOS,
     * which is precisely the crossing HOS-713 got wrong one hop upstream.
     */
    readonly amountMajor: Major;
    /** ISO-4217 currency of the charge. */
    readonly currency: string;
    /** Local subscription id the payment named. `null` when unknown. */
    readonly subscriptionId?: string | null;
    /** Local billing customer id, when the subscription row was found. */
    readonly customerId?: string | null;
    /** The local status that made the payment inapplicable, when there was a row. */
    readonly observedStatus?: string | null;
    /** Caller label of whatever observed the orphan (`webhook`, a cron job, …). */
    readonly source: string;
    /** Flow-specific context (plan ids, metadata echoes) for the human triaging it. */
    readonly metadata?: Record<string, unknown>;
    /** Payment provider. Defaults to `mercadopago`. */
    readonly provider?: string;
}

/** Outcome of a {@link recordOrphanPayment} call. */
export interface RecordOrphanPaymentResult {
    /** True when THIS call created the queue row (first sighting of this payment). */
    readonly queued: boolean;
    /**
     * True when a row for this `(provider, providerPaymentId)` already existed —
     * a provider redelivery of an orphan already on the queue. Routine, not a
     * new incident.
     */
    readonly alreadyQueued: boolean;
    /**
     * True when the queue write itself failed. The payment was NOT persisted to
     * the table; it survives only in the logs and in Sentry.
     */
    readonly failed: boolean;
}

/**
 * The row values a queue entry is built from, split out from the write so the
 * mapping (major units → centavos, defaults, metadata shape) is testable
 * without a database.
 *
 * @param input - The orphan payment description.
 * @returns The exact object handed to the insert.
 */
export function buildOrphanPaymentRow(input: RecordOrphanPaymentInput): {
    readonly provider: string;
    readonly providerPaymentId: string;
    readonly flow: OrphanPaymentFlow;
    readonly reason: OrphanPaymentReason;
    readonly subscriptionId: string | null;
    readonly customerId: string | null;
    readonly amount: number;
    readonly currency: string;
    readonly observedStatus: string | null;
    readonly source: string;
    readonly status: 'unresolved';
    readonly livemode: boolean;
    readonly metadata: Record<string, unknown>;
} {
    return {
        provider: input.provider ?? 'mercadopago',
        providerPaymentId: input.providerPaymentId,
        flow: input.flow,
        reason: input.reason,
        subscriptionId: input.subscriptionId ?? null,
        customerId: input.customerId ?? null,
        // Money is stored as integer centavos per repo policy; the webhook
        // payload reports major units. `toCentavos` is the one named crossing
        // (HOS-720), the same one every sibling `billing.payments.record()`
        // call in these flows now performs.
        amount: toCentavos(input.amountMajor),
        currency: input.currency,
        observedStatus: input.observedStatus ?? null,
        source: input.source,
        status: 'unresolved',
        // HOS-708 / HOS-719: derived from the environment on every write, never
        // hard-coded. Sandbox mode means every persisted row is non-live. This
        // is the single derivation site for the queue, and it matters more here
        // than anywhere else: a human triaging this table has to be able to tell
        // a genuine stranded charge from a staging test at a glance.
        livemode: !env.HOSPEDA_MERCADO_PAGO_SANDBOX,
        metadata: input.metadata ?? {}
    };
}

/**
 * Queue a confirmed-but-inapplicable payment for manual resolution, and alert.
 *
 * Idempotent: the table is UNIQUE on `(provider, provider_payment_id)` and the
 * insert uses `onConflictDoNothing()`, so MercadoPago's redeliveries of the
 * same charge neither duplicate the row nor re-fire the incident alert.
 *
 * Never throws — a failure to record is itself logged at `error` with
 * `capture: true`, carrying the whole payload so the payment is recoverable
 * from the logs.
 *
 * @param input - The orphan payment description.
 * @returns Whether the row was created, already present, or failed to write.
 */
export async function recordOrphanPayment(
    input: RecordOrphanPaymentInput
): Promise<RecordOrphanPaymentResult> {
    const row = buildOrphanPaymentRow(input);

    try {
        const inserted = await getDb()
            .insert(billingOrphanPayments)
            .values(row)
            .onConflictDoNothing({
                target: [billingOrphanPayments.provider, billingOrphanPayments.providerPaymentId]
            })
            .returning({ id: billingOrphanPayments.id });

        const alreadyQueued = inserted.length === 0;

        if (alreadyQueued) {
            // A provider redelivery of a charge already on the queue. The
            // incident was raised on the first sighting; raising it again on
            // every retry would bury the real ones.
            apiLogger.info(
                {
                    providerPaymentId: row.providerPaymentId,
                    flow: row.flow,
                    reason: row.reason,
                    source: row.source
                },
                'Orphan payment already queued for manual resolution — idempotent skip'
            );
            return { queued: false, alreadyQueued: true, failed: false };
        }

        // `error` + `capture: true`, NOT `warn` (HOS-714 point 3): a charge the
        // platform took and could not honour is an incident, not routine noise.
        apiLogger.error(
            {
                orphanPaymentId: inserted[0]?.id,
                providerPaymentId: row.providerPaymentId,
                flow: row.flow,
                reason: row.reason,
                subscriptionId: row.subscriptionId,
                customerId: row.customerId,
                amount: row.amount,
                currency: row.currency,
                observedStatus: row.observedStatus,
                source: row.source,
                livemode: row.livemode
            },
            'Confirmed payment could not be applied — queued for manual resolution',
            { capture: true }
        );

        return { queued: true, alreadyQueued: false, failed: false };
    } catch (error) {
        // The queue is the last line of defence; if it fails, the payload must
        // still reach a human. Log everything and swallow — the caller's
        // webhook disposition must not change because bookkeeping broke.
        apiLogger.error(
            {
                providerPaymentId: row.providerPaymentId,
                flow: row.flow,
                reason: row.reason,
                subscriptionId: row.subscriptionId,
                customerId: row.customerId,
                amount: row.amount,
                currency: row.currency,
                observedStatus: row.observedStatus,
                source: row.source,
                livemode: row.livemode,
                metadata: row.metadata,
                error: error instanceof Error ? error.message : String(error)
            },
            'Confirmed payment could not be applied AND the orphan-payment queue write failed — payment recorded only in this log',
            { capture: true }
        );
        return { queued: false, alreadyQueued: false, failed: true };
    }
}
