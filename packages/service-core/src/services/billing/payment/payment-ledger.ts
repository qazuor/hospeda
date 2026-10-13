import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import {
    and,
    count,
    eq,
    getDb,
    inArray,
    isNull,
    manualPayments,
    payments,
    reconciliationMarkPayments
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import type {
    HangablePayment,
    ReconciliationMarkPayments
} from '../reconciliation/reconciliation-mark-payments.port';
import type { SubscriptionPayments } from '../subscription/subscription-billing-ports';

const CREDITED_PROVIDER_STATUSES = [
    'SUCCEEDED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'CHARGED_BACK'
] as const;

/** B5's ledger implementation; B3.6 must opt into it when composing the receiver. */
export const creditedPaymentsFromLedger: SubscriptionPayments = {
    async hasCreditedPayment({ subscriptionId, tx }) {
        const db = tx ?? getDb();
        const [providerPayment] = await db
            .select({ id: payments.id })
            .from(payments)
            .where(
                and(
                    eq(payments.subscriptionId, subscriptionId),
                    inArray(payments.status, [...CREDITED_PROVIDER_STATUSES])
                )
            )
            .limit(1);
        if (providerPayment) return true;
        const [manualPayment] = await db
            .select({ id: manualPayments.id })
            .from(manualPayments)
            .where(
                and(
                    eq(manualPayments.subscriptionId, subscriptionId),
                    eq(manualPayments.status, 'REGISTERED')
                )
            )
            .limit(1);
        return Boolean(manualPayment);
    }
};

/** The two `UNIQUE(mark, payment)` constraints of `reconciliation_mark_payment` (0151). */
const MARK_PAYMENT_UNIQUE_CONSTRAINTS: readonly string[] = [
    'uq_reconciliation_mark_payment_payment',
    'uq_reconciliation_mark_payment_manual_payment'
];

/**
 * Hangs one payment (provider `payment` or `manual_payment`) on a reconciliation
 * mark, inside the caller's transaction (S14, AC:B5:37).
 *
 * The same payment never hangs twice from the same mark: the database rejects
 * it with one of the two `UNIQUE(mark, payment)` constraints, and that rejection
 * is surfaced as a typed `ALREADY_EXISTS` error so the caller's whole
 * transaction rolls back (no second row, no version bump, no second event).
 * Any other database error is rethrown untouched.
 *
 * @param input.markId - The open mark the payment hangs from.
 * @param input.payment - Which payment and from which source.
 * @param input.tx - The caller's transaction.
 * @param input.hungAt - When the payment was hung.
 * @throws ServiceError `ALREADY_EXISTS` / `MARK_PAYMENT_ALREADY_HUNG` on a duplicate.
 */
export async function hangPaymentOnMark(input: {
    readonly markId: string;
    readonly payment: HangablePayment;
    readonly tx: DrizzleClient;
    readonly hungAt: Date;
}): Promise<void> {
    try {
        await input.tx.insert(reconciliationMarkPayments).values({
            markId: input.markId,
            paymentId: input.payment.source === 'PAYMENT' ? input.payment.id : null,
            manualPaymentId: input.payment.source === 'MANUAL_PAYMENT' ? input.payment.id : null,
            hungAt: input.hungAt
        });
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (
            cause?.code === '23505' &&
            cause.constraint !== undefined &&
            MARK_PAYMENT_UNIQUE_CONSTRAINTS.includes(cause.constraint)
        )
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'Payment is already hung on this reconciliation mark',
                undefined,
                'MARK_PAYMENT_ALREADY_HUNG'
            );
        throw error;
    }
}

/**
 * Counts the payments hung on one mark that are not resolved yet (S15 guard,
 * AC:B5:38): rows of `reconciliation_mark_payment` with this `mark_id` and
 * `resolved_at IS NULL`, from both sources. Reads with the caller's
 * transaction, never with a fresh connection.
 *
 * @param input.markId - The mark whose hung payments are counted.
 * @param input.tx - The S15 transaction.
 * @returns The number of unresolved hung payments.
 */
async function countUnresolvedMarkPayments(input: {
    readonly markId: string;
    readonly tx: DrizzleClient;
}): Promise<number> {
    const [row] = await input.tx
        .select({ unresolved: count() })
        .from(reconciliationMarkPayments)
        .where(
            and(
                eq(reconciliationMarkPayments.markId, input.markId),
                isNull(reconciliationMarkPayments.resolvedAt)
            )
        );
    return Number(row?.unresolved ?? 0);
}

/**
 * B5's implementation of the reconciliation mark payments port that B3's S14
 * and S15 are written against: `hang` writes `reconciliation_mark_payment`, and
 * `countUnresolved` reads it for the S15 guard.
 *
 * @param clock - Source of the `hung_at` timestamp.
 * @returns The port implementation.
 */
export function createPaymentReconciliationMarkPayments(clock: Clock): ReconciliationMarkPayments {
    return {
        hang: async (input) => hangPaymentOnMark({ ...input, hungAt: clock.now() }),
        countUnresolved: async (input) => countUnresolvedMarkPayments(input)
    };
}
