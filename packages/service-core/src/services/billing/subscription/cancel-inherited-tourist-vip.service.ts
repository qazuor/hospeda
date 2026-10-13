import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { getDb, touristVipModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnum } from '@repo/schemas';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import type { BeforeCancelNotice } from './start-subscription.service';

const logger = createLogger('cancel-inherited-tourist-vip');

/** Reads whether the user's current effective plan grants Tourist VIP. */
export interface TouristVipInheritancePort {
    inherits(args: { readonly userId: string }): Promise<boolean>;
}

/** Dependencies used to cancel inherited paid Tourist VIP mandates safely. */
export interface CancelInheritedTouristVipPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly touristVipInheritance: TouristVipInheritancePort;
    /** Receives the post-commit `REMOVED` tourist notice (B4.2); defaults to the unwired logger. */
    readonly coverageNotices?: CoverageNotices;
}

/** Aggregate outcome of a cancellation clause or bounded retry sweep. */
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
    const notices = ports.coverageNotices ?? unwiredCoverageNotices;
    for (const row of rows) {
        const { subscription, providerLink } = row;
        let closed: boolean;
        let called = false;
        try {
            if (providerLink) {
                const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                actStartInstant({ act });
                const read = await ports.provider.readAuthorization({
                    authorizationId: providerLink.providerId
                });
                const { snapshot } = assertFreshForAct({ read, act });
                if (snapshot.status !== 'cancelled') {
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
                    called = true;
                }
            }
            const closedAt = ports.clock.now();
            closed = await getDb().transaction(async (tx) => {
                const wrote = await touristVipModel.closeCancelledVip({
                    subscriptionId: subscription.id,
                    now: closedAt,
                    tx
                });
                // Our call cancelled its own preapproval and nobody re-reads it: the sweep retries
                // it as the twelfth row (H3 → b, Coord-289; AC:B11:6). No link or an already
                // cancelled re-read means no call, so nothing is recorded.
                if (wrote && called) {
                    await recordProviderCancellationDecided({
                        subscriptionId: subscription.id,
                        transition: 'TOURIST_VIP_INHERITED',
                        decidedAt: closedAt,
                        actor: { type: 'job' },
                        correlationId: randomUUID(),
                        changes: [{ field: 'status', new: 'CANCELLED' }],
                        tx
                    });
                }
                return wrote;
            });
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'Inherited Tourist VIP could not be cancelled'
            );
            deferred++;
            continue;
        }
        if (!closed) {
            skipped++;
            continue;
        }
        cancelled++;
        // closeCancelledVip committed on its own: the tourist source is gone (I-5).
        try {
            await notices.emitCoverageChanged({
                userId: input.userId,
                vertical: VerticalEnum.TOURIST,
                sourceType: 'SUBSCRIPTION',
                change: 'REMOVED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'Coverage changed notice failed after Tourist VIP cancellation commit'
            );
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
