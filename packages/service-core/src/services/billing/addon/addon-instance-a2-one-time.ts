import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    addonVersions,
    and,
    domainEventModel,
    eq,
    getDb,
    payments
} from '@repo/db';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { creditPayment } from '../payment/credit-payment.service';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { compatibleVerticalsOf, coverageVerticalsOf } from './addon-coverage-verticals';
import { emitAddonCoverageAdded } from './addon-instance-a2';
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
    const now = ports.clock.now();
    const activated = await getDb().transaction(async (tx) => {
        const [instance] = await tx
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, input.instanceId))
            .limit(1)
            .for('update');
        if (
            instance?.status !== 'PENDING_AUTHORIZATION' ||
            instance.providerOrderId !== snapshot.orderId
        )
            return null;
        const [version] = await tx
            .select({ validity: addonVersions.validity, validityDays: addonVersions.validityDays })
            .from(addonVersions)
            .where(eq(addonVersions.id, instance.addonVersionId))
            .limit(1);
        if (!version)
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Addon version missing');
        const endsAt =
            version.validity === 'FIXED_DAYS'
                ? new Date(now.getTime() + (version.validityDays ?? 0) * 86_400_000)
                : null;
        if (version.validity === 'FIXED_DAYS' && !version.validityDays)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Fixed addon validity has no days'
            );
        const [existing] = await tx
            .select({ id: payments.id })
            .from(payments)
            .where(
                and(
                    eq(payments.addonInstanceId, instance.id),
                    eq(payments.providerFactId, paymentTransactionId)
                )
            )
            .limit(1);
        const [payment] = existing
            ? [existing]
            : await tx
                  .insert(payments)
                  .values({
                      addonInstanceId: instance.id,
                      subscriptionId: null,
                      amount: found.product.price,
                      currency: 'ARS',
                      status: 'PENDING',
                      provider: 'MERCADO_PAGO',
                      providerFactId: paymentTransactionId,
                      providerPaymentId: paymentTransactionId,
                      factAt: now
                  })
                  .returning({ id: payments.id });
        if (!payment)
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Addon payment insert failed');
        const coverageVerticals = await coverageVerticalsOf({
            tx,
            scopeType: (await ports.addonPolicy({ addonVersionId: instance.addonVersionId }))
                .scopeType,
            targetId: instance.targetId,
            compatibleVerticals: await compatibleVerticalsOf({ tx, productId: instance.productId }),
            ports
        });
        const [updated] = await tx
            .update(addonInstances)
            .set({ status: 'ACTIVE', startsAt: now, endsAt, updatedAt: now })
            .where(
                and(
                    eq(addonInstances.id, instance.id),
                    eq(addonInstances.status, 'PENDING_AUTHORIZATION')
                )
            )
            .returning({ id: addonInstances.id });
        if (!updated)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'A2 one-time state changed under lock'
            );
        await domainEventModel.insert({
            eventType: 'addon_instance.status_changed',
            entityType: 'addon_instance',
            entityId: instance.id,
            actorType: 'provider',
            actorId: null,
            correlationId: randomUUID(),
            changes: [{ field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ACTIVE' }],
            occurredAt: now,
            tx
        });
        return {
            outcome: 'ACTIVATED' as const,
            paymentId: payment.id,
            instanceId: instance.id,
            ownerId: instance.ownerId,
            coverageVerticals
        };
    });
    if (!activated) return { outcome: 'NOT_APPLICABLE' };
    await creditPayment(
        { paymentId: activated.paymentId, chargeCreatedAt: new Date(snapshot.createdAt) },
        { clock: ports.clock, coverageNotices: ports.coverageNotices }
    );
    await emitAddonCoverageAdded({
        activated: [activated],
        coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
    });
    return { outcome: 'ACTIVATED', paymentId: activated.paymentId };
}
