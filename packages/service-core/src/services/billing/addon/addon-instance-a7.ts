import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, addonProducts, and, domainEventModel, eq, getDb } from '@repo/db';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';

const inputSchema = z.strictObject({ instanceId: z.uuid() });

/** A7: closes a declined one-time purchase using a fresh order read by id. */
export async function rejectOneTimeOrder(
    input: { readonly instanceId: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<{
    readonly outcome: 'ABANDONED' | 'APPROVED' | 'NOT_FAILED' | 'UNKNOWN' | 'NOT_APPLICABLE';
}> {
    const request = inputSchema.parse(input);
    const [found] = await getDb()
        .select({ instance: addonInstances, chargeKind: addonProducts.chargeKind })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonInstances.productId, addonProducts.id))
        .where(eq(addonInstances.id, request.instanceId))
        .limit(1);
    if (
        found?.instance.status !== 'PENDING_AUTHORIZATION' ||
        found.chargeKind !== 'UNA_VEZ' ||
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
    if (
        snapshot.orderId !== found.instance.providerOrderId ||
        snapshot.reference !== found.instance.orderRequestId
    )
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Declined addon order has inconsistent identity'
        );
    if (snapshot.hasApprovedPayment) return { outcome: 'APPROVED' };
    if (!snapshot.failed) return { outcome: 'NOT_FAILED' };

    const now = ports.clock.now();
    return getDb().transaction(async (tx) => {
        const [instance] = await tx
            .select({
                id: addonInstances.id,
                status: addonInstances.status,
                providerOrderId: addonInstances.providerOrderId
            })
            .from(addonInstances)
            .where(eq(addonInstances.id, request.instanceId))
            .limit(1)
            .for('update');
        if (
            instance?.status !== 'PENDING_AUTHORIZATION' ||
            instance.providerOrderId !== snapshot.orderId
        )
            return { outcome: 'NOT_APPLICABLE' as const };
        const [updated] = await tx
            .update(addonInstances)
            .set({ status: 'ABANDONED', updatedAt: now })
            .where(
                and(
                    eq(addonInstances.id, instance.id),
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: addonInstances.id });
        if (!updated) return { outcome: 'NOT_APPLICABLE' as const };
        await domainEventModel.insert({
            eventType: 'addon_instance.status_changed',
            entityType: 'addon_instance',
            entityId: instance.id,
            actorType: 'provider',
            actorId: null,
            correlationId: randomUUID(),
            changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }],
            occurredAt: now,
            tx
        });
        return { outcome: 'ABANDONED' as const };
    });
}
