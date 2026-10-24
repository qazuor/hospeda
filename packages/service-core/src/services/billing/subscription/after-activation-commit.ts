import type { Clock } from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
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
}

/** Runs the non-transactional S2 effects after activation has committed. */
export async function afterSubscriptionActivated(
    input: {
        readonly subscriptionId: string;
        readonly userId: string | null;
        readonly vertical: string | null;
        readonly succeedsId: string | null;
    },
    ports: AfterSubscriptionActivatedPorts
): Promise<{ readonly touristVipCancelled: number }> {
    const vertical = VerticalEnumSchema.safeParse(input.vertical);
    if (input.userId && vertical.success) {
        try {
            await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
                userId: input.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: input.succeedsId ? 'CHANGED' : 'ADDED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: input.subscriptionId, error },
                'Coverage changed notice failed after activation commit'
            );
        }
    } else {
        logger.error(
            { subscriptionId: input.subscriptionId, vertical: input.vertical },
            'Activated subscription has no coverage subject to notify'
        );
    }

    if (!input.userId || !ports.touristVipInheritance) {
        logger.warn(
            { subscriptionId: input.subscriptionId, userId: input.userId },
            'Tourist VIP clause not wired; the window-expiry sweep retries'
        );
        return { touristVipCancelled: 0 };
    }
    try {
        const result = await cancelInheritedTouristVips(
            { userId: input.userId },
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
            { subscriptionId: input.subscriptionId, error },
            'Inherited Tourist VIP cancellation will be retried'
        );
        return { touristVipCancelled: 0 };
    }
}
