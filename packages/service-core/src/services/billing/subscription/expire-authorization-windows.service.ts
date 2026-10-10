import type { Clock } from '@repo/billing-verticals-contract';
import { getDb, subscriptionModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { enqueueSignupIncompleteNotice } from './signup-incomplete-notice.ts';
import type { BeforeCancelNotice } from './start-subscription.service';

const logger = createLogger('subscription-window-expiry');

export interface ExpireAuthorizationWindowsPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
}

export interface ExpireAuthorizationWindowsSummary {
    readonly abandoned: number;
    readonly activated: number;
    readonly cancelCalls: number;
    readonly noticePending: number;
    readonly skipped: number;
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
                const wrote = await subscriptionModel.activatePendingAuthorization({
                    subscriptionId: subscription.id,
                    now: ports.clock.now()
                });
                if (wrote) activated++;
                else skipped++;
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

        const result = await getDb().transaction(async (tx) => {
            const wrote = await subscriptionModel.abandonPendingAuthorization({
                subscriptionId: subscription.id,
                now: ports.clock.now(),
                tx
            });
            if (wrote.wrote) {
                await enqueueSignupIncompleteNotice({
                    tx,
                    subscription,
                    closedCourtesyMonths: wrote.closedCourtesyMonths
                });
            }
            return wrote;
        });
        if (result.wrote) abandoned++;
        else skipped++;
    }

    return { abandoned, activated, cancelCalls, noticePending, skipped };
}
