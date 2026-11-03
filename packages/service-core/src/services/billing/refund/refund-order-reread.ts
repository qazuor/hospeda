import type { Clock } from '@repo/billing-verticals-contract';
import {
    actStartInstant,
    assertFreshForAct,
    type PaymentProvider,
    PaymentProviderError
} from '@repo/payments';

/** Re-reads an order for the RF2 decision (AC:B6:8, TRANS:B:RF2, GUARD:G17). */
export async function rereadOrderForRefund(input: {
    readonly orderId: string;
    readonly clock: Clock;
    readonly provider: PaymentProvider;
}) {
    const act = { kind: 'decision' as const, startedAt: input.clock.now() };
    actStartInstant({ act });
    try {
        const read = await input.provider.readOrder({ orderId: input.orderId });
        const order = assertFreshForAct({ read, act }).snapshot;
        return order.hasApprovedPayment
            ? { kind: 'READY' as const, order }
            : { kind: 'NOT_REFUNDABLE' as const };
    } catch (error) {
        if (error instanceof PaymentProviderError && error.code === 'UNAVAILABLE')
            return { kind: 'UNAVAILABLE' as const };
        throw error;
    }
}
