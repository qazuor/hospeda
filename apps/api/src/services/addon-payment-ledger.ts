/**
 * The `billing_payments` ledger write for an add-on charge (HOS-595, moved
 * here by HOS-847 PR 5).
 *
 * Extracted verbatim from `addon.checkout.ts` — where it was a private
 * function — because a RECURRING add-on has a second charge, and a second one
 * after that, and none of them travel through the checkout module. Its own
 * JSDoc has always said this is *"deliberately NOT a second implementation"*;
 * leaving it private and writing the renewal's ledger entry next to the renewal
 * would have made it exactly that, with two dedupe queries to keep in step.
 *
 * The only behavioural additions are the two parameters the renewal path needs:
 * {@link RecordAddonPaymentInput.flow}, which distinguishes the initial purchase
 * from a renewal inside `billing_payments.metadata`, and the
 * {@link RecordAddonPaymentOutcome} return value, which tells the caller whether
 * this call INSERTED a row or found one already there. That distinction is not
 * cosmetic: it is what stops a MercadoPago redelivery from advancing a recurring
 * add-on's billing period a second time (see
 * `addon-recurring-renewal.service.ts`).
 *
 * @module services/addon-payment-ledger
 */

import { randomUUID } from 'node:crypto';
import type { QZPayBilling, QZPayCurrency, QZPayPaymentStatus } from '@qazuor/qzpay-core';
import { asCentavos, toMajor } from '@repo/billing';
import { captureBillingError } from '../lib/sentry';
import { apiLogger } from '../utils/logger';
import { recordOrphanPayment } from './billing/orphan-payment-queue.service';

/**
 * Provider key under which MercadoPago payment ids live inside the
 * `billing_payments.provider_payment_ids` jsonb map.
 *
 * Exported so the dedupe query, the sibling subscription flows and the
 * regression test all name the same key instead of re-typing the string.
 */
export const ADDON_PAYMENT_PROVIDER_KEY = 'mercadopago' as const;

/**
 * Value written to `billing_payments.metadata.flow` for a one-time add-on
 * charge, so the ledger can tell an add-on purchase apart from a subscription
 * charge (`annual-upfront`, `plan-upgrade-delta`, recurring) with one query.
 */
export const ADDON_PAYMENT_FLOW = 'addon-purchase' as const;

/**
 * Value written to `billing_payments.metadata.flow` for a charge MercadoPago
 * took against a recurring add-on's OWN preapproval (HOS-847 PR 5).
 *
 * A distinct value from {@link ADDON_PAYMENT_FLOW} on purpose: the two are the
 * same money for the same add-on but they answer different questions. A
 * `'addon-purchase'` row is a charge somebody chose to make once; an
 * `'addon-recurring'` row is a charge that will happen again next month unless
 * a preapproval is cancelled. Revenue reporting can sum them together whenever
 * it wants; nothing can split them apart after the fact if they were written
 * under one name.
 *
 * `metadata` is free-form JSONB, so this needs no schema change. Note it is
 * deliberately NOT added to `OrphanPaymentFlowSchema` — see
 * {@link ADDON_ORPHAN_QUEUE_FLOW}.
 */
export const ADDON_RECURRING_PAYMENT_FLOW = 'addon-recurring' as const;

/**
 * Flow recorded on the orphan-payment queue row when the ledger write fails.
 *
 * `'addon-purchase'` for BOTH the one-time and the recurring path, because
 * `OrphanPaymentFlow` is a closed Zod enum in `@repo/schemas` and what a
 * triaging operator needs from it is the coarse category ("an add-on charge we
 * could not book"), which both paths share. The precise flow is still on the
 * queue row's own `metadata.flow`, written below.
 */
const ADDON_ORPHAN_QUEUE_FLOW = 'addon-purchase' as const;

