import type { DrizzleClient, SelectManualPayment, SelectPayment } from '@repo/db';
import {
    and,
    eq,
    inArray,
    isNull,
    LIVE_SUBSCRIPTION_STATUSES,
    manualPayments,
    ne,
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

/**
 * Payment statuses a refund may be requested or settled on (notes H8). A `REFUNDED` or
 * `CHARGED_BACK` payment is not refundable (HOS-1680). S36 reuses this list too.
 */
export const REFUNDABLE_PAYMENT_STATUSES: readonly string[] = ['SUCCEEDED', 'PARTIALLY_REFUNDED'];

/**
 * Refund statuses that already claim money of a payment: every one but `FAILED`. An open
 * `REQUESTED`/`CONFIRMED` counts too, or two requests would ask for the same total twice
 * (Coord-333, HOS-1680). Local literals on purpose: nothing from `@repo/db` is evaluated at
 * module level.
 */
export const CLAIMING_REFUND_STATUSES = ['REQUESTED', 'CONFIRMED', 'EXECUTED'] as const;

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
 * The CLAIMED sum of a refund source: Σ `refund.amount` of every refund of that payment
 * (or manual payment) that already claims its money, i.e. every status but `FAILED`
 * (`CLAIMING_REFUND_STATUSES`; Coord-333/351, HOS-1680). It is what the refundable balance
 * discounts. It is NOT the payment's accumulated refund of P3/P4/P5 (AC:B5:6), which counts
 * only `EXECUTED` rows (`apply-executed-refund.service.ts`).
 *
 * Runs in the caller's transaction, never `getDb()`. The caller has already locked the
 * source `FOR UPDATE` (`lockRefundSource`, or S36's own lock), so the sum cannot move
 * until its commit.
 *
 * @param input.tx - The caller's transaction (the source is already locked)
 * @param input.source - The payment or manual payment
 * @param input.excludeRefundId - A refund left out of the sum (RF4: the `REQUESTED` it closes)
 * @returns The claimed cents (0 when nothing claims it)
 */
export async function claimedRefundAmount(input: {
    readonly tx: DrizzleClient;
    readonly source: RefundSource;
    readonly excludeRefundId?: string;
}): Promise<number> {
    const column = input.source.kind === 'PAYMENT' ? refunds.paymentId : refunds.manualPaymentId;
    const [claimed] = await input.tx
        .select({ amount: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
        .from(refunds)
        .where(
            and(
                eq(column, input.source.id),
                inArray(refunds.status, [...CLAIMING_REFUND_STATUSES]),
                input.excludeRefundId === undefined
                    ? undefined
                    : ne(refunds.id, input.excludeRefundId)
            )
        );
    return claimed?.amount ?? 0;
}

/**
 * Reject an amount over the payment's refundable balance: `payment.amount − Σ` of every
 * refund of that payment that is not `FAILED` (`REQUESTED`, `CONFIRMED`, `EXECUTED`;
 * Coord-333/351, HOS-1680). This replaces notes H7 of HOS-1540, which discounted only
 * `EXECUTED` rows and let two open requests ask for the whole payment each. The payment
 * is already locked by `lockRefundSource` in the same transaction, so a concurrent writer
 * waits for this one's commit and then reads its row. A `manual_payment` has no amount
 * (DEC-SUB-013), so it is never checked (I-2).
 *
 * @param input - The transaction, the locked source, the amount to refund and, for RF4, the
 *   `REQUESTED` row the settlement closes (it does not count against itself).
 * @throws ServiceError VALIDATION_ERROR `REFUND_EXCEEDS_BALANCE`.
 */
export async function assertWithinBalance(input: {
    readonly tx: DrizzleClient;
    readonly locked: LockedRefundSource;
    readonly amount: number;
    readonly excludeRefundId?: string;
}): Promise<void> {
    if (input.locked.kind !== 'PAYMENT') return;
    const { payment } = input.locked;
    const claimed = await claimedRefundAmount({
        tx: input.tx,
        source: { kind: 'PAYMENT', id: payment.id },
        excludeRefundId: input.excludeRefundId
    });
    const balance = payment.amount - claimed;
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
