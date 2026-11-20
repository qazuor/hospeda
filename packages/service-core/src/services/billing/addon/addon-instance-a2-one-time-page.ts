import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, addonProducts, and, eq, getDb, idempotencyKeys, payments } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports';
import { activateOneTimeInstance } from './addon-instance-a2-one-time-activation';
import type { A5Ports } from './addon-instance-a5';
import { closeOneTimePaymentPage } from './close-one-time-payment-page';
import {
    type OneTimePageMarkTrigger,
    openOneTimePageChargeMark
} from './one-time-page-charge-marks';
import { PAYMENT_PAGE_OPERATION } from './one-time-payment-page';

const logger = createLogger('addon-a2-one-time-page');

const inputSchema = z.strictObject({
    instanceId: z.uuid(),
    chargeId: z.string().min(1),
    trigger: z
        .strictObject({ actor: z.enum(['provider', 'job']), correlationId: z.uuid().optional() })
        .optional()
});

/** Ports of A2 for a payment made on a one-time payment page. */
export type ConfirmOneTimePagePaymentPorts = A5Ports & {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly coverageNotices?: CoverageNotices;
};

/**
 * What A2 decided about one payment. Every outcome but `UNKNOWN` and `NOT_APPLICABLE` comes from
 * a fresh read of the payment by id.
 *
 * - `ACTIVATED`: the purchase was waiting and this approved payment activated it.
 * - `ALREADY_CONFIRMED`: the purchase already holds this very payment (a repeated notice).
 * - `DUPLICATE_PAYMENT`: the purchase already holds another payment; this one is a second
 *   collection on the same page (§5.8). It activates nothing, and `COBRO_DUPLICADO` is already
 *   open on the instance (or was lifted for this charge) when this is returned (AC-11).
 * - `LATE_PAYMENT`: the purchase closed with no payment (abandoned, for one): the payment
 *   arrived after it closed (§5.9). It activates nothing, and mark 23 is already open on the
 *   instance (or was lifted for this charge) when this is returned (AC-12).
 * - `AMOUNT_MISMATCH`: approved with another amount or currency than the anchored price (AC-8),
 *   whatever state the purchase is in. It activates nothing, and `DIVERGENCIA_DE_MONTO` is
 *   already open on the instance when this is returned.
 * - `NOT_APPROVED`: rejected, pending or refunded; the purchase keeps waiting (AC-9).
 * - `NOT_THIS_PURCHASE`: the payment carries another reference or hangs from an authorization.
 * - `UNKNOWN`: the provider did not answer the read, or the mark the payment raises could not be
 *   opened.
 * - `NOT_APPLICABLE`: the instance is not a page purchase.
 */
export type ConfirmOneTimePagePaymentResult =
    | { readonly outcome: 'ACTIVATED'; readonly paymentId: string }
    | {
          readonly outcome:
              | 'ALREADY_CONFIRMED'
              | 'DUPLICATE_PAYMENT'
              | 'LATE_PAYMENT'
              | 'AMOUNT_MISMATCH'
              | 'NOT_APPROVED'
              | 'NOT_THIS_PURCHASE'
              | 'UNKNOWN'
              | 'NOT_APPLICABLE';
      };

/**
 * Classifies an approved payment of a purchase that no longer waits: the very payment it holds
 * (`ALREADY_CONFIRMED`), a second one beside the payment it holds (`DUPLICATE_PAYMENT`, §5.8),
 * or one for a purchase that closed with no payment at all (`LATE_PAYMENT`, §5.9).
 */
async function settledOutcome(input: {
    readonly instanceId: string;
    readonly chargeId: string;
}): Promise<'ALREADY_CONFIRMED' | 'DUPLICATE_PAYMENT' | 'LATE_PAYMENT'> {
    const held = await getDb()
        .select({ providerFactId: payments.providerFactId })
        .from(payments)
        .where(eq(payments.addonInstanceId, input.instanceId));
    if (held.some((payment) => payment.providerFactId === input.chargeId))
        return 'ALREADY_CONFIRMED';
    return held.length > 0 ? 'DUPLICATE_PAYMENT' : 'LATE_PAYMENT';
}