/** The charge to book, plus the facade to book it with. */
export interface RecordAddonPaymentInput {
    readonly billing: QZPayBilling;
    readonly customerId: string;
    /**
     * Local `billing_subscriptions` row this charge is attributed to.
     *
     * `undefined` when there is none. `billing_payments.subscription_id` is a
     * nullable FK onto `billing_subscriptions.id`, so the ONLY two legal values
     * are a real subscription id or nothing: substituting some other table's id
     * (an add-on purchase id, say) makes every insert fail with SQLSTATE 23503,
     * which this module swallows into the orphan queue — a silent, permanent
     * ledger outage for that flow.
     */
    readonly subscriptionId?: string | undefined;
    /** The `billing_addon_purchases` row the charge paid for. */
    readonly purchaseId: string;
    readonly addonSlug: string;
    /** MercadoPago payment id — the dedupe key. */
    readonly providerPaymentId: string;
    readonly amountInCents: number;
    readonly currency: string;
    /**
     * `billing_payments.metadata.flow`. Defaults to {@link ADDON_PAYMENT_FLOW}
     * so the pre-existing one-time call site keeps writing exactly what it
     * always wrote.
     */
    readonly flow?: typeof ADDON_PAYMENT_FLOW | typeof ADDON_RECURRING_PAYMENT_FLOW;
    /**
     * QZPay status to book the charge under. Defaults to `'succeeded'`, which
     * is the only status the one-time confirmation path can reach (it is only
     * called for an APPROVED payment). The recurring path passes the mapped
     * provider status, because MercadoPago also notifies rejected and refunded
     * charges against a live preapproval and the ledger has to carry them.
     */
    readonly status?: QZPayPaymentStatus;
}

/**
 * Payment statuses that are the LAST word MercadoPago will have on a charge.
 *
 * `pending` and `processing` are excluded because they are explicitly not
 * final: an issuer review (`in_process`) or a mediation resolves later into one
 * of these. Everything here is a disposition the provider does not walk back —
 * a `refunded` charge that is somehow charged again arrives as a new payment
 * id, not as an amendment of this one.
 */
const TERMINAL_PAYMENT_STATUSES: ReadonlySet<QZPayPaymentStatus> = new Set<QZPayPaymentStatus>([
    'succeeded',
    'failed',
    'canceled',
    'refunded'
]);

/**
 * What the ledger write did.
 *
 * `inserted: false` covers BOTH "a row for this MercadoPago payment id already
 * existed" (an idempotent redelivery) and "the write failed and was queued as
 * an orphan payment".
 *
 * `statusAdvanced` is the third case, and it exists because the first two
 * collapse a distinction that costs a customer a whole billing period. A charge
 * that MercadoPago first reports as `in_process` (issuer review) and later as
 * `approved` is ONE payment id: the `in_process` delivery consumes `inserted`,
 * and the `approved` delivery that follows finds the row and reports
 * `inserted: false`. A caller gating "advance the period" on `inserted` alone
 * therefore never advances it — for money that actually arrived — and leaves
 * the ledger row reading `processing` forever. When the stored row is
 * non-terminal and the incoming status is terminal, this module UPDATES the row
 * and says so here.
 */
export interface RecordAddonPaymentOutcome {
    readonly inserted: boolean;
    /**
     * An existing ledger row was moved from a non-terminal status
     * (`pending`/`processing`) to the terminal status this delivery carries.
     * Never `true` at the same time as `inserted`.
     */
    readonly statusAdvanced: boolean;
}

/**
 * Write the `billing_payments` row for a confirmed add-on charge (HOS-595).
 *
 * The add-on path used to be the only money-collecting flow in the codebase
 * with no ledger entry at all: `billing_addon_purchases` recorded WHAT was
 * bought, and nothing recorded THAT it was paid. A charge with no
 * `provider_payment_ids` cannot be reconciled against the provider's
 * settlement, cannot be refunded through `refund-lifecycle.service.ts` (which
 * looks the payment up by its provider id), and is invisible to every revenue
 * report that reads this table.
 *
 * This is deliberately NOT a second implementation: it calls the same
 * `billing.payments.record()` facade the subscription flows call
 * (`payment-logic.ts` annual + plan-upgrade delta,
 * `subscription-payment-handler.ts` recurring, `webhook-retry.job.ts`
 * dead-letter), and reuses their dedupe shape — a lookup on
 * `provider_payment_ids->>'mercadopago'` — so a provider redelivery of the same
 * charge does not double-insert.
 *
 * Best-effort by design: it runs after the purchase row is already committed
 * and after the money was collected, so a failure here must never turn a
 * successful confirmation into a failed one (HOS-714 — a payment that cannot be
 * applied is recorded and alerted, never discarded). A failure is logged at
 * `error`, queued for an operator, and reported to Sentry.
 *
 * @param params - See {@link RecordAddonPaymentInput}.
 * @returns Whether a NEW ledger row was inserted by this call.
 */
