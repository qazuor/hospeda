import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { getDb, subscriptionModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import { activatePendingWithSignupNotice } from './activate-pending-with-signup-notice.js';
import {
    cancelInheritedTouristVips,
    type TouristVipInheritancePort
} from './cancel-inherited-tourist-vip.service';
import { enqueueSignupIncompleteNotice } from './signup-incomplete-notice.ts';
import type { BeforeCancelNotice } from './start-subscription.service';

const logger = createLogger('subscription-window-expiry');

export interface ExpireAuthorizationWindowsPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly touristVipInheritance: TouristVipInheritancePort;
    /** Receives the post-commit S2 notice (B4.2); defaults to the unwired logger. */
    readonly coverageNotices?: CoverageNotices;
}

export interface ExpireAuthorizationWindowsSummary {
    readonly abandoned: number;
    readonly activated: number;
    readonly cancelCalls: number;
    readonly noticePending: number;
    readonly skipped: number;
    readonly touristVipCancelled: number;
}

/** S3: stored row deadlines determine eligibility; provider state is re-read by id. */
export async function expireAuthorizationWindows(
    limit: number,
    ports: ExpireAuthorizationWindowsPorts
): Promise<ExpireAuthorizationWindowsSummary> {
    const rows = await subscriptionModel.findExpiredAuthorizationWindows({
        now: ports.clock.now(),
        limit
    });
    let abandoned = 0;
    let activated = 0;
    let cancelCalls = 0;
    let noticePending = 0;
    let skipped = 0;
    let touristVipCancelled = 0;

    for (const row of rows) {
        const { subscription, providerLink } = row;
        if (subscription.paymentMethod !== 'MANUAL' && providerLink) {
            const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
            actStartInstant({ act });
            const read = await ports.provider.readAuthorization({
                authorizationId: providerLink.providerId
            });
            const { snapshot } = assertFreshForAct({ read, act });

            if (snapshot.status === 'active') {
                const wrote = await activatePendingWithSignupNotice({
                    subscriptionId: subscription.id,
                    now: ports.clock.now()
                });
                if (wrote) activated++;
                else skipped++;
                if (wrote) {
                    // S2 committed: the row now emits its source, replacing the predecessor's when it succeeds one.
                    const vertical = VerticalEnumSchema.safeParse(subscription.vertical);
                    if (subscription.userId && vertical.success) {
                        try {
                            await (
                                ports.coverageNotices ?? unwiredCoverageNotices
                            ).emitCoverageChanged({
                                userId: subscription.userId,
                                vertical: vertical.data,
                                sourceType: 'SUBSCRIPTION',
                                change: subscription.succeedsId ? 'CHANGED' : 'ADDED'
                            });
                        } catch (error) {
                            logger.error(
                                { subscriptionId: subscription.id, error },
                                'Coverage changed notice failed after activation commit'
                            );
                        }
                    } else {
                        logger.error(
                            { subscriptionId: subscription.id, vertical: subscription.vertical },
                            'Activated subscription has no coverage subject to notify'
                        );
                    }
                }
                if (wrote && subscription.userId) {
                    try {
                        const result = await cancelInheritedTouristVips(
                            { userId: subscription.userId },
                            ports
                        );
                        touristVipCancelled += result.cancelled;
                    } catch (error) {
                        logger.error(
                            { subscriptionId: subscription.id, error },
                            'Inherited Tourist VIP cancellation will be retried'
                        );
                    }
                }
                continue;
            }

            if (snapshot.status !== 'cancelled') {
                const notice = await ports.beforeCancelNotice.beforeCancel({
                    subscriptionId: subscription.id,
                    userId: subscription.userId!
                });
                if (notice === 'NOT_YET_SENT') {
                    noticePending++;
                } else {
                    if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED') {
                        logger.warn(
                            { subscriptionId: subscription.id, notice },
                            'Before-cancel notice is not deliverable'
                        );
                    }
                    cancelCalls++;
                    try {
                        await ports.provider.cancel({ authorizationId: providerLink.providerId });
                    } catch (error) {
                        logger.error(
                            { subscriptionId: subscription.id, error },
                            'Expired authorization could not be cancelled'
                        );
                    }
                }
            }
        }

        const abandonedAt = ports.clock.now();
        const result = await getDb().transaction(async (tx) => {
            const wrote = await subscriptionModel.abandonPendingAuthorization({
                subscriptionId: subscription.id,
                now: abandonedAt,
                tx
            });
            if (wrote.wrote) {
                await enqueueSignupIncompleteNotice({
                    tx,
                    subscription,
                    closedCourtesyMonths: wrote.closedCourtesyMonths
                });
                // S3 decided the cancellation even when the notice deferred the call: the sweep
                // finishes it (AC:B11:6). A manual payer had no call, so it records nothing.
                if (subscription.paymentMethod !== 'MANUAL' && providerLink) {
                    await recordProviderCancellationDecided({
                        subscriptionId: subscription.id,
                        transition: 'S3',
                        decidedAt: abandonedAt,
                        actor: { type: 'job' },
                        correlationId: randomUUID(),
                        changes: [
                            { field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }
                        ],
                        tx
                    });
                }
            }
            return wrote;
        });
        if (result.wrote) abandoned++;
        else skipped++;
    }

    return { abandoned, activated, cancelCalls, noticePending, skipped, touristVipCancelled };
}
