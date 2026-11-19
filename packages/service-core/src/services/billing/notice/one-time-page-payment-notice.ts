import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, addonProducts, and, eq, getDb, idempotencyKeys, payments } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { confirmOneTimePagePayment } from '../addon/addon-instance-a2-one-time-page.js';
import { PAYMENT_PAGE_OPERATION } from '../addon/one-time-payment-page.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import type { ComplementPolicyPorts } from '../subscription/complement-ports.js';
import { executeConfirmedRefundsOnNotice } from './refund-execution-on-notice.js';

/**
 * What the notice receiver answers for the `payment` notice of a one-time page purchase
 * (HOS-2179 §5.3 path 1), one per decided A2 outcome.
 *
 * - `ADDON_PAYMENT_ACTIVATED`: the approved payment activated the purchase (AC-6).
 * - `ADDON_PAYMENT_ALREADY_CONFIRMED`: a repeated notice of the payment the purchase holds.
 * - `ADDON_DUPLICATE_PAYMENT_MARKED`: a second payment on the same page; `COBRO_DUPLICADO` (AC-11).
 * - `ADDON_LATE_PAYMENT_MARKED`: money on a purchase that closed with no payment; mark 23 (AC-12).
 * - `ADDON_AMOUNT_DIVERGENCE_MARKED`: another amount; `DIVERGENCIA_DE_MONTO` (AC-8).
 * - `ADDON_PAYMENT_NOT_APPROVED`: rejected or pending; the purchase keeps waiting (AC-9).
 */
export type OneTimePagePaymentNoticeOutcome =
    | 'ADDON_PAYMENT_ACTIVATED'
    | 'ADDON_PAYMENT_ALREADY_CONFIRMED'
    | 'ADDON_DUPLICATE_PAYMENT_MARKED'
    | 'ADDON_LATE_PAYMENT_MARKED'
    | 'ADDON_AMOUNT_DIVERGENCE_MARKED'
    | 'ADDON_PAYMENT_NOT_APPROVED';

/** The receiver's ports this routing reads. */
export interface OneTimePagePaymentNoticePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly coverageNotices?: CoverageNotices;
    /** The anchored addon policy and listing readers A2 activates with. */
    readonly complements?: ComplementPolicyPorts;
}

/** Raised when a page purchase could not be decided, so the provider delivers the notice again. */
export class OneTimePagePaymentUndecidedError extends Error {
    constructor(input: {
        readonly instanceId: string;
        readonly chargeId: string;
        readonly why: string;
    }) {
        super(
            `One-time page payment ${input.chargeId} of addon instance ${input.instanceId} left undecided: ${input.why}`
        );
        this.name = 'OneTimePagePaymentUndecidedError';
    }
}

/**
 * Routes the `payment` notice of a charge with no authorization to the one-time page purchase
 * whose reference it carries (HOS-2179 §5.3 path 1, §13 T-4). The reference comes from the
 * receiver's fresh read by id and only picks the purchase: A2 re-reads the charge by id and
 * decides on that read alone (GUARD:G17, INV:D6); the notice body never decides. A charge whose
 * reference names no page purchase (an order purchase, or nothing of ours) is `null`, and the
 * receiver answers it as it did before. An undecided A2 (the read or the mark did not answer)
 * throws, so the receiver acks an error and the provider delivers the notice again.
 *
 * When the charge already holds the purchase's `payment` row, RF3 runs first for its confirmed
 * refunds (HOS-2179 §5.11), as the subscription path does: the notice of a refunded page charge
 * is what executes its refund. RF3 never throws; a failure waits for the next notice.
 *
 * @param input.chargeId - The charge the notice names
 * @param input.reference - The charge's reference, from the receiver's fresh read
 * @param ports - Provider, clock, coverage notices and the complement policy readers
 * @returns The outcome to answer with, or `null` when no page purchase carries the reference
 * @throws OneTimePagePaymentUndecidedError when A2 could not decide; Error when the policy ports are unwired
 */
export async function routeOneTimePagePaymentNotice(
    input: { readonly chargeId: string; readonly reference: string | null },
    ports: OneTimePagePaymentNoticePorts
): Promise<OneTimePagePaymentNoticeOutcome | null> {
    if (input.reference === null) return null;
    const [purchase] = await getDb()
        .select({ id: addonInstances.id })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonInstances.productId, addonProducts.id))
        .innerJoin(
            idempotencyKeys,
            and(
                eq(idempotencyKeys.subjectId, addonInstances.id),
                eq(idempotencyKeys.operation, PAYMENT_PAGE_OPERATION)
            )
        )
        .where(
            and(
                eq(addonInstances.orderRequestId, input.reference),
                eq(addonProducts.chargeKind, 'UNA_VEZ')
            )
        )
        .limit(1);
    if (!purchase) return null;
    const [held] = await getDb()
        .select({ id: payments.id })
        .from(payments)
        .where(
            and(
                eq(payments.addonInstanceId, purchase.id),
                eq(payments.providerFactId, input.chargeId)
            )
        )
        .limit(1);
    if (held)
        await executeConfirmedRefundsOnNotice(
            {
                paymentId: held.id,
                providerFactId: input.chargeId,
                correlationId: crypto.randomUUID()
            },
            { provider: ports.provider, clock: ports.clock }
        );
    if (!ports.complements)
        throw new Error('A one-time page payment notice needs the complement policy ports');
    const result = await confirmOneTimePagePayment(
        { instanceId: purchase.id, chargeId: input.chargeId, trigger: { actor: 'provider' } },
        {
            provider: ports.provider,
            clock: ports.clock,
            addonPolicy: ports.complements.addonPolicy,
            listing: ports.complements.listing,
            ...(ports.coverageNotices === undefined
                ? {}
                : { coverageNotices: ports.coverageNotices })
        }
    );
    switch (result.outcome) {
        case 'ACTIVATED':
            return 'ADDON_PAYMENT_ACTIVATED';
        case 'ALREADY_CONFIRMED':
            return 'ADDON_PAYMENT_ALREADY_CONFIRMED';
        case 'DUPLICATE_PAYMENT':
            return 'ADDON_DUPLICATE_PAYMENT_MARKED';
        case 'LATE_PAYMENT':
            return 'ADDON_LATE_PAYMENT_MARKED';
        case 'AMOUNT_MISMATCH':
            return 'ADDON_AMOUNT_DIVERGENCE_MARKED';
        case 'NOT_APPROVED':
            return 'ADDON_PAYMENT_NOT_APPROVED';
        // The purchase carries the reference, yet the fresh read names another one or an
        // authorization: nothing of this purchase to decide.
        case 'NOT_THIS_PURCHASE':
            return null;
        case 'UNKNOWN':
        case 'NOT_APPLICABLE':
            throw new OneTimePagePaymentUndecidedError({
                instanceId: purchase.id,
                chargeId: input.chargeId,
                why: result.outcome
            });
    }
}
