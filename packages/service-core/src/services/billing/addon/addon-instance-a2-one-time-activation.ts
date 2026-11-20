import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonVersions,
    and,
    domainEventModel,
    eq,
    getDb,
    payments,
    type SelectAddonInstance
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { creditPayment } from '../payment/credit-payment.service';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { compatibleVerticalsOf, coverageVerticalsOf } from './addon-coverage-verticals';
import { emitAddonCoverageAdded } from './addon-instance-a2';
import type { A5Ports } from './addon-instance-a5';
import { heldByPageChargeMark } from './one-time-page-charge-marks';

/** Ports of the shared one-time activation. */
export type OneTimeActivationPorts = A5Ports & {
    readonly clock: Clock;
    readonly coverageNotices?: CoverageNotices;
};

/** What the one-time activation did. */
export type OneTimeActivationResult =
    | { readonly outcome: 'ACTIVATED'; readonly paymentId: string }
    | { readonly outcome: 'NOT_APPLICABLE' };

/**
 * A2 one-time, shared by the order and the payment page (HOS-2179 §5.3): under a lock on the
 * instance, inserts (or reuses) the `payment` hung from the instance for one provider fact,
 * refuses one held by a page-charge mark (HOS-2179 D1, fails closed), moves
 * `PENDING_AUTHORIZATION` → `ACTIVE` with the version's validity, and after commit
 * credits the payment and emits the coverage notice. The caller has already confirmed the fact
 * by a fresh read by id; `stillOurs` re-checks, under the lock, that the instance is still the
 * one that read was about.
 *
 * @param input.instanceId - The pending one-time instance
 * @param input.providerFactId - The provider's id of the approved payment
 * @param input.amount - The amount and currency read back from the provider
 * @param input.chargeCreatedAt - When the provider created the payment, for the credit
 * @param input.stillOurs - Whether the locked instance still matches the confirmed read
 * @returns `ACTIVATED` with the payment, or `NOT_APPLICABLE` when the instance moved meanwhile
 */
export async function activateOneTimeInstance(
    input: {
        readonly instanceId: string;
        readonly providerFactId: string;
        readonly amount: { readonly amountMinor: number; readonly currency: string };
        readonly chargeCreatedAt: Date;
        readonly stillOurs: (instance: SelectAddonInstance) => boolean;
    },
    ports: OneTimeActivationPorts
): Promise<OneTimeActivationResult> {
    const now = ports.clock.now();
    const activated = await getDb().transaction(async (tx) => {
        const [instance] = await tx
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, input.instanceId))
            .limit(1)
            .for('update');
        if (instance?.status !== 'PENDING_AUTHORIZATION' || !input.stillOurs(instance)) return null;
        const [version] = await tx
            .select({ validity: addonVersions.validity, validityDays: addonVersions.validityDays })
            .from(addonVersions)
            .where(eq(addonVersions.id, instance.addonVersionId))
            .limit(1);
        if (!version)
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Addon version missing');
        if (version.validity === 'FIXED_DAYS' && !version.validityDays)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Fixed addon validity has no days'
            );
        const endsAt =
            version.validity === 'FIXED_DAYS'
                ? new Date(now.getTime() + (version.validityDays ?? 0) * 86_400_000)
                : null;
        const [existing] = await tx
            .select({ id: payments.id, held: heldByPageChargeMark() })
            .from(payments)
            .where(
                and(
                    eq(payments.addonInstanceId, instance.id),
                    eq(payments.providerFactId, input.providerFactId)
                )
            )
            .limit(1);
        // A charge a page-charge mark holds (HOS-2179 D1) is money pending a person's decision,
        // never the purchase's payment: activating with it would credit it. Callers already
        // refuse it before reaching here; this fails closed if one ever does not.
        if (existing?.held)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'A2 one-time refused a payment held by a reconciliation mark',
                undefined,
                'HELD_PAYMENT_ACTIVATION_REFUSED'
            );
        const [payment] = existing
            ? [existing]
            : await tx
                  .insert(payments)
                  .values({
                      addonInstanceId: instance.id,
                      subscriptionId: null,
                      amount: input.amount.amountMinor,
                      currency: input.amount.currency,
                      status: 'PENDING',
                      provider: 'MERCADO_PAGO',
                      providerFactId: input.providerFactId,
                      providerPaymentId: input.providerFactId,
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
        { paymentId: activated.paymentId, chargeCreatedAt: input.chargeCreatedAt },
        { clock: ports.clock, coverageNotices: ports.coverageNotices }
    );
    await emitAddonCoverageAdded({
        activated: [activated],
        coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
    });
    return { outcome: 'ACTIVATED', paymentId: activated.paymentId };
}