/**
 * Opens `DIVERGENCIA_DE_MONTO` (MOT:5, AC-8) on the instance for an approved payment of another
 * amount or currency than the anchored price. The provider's id and both amounts travel in the
 * mark's event. A repeated notice or a later A3 accumulates on the same open mark, and a charge
 * whose mark a person already lifted does not reopen it. `AMOUNT_MISMATCH` is returned only once
 * the mark is open or was lifted for this charge, so a caller may treat it as decided; a failure
 * to open it is `UNKNOWN`.
 */
async function recordAmountMismatch(input: {
    readonly instanceId: string;
    readonly chargeId: string;
    readonly expected: { readonly amountMinor: number; readonly currency: string };
    readonly actual: { readonly amountMinor: number; readonly currency: string };
    readonly trigger: OneTimePageMarkTrigger;
}): Promise<{ readonly outcome: 'AMOUNT_MISMATCH' | 'UNKNOWN' }> {
    logger.error(
        {
            instanceId: input.instanceId,
            chargeId: input.chargeId,
            expected: input.expected,
            actual: input.actual
        },
        'Approved page payment differs from the anchored price; not activated'
    );
    const marked = await openOneTimePageChargeMark({
        instanceId: input.instanceId,
        chargeId: input.chargeId,
        reason: 'DIVERGENCIA_DE_MONTO',
        trigger: input.trigger,
        detail: [
            { field: 'reconciliation_mark.expected_minor', new: input.expected.amountMinor },
            { field: 'reconciliation_mark.expected_currency', new: input.expected.currency },
            { field: 'provider.charge_amount_minor', new: input.actual.amountMinor },
            { field: 'provider.charge_currency', new: input.actual.currency }
        ]
    });
    return { outcome: marked === 'MARKED' ? 'AMOUNT_MISMATCH' : 'UNKNOWN' };
}

/**
 * Settles an approved payment of the anchored price on a purchase that no longer waits. The very
 * payment it holds is a repeated notice (`ALREADY_CONFIRMED`, nothing opened). A second payment
 * beside the one it holds opens `COBRO_DUPLICADO` (§5.8, AC-11), and money on a purchase that
 * closed with no payment opens mark 23 (§5.9, AC-12); both propose refunding the whole charge,
 * which a person confirms (DEC-CONC-001). The outcome is returned only once its mark is open or
 * was lifted for this charge; a failure to open it is `UNKNOWN`.
 */
async function settleApprovedPayment(input: {
    readonly instanceId: string;
    readonly chargeId: string;
    readonly amount: { readonly amountMinor: number; readonly currency: string };
    readonly trigger: OneTimePageMarkTrigger;
}): Promise<{
    readonly outcome: 'ALREADY_CONFIRMED' | 'DUPLICATE_PAYMENT' | 'LATE_PAYMENT' | 'UNKNOWN';
}> {
    const outcome = await settledOutcome(input);
    if (outcome === 'ALREADY_CONFIRMED') return { outcome };
    const marked = await openOneTimePageChargeMark({
        instanceId: input.instanceId,
        chargeId: input.chargeId,
        reason: outcome === 'DUPLICATE_PAYMENT' ? 'COBRO_DUPLICADO' : 'ORDEN_PAGADA_SIN_INSTANCIA',
        trigger: input.trigger,
        detail: [
            { field: 'provider.charge_amount_minor', new: input.amount.amountMinor },
            { field: 'provider.charge_currency', new: input.amount.currency },
            { field: 'reconciliation_mark.proposed_refund_minor', new: input.amount.amountMinor }
        ]
    });
    return { outcome: marked === 'MARKED' ? outcome : 'UNKNOWN' };
}

/**
 * A2 one-time for a payment page (HOS-2179 §5.3): confirms ONE payment, named by id, against
 * one page purchase. The payment is re-read by id and the decision is taken only on that fresh
 * read (GUARD:G17, INV:D6); a notice body, a return URL or a search result never decide. It
 * requires an approved payment of this purchase's reference, with no authorization, for exactly
 * the anchored price. Activation inserts the instance payment keyed by the provider's id and
 * credits it, so the three entries (notice, return, A3) converge idempotently. After
 * activation the page is closed (§5.7), best effort.
 *
 * @param input.instanceId - The one-time page purchase
 * @param input.chargeId - The provider's id of the payment to confirm
 * @param input.trigger - Who opens a mark this payment raises (default: the provider's notice)
 * @param ports - Provider, clock, policy readers and coverage notices
 * @returns What was decided
 */
