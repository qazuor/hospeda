import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { getDb, refunds } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { canRefundTransition, type Rf1Reason } from './refund-machine';
import {
    assertRefundAmount,
    assertRefundable,
    assertWithinBalance,
    lockRefundSource,
    type RefundSource,
    refundSourceColumns
} from './refund-source';

/** Input of RF1: the payment to return, the amount (cents) and the reason. */
export type RequestRefundInput = {
    readonly source: RefundSource;
    readonly amount: number;
    readonly reason: Rf1Reason;
};

/**
 * RF1 — a refund is requested (TRANS:B:RF1; AC:B5:9). A `refund` row is born
 * in `REQUESTED` with the payment it returns (a `payment` or a
 * `manual_payment`), its amount and its reason. It moves neither the payment,
 * the subscription, `covered_period` nor `refund_call`: no money leaves until a
 * person confirms it (INV:D11; RF2 of B6) or settles it by admin action 14
 * (RF4, AC:B5:41).
 *
 * Authorization: none here. RF1 is called by other transitions (S36, S21, a
 * person acting from a reconciliation mark) that already authorized their own
 * act; it is never exposed to a caller on its own.
 *
 * Runs in `ports.tx` when given (S36 calls it from its own transaction), or in
 * a transaction of its own. The payment is locked `FOR UPDATE` while it is read.
 *
 * @param input - The source, amount and reason.
 * @param ports - The clock and an optional outer transaction.
 * @returns The new refund id.
 * @throws ServiceError VALIDATION_ERROR `REFUND_AMOUNT_INVALID` | `REFUND_EXCEEDS_BALANCE`;
 *   NOT_FOUND `REFUND_SOURCE_NOT_FOUND`; ALREADY_EXISTS `PAYMENT_NOT_REFUNDABLE`.
 */
export async function requestRefund(
    input: RequestRefundInput,
    ports: { readonly clock: Clock; readonly tx?: DrizzleClient }
): Promise<{ readonly refundId: string }> {
    assertRefundAmount({ amount: input.amount });
    const run = async (tx: DrizzleClient): Promise<{ readonly refundId: string }> => {
        const locked = await lockRefundSource({ tx, source: input.source });
        assertRefundable({ locked });
        await assertWithinBalance({ tx, locked, amount: input.amount });
        if (!canRefundTransition({ transition: 'RF1', from: 'NO_ROW' }).allowed)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'RF1 is not allowed from NO_ROW',
                undefined,
                'REFUND_TRANSITION_NOT_ALLOWED'
            );
        const now = ports.clock.now();
        const [row] = await tx
            .insert(refunds)
            .values({
                ...refundSourceColumns({ source: input.source }),
                amount: input.amount,
                reason: input.reason,
                status: 'REQUESTED',
                createdAt: now,
                updatedAt: now
            })
            .returning({ id: refunds.id });
        if (!row)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Refund request insert returned no row',
                undefined,
                'REFUND_INSERT_FAILED'
            );
        return { refundId: row.id };
    };
    return ports.tx ? run(ports.tx) : getDb().transaction(run);
}