export async function recordAddonPayment(
    params: RecordAddonPaymentInput
): Promise<RecordAddonPaymentOutcome> {
    const {
        billing,
        customerId,
        subscriptionId,
        purchaseId,
        addonSlug,
        providerPaymentId,
        amountInCents,
        currency,
        flow = ADDON_PAYMENT_FLOW,
        status = 'succeeded' as QZPayPaymentStatus
    } = params;

    try {
        const { getDb, billingPayments, eq } = await import('@repo/db');
        const { sql: paymentSql } = await import('drizzle-orm');

        const existing = await getDb()
            .select({ id: billingPayments.id, status: billingPayments.status })
            .from(billingPayments)
            .where(
                paymentSql`${billingPayments.providerPaymentIds}->>${ADDON_PAYMENT_PROVIDER_KEY} = ${providerPaymentId}`
            )
            .limit(1);

        const existingRow = existing[0];

        if (existingRow) {
            const storedStatus = existingRow.status as QZPayPaymentStatus;
            const storedIsTerminal = TERMINAL_PAYMENT_STATUSES.has(storedStatus);
            const incomingIsTerminal = TERMINAL_PAYMENT_STATUSES.has(status);

            if (!storedIsTerminal && incomingIsTerminal && storedStatus !== status) {
                // The SAME MercadoPago payment resolving: `in_process` →
                // `approved` (or `rejected`). Not a redelivery to ignore — it is
                // the disposition, arriving second. Leaving the row at
                // `processing` strands real money in a non-terminal state and,
                // worse, denies the caller the `inserted` it gates the billing
                // period on.
                await getDb()
                    .update(billingPayments)
                    .set({ status, updatedAt: new Date() })
                    .where(eq(billingPayments.id, existingRow.id));

                apiLogger.info(
                    {
                        customerId,
                        addonSlug,
                        purchaseId,
                        providerPaymentId,
                        billingPaymentId: existingRow.id,
                        previousStatus: storedStatus,
                        status,
                        flow
                    },
                    'Add-on payment already in billing_payments — status advanced to its terminal disposition'
                );

                return { inserted: false, statusAdvanced: true };
            }

            apiLogger.debug(
                { customerId, addonSlug, purchaseId, providerPaymentId, storedStatus, status },
                'Add-on payment already recorded in billing_payments — skipping record'
            );
            return { inserted: false, statusAdvanced: false };
        }

        const recorded = await billing.payments.record({
            id: randomUUID(),
            customerId,
            subscriptionId,
            amount: amountInCents,
            currency: currency as QZPayCurrency,
            status,
            provider: ADDON_PAYMENT_PROVIDER_KEY,
            providerPaymentId,
            metadata: {
                flow,
                addonSlug,
                purchaseId
            }
        });

        apiLogger.info(
            {
                customerId,
                addonSlug,
                purchaseId,
                providerPaymentId,
                billingPaymentId: recorded.id,
                amountInCents,
                currency,
                flow,
                status
            },
            'Add-on payment recorded in billing_payments'
        );

        return { inserted: true, statusAdvanced: false };
    } catch (recordError) {
        // HOS-1001: this branch used to say, in its own log message, "money
        // collected without a ledger entry; reconcile manually" — and there was
        // nothing in the codebase that would ever tell anyone to, nor anywhere
        // for them to look. The queue is that place.
        //
        // Enqueued BEFORE the Sentry call on purpose: the row is the durable
        // record an operator acts on, the Sentry event is the notification. If
        // only one of the two survives it must be the one you can work from.
        //
        // `recordOrphanPayment` never throws, so a confirmed purchase is still
        // never turned into a failed one by bookkeeping.
        await recordOrphanPayment({
            providerPaymentId,
            flow: ADDON_ORPHAN_QUEUE_FLOW,
            reason: 'ledger-write-failed',
            // HOS-720: the queue takes MAJOR units and converts once. This flow
            // holds CENTAVOS, so the crossing is spelled out rather than
            // implied — `toMajor`/`toCentavos` round-trip to the same integer
            // centavo by construction (see their JSDoc), and a bare
            // `amountInCents` here would book a charge 100× too large.
            amountMajor: toMajor(asCentavos(amountInCents)),
            currency,
            subscriptionId,
            customerId,
            source: 'addon-checkout',
            metadata: {
                addonSlug,
                purchaseId,
                amountInCents,
                flow,
                ledgerWriteError:
                    recordError instanceof Error ? recordError.message : String(recordError)
            }
        });

        captureBillingError(
            recordError instanceof Error ? recordError : new Error(String(recordError)),
            {
                addonIds: [addonSlug],
                transactionId: purchaseId,
                operation: 'addon_payment_record'
            },
            'error'
        );

        return { inserted: false, statusAdvanced: false };
    }
}
