import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, addonProducts, and, eq, getDb, idempotencyKeys, payments } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import { activateOneTimeInstance } from './addon-instance-a2-one-time-activation';
import type { A5Ports } from './addon-instance-a5';
import { closeOneTimePaymentPage } from './close-one-time-payment-page';
import { PAYMENT_PAGE_OPERATION } from './one-time-payment-page';

const logger = createLogger('addon-a2-one-time-page');

const inputSchema = z.strictObject({ instanceId: z.uuid(), chargeId: z.string().min(1) });

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
 *   collection on the same page (§5.8). It activates nothing; the duplicate mark is the caller's.
 * - `LATE_PAYMENT`: the purchase closed with no payment (abandoned, for one): the payment
 *   arrived after it closed (§5.9). It activates nothing; mark 23 is the caller's.
 * - `AMOUNT_MISMATCH`: approved with another amount or currency than the anchored price (AC-8),
 *   whatever state the purchase is in. It activates nothing, and `DIVERGENCIA_DE_MONTO` is
 *   already open on the instance when this is returned.
 * - `NOT_APPROVED`: rejected, pending or refunded; the purchase keeps waiting (AC-9).
 * - `NOT_THIS_PURCHASE`: the payment carries another reference or hangs from an authorization.
 * - `UNKNOWN`: the provider did not answer the read, or the divergence mark could not be opened.
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
 * mark's event; there is no `payment` row to hang, since the money activated nothing. A repeated
 * notice or a later A3 accumulates on the same open mark. `AMOUNT_MISMATCH` is returned only once
 * the mark is open, so a caller may treat it as decided; a failure to open it is `UNKNOWN`.
 */
async function recordAmountMismatch(input: {
    readonly instanceId: string;
    readonly chargeId: string;
    readonly expected: { readonly amountMinor: number; readonly currency: string };
    readonly actual: { readonly amountMinor: number; readonly currency: string };
}): Promise<{ readonly outcome: 'AMOUNT_MISMATCH' | 'UNKNOWN' }> {
    logger.error(input, 'Approved page payment differs from the anchored price; not activated');
    try {
        await openReconciliationMark({
            subject: { kind: 'ADDON_INSTANCE', addonInstanceId: input.instanceId },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: { type: 'provider' },
            correlationId: randomUUID(),
            detail: [
                { field: 'provider.charge_id', new: input.chargeId },
                { field: 'reconciliation_mark.expected_minor', new: input.expected.amountMinor },
                { field: 'reconciliation_mark.expected_currency', new: input.expected.currency },
                { field: 'provider.charge_amount_minor', new: input.actual.amountMinor },
                { field: 'provider.charge_currency', new: input.actual.currency }
            ]
        });
    } catch (error) {
        logger.error(
            {
                instanceId: input.instanceId,
                chargeId: input.chargeId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Could not open the amount divergence mark; left undecided'
        );
        return { outcome: 'UNKNOWN' };
    }
    return { outcome: 'AMOUNT_MISMATCH' };
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
 * @param ports - Provider, clock, policy readers and coverage notices
 * @returns What was decided
 */
export async function confirmOneTimePagePayment(
    input: { readonly instanceId: string; readonly chargeId: string },
    ports: ConfirmOneTimePagePaymentPorts
): Promise<ConfirmOneTimePagePaymentResult> {
    const request = inputSchema.parse(input);
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
            actual: snapshot.amount
        });
    if (found.instance.status !== 'PENDING_AUTHORIZATION')
        return {
            outcome: await settledOutcome({
                instanceId: found.instance.id,
                chargeId: snapshot.chargeId
            })
        };

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
        return {
            outcome: await settledOutcome({
                instanceId: found.instance.id,
                chargeId: snapshot.chargeId
            })
        };
    }
    await closeOneTimePaymentPage({ instanceId: found.instance.id }, ports);
    return activation;
}
