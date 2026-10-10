import type { Clock } from '@repo/billing-verticals-contract';
import { touristVipModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import type { BeforeCancelNotice } from './start-subscription.service';

const logger = createLogger('cancel-inherited-tourist-vip');

export interface TouristVipInheritancePort {
    inherits(args: { readonly userId: string }): Promise<boolean>;
}

export interface CancelInheritedTouristVipPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly touristVipInheritance: TouristVipInheritancePort;
}

export interface CancelInheritedTouristVipSummary {
    readonly cancelled: number;
    readonly deferred: number;
    readonly skipped: number;
}

/** S2 clause: cancel paid Tourist mandates only after fresh inheritance and notice decisions. */
export async function cancelInheritedTouristVips(
    input: { readonly userId: string },
    ports: CancelInheritedTouristVipPorts
): Promise<CancelInheritedTouristVipSummary> {
    if (!(await ports.touristVipInheritance.inherits({ userId: input.userId }))) {
        return { cancelled: 0, deferred: 0, skipped: 1 };
    }
    let cancelled = 0;
    let deferred = 0;
    let skipped = 0;
    const rows = await touristVipModel.findCancellableRows({ userId: input.userId });
    for (const row of rows) {
        const { subscription, providerLink } = row;
        try {
            if (!providerLink) {
                if (
                    await touristVipModel.closeCancelledVip({
                        subscriptionId: subscription.id,
                        now: ports.clock.now()
                    })
                )
                    cancelled++;
                else skipped++;
                continue;
            }
            const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
            actStartInstant({ act });
            const read = await ports.provider.readAuthorization({
                authorizationId: providerLink.providerId
            });
            const { snapshot } = assertFreshForAct({ read, act });
            if (snapshot.status === 'cancelled') {
                if (
                    await touristVipModel.closeCancelledVip({
                        subscriptionId: subscription.id,
                        now: ports.clock.now()
                    })
                )
                    cancelled++;
                else skipped++;
                continue;
            }
            const notice = await ports.beforeCancelNotice.beforeCancel({
                subscriptionId: subscription.id,
                userId: input.userId,
                kind: 'TOURIST_VIP_INHERITED'
            });
            if (notice === 'NOT_YET_SENT') {
                deferred++;
                continue;
            }
            if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED') {
                logger.warn(
                    { subscriptionId: subscription.id, notice },
                    'Inherited Tourist VIP notice is not deliverable'
                );
            }
            await ports.provider.cancel({ authorizationId: providerLink.providerId });
            if (
                await touristVipModel.closeCancelledVip({
                    subscriptionId: subscription.id,
                    now: ports.clock.now()
                })
            )
                cancelled++;
            else skipped++;
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'Inherited Tourist VIP could not be cancelled'
            );
            deferred++;
        }
    }
    return { cancelled, deferred, skipped };
}

/** Bounded retry sweep; its candidate query does not decide whether the plan inherits VIP. */
export async function sweepInheritedTouristVips(
    limit: number,
    ports: CancelInheritedTouristVipPorts
): Promise<CancelInheritedTouristVipSummary> {
    const userIds = await touristVipModel.findUserIdsWithCancellableVip({ limit });
    const totals = { cancelled: 0, deferred: 0, skipped: 0 };
    for (const userId of userIds) {
        const result = await cancelInheritedTouristVips({ userId }, ports);
        totals.cancelled += result.cancelled;
        totals.deferred += result.deferred;
        totals.skipped += result.skipped;
    }
    return totals;
}
