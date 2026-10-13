import type { DrizzleClient, SelectManualPayment, SelectPayment } from '@repo/db';
import {
    and,
    eq,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    manualPayments,
    payments,
    refunds,
    sql,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

/** The payment a refund returns: a provider `payment` or a `manual_payment` (B5.md §refund). */
export type RefundSource = {
    readonly kind: 'PAYMENT' | 'MANUAL_PAYMENT';
    readonly id: string;
};

/** A refund source read and locked `FOR UPDATE` inside the caller's transaction. */
export type LockedRefundSource =
    | { readonly kind: 'PAYMENT'; readonly payment: SelectPayment }
    | { readonly kind: 'MANUAL_PAYMENT'; readonly manualPayment: SelectManualPayment };

/** Payment statuses a refund may be requested or settled on (notes H8). */
const REFUNDABLE_PAYMENT_STATUSES: readonly string[] = ['SUCCEEDED', 'PARTIALLY_REFUNDED'];

/**
 * Read the refund source and lock it `FOR UPDATE` in the given transaction.
 *
 * @param input - The transaction and the source to lock.
 * @returns The locked row, tagged by kind.
 * @throws ServiceError NOT_FOUND `REFUND_SOURCE_NOT_FOUND` when the row does not exist.
 */
export async function lockRefundSource(input: {
    readonly tx: DrizzleClient;
    readonly source: RefundSource;
}): Promise<LockedRefundSource> {
    const { tx, source } = input;
    if (source.kind === 'PAYMENT') {
        const [payment] = await tx
            .select()
            .from(payments)
            .where(eq(payments.id, source.id))
            .limit(1)
            .for('update');
        if (payment) return { kind: 'PAYMENT', payment };
    } else {
        const [manualPayment] = await tx
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.id, source.id))
            .limit(1)
            .for('update');
        if (manualPayment) return { kind: 'MANUAL_PAYMENT', manualPayment };
    }
    throw new ServiceError(
        ServiceErrorCode.NOT_FOUND,
        'Refund source not found',
        undefined,
        'REFUND_SOURCE_NOT_FOUND'
    );
}

/**
 * Reject a source that cannot be refunded (notes H8): a `payment` outside
 * `SUCCEEDED`/`PARTIALLY_REFUNDED`, or a `manual_payment` that is not `REGISTERED`.
 *
 * @param input - The locked source.
 * @throws ServiceError ALREADY_EXISTS `PAYMENT_NOT_REFUNDABLE`.
 */
export function assertRefundable(input: { readonly locked: LockedRefundSource }): void {
    const refundable =
        input.locked.kind === 'PAYMENT'
            ? REFUNDABLE_PAYMENT_STATUSES.includes(input.locked.payment.status)
            : input.locked.manualPayment.status === 'REGISTERED';
    if (!refundable)
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'Payment is not in a refundable state',
            undefined,
            'PAYMENT_NOT_REFUNDABLE'
        );
}

/**
 * GUARD:G-R1-D, its "no refund before the close" half at run time (B7.md
 * AC:B7:17; `04-catalogos.md` GUARD:G-R1-D: «o reembolsa el pago que quedó
 * pendiente por `S19` antes de que la sucesión se resuelva»; HOS-1561 H12).
 *
 * Rejects the refund of a payment that S19 retained while the succession is still
 * unresolved: the payment has an OPEN `succession_retained_payment` row AND the
 * subscription that retains it is still live (`LIVE_SUBSCRIPTION_STATUSES`). Once
 * the predecessor is dead (branches 1, 5 and 6 leave it `CANCELLED`, and S36
 * cancels it in the same act before its RF1) the refund goes through.
 *
 * Both reads run in the caller's transaction, after `lockRefundSource` locked the
 * payment. A read error propagates (fails closed): it is never taken as "no
 * retention".
 *
 * @param input.tx - The caller's transaction (the source is already locked)
 * @param input.locked - The locked refund source
 * @throws ServiceError ALREADY_EXISTS `RETAINED_PAYMENT_SUCCESSION_OPEN`.
 */
export async function assertRetainedPaymentRefundable(input: {
    readonly tx: DrizzleClient;
    readonly locked: LockedRefundSource;
}): Promise<void> {
    const { tx, locked } = input;
    const paymentMatch =
        locked.kind === 'PAYMENT'
            ? eq(successionRetainedPayments.paymentId, locked.payment.id)
            : eq(successionRetainedPayments.manualPaymentId, locked.manualPayment.id);
    const [retained] = await tx
        .select({ subscriptionId: subscriptions.id })
        .from(successionRetainedPayments)
        .innerJoin(subscriptions, eq(subscriptions.id, successionRetainedPayments.subscriptionId))
        .where(
            and(
                paymentMatch,
                isNull(successionRetainedPayments.releasedAt),
                inArray(subscriptions.status, LIVE_SUBSCRIPTION_STATUSES)
            )
        )
        .limit(1);
    if (retained)
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'Payment is retained by a succession in progress',
            undefined,
            'RETAINED_PAYMENT_SUCCESSION_OPEN'
        );
}

/**
 * Reject an amount over the payment's balance: `payment.amount − Σ EXECUTED
 * refunds` (notes H7). Other open `REQUESTED` rows are not discounted. A
 * `manual_payment` has no amount (DEC-SUB-013), so it is never checked.
 *
 * @param input - The transaction, the locked source and the amount to refund.
 * @throws ServiceError VALIDATION_ERROR `REFUND_EXCEEDS_BALANCE`.
 */
export async function assertWithinBalance(input: {
    readonly tx: DrizzleClient;
    readonly locked: LockedRefundSource;
    readonly amount: number;
}): Promise<void> {
    if (input.locked.kind !== 'PAYMENT') return;
    const { payment } = input.locked;
    const [sum] = await input.tx
        .select({ amount: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
        .from(refunds)
        .where(and(eq(refunds.paymentId, payment.id), eq(refunds.status, 'EXECUTED')));
    const balance = payment.amount - (sum?.amount ?? 0);
    if (input.amount > balance)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            `Refund amount ${input.amount} exceeds the payment balance ${balance}`,
            undefined,
            'REFUND_EXCEEDS_BALANCE'
        );
}

/**
 * Reject an amount that is not a positive integer (cents).
 *
 * @param input - The amount.
 * @throws ServiceError VALIDATION_ERROR `REFUND_AMOUNT_INVALID`.
 */
export function assertRefundAmount(input: { readonly amount: number }): void {
    if (!Number.isInteger(input.amount) || input.amount <= 0)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'Refund amount must be a positive integer',
            undefined,
            'REFUND_AMOUNT_INVALID'
        );
}

/**
 * The payment reference columns of a refund row for a source: exactly one is set.
 *
 * @param input - The source.
 * @returns `{ paymentId, manualPaymentId }`.
 */
export function refundSourceColumns(input: { readonly source: RefundSource }): {
    readonly paymentId: string | null;
    readonly manualPaymentId: string | null;
} {
    return input.source.kind === 'PAYMENT'
        ? { paymentId: input.source.id, manualPaymentId: null }
        : { paymentId: null, manualPaymentId: input.source.id };
}
