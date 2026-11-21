import type { Clock } from '@repo/billing-verticals-contract';
import type { ChargeRefund, PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';

/** The provider refunds of one charge, as the provider read them for this decision. */
export type ChargeRefundsRead = {
    readonly refunds: readonly ChargeRefund[];
    readonly currency: string;
};

/**
 * Reads the charge by id for one decision, the same way RF3 does: the act starts before the read
 * and the snapshot must be fresh for it. Runs outside any transaction.
 *
 * @param input.chargeId - The provider charge id of the payment.
 * @param input.provider - The payment provider.
 * @param input.clock - The clock.
 * @returns The refunds the provider reports on the charge and the charge currency.
 */
export async function readChargeRefunds(input: {
    readonly chargeId: string;
    readonly provider: PaymentProvider;
    readonly clock: Clock;
}): Promise<ChargeRefundsRead> {
    const act = { kind: 'decision' as const, startedAt: input.clock.now() };
    actStartInstant({ act });
    const read = await input.provider.readCharge({ chargeId: input.chargeId });
    const { snapshot } = assertFreshForAct({ read, act });
    return { refunds: snapshot.refunds, currency: snapshot.amount.currency };
}

function credited(input: {
    readonly read: ChargeRefundsRead;
    readonly refundId: string;
    readonly currency: string;
}): number | null {
    const entry = input.read.refunds.find((refund) => refund.refundId === input.refundId);
    if (!entry?.accredited || entry.amount.currency !== input.currency) return null;
    return entry.amount.amountMinor;
}

/**
 * "Accepted" is not "credited": every provider refund id our calls hold must be on the charge,
 * credited, in the payment's currency. Returns the sum the PROVIDER returned for them, which is
 * what was really refunded (not what we asked for).
 *
 * @param input.read - The charge read for this decision.
 * @param input.acceptedIds - The provider refund ids of the accepted calls.
 * @param input.currency - The payment currency.
 * @returns The credited sum, in cents.
 * @throws ServiceError ALREADY_EXISTS `ACCEPTED_PART_NOT_ACCREDITED` when one is missing, not credited or in another currency.
 */
export function creditedAcceptedAmount(input: {
    readonly read: ChargeRefundsRead;
    readonly acceptedIds: readonly string[];
    readonly currency: string;
}): number {
    let sum = 0;
    for (const refundId of input.acceptedIds) {
        const amount = credited({ read: input.read, refundId, currency: input.currency });
        if (amount === null)
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                `The provider does not report accepted refund ${refundId} as credited`,
                undefined,
                'ACCEPTED_PART_NOT_ACCREDITED'
            );
        sum += amount;
    }
    return sum;
}

/**
 * The remainder must be a refund the provider reports on this charge: the panel reference is a
 * credited provider refund, in the payment's currency, for exactly the remainder.
 *
 * @param input.read - The charge read for this decision.
 * @param input.reference - The provider panel refund id the person gave.
 * @param input.remainder - The remainder, in cents.
 * @param input.currency - The payment currency.
 * @throws ServiceError VALIDATION_ERROR `REMAINDER_NOT_FOUND_AT_PROVIDER` otherwise.
 */
export function assertRemainderAtProvider(input: {
    readonly read: ChargeRefundsRead;
    readonly reference: string;
    readonly remainder: number;
    readonly currency: string;
}): void {
    const amount = credited({
        read: input.read,
        refundId: input.reference,
        currency: input.currency
    });
    if (amount !== input.remainder)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            `The provider reports no credited refund ${input.reference} of ${input.remainder} on this charge`,
            undefined,
            'REMAINDER_NOT_FOUND_AT_PROVIDER'
        );
}
