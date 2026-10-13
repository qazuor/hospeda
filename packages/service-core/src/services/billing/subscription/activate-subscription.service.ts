import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { activatePendingWithSignupNotice } from './activate-pending-with-signup-notice.js';
import {
    cancelInheritedTouristVips,
    type TouristVipInheritancePort
} from './cancel-inherited-tourist-vip.service';
import type { BeforeCancelNotice } from './start-subscription.service';

const logger = createLogger('subscription-activation');

export interface ActivateSubscriptionPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly touristVipInheritance: TouristVipInheritancePort;
    /** Receives the post-commit S2 notice (B4.2); defaults to the unwired logger. */
    readonly coverageNotices?: CoverageNotices;
}

export interface ActivateSubscriptionResult {
    readonly activated: boolean;
    readonly subscriptionId: string;
}

/** S2: only a fresh by-id provider read can authorize a still-pending row. */
export async function activateSubscription(
    subscriptionId: string,
    ports: ActivateSubscriptionPorts
): Promise<ActivateSubscriptionResult> {
    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

    if (row?.subscription.status !== 'PENDING_AUTHORIZATION' || !row.providerLink) {
        return { activated: false, subscriptionId };
    }

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({
        authorizationId: row.providerLink.providerId
    });
    const { snapshot } = assertFreshForAct({ read, act });
    if (snapshot.status !== 'active') return { activated: false, subscriptionId };

    const activated = await activatePendingWithSignupNotice({
        subscriptionId,
        now: ports.clock.now()
    });
    if (activated) {
        // S2 committed: the row now emits its source, replacing the predecessor's when it succeeds one.
        const vertical = VerticalEnumSchema.safeParse(row.subscription.vertical);
        if (row.subscription.userId && vertical.success) {
            try {
                await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
                    userId: row.subscription.userId,
                    vertical: vertical.data,
                    sourceType: 'SUBSCRIPTION',
                    change: row.subscription.succeedsId ? 'CHANGED' : 'ADDED'
                });
            } catch (error) {
                logger.error(
                    { subscriptionId, error },
                    'Coverage changed notice failed after activation commit'
                );
            }
        } else {
            logger.error(
                { subscriptionId, vertical: row.subscription.vertical },
                'Activated subscription has no coverage subject to notify'
            );
        }
    }
    if (activated && row.subscription.userId) {
        try {
            await cancelInheritedTouristVips({ userId: row.subscription.userId }, ports);
        } catch (error) {
            logger.error(
                { subscriptionId, error },
                'Inherited Tourist VIP cancellation will be retried'
            );
        }
    }
    return { activated, subscriptionId };
}
