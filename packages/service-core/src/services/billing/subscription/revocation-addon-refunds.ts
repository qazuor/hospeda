import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { addonInstances, addonProducts, and, desc, eq, inArray, payments } from '@repo/db';
import type { CancelledAddon } from '../addon/addon-instance-a5';
import { claimedRefundAmount, lockRefundSource } from '../refund/refund-source';
import { requestRefund } from '../refund/request-refund.service';
import { revocationWindowEndsAt } from './revocation-payment';

/** A refund requested for one orphaned one-time addon. */
export interface OneTimeAddonRefund {
    readonly instanceId: string;
    readonly refundId: string;
    readonly paymentId: string;
    readonly amount: number;
}

/**
 * Requests an RF1 for each recently credited one-time addon payment A5 cancelled.
 *
 * @param input.tx - The enclosing S36 transaction
 * @param input.cancelled - The instances A5 cancelled in that transaction
 * @param input.now - The instant of revocation
 * @param input.clock - The clock passed to RF1
 * @returns The refunds created, ordered by instance id
 */
export async function requestOneTimeAddonRefunds(input: {
    readonly tx: DrizzleClient;
    readonly cancelled: readonly CancelledAddon[];
    readonly now: Date;
    readonly clock: Clock;
}): Promise<{ readonly refunds: readonly OneTimeAddonRefund[] }> {
    const results: OneTimeAddonRefund[] = [];
    for (const { instanceId } of [...input.cancelled].sort((a, b) =>
        a.instanceId.localeCompare(b.instanceId)
    )) {
        const [instance] = await input.tx
            .select({ chargeKind: addonProducts.chargeKind })
            .from(addonInstances)
            .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
            .where(eq(addonInstances.id, instanceId))
            .limit(1);
        if (!instance) throw new Error(`Cancelled addon ${instanceId} disappeared`);
        if (instance.chargeKind !== 'UNA_VEZ') continue;
        const [payment] = await input.tx
            .select({ id: payments.id, amount: payments.amount, factAt: payments.factAt })
            .from(payments)
            .where(
                and(
                    eq(payments.addonInstanceId, instanceId),
                    inArray(payments.status, ['SUCCEEDED', 'PARTIALLY_REFUNDED'])
                )
            )
            .orderBy(desc(payments.factAt), desc(payments.createdAt), desc(payments.id))
            .limit(1);
        if (!payment || input.now >= revocationWindowEndsAt({ chargedAt: payment.factAt }))
            continue;
        const source = { kind: 'PAYMENT' as const, id: payment.id };
        const locked = await lockRefundSource({ tx: input.tx, source });
        if (locked.kind !== 'PAYMENT')
            throw new Error(`Addon payment ${payment.id} changed source`);
        const balance =
            locked.payment.amount - (await claimedRefundAmount({ tx: input.tx, source }));
        if (balance <= 0) continue;
        const { refundId } = await requestRefund(
            { source, amount: balance, reason: 'ONE_TIME_ADDON_REVOCATION' },
            { clock: input.clock, tx: input.tx }
        );
        results.push({ instanceId, refundId, paymentId: payment.id, amount: balance });
    }
    return { refunds: results };
}