export async function confirmOneTimePagePayment(
    input: {
        readonly instanceId: string;
        readonly chargeId: string;
        readonly trigger?: OneTimePageMarkTrigger;
    },
    ports: ConfirmOneTimePagePaymentPorts
): Promise<ConfirmOneTimePagePaymentResult> {
    const request = inputSchema.parse(input);
    const trigger: OneTimePageMarkTrigger = request.trigger ?? { actor: 'provider' };
    const [found] = await getDb()
        .select({ instance: addonInstances, product: addonProducts })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonInstances.productId, addonProducts.id))
        .innerJoin(
            idempotencyKeys,
            and(
                eq(idempotencyKeys.subjectId, addonInstances.id),
                eq(idempotencyKeys.operation, PAYMENT_PAGE_OPERATION)
            )
        )
        .where(eq(addonInstances.id, request.instanceId))
        .limit(1);
    if (
        found?.product.chargeKind !== 'UNA_VEZ' ||
        found.instance.orderRequestId === null ||
        found.instance.providerOrderId !== null
    )
        return { outcome: 'NOT_APPLICABLE' };
    const reference = found.instance.orderRequestId;

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    let read: Awaited<ReturnType<PaymentProvider['readCharge']>>;
    try {
        read = await ports.provider.readCharge({ chargeId: request.chargeId });
    } catch {
        return { outcome: 'UNKNOWN' };
    }
    const { snapshot } = assertFreshForAct({ read, act });
    if (
        snapshot.chargeId !== request.chargeId ||
        snapshot.reference !== reference ||
        snapshot.authorizationId !== null ||
        snapshot.purpose !== 'charge'
    )
        return { outcome: 'NOT_THIS_PURCHASE' };
    if (snapshot.status !== 'approved') return { outcome: 'NOT_APPROVED' };

    // The amount goes first, whatever the purchase became: money of another amount is MOT:5
    // and only MOT:5, so the same payment never also raises MOT:20 or MOT:23 later.
    if (
        snapshot.amount.amountMinor !== found.product.price ||
        snapshot.amount.currency !== found.product.currency
    )
        return await recordAmountMismatch({
            instanceId: found.instance.id,
            chargeId: snapshot.chargeId,
            expected: { amountMinor: found.product.price, currency: found.product.currency },
            actual: snapshot.amount,
            trigger
        });
    if (found.instance.status !== 'PENDING_AUTHORIZATION')
        return await settleApprovedPayment({
            instanceId: found.instance.id,
            chargeId: snapshot.chargeId,
            amount: snapshot.amount,
            trigger
        });

    const activation = await activateOneTimeInstance(
        {
            instanceId: found.instance.id,
            providerFactId: snapshot.chargeId,
            amount: snapshot.amount,
            chargeCreatedAt: new Date(snapshot.createdAt),
            stillOurs: (instance) =>
                instance.providerOrderId === null && instance.orderRequestId === reference
        },
        ports
    );
    if (activation.outcome !== 'ACTIVATED') {
        // The instance left the wait between the read and the lock (a concurrent A2, A3 or
        // orphanhood): classify this approved payment against what it became.
        const [now] = await getDb()
            .select({ status: addonInstances.status })
            .from(addonInstances)
            .where(eq(addonInstances.id, found.instance.id))
            .limit(1);
        if (!now || now.status === 'PENDING_AUTHORIZATION') return { outcome: 'NOT_APPLICABLE' };
        return await settleApprovedPayment({
            instanceId: found.instance.id,
            chargeId: snapshot.chargeId,
            amount: snapshot.amount,
            trigger
        });
    }
    await closeOneTimePaymentPage({ instanceId: found.instance.id }, ports);
    return activation;
}
