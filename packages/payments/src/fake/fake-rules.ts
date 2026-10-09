/**
 * The provider's own rules the fake keeps always (RP, DEC-TEST-003): they are
 * not lies, so no test turns them off. The ones with a surface in the payment
 * interface today live here or in the fake's methods, named by their id:
 *
 * - RP2: a refund without its idempotency key (`reference`) fails before any
 *   business validation: the input schema refuses it first.
 * - RP3: an amount below ARS 15 or above ARS 2.000.000 is refused, with the
 *   provider's exact messages (PC-2).
 * - RP4: another currency is refused (EX-18).
 * - RP5: a refund repeated with the same key moves no money and answers with
 *   no refund id, as the provider's empty body carries none (RF-6).
 * - RP6: a paused authorization refuses every change, and can still be
 *   cancelled (EX-11).
 * - RP9: a paused authorization is not charged (PS-2).
 * - RP1: a card token can authorize only once (EX-12).
 */
import type { PaymentCapability } from '../provider/capabilities';
import { PaymentProviderError } from '../provider/errors';
import type { Money } from '../provider/payment-provider';

/** The one currency the provider charges in (RP4). */
export const FAKE_CURRENCY = 'ARS';

/** The floor of an amount, in centavos: ARS 15 (RP3). */
export const FAKE_AMOUNT_FLOOR_MINOR = 1_500;

/** The ceiling of an amount, in centavos: ARS 2.000.000 (RP3). */
export const FAKE_AMOUNT_CEILING_MINOR = 200_000_000;

/** RP3, the provider's exact refusal below the floor. */
export const AMOUNT_BELOW_FLOOR_MESSAGE = 'Cannot pay an amount lower than $ 15.00';

/** RP3, the provider's exact refusal above the ceiling. */
export const AMOUNT_ABOVE_CEILING_MESSAGE = 'Cannot pay an amount greater than $ 2000000.00';

/** RP1: refuse reuse of a card token before creating another authorization. */
export function assertUnusedPaymentToken(args: {
    readonly paymentToken: string | undefined;
    readonly usedTokens: ReadonlySet<string>;
}): void {
    if (args.paymentToken !== undefined && args.usedTokens.has(args.paymentToken)) {
        throw new PaymentProviderError({
            code: 'REJECTED',
            capability: 'authorize',
            message: 'Card token was used, please generate new'
        });
    }
}

/**
 * RP3 and RP4 over an amount the provider would charge.
 *
 * @param args.amount - The amount asked for
 * @param args.capability - The capability, named in the refusal
 * @throws PaymentProviderError with code `REJECTED`
 */
export function assertChargeableAmount(args: {
    readonly amount: Money;
    readonly capability: PaymentCapability;
}): void {
    const refuse = (message: string) =>
        new PaymentProviderError({ code: 'REJECTED', capability: args.capability, message });
    if (args.amount.currency !== FAKE_CURRENCY) {
        throw refuse(`currency ${args.amount.currency} is not accepted: only ${FAKE_CURRENCY}`);
    }
    if (args.amount.amountMinor < FAKE_AMOUNT_FLOOR_MINOR) throw refuse(AMOUNT_BELOW_FLOOR_MESSAGE);
    if (args.amount.amountMinor > FAKE_AMOUNT_CEILING_MINOR) {
        throw refuse(AMOUNT_ABOVE_CEILING_MESSAGE);
    }
}

/**
 * The instant of the first charge batch after `at` (M8): batches run at minute
 * :02 of every hour, and a charge lands in the first one strictly after the
 * instant it was due.
 *
 * @param args.at - When the charge was due, in epoch milliseconds
 * @returns The batch instant, in epoch milliseconds
 */
export function nextChargeBatch(args: { readonly at: number }): number {
    const batch = new Date(args.at);
    batch.setUTCMinutes(2, 0, 0);
    if (batch.getTime() <= args.at) batch.setUTCHours(batch.getUTCHours() + 1);
    return batch.getTime();
}
