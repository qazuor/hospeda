import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, addonProducts, eq, getDb } from '@repo/db';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { CoverageNotices } from '../payment/payment-ports';
import { activateOneTimeInstance } from './addon-instance-a2-one-time-activation';
import type { A5Ports } from './addon-instance-a5';

const inputSchema = z.object({ instanceId: z.uuid() });

/** Confirms a one-time order by a fresh read, then credits its instance payment. */
export async function confirmOneTimeOrder(
    input: { readonly instanceId: string },
    ports: A5Ports & {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly coverageNotices?: CoverageNotices;
    }
): Promise<
    | { readonly outcome: 'ACTIVATED'; readonly paymentId: string }
    | { readonly outcome: 'NOT_APPROVED' | 'UNKNOWN' | 'NOT_APPLICABLE' }
> {
    inputSchema.parse(input);
    const [found] = await getDb()
        .select({ instance: addonInstances, product: addonProducts })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonInstances.productId, addonProducts.id))
        .where(eq(addonInstances.id, input.instanceId))
        .limit(1);
    if (
        found?.instance.status !== 'PENDING_AUTHORIZATION' ||
        found.product.chargeKind !== 'UNA_VEZ' ||
        !found.instance.providerOrderId
    )
        return { outcome: 'NOT_APPLICABLE' };
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    let order: Awaited<ReturnType<PaymentProvider['readOrder']>>;
    try {
        order = await ports.provider.readOrder({ orderId: found.instance.providerOrderId });
    } catch {
        return { outcome: 'UNKNOWN' };
    }
    const { snapshot } = assertFreshForAct({ read: order, act });
    if (!snapshot.hasApprovedPayment) return { outcome: 'NOT_APPROVED' };
    if (
        !snapshot.paymentTransactionId ||
        snapshot.orderId !== found.instance.providerOrderId ||
        snapshot.reference !== found.instance.orderRequestId
    )
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Approved addon order has inconsistent identity'
        );
    const paymentTransactionId = snapshot.paymentTransactionId;
    return activateOneTimeInstance(
        {
            instanceId: input.instanceId,
            providerFactId: paymentTransactionId,
            amount: { amountMinor: found.product.price, currency: 'ARS' },
            chargeCreatedAt: new Date(snapshot.createdAt),
            stillOurs: (instance) => instance.providerOrderId === snapshot.orderId
        },
        ports
    );
}
