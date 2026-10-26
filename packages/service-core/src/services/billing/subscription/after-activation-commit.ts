import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import { billingOptions, eq, getDb, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { type BillingFactSink, emitBillingFact } from '../facts/billing-fact-sink.js';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import {
    cancelInheritedTouristVips,
    type TouristVipInheritancePort
} from './cancel-inherited-tourist-vip.service';
import type { BeforeCancelNotice } from './start-subscription.service';

const logger = createLogger('subscription-activation');

export interface AfterSubscriptionActivatedPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly touristVipInheritance?: TouristVipInheritancePort;
    readonly coverageNotices?: CoverageNotices;
    readonly billingFacts?: BillingFactSink;
    readonly changeDirection?: VerticalsForBilling['changeDirection'];
}

/** Runs the non-transactional S2 effects after activation has committed. */
export async function afterSubscriptionActivated(
    input: {
        readonly subscription: {
            readonly id: string;
            readonly userId: string | null;
            readonly vertical: string | null;
            readonly succeedsId: string | null;
        };
    },
    ports: AfterSubscriptionActivatedPorts
): Promise<{ readonly touristVipCancelled: number }> {
    const subscription = input.subscription;
    if (subscription.userId) {
        try {
            const [row] = await getDb()
                .select({ subscription: subscriptions, option: billingOptions })
                .from(subscriptions)
                .innerJoin(billingOptions, eq(subscriptions.billingOptionId, billingOptions.id))
                .where(eq(subscriptions.id, subscription.id))
                .limit(1);
            if (
                row?.subscription.class === 'PRINCIPAL' &&
                row.subscription.vertical &&
                row.subscription.planVersionId
            ) {
                const verticalFact = VerticalEnumSchema.safeParse(row.subscription.vertical);
                if (verticalFact.success) {
                    let predecessor: Extract<
                        import('../facts/billing-fact-sink.js').BillingFact,
                        { kind: 'SUBSCRIPTION_ACTIVATED' }
                    >['predecessor'];
                    if (row.subscription.succeedsId) {
                        const [previous] = await getDb()
                            .select({ subscription: subscriptions, option: billingOptions })
                            .from(subscriptions)
                            .innerJoin(
                                billingOptions,
                                eq(subscriptions.billingOptionId, billingOptions.id)
                            )
                            .where(eq(subscriptions.id, row.subscription.succeedsId))
                            .limit(1);
                        if (previous?.subscription.planVersionId) {
                            let verdict:
                                | Awaited<ReturnType<NonNullable<typeof ports.changeDirection>>>
                                | undefined;
                            try {
                                verdict = await ports.changeDirection?.({
                                    fromPlanVersionId: previous.subscription.planVersionId,
                                    toPlanVersionId: row.subscription.planVersionId
                                });
                            } catch (error) {
                                logger.warn(
                                    { subscriptionId: subscription.id, error },
                                    'Plan change direction lookup failed; reporting lateral'
                                );
                            }
                            const direction =
                                verdict?.direction === 'UP'
                                    ? 'UPGRADE'
                                    : verdict?.direction === 'DOWN'
                                      ? 'DOWNGRADE'
                                      : 'LATERAL';
                            if (!ports.changeDirection)
                                logger.warn(
                                    { subscriptionId: subscription.id },
                                    'Change direction unavailable; reporting lateral plan change'
                                );
                            predecessor = {
                                planVersionId: previous.subscription.planVersionId,
                                cycle: previous.option.cycle as
                                    | 'monthly'
                                    | 'quarterly'
                                    | 'semiannual'
                                    | 'annual',
                                amountMinor: previous.option.amount,
                                direction
                            };
                        }
                    }
                    const fact = {
                        kind: 'SUBSCRIPTION_ACTIVATED' as const,
                        userId: subscription.userId,
                        vertical: verticalFact.data,
                        subscriptionId: subscription.id,
                        subscriptionClass: 'PRINCIPAL' as const,
                        actorKind: 'SYSTEM' as const,
                        planVersionId: row.subscription.planVersionId,
                        billingOptionId: row.option.id,
                        cycle: row.option.cycle as
                            | 'monthly'
                            | 'quarterly'
                            | 'semiannual'
                            | 'annual',
                        amountMinor: row.option.amount,
                        currency: row.option.currency as 'ARS',
                        predecessor,
                        occurredAt: ports.clock.now()
                    };
                    emitBillingFact({ sink: ports.billingFacts, fact });
                }
            }
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'Activation analytics fact lookup failed after commit'
            );
        }
    }
    const vertical = VerticalEnumSchema.safeParse(subscription.vertical);
    if (subscription.userId && vertical.success) {
        try {
            await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
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

    if (!subscription.userId || !ports.touristVipInheritance) {
        logger.warn(
            { subscriptionId: subscription.id, userId: subscription.userId },
            'Tourist VIP clause not wired; the window-expiry sweep retries'
        );
        return { touristVipCancelled: 0 };
    }
    try {
        const result = await cancelInheritedTouristVips(
            { userId: subscription.userId },
            {
                provider: ports.provider,
                clock: ports.clock,
                beforeCancelNotice: ports.beforeCancelNotice,
                touristVipInheritance: ports.touristVipInheritance,
                coverageNotices: ports.coverageNotices
            }
        );
        return { touristVipCancelled: result.cancelled };
    } catch (error) {
        logger.error(
            { subscriptionId: subscription.id, error },
            'Inherited Tourist VIP cancellation will be retried'
        );
        return { touristVipCancelled: 0 };
    }
}
